import { corsHeaders } from "../_shared/cors.ts";
import { assertAdmin } from "../_shared/demo.ts";

type AppRole = "admin" | "receptionist" | "attendant" | "professional" | "public_display";

const roleSet = new Set<AppRole>([
  "admin",
  "receptionist",
  "attendant",
  "professional",
  "public_display",
]);

type CreateBody = {
  action: "create";
  email: string;
  fullName: string;
  role: AppRole;
  active?: boolean;
  password?: string;
};

type UpdateBody = {
  action: "update";
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  active: boolean;
  password?: string;
};

type DeleteBody = {
  action: "delete";
  userId: string;
};

type Body = CreateBody | UpdateBody | DeleteBody;

type SuperadminCreateClinicBody = {
  action: "superadmin_create_clinic_with_admin";
  clinic: Record<string, unknown>;
  name: string;
  email: string;
  phone?: string | null;
  tempPassword: string;
  roomsCount?: number;
  receptionsCount?: number;
  ticketPrefix?: string;
};

function ensureRole(role: string): AppRole {
  if (!roleSet.has(role as AppRole)) {
    throw new Error("Papel de acesso inválido.");
  }
  return role as AppRole;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function randomPassword() {
  const base = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `Tmp@${base}A1`;
}

async function findAuthUserIdByEmail(
  serviceClient: ReturnType<typeof assertAdmin> extends Promise<infer T>
    ? T["serviceClient"]
    : never,
  email: string,
) {
  const normalized = normalizeEmail(email);
  let page = 1;
  const perPage = 200;

  while (true) {
    const listed = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (listed.error) throw listed.error;

    const users = listed.data.users ?? [];
    const found = users.find((user) => (user.email ?? "").toLowerCase() === normalized);
    if (found?.id) return found.id;

    if (users.length < perPage) return null;
    page += 1;
  }
}

async function ensureClinicProfile(
  serviceClient: ReturnType<typeof assertAdmin> extends Promise<infer T>
    ? T["serviceClient"]
    : never,
  clinicId: string,
  payload: { id: string; email: string; fullName: string; role: AppRole; active: boolean },
) {
  const { error } = await serviceClient.from("profiles").upsert(
    {
      id: payload.id,
      clinic_id: clinicId,
      email: normalizeEmail(payload.email),
      full_name: payload.fullName.trim(),
      role: payload.role,
      active: payload.active,
    },
    { onConflict: "id" },
  );
  if (error) throw error;

  if (payload.role === "professional") {
    await serviceClient
      .from("professionals")
      .update({ profile_id: payload.id })
      .eq("clinic_id", clinicId)
      .eq("email", normalizeEmail(payload.email));
  }
}

async function getClinicProfile(
  serviceClient: ReturnType<typeof assertAdmin> extends Promise<infer T>
    ? T["serviceClient"]
    : never,
  clinicId: string,
  userId: string,
) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, role, active")
    .eq("clinic_id", clinicId)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Usuário não pertence a esta clínica.");
  return data as { id: string; role: AppRole; active: boolean };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método não suportado." }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");

  try {
    const admin = await assertAdmin(authHeader);
    const body = (await req.json()) as Body | SuperadminCreateClinicBody;

    if (body.action === "superadmin_create_clinic_with_admin") {
      if (admin.userId === null) throw new Error("Usuário inválido.");
      const profile = await admin.serviceClient
        .from("profiles")
        .select("role")
        .eq("id", admin.userId)
        .single();
      if (profile.error) throw profile.error;
      if ((profile.data as { role: string }).role !== "superadmin") {
        throw new Error("Apenas superadmin pode criar clínicas.");
      }

      const clinicInsert = await admin.serviceClient
        .from("clinics")
        .insert(body.clinic)
        .select("id")
        .single();
      if (clinicInsert.error) throw clinicInsert.error;
      const clinicId = (clinicInsert.data as { id: string }).id;

      const createdUser = await admin.serviceClient.auth.admin.createUser({
        email: normalizeEmail(body.email),
        password: body.tempPassword,
        email_confirm: true,
        user_metadata: { full_name: body.name },
      });
      if (createdUser.error) throw createdUser.error;

      const userId = createdUser.data.user.id;
      await ensureClinicProfile(admin.serviceClient, clinicId, {
        id: userId,
        email: body.email,
        fullName: body.name,
        role: "admin",
        active: true,
      });

      const roomsCount = Math.max(0, Number(body.roomsCount ?? 0));
      for (let i = 1; i <= roomsCount; i += 1) {
        await admin.serviceClient.from("rooms").insert({
          clinic_id: clinicId,
          name: `Sala ${i}`,
          number: `${i}`,
          active: true,
        });
      }

      const receptionsCount = Math.max(0, Number(body.receptionsCount ?? 0));
      for (let i = 1; i <= receptionsCount; i += 1) {
        await admin.serviceClient.from("receptions" as never).insert({
          clinic_id: clinicId,
          name: `Guichê ${i}`,
          location: "Recepção",
          active: true,
        } as never);
      }

      return new Response(JSON.stringify({ ok: true, clinicId, adminUserId: userId }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (body.action === "create") {
      const email = normalizeEmail(body.email ?? "");
      const fullName = (body.fullName ?? "").trim();
      const role = ensureRole(body.role ?? "");
      const active = body.active ?? true;

      if (!email) throw new Error("E-mail obrigatório.");
      if (fullName.length < 2) throw new Error("Nome obrigatório.");

      const existingUserId = await findAuthUserIdByEmail(admin.serviceClient, email);
      const suppliedPassword = body.password?.trim();
      const effectivePassword =
        suppliedPassword && suppliedPassword.length >= 8 ? suppliedPassword : randomPassword();

      let userId = existingUserId;
      let created = false;

      if (!userId) {
        const createdUser = await admin.serviceClient.auth.admin.createUser({
          email,
          password: effectivePassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (createdUser.error) throw createdUser.error;
        userId = createdUser.data.user.id;
        created = true;
      } else {
        const updatedUser = await admin.serviceClient.auth.admin.updateUserById(userId, {
          email,
          password: effectivePassword,
          user_metadata: { full_name: fullName },
        });
        if (updatedUser.error) throw updatedUser.error;
      }

      await ensureClinicProfile(admin.serviceClient, admin.clinicId, {
        id: userId,
        email,
        fullName,
        role,
        active,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          action: "create",
          created,
          user: { id: userId, email, fullName, role, active },
          generatedPassword: effectivePassword,
        }),
        { headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    if (body.action === "update") {
      const target = await getClinicProfile(admin.serviceClient, admin.clinicId, body.userId);
      const email = normalizeEmail(body.email ?? "");
      const fullName = (body.fullName ?? "").trim();
      const role = ensureRole(body.role ?? "");
      const active = Boolean(body.active);

      if (!email) throw new Error("E-mail obrigatório.");
      if (fullName.length < 2) throw new Error("Nome obrigatório.");

      if (target.id === admin.userId && (!active || role !== "admin")) {
        throw new Error("Não é permitido remover seu próprio acesso de administrador.");
      }

      const updatePayload: {
        email: string;
        user_metadata: { full_name: string };
        password?: string;
      } = {
        email,
        user_metadata: { full_name: fullName },
      };

      const password = body.password?.trim();
      if (password) {
        if (password.length < 8) throw new Error("Senha deve ter pelo menos 8 caracteres.");
        updatePayload.password = password;
      }

      const updatedAuth = await admin.serviceClient.auth.admin.updateUserById(
        body.userId,
        updatePayload,
      );
      if (updatedAuth.error) throw updatedAuth.error;

      const { error } = await admin.serviceClient
        .from("profiles")
        .update({ email, full_name: fullName, role, active })
        .eq("clinic_id", admin.clinicId)
        .eq("id", body.userId);
      if (error) throw error;

      if (role === "professional") {
        await admin.serviceClient
          .from("professionals")
          .update({ profile_id: body.userId, email })
          .eq("clinic_id", admin.clinicId)
          .eq("profile_id", body.userId);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          action: "update",
          user: { id: body.userId, email, fullName, role, active },
        }),
        { headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    if (body.action === "delete") {
      const target = await getClinicProfile(admin.serviceClient, admin.clinicId, body.userId);
      if (target.id === admin.userId) {
        throw new Error("Não é permitido remover seu próprio usuário.");
      }

      if (target.role === "admin") {
        const { count, error: countError } = await admin.serviceClient
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", admin.clinicId)
          .eq("role", "admin")
          .eq("active", true);
        if (countError) throw countError;
        if ((count ?? 0) <= 1) {
          throw new Error("Não é permitido remover o último administrador ativo da clínica.");
        }
      }

      await admin.serviceClient
        .from("attendants")
        .delete()
        .eq("clinic_id", admin.clinicId)
        .eq("profile_id", body.userId);

      await admin.serviceClient
        .from("professionals")
        .update({ profile_id: null })
        .eq("clinic_id", admin.clinicId)
        .eq("profile_id", body.userId);

      const deletedAuth = await admin.serviceClient.auth.admin.deleteUser(body.userId);
      if (deletedAuth.error) throw deletedAuth.error;

      await admin.serviceClient
        .from("profiles")
        .delete()
        .eq("clinic_id", admin.clinicId)
        .eq("id", body.userId);

      return new Response(JSON.stringify({ ok: true, action: "delete", userId: body.userId }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    throw new Error("Ação inválida.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});

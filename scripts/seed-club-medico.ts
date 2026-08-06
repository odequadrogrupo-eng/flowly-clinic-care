import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type DemoUser = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "receptionist" | "attendant" | "professional" | "public_display";
  professionalName?: string;
};

const REQUIRED_CONFIRMATION = "CLUB_MEDICO_DEMO";

const demoUsers: DemoUser[] = [
  {
    name: "Administrador Club Medico",
    email: "admin@clubmedico.teste",
    password: "ClubMedico@2026",
    role: "admin",
  },
  {
    name: "Juliana Ferreira",
    email: "recepcao@clubmedico.teste",
    password: "Recepcao@2026",
    role: "receptionist",
  },
  {
    name: "Marcos Oliveira",
    email: "atendimento@clubmedico.teste",
    password: "Atendimento@2026",
    role: "attendant",
  },
  {
    name: "Painel Club Medico",
    email: "painel@clubmedico.teste",
    password: "Painel@2026",
    role: "public_display",
  },
  {
    name: "Dra. Ana Martins",
    email: "ana.martins@clubmedico.teste",
    password: "AnaMedica@2026",
    role: "professional",
    professionalName: "Dra. Ana Martins",
  },
  {
    name: "Dr. Bruno Lima",
    email: "bruno.lima@clubmedico.teste",
    password: "BrunoMedico@2026",
    role: "professional",
    professionalName: "Dr. Bruno Lima",
  },
  {
    name: "Dra. Carla Souza",
    email: "carla.souza@clubmedico.teste",
    password: "CarlaMedica@2026",
    role: "professional",
    professionalName: "Dra. Carla Souza",
  },
  {
    name: "Dr. Diego Alves",
    email: "diego.alves@clubmedico.teste",
    password: "DiegoMedico@2026",
    role: "professional",
    professionalName: "Dr. Diego Alves",
  },
  {
    name: "Dra. Elisa Rocha",
    email: "elisa.rocha@clubmedico.teste",
    password: "ElisaMedica@2026",
    role: "professional",
    professionalName: "Dra. Elisa Rocha",
  },
];

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function getAllAuthUsers(supabase: ReturnType<typeof createClient>) {
  const users: Array<{ id: string; email: string | undefined }> = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const batch = data.users ?? [];
    for (const user of batch) {
      users.push({ id: user.id, email: user.email?.toLowerCase() });
    }
    if (batch.length < 200) break;
    page += 1;
  }

  return users;
}

async function main() {
  if (process.env.SEED_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Seed blocked. Set SEED_CONFIRM=${REQUIRED_CONFIRMATION} to confirm creation/update of demo Auth users.`,
    );
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  console.log("[seed] Running SQL seed function...");
  const { data: seedResult, error: seedError } = await supabase.rpc("seed_demo_clinic", {
    _clinic_name: "Club Medico",
  });
  if (seedError) throw seedError;

  const clinicId = (seedResult as { clinic_id?: string } | null)?.clinic_id;
  if (!clinicId) {
    throw new Error("seed_demo_clinic did not return clinic_id");
  }

  console.log("[seed] Ensuring storage bucket and logo...");
  const bucketName = "brand-assets";
  const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
  if (bucketListError) throw bucketListError;

  if (!(buckets ?? []).some((bucket) => bucket.name === bucketName)) {
    const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
    if (createBucketError) throw createBucketError;
  }

  const logoAbsolutePath = path.resolve(process.cwd(), "public/brands/club-medico/logo.png");
  let logoUrl = "/brands/club-medico/logo.png";
  try {
    const logoBuffer = await fs.readFile(logoAbsolutePath);
    const storagePath = "brands/club-medico/logo.png";
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, logoBuffer, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const publicData = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    logoUrl = publicData.data.publicUrl;
  } catch (error) {
    console.warn(`[seed] Logo upload skipped. File not found at ${logoAbsolutePath}.`, error);
  }

  const { error: clinicLogoError } = await supabase
    .from("clinics" as never)
    .update({ logo_url: logoUrl } as never)
    .eq("id", clinicId);
  if (clinicLogoError) throw clinicLogoError;

  const { error: kioskLogoError } = await supabase
    .from("kiosk_settings" as never)
    .update({ logo_url: logoUrl } as never)
    .eq("clinic_id", clinicId);
  if (kioskLogoError) throw kioskLogoError;

  console.log("[seed] Ensuring Supabase Auth users and profiles...");
  const allUsers = await getAllAuthUsers(supabase);
  const userByEmail = new Map(allUsers.map((u) => [u.email, u.id]));

  const createdOrUpdatedUsers: Array<{ id: string; email: string; role: DemoUser["role"] }> = [];

  for (const demoUser of demoUsers) {
    const email = demoUser.email.toLowerCase();
    const existingId = userByEmail.get(email);

    let userId = existingId;
    if (!userId) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: demoUser.password,
        email_confirm: true,
        user_metadata: {
          full_name: demoUser.name,
          demo_seed: "club_medico",
        },
      });
      if (createError) throw createError;
      userId = created.user.id;
      userByEmail.set(email, userId);
    } else {
      const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, {
        password: demoUser.password,
        email,
        user_metadata: {
          full_name: demoUser.name,
          demo_seed: "club_medico",
        },
      });
      if (updateUserError) throw updateUserError;
    }

    const { error: profileError } = await supabase
      .from("profiles" as never)
      .upsert(
        {
          id: userId,
          clinic_id: clinicId,
          full_name: demoUser.name,
          email,
          role: demoUser.role,
          active: true,
          force_password_change: true,
          temp_password_issued_at: new Date().toISOString(),
        } as never,
        { onConflict: "id" },
      );
    if (profileError) throw profileError;

    createdOrUpdatedUsers.push({ id: userId, email, role: demoUser.role });
  }

  // Link attendant table
  const attendantProfile = createdOrUpdatedUsers.find((user) => user.role === "attendant");
  if (attendantProfile) {
    const { data: receptionData } = await supabase
      .from("receptions" as never)
      .select("id" as never)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const receptionId = (receptionData as { id: string } | null)?.id ?? null;

    const { error: attendantError } = await supabase
      .from("attendants" as never)
      .upsert(
        {
          clinic_id: clinicId,
          profile_id: attendantProfile.id,
          reception_id: receptionId,
          display_name: "Marcos Oliveira",
          active: true,
        } as never,
        { onConflict: "clinic_id,profile_id" },
      );
    if (attendantError) throw attendantError;
  }

  // Link professionals with profile users by email.
  for (const doctor of createdOrUpdatedUsers.filter((user) => user.role === "professional")) {
    const doctorSpec = demoUsers.find((item) => item.email.toLowerCase() === doctor.email);
    if (!doctorSpec?.professionalName) continue;

    const { error: profUpdateError } = await supabase
      .from("professionals" as never)
      .update({ profile_id: doctor.id, email: doctor.email } as never)
      .eq("clinic_id", clinicId)
      .eq("full_name", doctorSpec.professionalName);

    if (profUpdateError) throw profUpdateError;
  }

  // Add audit entries for login/config changes by admin actor.
  const adminId = createdOrUpdatedUsers.find((user) => user.role === "admin")?.id ?? null;
  if (adminId) {
    const logs = [
      "login",
      "create_patient",
      "update_patient",
      "issue_ticket",
      "call",
      "repeat_call",
      "start_service",
      "finish_service",
      "cancel",
      "transfer",
      "change_priority",
      "update_settings",
    ];

    for (const action of logs) {
      const seedKey = `club-medico-auth-${action}`;
      const { data: existing } = await supabase
        .from("audit_logs")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("action", action)
        .contains("details", { seed_key: seedKey })
        .limit(1);

      if ((existing ?? []).length > 0) continue;

      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert({
          clinic_id: clinicId,
          user_id: adminId,
          action,
          entity: "seed_demo",
          details: { seed_key: seedKey, source: "scripts/seed-club-medico.ts" },
        });
      if (auditError) throw auditError;
    }
  }

  const [{ count: patientsCount }, { count: queuesCount }, { count: ticketsCount }] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("queues").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    supabase.from("tickets" as never).select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
  ]);

  const { data: kioskTokenData } = await supabase
    .from("kiosk_settings" as never)
    .select("public_token" as never)
    .eq("clinic_id", clinicId)
    .single();

  const { data: panelTokenData } = await supabase
    .from("panel_settings" as never)
    .select("public_token" as never)
    .eq("clinic_id", clinicId)
    .single();

  const kioskToken = (kioskTokenData as { public_token: string } | null)?.public_token;
  const panelToken = (panelTokenData as { public_token: string } | null)?.public_token;

  console.log("[seed] Done");
  console.log(
    JSON.stringify(
      {
        clinic_id: clinicId,
        logo_url: logoUrl,
        users_total: createdOrUpdatedUsers.length,
        patients_total: patientsCount ?? 0,
        queues_total: queuesCount ?? 0,
        tickets_total: ticketsCount ?? 0,
        totem_url: kioskToken ? `${appBaseUrl}/totem/${kioskToken}` : null,
        panel_url: panelToken ? `${appBaseUrl}/painel/${panelToken}` : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[seed] Failed", error);
  process.exitCode = 1;
});

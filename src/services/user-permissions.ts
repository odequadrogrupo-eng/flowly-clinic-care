import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type InviteRow = {
  id: string;
  clinic_id: string;
  email: string;
  role: AppRole;
  invite_token: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const inviteSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  role: z.enum(["admin", "receptionist", "attendant", "professional", "public_display"]),
});

const updateUserSchema = z.object({
  role: z.enum(["admin", "receptionist", "attendant", "professional", "public_display"]),
  active: z.boolean(),
  full_name: z.string().trim().min(2, "Nome obrigatorio."),
});

export async function listClinicUsers(clinicId: string): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function updateClinicUser(
  clinicId: string,
  profileId: string,
  input: { role: AppRole; active: boolean; full_name: string },
  currentUserId: string,
) {
  const data = updateUserSchema.parse(input);
  if (profileId === currentUserId && (!data.active || data.role !== "admin")) {
    throw new Error("Nao e permitido remover seu proprio acesso de administrador.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: data.role, active: data.active, full_name: data.full_name })
    .eq("id", profileId)
    .eq("clinic_id", clinicId);

  if (error) throw error;
}

export async function createClinicInvite(
  clinicId: string,
  clinicName: string,
  createdBy: string,
  input: { email: string; role: AppRole },
) {
  const data = inviteSchema.parse(input);

  const { data: inserted, error } = await supabase
    .from("clinic_invites" as never)
    .insert({
      clinic_id: clinicId,
      email: data.email.toLowerCase(),
      role: data.role,
      created_by: createdBy,
    } as never)
    .select(
      "id, clinic_id, email, role, invite_token, expires_at, accepted_at, revoked_at, created_at",
    )
    .single();

  if (error) throw error;

  const invite = inserted as unknown as InviteRow;
  const inviteUrl = new URL("/auth", window.location.origin);
  inviteUrl.searchParams.set("mode", "signup");
  inviteUrl.searchParams.set("invite", invite.invite_token);
  inviteUrl.searchParams.set("role", invite.role);
  inviteUrl.searchParams.set("email", invite.email);
  inviteUrl.searchParams.set("clinic", clinicName);

  return { invite, inviteUrl: inviteUrl.toString() };
}

export async function listPendingInvites(clinicId: string): Promise<InviteRow[]> {
  const { data, error } = await supabase
    .from("clinic_invites" as never)
    .select(
      "id, clinic_id, email, role, invite_token, expires_at, accepted_at, revoked_at, created_at",
    )
    .eq("clinic_id", clinicId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as InviteRow[];
}

export async function revokeInvite(clinicId: string, inviteId: string) {
  const { error } = await supabase
    .from("clinic_invites" as never)
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("id", inviteId)
    .eq("clinic_id", clinicId)
    .is("accepted_at", null);

  if (error) throw error;
}

const createClinicAuthUserSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  fullName: z.string().trim().min(2, "Nome obrigatorio."),
  role: z.enum(["admin", "receptionist", "attendant", "professional", "public_display"]),
  active: z.boolean().default(true),
  password: z
    .string()
    .trim()
    .min(8, "Senha deve ter pelo menos 8 caracteres.")
    .max(128, "Senha muito longa.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
});

const updateClinicAuthUserSchema = z.object({
  userId: z.string().uuid("Usuário inválido."),
  email: z.string().trim().email("Informe um e-mail valido."),
  fullName: z.string().trim().min(2, "Nome obrigatorio."),
  role: z.enum(["admin", "receptionist", "attendant", "professional", "public_display"]),
  active: z.boolean(),
  password: z
    .string()
    .trim()
    .min(8, "Senha deve ter pelo menos 8 caracteres.")
    .max(128, "Senha muito longa.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
});

export async function createClinicAuthUser(input: {
  email: string;
  fullName: string;
  role: AppRole;
  active?: boolean;
  password?: string;
}) {
  const payload = createClinicAuthUserSchema.parse(input);
  const { data, error } = await supabase.functions.invoke("manage-clinic-users", {
    body: { action: "create", ...payload },
  });
  if (error) throw error;

  const result = data as
    | {
        ok: true;
        action: "create";
        created: boolean;
        user: { id: string; email: string; fullName: string; role: AppRole; active: boolean };
        generatedPassword: string;
      }
    | { ok: false; error: string };

  if (!result?.ok) {
    throw new Error(result?.error ?? "Não foi possível criar usuário.");
  }

  return result;
}

export async function updateClinicAuthUser(input: {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  active: boolean;
  password?: string;
}) {
  const payload = updateClinicAuthUserSchema.parse(input);
  const { data, error } = await supabase.functions.invoke("manage-clinic-users", {
    body: { action: "update", ...payload },
  });
  if (error) throw error;

  const result = data as
    | {
        ok: true;
        action: "update";
        user: { id: string; email: string; fullName: string; role: AppRole; active: boolean };
      }
    | { ok: false; error: string };

  if (!result?.ok) {
    throw new Error(result?.error ?? "Não foi possível atualizar usuário.");
  }

  return result;
}

export async function deleteClinicAuthUser(userId: string) {
  const { data, error } = await supabase.functions.invoke("manage-clinic-users", {
    body: { action: "delete", userId },
  });
  if (error) throw error;

  const result = data as
    | { ok: true; action: "delete"; userId: string }
    | { ok: false; error: string };

  if (!result?.ok) {
    throw new Error(result?.error ?? "Não foi possível remover usuário.");
  }

  return result;
}

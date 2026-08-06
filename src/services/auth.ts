import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().trim().email("Informe um e-mail valido.");
const passwordSchema = z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.");
const nonEmptySchema = z.string().trim().min(1, "Campo obrigatorio.");

const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: nonEmptySchema,
  clinicName: z.string().trim().optional(),
  inviteToken: z.string().trim().optional(),
  inviteRole: z
    .enum(["admin", "receptionist", "attendant", "professional", "public_display", "superadmin"])
    .optional(),
});

const requestResetSchema = z.object({
  email: emailSchema,
});

const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao conferem.",
    path: ["confirmPassword"],
  });

function mapAuthErrorMessage(message: string) {
  if (message.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("User already registered")) return "Este e-mail ja esta cadastrado.";
  if (message.includes("Password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (message.includes("over_email_send_rate_limit"))
    return "Muitas tentativas. Tente novamente em instantes.";
  return message;
}

function parseOrThrow<T>(result: z.SafeParseReturnType<unknown, T>): T {
  if (result.success) return result.data;
  throw new Error(result.error.issues[0]?.message ?? "Dados invalidos.");
}

export async function signInWithEmail(input: { email: string; password: string }) {
  const data = parseOrThrow(signInSchema.safeParse(input));
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (error) throw new Error(mapAuthErrorMessage(error.message));
}

export async function signUpWithClinic(input: {
  email: string;
  password: string;
  fullName: string;
  clinicName?: string;
  clinicSlug?: string;
  inviteToken?: string;
  inviteRole?:
    "admin" | "receptionist" | "attendant" | "professional" | "public_display" | "superadmin";
}) {
  const data = parseOrThrow(signUpSchema.safeParse(input));
  const metadata: Record<string, string> = {
    full_name: data.fullName,
  };

  if (data.inviteToken) {
    metadata["invite_token"] = data.inviteToken;
    if (data.inviteRole) metadata["invite_role"] = data.inviteRole;
  } else {
    metadata["clinic_name"] = data.clinicName ?? "";
    if (input.clinicSlug && input.clinicSlug.trim().length > 0) {
      metadata["clinic_slug"] = input.clinicSlug.trim().toLowerCase();
    }
  }

  const { data: signUpData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: metadata,
    },
  });
  if (error) throw new Error(mapAuthErrorMessage(error.message));
  return signUpData;
}

export async function requestPasswordReset(email: string) {
  const data = parseOrThrow(requestResetSchema.safeParse({ email }));
  const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(mapAuthErrorMessage(error.message));
}

export async function updateCurrentUserPassword(input: {
  password: string;
  confirmPassword: string;
}) {
  const data = parseOrThrow(updatePasswordSchema.safeParse(input));
  const { error } = await supabase.auth.updateUser({ password: data.password });
  if (error) throw new Error(mapAuthErrorMessage(error.message));
}

export async function signOutCurrentUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(mapAuthErrorMessage(error.message));
}

export async function getAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(mapAuthErrorMessage(error.message));
  return data.user;
}

export async function hasActiveSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(mapAuthErrorMessage(error.message));
  return Boolean(data.session);
}

export async function mustChangeTemporaryPassword() {
  const user = await getAuthenticatedUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("profiles" as never)
    .select("force_password_change" as never)
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(mapAuthErrorMessage(error.message));
  return Boolean((data as { force_password_change?: boolean } | null)?.force_password_change);
}

export async function clearTemporaryPasswordFlag() {
  const user = await getAuthenticatedUser();
  if (!user) return;
  const { error } = await supabase
    .from("profiles")
    .update({ force_password_change: false, temp_password_issued_at: null } as never)
    .eq("id", user.id);
  if (error) throw new Error(mapAuthErrorMessage(error.message));
}

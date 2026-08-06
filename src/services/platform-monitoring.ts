import { supabase } from "@/integrations/supabase/client";

export type PlatformErrorInput = {
  clinicId: string | null;
  source: "frontend" | "ssr" | "supabase" | "edge" | "print" | "realtime" | "auth";
  route: string;
  message: string;
  severity: "error" | "warning" | "info";
  appVersion?: string;
  environment?: string;
  context?: Record<string, unknown>;
};

export async function logPlatformError(input: PlatformErrorInput) {
  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id ?? null;

  const payload = {
    clinic_id: input.clinicId,
    user_id: userId,
    source: input.source,
    route: input.route,
    message: sanitizeMessage(input.message),
    severity: input.severity,
    app_version: input.appVersion ?? null,
    environment: input.environment ?? null,
    context: sanitizeContext(input.context ?? {}),
  };

  const { error } = await supabase.from("platform_errors" as never).insert(payload as never);
  if (error) throw error;
}

export async function listPlatformErrors(filters?: {
  clinicId?: string;
  severity?: string;
  limit?: number;
}) {
  const limit = filters?.limit ?? 100;
  let query = supabase
    .from("platform_errors" as never)
    .select(
      "id, clinic_id, user_id, source, route, message, severity, app_version, environment, context, created_at" as never,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.clinicId) query = query.eq("clinic_id", filters.clinicId);
  if (filters?.severity) query = query.eq("severity", filters.severity);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    clinic_id: string | null;
    user_id: string | null;
    source: string;
    route: string | null;
    message: string;
    severity: string;
    app_version: string | null;
    environment: string | null;
    context: Record<string, unknown>;
    created_at: string;
  }>;
}

function sanitizeMessage(value: string) {
  return value
    .replace(/(password|senha)\s*[:=]\s*[^\s]+/gi, "$1=[REDACTED]")
    .replace(/(token|secret|service_role_key)\s*[:=]\s*[^\s]+/gi, "$1=[REDACTED]")
    .slice(0, 1200);
}

function sanitizeContext(value: Record<string, unknown>) {
  const json = JSON.stringify(value);

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const key of Object.keys(parsed)) {
      if (/password|senha|token|secret|service_role_key/i.test(key)) {
        parsed[key] = "[REDACTED]";
      }
    }
    return parsed;
  } catch {
    return { redacted: true };
  }
}

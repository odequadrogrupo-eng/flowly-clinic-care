import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"] & {
  profiles: Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "id" | "full_name" | "email"
  > | null;
};

export async function listAuditLogs(input: {
  clinicId: string;
  fromIso: string;
  toIso: string;
  entity?: string;
  action?: string;
  limit?: number;
}) {
  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("clinic_id", input.clinicId)
    .gte("created_at", input.fromIso)
    .lte("created_at", input.toIso)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 200);

  if (input.entity) query = query.eq("entity", input.entity);
  if (input.action) query = query.eq("action", input.action);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Database["public"]["Tables"]["audit_logs"]["Row"][];
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))] as string[];

  let profileMap = new Map<
    string,
    Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email">
  >();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    if (profilesError) throw profilesError;
    profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  }

  return rows.map((row) => ({
    ...row,
    profiles: row.user_id ? (profileMap.get(row.user_id) ?? null) : null,
  }));
}

export function sanitizeAuditDetails(details: unknown) {
  if (!details || typeof details !== "object") return details;
  const clone = { ...(details as Record<string, unknown>) };
  const redactedKeys = ["cpf", "document", "token", "password", "invite", "email"];
  for (const key of Object.keys(clone)) {
    if (redactedKeys.some((token) => key.toLowerCase().includes(token))) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}

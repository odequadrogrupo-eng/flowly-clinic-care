import { supabase } from "@/integrations/supabase/client";

const EXPORT_TABLES = [
  "patients",
  "professionals",
  "rooms",
  "receptions",
  "appointments",
  "tickets",
  "queues",
  "calls",
  "panel_settings",
  "kiosk_settings",
  "print_settings",
  "audit_logs",
] as const;

export async function createBackupExportRecord(input: {
  clinicId: string;
  format: "csv" | "json";
}) {
  const { data, error } = await supabase
    .from("backup_exports" as never)
    .insert({
      clinic_id: input.clinicId,
      format: input.format,
      status: "ready",
      details: { tables: EXPORT_TABLES },
    } as never)
    .select("id, clinic_id, format, status, retention_days, details, created_at" as never)
    .single();

  if (error) throw error;
  return data as {
    id: string;
    clinic_id: string;
    format: "csv" | "json";
    status: string;
    retention_days: number;
    details: Record<string, unknown>;
    created_at: string;
  };
}

export async function listBackupExports(clinicId: string) {
  const { data, error } = await supabase
    .from("backup_exports" as never)
    .select("id, clinic_id, format, status, retention_days, details, created_at" as never)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    clinic_id: string;
    format: "csv" | "json";
    status: string;
    retention_days: number;
    details: Record<string, unknown>;
    created_at: string;
  }>;
}

export async function exportClinicDataAsJson(clinicId: string) {
  const payload: Record<string, unknown> = {};

  for (const table of EXPORT_TABLES) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*" as never)
      .eq("clinic_id", clinicId);
    if (error) throw error;
    payload[table] = data ?? [];
  }

  return payload;
}

export function jsonToCsvRows(data: Record<string, unknown>) {
  const rows: string[] = [];
  for (const [table, records] of Object.entries(data)) {
    const arr = Array.isArray(records) ? records : [];
    rows.push(`# ${table}`);
    if (arr.length === 0) {
      rows.push("(vazio)");
      rows.push("");
      continue;
    }

    const keys = Object.keys(arr[0] as Record<string, unknown>);
    rows.push(keys.join(","));
    for (const item of arr as Array<Record<string, unknown>>) {
      rows.push(keys.map((k) => JSON.stringify(item[k] ?? "")).join(","));
    }
    rows.push("");
  }
  return rows.join("\n");
}

import { supabase } from "@/integrations/supabase/client";

export type DemoSeedSummary = {
  clinic: "created" | "updated";
  usersCreated: number;
  usersUpdated: number;
  doctorsCreated: number;
  patientsCreated: number;
  ticketsCreated: number;
  queuesCreated: number;
  callsCreated: number;
  appointmentsCreated: number;
  tenantValidation: {
    secondClinicCreated: boolean;
    checks: Array<{ table: string; passed: boolean; details: string }>;
  };
  errors: string[];
  clinicId: string;
  batchId: string;
  totemToken?: string;
  panelToken?: string;
};

export type DemoRunRow = {
  id: string;
  clinic_id: string | null;
  triggered_by: string | null;
  action: "seed" | "reset" | "validate_tenant";
  status: "running" | "success" | "error";
  summary: unknown;
  error_message: string | null;
  demo_batch_id: string | null;
  created_at: string;
  finished_at: string | null;
};

export async function runSeedDemoClubMedico() {
  const { data, error } = await supabase.functions.invoke("seed-demo-clinic", {
    body: {},
  });

  if (error) throw error;
  return data as { ok: boolean; runId?: string; summary?: DemoSeedSummary; error?: string };
}

export async function runResetAndRecreateDemoClubMedico() {
  const { data, error } = await supabase.functions.invoke("reset-demo-clinic", {
    body: {
      confirmA: "RECRIAR CLUB MEDICO",
      confirmB: "APAGAR SOMENTE DEMO",
      recreate: true,
    },
  });

  if (error) throw error;
  return data as {
    ok: boolean;
    runId?: string;
    reset?: unknown;
    recreated?: DemoSeedSummary;
    error?: string;
  };
}

export async function listDemoRuns(clinicId: string, limit = 5) {
  const { data, error } = await supabase
    .from("demo_seed_runs" as never)
    .select(
      "id, clinic_id, triggered_by, action, status, summary, error_message, demo_batch_id, created_at, finished_at" as never,
    )
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as DemoRunRow[];
}

export async function getDemoRunActorName(userId: string | null) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return (data as { full_name: string | null } | null)?.full_name ?? null;
}

import { supabase } from "@/integrations/supabase/client";
import { minutesBetween } from "@/lib/queue";

export type OperationalReport = {
  totalCheckins: number;
  totalFinished: number;
  totalCancelled: number;
  avgWaitMinutes: number;
  byStatus: Array<{ status: string; total: number }>;
  byProfessional: Array<{ professional: string; total: number }>;
};

export async function getOperationalReport(clinicId: string, fromIso: string, toIso: string) {
  const { data, error } = await supabase
    .from("queues")
    .select("status, checkin_at, called_at, professionals(full_name)")
    .eq("clinic_id", clinicId)
    .gte("checkin_at", fromIso)
    .lte("checkin_at", toIso)
    .order("checkin_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    status: string;
    checkin_at: string;
    called_at: string | null;
    professionals: { full_name: string | null } | null;
  }>;

  const totalCheckins = rows.length;
  const totalFinished = rows.filter((row) => row.status === "finished").length;
  const totalCancelled = rows.filter((row) => row.status === "cancelled" || row.status === "no_show").length;

  const waits = rows.filter((row) => row.called_at).map((row) => minutesBetween(row.checkin_at, row.called_at));
  const avgWaitMinutes = waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : 0;

  const byStatusMap = new Map<string, number>();
  for (const row of rows) {
    byStatusMap.set(row.status, (byStatusMap.get(row.status) ?? 0) + 1);
  }

  const byProfessionalMap = new Map<string, number>();
  for (const row of rows) {
    const professional = row.professionals?.full_name ?? "Sem profissional";
    byProfessionalMap.set(professional, (byProfessionalMap.get(professional) ?? 0) + 1);
  }

  return {
    totalCheckins,
    totalFinished,
    totalCancelled,
    avgWaitMinutes,
    byStatus: [...byStatusMap.entries()].map(([status, total]) => ({ status, total })),
    byProfessional: [...byProfessionalMap.entries()]
      .map(([professional, total]) => ({ professional, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
  } satisfies OperationalReport;
}

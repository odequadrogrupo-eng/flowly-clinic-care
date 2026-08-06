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

type PrintableReportInput = {
  clinicName: string;
  logoUrl?: string | null;
  fromDate: string;
  toDate: string;
  generatedAtIso?: string;
  report: OperationalReport;
};

export function buildOperationalReportPrintHtml(input: PrintableReportInput) {
  const generatedAt = new Date(input.generatedAtIso ?? new Date().toISOString()).toLocaleString(
    "pt-BR",
  );
  const statusRows = input.report.byStatus
    .map(
      (item) => `<tr><td>${item.status}</td><td style="text-align:right">${item.total}</td></tr>`,
    )
    .join("");
  const professionalRows = input.report.byProfessional
    .map(
      (item) =>
        `<tr><td>${item.professional}</td><td style="text-align:right">${item.total}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relatório Operacional</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 6px; }
    .meta { color: #555; margin-bottom: 16px; }
    .logo-wrap { margin-bottom: 12px; }
    .logo { max-height: 56px; width: auto; object-fit: contain; }
    .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
    .label { font-size: 12px; color: #666; }
    .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
    th { background: #f4f4f4; text-align: left; }
    .section { margin-top: 18px; }
  </style>
</head>
<body>
  <div class="logo-wrap">${input.logoUrl ? `<img class="logo" src="${input.logoUrl}" alt="${input.clinicName}" />` : ""}</div>
  <h1>Relatório Operacional</h1>
  <p><strong>${input.clinicName}</strong></p>
  <p class="meta">Período: ${input.fromDate} até ${input.toDate} · Gerado em ${generatedAt}</p>

  <section class="cards">
    <article class="card"><div class="label">Check-ins</div><div class="value">${input.report.totalCheckins}</div></article>
    <article class="card"><div class="label">Finalizados</div><div class="value">${input.report.totalFinished}</div></article>
    <article class="card"><div class="label">Cancelados/No-show</div><div class="value">${input.report.totalCancelled}</div></article>
    <article class="card"><div class="label">Espera média (min)</div><div class="value">${input.report.avgWaitMinutes}</div></article>
  </section>

  <section class="section">
    <h2>Status</h2>
    <table>
      <thead><tr><th>Status</th><th>Total</th></tr></thead>
      <tbody>${statusRows}</tbody>
    </table>
  </section>

  <section class="section">
    <h2>Top Profissionais</h2>
    <table>
      <thead><tr><th>Profissional</th><th>Total</th></tr></thead>
      <tbody>${professionalRows}</tbody>
    </table>
  </section>
</body>
</html>`;
}

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
  const totalCancelled = rows.filter(
    (row) => row.status === "cancelled" || row.status === "no_show",
  ).length;

  const waits = rows
    .filter((row) => row.called_at)
    .map((row) => minutesBetween(row.checkin_at, row.called_at));
  const avgWaitMinutes = waits.length
    ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length)
    : 0;

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

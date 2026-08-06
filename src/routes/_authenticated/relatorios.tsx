import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Clock, Users } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState, StatCard } from "@/components/common/States";
import { ClinicLogo } from "@/components/common/ClinicLogo";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildOperationalReportPrintHtml, getOperationalReport } from "@/services/reports";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — ClinicFlow" },
      {
        name: "description",
        content: "Indicadores operacionais de check-in, espera e conclusão de atendimentos.",
      },
      { property: "og:title", content: "Relatórios — ClinicFlow" },
      {
        property: "og:description",
        content: "Acompanhe os principais indicadores de atendimento da clínica.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function toCsv(report: {
  totalCheckins: number;
  totalFinished: number;
  totalCancelled: number;
  avgWaitMinutes: number;
  byStatus: Array<{ status: string; total: number }>;
  byProfessional: Array<{ professional: string; total: number }>;
}) {
  const rows: string[][] = [
    ["Metrica", "Valor"],
    ["Checkins", String(report.totalCheckins)],
    ["Finalizados", String(report.totalFinished)],
    ["Cancelados_no_show", String(report.totalCancelled)],
    ["Espera_media_min", String(report.avgWaitMinutes)],
    [],
    ["Status", "Total"],
    ...report.byStatus.map((item) => [item.status, String(item.total)]),
    [],
    ["Profissional", "Total"],
    ...report.byProfessional.map((item) => [item.professional, String(item.total)]),
  ];

  return rows
    .map((cols) =>
      cols
        .map((value) => {
          const escaped = value.replaceAll('"', '""');
          return /[",\n;]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(";"),
    )
    .join("\n");
}

function downloadCsv(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function openPdfReadyReport(html: string) {
  const popup = window.open("", "_blank", "width=1100,height=760");
  if (!popup) {
    throw new Error("Nao foi possivel abrir a visualizacao de PDF.");
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
}

function ReportsPage() {
  return (
    <Page
      title="Relatórios"
      description="Indicadores operacionais"
      allowed={["admin", "receptionist"]}
    >
      {(profile) => (
        <ReportsContent
          clinicId={profile.clinic_id}
          clinicName={profile.clinics?.name ?? "Clínica"}
          clinicLogoUrl={profile.clinics?.logo_url ?? null}
        />
      )}
    </Page>
  );
}

function ReportsContent({
  clinicId,
  clinicName,
  clinicLogoUrl,
}: {
  clinicId: string;
  clinicName: string;
  clinicLogoUrl: string | null;
}) {
  const [fromDate, setFromDate] = useState(daysAgo(6));
  const [toDate, setToDate] = useState(isoToday());

  const reportQuery = useQuery({
    queryKey: ["operational-report", clinicId, fromDate, toDate],
    queryFn: () =>
      getOperationalReport(
        clinicId,
        new Date(`${fromDate}T00:00:00`).toISOString(),
        new Date(`${toDate}T23:59:59`).toISOString(),
      ),
  });

  if (reportQuery.isLoading) return <LoadingState label="Gerando relatório..." />;
  if (reportQuery.error) return <ErrorState error={reportQuery.error} />;

  const report = reportQuery.data;
  if (!report) {
    return (
      <div className="card-soft">
        <EmptyState
          title="Sem dados"
          description="Não há dados suficientes para o período selecionado."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card-soft flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-muted-foreground">Relatórios de</p>
          <p className="text-lg font-semibold">{clinicName}</p>
        </div>
        <ClinicLogo
          src={clinicLogoUrl ?? "/brands/club-medico/logo.png"}
          alt={clinicName}
          fallbackText="Club Médico"
          className="h-16 w-44"
          imgClassName="h-12"
        />
      </section>

      <div className="grid gap-3 rounded-2xl border p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="report-from">De</Label>
          <Input
            id="report-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-to">Até</Label>
          <Input
            id="report-to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(`relatorio-operacional-${fromDate}_a_${toDate}.csv`, toCsv(report))
              }
            >
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const html = buildOperationalReportPrintHtml({
                  clinicName,
                  logoUrl: clinicLogoUrl ?? "/brands/club-medico/logo.png",
                  fromDate,
                  toDate,
                  report,
                });
                openPdfReadyReport(html);
              }}
            >
              Abrir versão PDF
            </Button>
          </div>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Check-ins"
          value={report.totalCheckins}
          icon={<Users className="size-5" />}
        />
        <StatCard
          label="Finalizados"
          value={report.totalFinished}
          icon={<Activity className="size-5" />}
        />
        <StatCard
          label="Cancelados/No-show"
          value={report.totalCancelled}
          icon={<Clock className="size-5" />}
        />
        <StatCard
          label="Espera média"
          value={`${report.avgWaitMinutes} min`}
          icon={<Clock className="size-5" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card-soft p-5">
          <h2 className="font-semibold">Atendimentos por status</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.byStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-soft p-5">
          <h2 className="font-semibold">Top profissionais por volume</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.byProfessional}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="professional"
                  interval={0}
                  angle={-15}
                  height={60}
                  textAnchor="end"
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

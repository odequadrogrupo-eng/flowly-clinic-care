import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Clock, Stethoscope, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { EmptyState, ErrorState, LoadingState, StatCard } from "@/components/common/States";
import { Page } from "@/components/layout/Page";
import { useRealtime } from "@/hooks/useRealtime";
import { supabase } from "@/integrations/supabase/client";
import {
  QUEUE_SELECT,
  formatDuration,
  formatTime,
  minutesBetween,
  statusLabels,
  statusTone,
  type QueueItem,
} from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ClinicFlow" },
      { name: "description", content: "Indicadores de espera, atendimentos e profissionais disponíveis da clínica." },
      { property: "og:title", content: "Dashboard — ClinicFlow" },
      { property: "og:description", content: "Visão geral do atendimento da clínica em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function startOfDaysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function DashboardPage() {
  return (
    <Page
      title="Dashboard"
      description="Visão geral do atendimento de hoje"
      allowed={["admin", "receptionist", "professional"]}
    >
      {(profile) => <DashboardContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

function DashboardContent({ clinicId }: { clinicId: string }) {
  useRealtime(["queues", "calls"], ["dashboard-queues", "queue"], clinicId);

  const queuesQuery = useQuery({
    queryKey: ["dashboard-queues", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queues")
        .select(QUEUE_SELECT)
        .gte("checkin_at", startOfDaysAgo(6).toISOString())
        .order("checkin_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QueueItem[];
    },
  });

  const professionalsQuery = useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (queuesQuery.isLoading) return <LoadingState />;
  if (queuesQuery.error) return <ErrorState error={queuesQuery.error} />;

  const all = queuesQuery.data ?? [];
  const todayStart = startOfDaysAgo(0);
  const today = all.filter((item) => new Date(item.checkin_at) >= todayStart);

  const waiting = today.filter((item) => item.status === "waiting");
  const inService = today.filter((item) => item.status === "in_service");
  const finished = today.filter((item) => item.status === "finished");

  const waitTimes = today
    .filter((item) => item.called_at)
    .map((item) => minutesBetween(item.checkin_at, item.called_at));
  const avgWait = waitTimes.length
    ? Math.round(waitTimes.reduce((sum, value) => sum + value, 0) / waitTimes.length)
    : 0;

  const availableProfessionals = (professionalsQuery.data ?? []).filter(
    (professional) => professional.status === "available",
  ).length;

  const chartData = Array.from({ length: 7 }, (_, index) => {
    const day = startOfDaysAgo(6 - index);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return {
      label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: all.filter((item) => {
        const at = new Date(item.checkin_at);
        return at >= day && at < next;
      }).length,
    };
  });

  const latest = all.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aguardando agora" value={waiting.length} icon={<Users className="size-5" />} />
        <StatCard label="Atendidos hoje" value={finished.length} icon={<Activity className="size-5" />} />
        <StatCard
          label="Tempo médio de espera"
          value={formatDuration(avgWait)}
          hint="Da chegada até a chamada"
          icon={<Clock className="size-5" />}
        />
        <StatCard
          label="Profissionais disponíveis"
          value={availableProfessionals}
          hint={`${professionalsQuery.data?.length ?? 0} cadastrados`}
          icon={<Stethoscope className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-soft p-5 lg:col-span-2">
          <h2 className="font-semibold">Atendimentos por dia</h2>
          <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                  }}
                />
                <Bar dataKey="total" name="Atendimentos" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-soft p-5">
          <h2 className="font-semibold">Em andamento</h2>
          <p className="text-sm text-muted-foreground">{inService.length} atendimento(s)</p>
          <div className="mt-4 space-y-2">
            {inService.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atendimento em andamento.</p>
            ) : (
              inService.map((item) => (
                <div key={item.id} className="rounded-xl border p-3">
                  <p className="font-medium">{item.patients?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.professionals?.full_name ?? "Sem profissional"} · início {formatTime(item.started_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="border-b p-5">
          <h2 className="font-semibold">Últimos atendimentos</h2>
        </div>
        {latest.length === 0 ? (
          <EmptyState title="Nenhum atendimento registrado" description="Faça um check-in para iniciar a fila." />
        ) : (
          <div className="divide-y">
            {latest.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.patients?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.service_type ?? "Atendimento"} · {item.professionals?.full_name ?? "Sem profissional"} ·
                    chegada {formatTime(item.checkin_at)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[item.status]}`}>
                  {statusLabels[item.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

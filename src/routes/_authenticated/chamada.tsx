import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listCallHistory } from "@/services/calls";
import { formatTime, speak } from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/chamada")({
  head: () => ({
    meta: [
      { title: "Central de chamadas — ClinicFlow" },
      { name: "description", content: "Histórico de chamadas para conferência e repetição de anúncio." },
      { property: "og:title", content: "Central de chamadas — ClinicFlow" },
      { property: "og:description", content: "Acompanhe e repita chamadas de pacientes na clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CallsPage,
});

function isoDateToday() {
  return new Date().toISOString().slice(0, 10);
}

function CallsPage() {
  return (
    <Page title="Central de chamadas" description="Histórico e repetição de chamadas" allowed={["admin", "receptionist", "professional"]}>
      {(profile) => <CallsContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

function CallsContent({ clinicId }: { clinicId: string }) {
  const [fromDate, setFromDate] = useState(isoDateToday());
  const [toDate, setToDate] = useState(isoDateToday());
  const [search, setSearch] = useState("");

  const callsQuery = useQuery({
    queryKey: ["call-history", clinicId, fromDate, toDate],
    queryFn: () =>
      listCallHistory(
        clinicId,
        new Date(`${fromDate}T00:00:00`).toISOString(),
        new Date(`${toDate}T23:59:59`).toISOString(),
        300,
      ),
  });

  if (callsQuery.isLoading) return <LoadingState label="Carregando chamadas..." />;
  if (callsQuery.error) return <ErrorState error={callsQuery.error} />;

  const items = (callsQuery.data ?? []).filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      item.display_name.toLowerCase().includes(term) ||
      (item.professional_name ?? "").toLowerCase().includes(term) ||
      (item.room_name ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_2fr]">
        <div className="space-y-2">
          <Label htmlFor="calls-from">De</Label>
          <Input id="calls-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="calls-to">Até</Label>
          <Input id="calls-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="calls-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="calls-search"
              className="pl-9"
              placeholder="Paciente, profissional ou sala"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card-soft">
          <EmptyState title="Sem chamadas" description="Nenhuma chamada encontrada para os filtros selecionados." />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{item.display_name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.professional_name ?? "Equipe de atendimento"} · {item.room_name ?? "Recepção"}
                </p>
                <p className="text-xs text-muted-foreground">{formatTime(item.called_at)}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  speak(`${item.display_name}, ${item.room_name ? `sala ${item.room_name}` : "dirija-se à recepção"}`)
                }
              >
                <BellRing className="size-4" /> Repetir
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

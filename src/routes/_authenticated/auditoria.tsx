import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { Page } from "@/components/layout/Page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAuditLogs, sanitizeAuditDetails } from "@/services/audit";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria e LGPD — ClinicFlow" },
      { name: "description", content: "Rastro de auditoria para ações no sistema com foco em governança e LGPD." },
      { property: "og:title", content: "Auditoria e LGPD — ClinicFlow" },
      { property: "og:description", content: "Monitore operações críticas e dados de auditoria da clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function AuditPage() {
  return (
    <Page title="Auditoria e LGPD" description="Rastro de ações e segurança" allowed={["admin"]}>
      {(profile) => <AuditContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

function AuditContent({ clinicId }: { clinicId: string }) {
  const [fromDate, setFromDate] = useState(isoDaysAgo(6));
  const [toDate, setToDate] = useState(isoToday());
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");

  const logsQuery = useQuery({
    queryKey: ["audit-logs", clinicId, fromDate, toDate, entity, action],
    queryFn: () => {
      const payload: Parameters<typeof listAuditLogs>[0] = {
        clinicId,
        fromIso: new Date(`${fromDate}T00:00:00`).toISOString(),
        toIso: new Date(`${toDate}T23:59:59`).toISOString(),
        limit: 300,
      };

      if (entity !== "all") payload.entity = entity;
      if (action !== "all") payload.action = action;

      return listAuditLogs(payload);
    },
  });

  if (logsQuery.isLoading) return <LoadingState label="Carregando trilha de auditoria..." />;
  if (logsQuery.error) return <ErrorState error={logsQuery.error} />;

  const logs = logsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border p-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="audit-from">De</Label>
          <Input id="audit-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-to">Até</Label>
          <Input id="audit-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Entidade</Label>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="patients">Pacientes</SelectItem>
              <SelectItem value="professionals">Profissionais</SelectItem>
              <SelectItem value="rooms">Salas</SelectItem>
              <SelectItem value="queues">Fila</SelectItem>
              <SelectItem value="appointments">Agenda</SelectItem>
              <SelectItem value="profiles">Usuários</SelectItem>
              <SelectItem value="clinic_invites">Convites</SelectItem>
              <SelectItem value="clinics">Clínica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ação</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="archive">Archive</SelectItem>
              <SelectItem value="checkin">Check-in</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="cancel">Cancel</SelectItem>
              <SelectItem value="revoke">Revoke</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="card-soft">
          <EmptyState title="Sem eventos" description="Nenhum evento de auditoria encontrado para os filtros selecionados." />
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="card-soft space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {log.action} · {log.entity ?? "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Usuário: {log.profiles?.full_name || log.profiles?.email || "Sistema"}
              </p>
              <p className="text-sm text-muted-foreground">ID entidade: {log.entity_id ?? "-"}</p>
              {log.details ? (
                <pre className="overflow-x-auto rounded-xl border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(sanitizeAuditDetails(log.details), null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Observação LGPD: valores sensíveis em detalhes são mascarados nesta visualização.
      </p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import {
  enqueueOperation,
  listPendingOperations,
  syncPendingOperations,
} from "@/services/offline-contingency";
import { listClinicsForSuperadmin } from "@/services/superadmin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/contingencia")({
  component: ContingencyPage,
  head: () => ({
    meta: [{ title: "Contingência — ClinicFlow" }, { name: "robots", content: "noindex" }],
  }),
});

function ContingencyPage() {
  return (
    <Page
      title="Contingência"
      description="Operação crítica em cenário offline e sincronização"
      allowed={["superadmin", "admin", "receptionist", "attendant"]}
    >
      {(profile) => <ContingencyContent role={profile.role} clinicId={profile.clinic_id} />}
    </Page>
  );
}

function ContingencyContent({ role, clinicId }: { role: string; clinicId: string | null }) {
  const queryClient = useQueryClient();
  const clinicsQuery = useQuery({
    queryKey: ["contingency-superadmin-clinics"],
    queryFn: listClinicsForSuperadmin,
    enabled: role === "superadmin",
  });

  const [selectedClinicId, setSelectedClinicId] = useState<string>(clinicId ?? "");
  const effectiveClinicId =
    role === "superadmin" ? selectedClinicId || clinicsQuery.data?.[0]?.id || "" : (clinicId ?? "");
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    function update() {
      setIsOnline(navigator.onLine);
    }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const pendingQuery = useQuery({
    queryKey: ["contingency-pending", effectiveClinicId],
    enabled: effectiveClinicId.length > 0,
    queryFn: async () =>
      (await listPendingOperations()).filter((item) => item.clinicId === effectiveClinicId),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncPendingOperations(effectiveClinicId),
    onSuccess: async () => {
      localStorage.setItem("clinicflow:contingency:last-sync", new Date().toISOString());
      toast.success("Sincronização concluída");
      await queryClient.invalidateQueries({ queryKey: ["contingency-pending", effectiveClinicId] });
    },
    onError: (error: Error) => toast.error("Erro de sincronização", { description: error.message }),
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      enqueueOperation({
        clinicId: effectiveClinicId,
        kind: "queue_status",
        payload: { queueId: "offline-sample", status: "called_reception" },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contingency-pending", effectiveClinicId] });
      toast.success("Operação de contingência adicionada");
    },
  });

  const lastSync = localStorage.getItem("clinicflow:contingency:last-sync");
  const pending = useMemo(() => pendingQuery.data ?? [], [pendingQuery.data]);
  const conflicts = useMemo(() => pending.filter((item) => item.status === "conflict"), [pending]);

  return (
    <div className="space-y-4">
      {role === "superadmin" ? (
        <section className="card-soft p-4">
          <h2 className="font-semibold">Clínica alvo</h2>
          <div className="mt-2 max-w-sm">
            <Select value={effectiveClinicId} onValueChange={setSelectedClinicId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a clínica" />
              </SelectTrigger>
              <SelectContent>
                {(clinicsQuery.data ?? []).map((clinic) => (
                  <SelectItem key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      ) : null}

      <section className="card-soft p-4">
        <h2 className="font-semibold">Status de conexão</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Internet: {isOnline ? "Online" : "Offline"}
        </p>
        <p className="text-sm text-muted-foreground">
          Última sincronização: {lastSync ? new Date(lastSync).toLocaleString("pt-BR") : "N/A"}
        </p>
        <p className="text-sm text-muted-foreground">
          Operações pendentes: {pending.filter((item) => item.status === "pending").length}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !isOnline}
          >
            {syncMutation.isPending ? "Sincronizando..." : "Tentar sincronizar"}
          </Button>
          <Button variant="outline" onClick={() => seedMutation.mutate()}>
            Simular operação pendente
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              enqueueOperation({
                clinicId: effectiveClinicId,
                kind: "ticket_issue",
                payload: { kioskToken: "token-placeholder", priority: false },
              })
            }
          >
            Simular emissão de senha
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              enqueueOperation({
                clinicId: effectiveClinicId,
                kind: "queue_call",
                payload: {
                  queueId: "offline-queue-1",
                  displayName: "Paciente Offline",
                  roomName: "Sala 04",
                },
              })
            }
          >
            Simular chamada
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              enqueueOperation({
                clinicId: effectiveClinicId,
                kind: "queue_transfer",
                payload: { queueId: "offline-queue-1", roomId: "room-2" },
              })
            }
          >
            Simular transferência
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              enqueueOperation({
                clinicId: effectiveClinicId,
                kind: "queue_no_show",
                payload: { queueId: "offline-queue-2" },
              })
            }
          >
            Simular no-show
          </Button>
        </div>
      </section>

      <section className="card-soft p-4">
        <h2 className="font-semibold">Pendências e conflitos</h2>
        <div className="mt-3 space-y-2">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem operações pendentes.</p>
          ) : (
            pending.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{item.kind}</p>
                <p className="text-muted-foreground">Status: {item.status}</p>
                <p className="text-muted-foreground">
                  Criada em: {new Date(item.createdAt).toLocaleString("pt-BR")}
                </p>
                {item.conflictDetails ? (
                  <p className="text-destructive">Conflito: {item.conflictDetails}</p>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 rounded-xl border p-3 text-sm text-muted-foreground">
          <p className="font-medium">Instruções de operação offline</p>
          <ul className="mt-1 list-disc pl-4">
            <li>Continue operações críticas de senha/chamada com sinalização de pendência.</li>
            <li>Ao reconectar, execute sincronização e revise conflitos manualmente.</li>
            <li>Nunca duplique ações sem checar o status "synced".</li>
          </ul>
          <p className="mt-2">Conflitos atuais: {conflicts.length}</p>
        </div>
      </section>
    </div>
  );
}

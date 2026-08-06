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
      {(profile) => <ContingencyContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

function ContingencyContent({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
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
    queryKey: ["contingency-pending", clinicId],
    queryFn: async () =>
      (await listPendingOperations()).filter((item) => item.clinicId === clinicId),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncPendingOperations(clinicId),
    onSuccess: async () => {
      localStorage.setItem("clinicflow:contingency:last-sync", new Date().toISOString());
      toast.success("Sincronização concluída");
      await queryClient.invalidateQueries({ queryKey: ["contingency-pending", clinicId] });
    },
    onError: (error: Error) => toast.error("Erro de sincronização", { description: error.message }),
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      enqueueOperation({
        clinicId,
        kind: "queue_status",
        payload: { queueId: "offline-sample", status: "called_reception" },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contingency-pending", clinicId] });
      toast.success("Operação de contingência adicionada");
    },
  });

  const lastSync = localStorage.getItem("clinicflow:contingency:last-sync");
  const pending = useMemo(() => pendingQuery.data ?? [], [pendingQuery.data]);
  const conflicts = useMemo(() => pending.filter((item) => item.status === "conflict"), [pending]);

  return (
    <div className="space-y-4">
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

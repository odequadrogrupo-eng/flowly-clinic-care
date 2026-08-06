import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Ban, BellRing, CheckCircle2, PlayCircle, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { Page } from "@/components/layout/Page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/useRealtime";
import { supabase } from "@/integrations/supabase/client";
import {
  QUEUE_SELECT,
  callQueueItem,
  formatDuration,
  formatTime,
  minutesBetween,
  speak,
  statusLabels,
  statusTone,
  updateQueueStatus,
  type QueueItem,
  type QueueStatus,
} from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/fila")({
  head: () => ({
    meta: [
      { title: "Fila de atendimento — ClinicFlow" },
      { name: "description", content: "Gerencie a fila de pacientes em tempo real: chamar, iniciar, finalizar e cancelar." },
      { property: "og:title", content: "Fila de atendimento — ClinicFlow" },
      { property: "og:description", content: "Fila de pacientes da clínica atualizada em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QueuePage,
});

export function sortQueue(items: QueueItem[]) {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "priority" ? -1 : 1;
    const pa = a.position ?? new Date(a.checkin_at).getTime();
    const pb = b.position ?? new Date(b.checkin_at).getTime();
    return pa - pb;
  });
}

export function useActiveQueue(clinicId: string, professionalId?: string) {
  useRealtime(["queues", "calls"], ["queue", "dashboard-queues"], clinicId);
  return useQuery({
    queryKey: ["queue", clinicId, professionalId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("queues")
        .select(QUEUE_SELECT)
        .in("status", ["waiting", "called", "in_service"]);
      if (professionalId) query = query.eq("professional_id", professionalId);
      const { data, error } = await query.order("checkin_at", { ascending: true });
      if (error) throw error;
      return sortQueue((data ?? []) as QueueItem[]);
    },
  });
}

function QueuePage() {
  return (
    <Page
      title="Fila de atendimento"
      description="Atualização em tempo real"
      allowed={["admin", "receptionist"]}
      actions={
        <Button asChild size="sm">
          <Link to="/checkin">
            <UserPlus className="size-4" /> Check-in
          </Link>
        </Button>
      }
    >
      {(profile) => <QueueContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

function QueueContent({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useActiveQueue(clinicId);
  const [confirm, setConfirm] = useState<{ item: QueueItem; status: QueueStatus } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["queue"] });

  const callMutation = useMutation({
    mutationFn: async (item: QueueItem) => {
      await callQueueItem(item, clinicId);
      return item;
    },
    onSuccess: (item) => {
      speak(
        `${item.patients?.full_name ?? "Paciente"}, ${item.rooms ? `sala ${item.rooms.name}` : "dirija-se à recepção"}`,
      );
      toast.success("Paciente chamado");
      invalidate();
    },
    onError: (mutationError: Error) => toast.error("Erro ao chamar", { description: mutationError.message }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ item, status }: { item: QueueItem; status: QueueStatus }) =>
      updateQueueStatus(item, status, clinicId),
    onSuccess: (_data, variables) => {
      toast.success(`Atendimento ${statusLabels[variables.status].toLowerCase()}`);
      invalidate();
    },
    onError: (mutationError: Error) => toast.error("Erro ao atualizar", { description: mutationError.message }),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ a, b }: { a: QueueItem; b: QueueItem }) => {
      const posA = a.position ?? new Date(a.checkin_at).getTime();
      const posB = b.position ?? new Date(b.checkin_at).getTime();
      const first = await supabase.from("queues").update({ position: posB }).eq("id", a.id);
      if (first.error) throw first.error;
      const second = await supabase.from("queues").update({ position: posA }).eq("id", b.id);
      if (second.error) throw second.error;
    },
    onSuccess: invalidate,
    onError: (mutationError: Error) => toast.error("Erro ao reordenar", { description: mutationError.message }),
  });

  if (isLoading) return <LoadingState label="Carregando fila..." />;
  if (error) return <ErrorState error={error} />;

  const items = data ?? [];
  const waiting = items.filter((item) => item.status === "waiting");

  function move(item: QueueItem, direction: -1 | 1) {
    const sameGroup = waiting.filter((candidate) => candidate.priority === item.priority);
    const index = sameGroup.findIndex((candidate) => candidate.id === item.id);
    const target = sameGroup[index + direction];
    if (!target) return;
    reorderMutation.mutate({ a: item, b: target });
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="card-soft">
          <EmptyState
            title="Fila vazia"
            description="Nenhum paciente aguardando ou em atendimento neste momento."
            action={
              <Button asChild className="mt-2">
                <Link to="/checkin">Fazer check-in</Link>
              </Button>
            }
          />
        </div>
      ) : (
        items.map((item) => {
          const waitingIndex = waiting.findIndex((candidate) => candidate.id === item.id);
          const sameGroup = waiting.filter((candidate) => candidate.priority === item.priority);
          const groupIndex = sameGroup.findIndex((candidate) => candidate.id === item.id);
          return (
            <div key={item.id} className="card-soft flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {item.status === "waiting" ? (
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-bold">
                    {waitingIndex + 1}
                  </span>
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{item.patients?.full_name}</p>
                    {item.priority === "priority" ? (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                        Preferencial
                      </span>
                    ) : null}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[item.status]}`}>
                      {statusLabels[item.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.service_type ?? "Atendimento"} ·{" "}
                    {item.professionals?.full_name ?? "Sem profissional"}
                    {item.professionals?.specialty ? ` (${item.professionals.specialty})` : ""}
                    {item.rooms ? ` · Sala ${item.rooms.name}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Chegada {formatTime(item.checkin_at)} · Espera{" "}
                    {formatDuration(minutesBetween(item.checkin_at, item.called_at))}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {item.status === "waiting" ? (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Subir na fila"
                      disabled={groupIndex <= 0 || reorderMutation.isPending}
                      onClick={() => move(item, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Descer na fila"
                      disabled={groupIndex === sameGroup.length - 1 || reorderMutation.isPending}
                      onClick={() => move(item, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </>
                ) : null}

                {item.status === "waiting" || item.status === "called" ? (
                  <Button size="sm" onClick={() => callMutation.mutate(item)} disabled={callMutation.isPending}>
                    <BellRing className="size-4" />
                    {item.status === "called" ? "Repetir" : "Chamar"}
                  </Button>
                ) : null}

                {item.status === "called" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => statusMutation.mutate({ item, status: "in_service" })}
                  >
                    <PlayCircle className="size-4" /> Iniciar
                  </Button>
                ) : null}

                {item.status === "in_service" ? (
                  <Button size="sm" onClick={() => setConfirm({ item, status: "finished" })}>
                    <CheckCircle2 className="size-4" /> Finalizar
                  </Button>
                ) : null}

                <Button size="sm" variant="ghost" onClick={() => setConfirm({ item, status: "cancelled" })}>
                  <Ban className="size-4" /> Cancelar
                </Button>
              </div>
            </div>
          );
        })
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.status === "cancelled" ? "Cancelar atendimento?" : "Finalizar atendimento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.item.patients?.full_name} — esta ação será registrada no histórico da clínica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) statusMutation.mutate(confirm);
                setConfirm(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

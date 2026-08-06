import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CheckCircle2, PlayCircle, Repeat } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  callQueueItem,
  formatDuration,
  formatTime,
  minutesBetween,
  speak,
  statusLabels,
  statusTone,
  updateQueueStatus,
  type Professional,
  type QueueItem,
} from "@/lib/queue";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCheckinProfessionals, listCheckinRooms } from "@/services/checkin";
import { useActiveQueue } from "./fila";

export const Route = createFileRoute("/_authenticated/atendimento")({
  head: () => ({
    meta: [
      { title: "Meu atendimento — ClinicFlow" },
      {
        name: "description",
        content: "Fila do profissional com chamada, início e finalização de atendimento.",
      },
      { property: "og:title", content: "Meu atendimento — ClinicFlow" },
      { property: "og:description", content: "Área do profissional de atendimento no ClinicFlow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfessionalPage,
});

function ProfessionalPage() {
  return (
    <Page
      title="Meu atendimento"
      description="Sua fila em tempo real"
      allowed={["admin", "professional"]}
    >
      {(profile) => <ProfessionalContent clinicId={profile.clinic_id} profileId={profile.id} />}
    </Page>
  );
}

function ProfessionalContent({ clinicId, profileId }: { clinicId: string; profileId: string }) {
  const queryClient = useQueryClient();
  const [internalNotes, setInternalNotes] = useState("");
  const [confirmFinish, setConfirmFinish] = useState<QueueItem | null>(null);
  const [transferProfessionalId, setTransferProfessionalId] = useState("__none__");
  const [transferRoomId, setTransferRoomId] = useState("__none__");
  const [transferNotes, setTransferNotes] = useState("");

  const professionalQuery = useQuery({
    queryKey: ["my-professional", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return (data as Professional | null) ?? null;
    },
  });

  const professionalId = professionalQuery.data?.id;
  const queueQuery = useActiveQueue(clinicId, professionalId);

  const professionalsQuery = useQuery({
    queryKey: ["transfer-professionals", clinicId],
    queryFn: () => listCheckinProfessionals(clinicId),
  });

  const roomsQuery = useQuery({
    queryKey: ["transfer-rooms", clinicId],
    queryFn: () => listCheckinRooms(clinicId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["queue"] });

  const callMutation = useMutation({
    mutationFn: async (item: QueueItem) => {
      await callQueueItem(item, clinicId);
      return item;
    },
    onSuccess: (item) => {
      speak(
        `${item.patients?.full_name ?? "Paciente"}, ${item.rooms ? `sala ${item.rooms.name}` : "dirija-se ao consultório"}`,
      );
      toast.success("Chamada realizada");
      invalidate();
    },
    onError: (error: Error) => toast.error("Erro ao chamar", { description: error.message }),
  });

  const startMutation = useMutation({
    mutationFn: (item: QueueItem) => updateQueueStatus(item, "in_service", clinicId),
    onSuccess: () => {
      toast.success("Atendimento iniciado");
      invalidate();
    },
    onError: (error: Error) => toast.error("Erro", { description: error.message }),
  });

  const finishMutation = useMutation({
    mutationFn: (item: QueueItem) =>
      updateQueueStatus(item, "finished", clinicId, {
        internal_notes: internalNotes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Atendimento finalizado");
      setInternalNotes("");
      invalidate();
    },
    onError: (error: Error) => toast.error("Erro", { description: error.message }),
  });

  const returnToReceptionMutation = useMutation({
    mutationFn: (item: QueueItem) =>
      updateQueueStatus(item, "waiting_reception", clinicId, {
        professional_id: null,
        room_id: null,
        started_at: null,
        called_at: null,
        notes: transferNotes.trim() || item.notes,
      }),
    onSuccess: () => {
      toast.success("Paciente devolvido para recepção");
      setTransferNotes("");
      invalidate();
    },
    onError: (error: Error) => toast.error("Erro ao devolver", { description: error.message }),
  });

  const transferMutation = useMutation({
    mutationFn: (item: QueueItem) =>
      updateQueueStatus(item, "waiting_service", clinicId, {
        professional_id: transferProfessionalId === "__none__" ? null : transferProfessionalId,
        room_id: transferRoomId === "__none__" ? null : transferRoomId,
        started_at: null,
        called_at: null,
        notes: transferNotes.trim() || item.notes,
      }),
    onSuccess: () => {
      toast.success("Paciente transferido para nova fila");
      setTransferNotes("");
      invalidate();
    },
    onError: (error: Error) => toast.error("Erro ao transferir", { description: error.message }),
  });

  const noShowMutation = useMutation({
    mutationFn: (item: QueueItem) =>
      updateQueueStatus(item, "no_show", clinicId, {
        internal_notes:
          [internalNotes.trim(), transferNotes.trim()].filter(Boolean).join(" | ") ||
          item.internal_notes,
      }),
    onSuccess: () => {
      toast.success("Paciente marcado como não compareceu");
      setTransferNotes("");
      invalidate();
    },
    onError: (error: Error) =>
      toast.error("Erro ao marcar no-show", { description: error.message }),
  });

  if (
    professionalQuery.isLoading ||
    queueQuery.isLoading ||
    professionalsQuery.isLoading ||
    roomsQuery.isLoading
  ) {
    return <LoadingState />;
  }
  if (professionalQuery.error) return <ErrorState error={professionalQuery.error} />;
  if (professionalsQuery.error) return <ErrorState error={professionalsQuery.error} />;
  if (roomsQuery.error) return <ErrorState error={roomsQuery.error} />;

  if (!professionalQuery.data) {
    return (
      <div className="card-soft">
        <EmptyState
          title="Nenhum profissional vinculado"
          description="Pedidos ao administrador: vincule seu usuário a um profissional em Profissionais."
        />
      </div>
    );
  }

  const items = queueQuery.data ?? [];
  const current =
    items.find((item) => item.status === "in_service") ??
    items.find((item) => item.status === "called_service") ??
    items.find((item) => item.status === "called");
  const waiting = items.filter(
    (item) => item.status === "waiting_service" || item.status === "waiting",
  );
  const next = waiting[0];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card-soft space-y-4 p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Paciente atual</h2>
          <Button
            size="sm"
            disabled={!next || callMutation.isPending}
            onClick={() => next && callMutation.mutate(next)}
          >
            <BellRing className="size-4" /> Chamar próximo
          </Button>
        </div>

        {current ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-primary/5 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-bold">{current.patients?.full_name}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[current.status]}`}
                >
                  {statusLabels[current.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {current.service_type ?? "Atendimento"}
                {current.rooms ? ` · Sala ${current.rooms.name}` : ""} · Espera{" "}
                {formatDuration(minutesBetween(current.checkin_at, current.called_at))}
                {current.started_at
                  ? ` · Atendimento ${formatDuration(minutesBetween(current.started_at, null))}`
                  : ""}
              </p>
              {current.notes ? (
                <p className="mt-2 text-sm">Obs. recepção: {current.notes}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="internal" className="text-sm font-medium">
                Observações internas
              </label>
              <Textarea
                id="internal"
                rows={4}
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                placeholder="Anotações do atendimento (visíveis apenas para a equipe)"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => callMutation.mutate(current)}>
                <Repeat className="size-4" /> Repetir chamada
              </Button>
              {current.status === "called" || current.status === "called_service" ? (
                <Button
                  onClick={() => startMutation.mutate(current)}
                  disabled={startMutation.isPending}
                >
                  <PlayCircle className="size-4" /> Iniciar atendimento
                </Button>
              ) : (
                <Button onClick={() => setConfirmFinish(current)}>
                  <CheckCircle2 className="size-4" /> Finalizar atendimento
                </Button>
              )}
            </div>

            <div className="rounded-2xl border p-4">
              <p className="mb-3 text-sm font-semibold">Transferência e exceções</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Transferir para profissional</Label>
                  <Select value={transferProfessionalId} onValueChange={setTransferProfessionalId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não definido</SelectItem>
                      {(professionalsQuery.data ?? []).map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Transferir para sala</Label>
                  <Select value={transferRoomId} onValueChange={setTransferRoomId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não definido</SelectItem>
                      {(roomsQuery.data ?? []).map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <Label htmlFor="transfer-notes">Motivo/observação</Label>
                <Textarea
                  id="transfer-notes"
                  rows={3}
                  value={transferNotes}
                  onChange={(event) => setTransferNotes(event.target.value)}
                  placeholder="Descreva motivo da transferência, devolução ou no-show"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => transferMutation.mutate(current)}
                  disabled={transferMutation.isPending}
                >
                  Transferir
                </Button>
                <Button
                  variant="outline"
                  onClick={() => returnToReceptionMutation.mutate(current)}
                  disabled={returnToReceptionMutation.isPending}
                >
                  Devolver para recepção
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => noShowMutation.mutate(current)}
                  disabled={noShowMutation.isPending}
                >
                  Marcar no-show
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Nenhum paciente chamado"
            description="Use “Chamar próximo” para iniciar."
          />
        )}
      </div>

      <div className="card-soft p-5">
        <h2 className="font-semibold">Minha fila</h2>
        <p className="text-sm text-muted-foreground">{waiting.length} aguardando</p>
        <div className="mt-4 space-y-2">
          {waiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem pacientes aguardando.</p>
          ) : (
            waiting.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.patients?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.priority === "priority" ? "Preferencial · " : ""}
                    Chegada {formatTime(item.checkin_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmFinish !== null}
        onOpenChange={(open) => !open && setConfirmFinish(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmFinish?.patients?.full_name} — as observações internas serão salvas no
              atendimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmFinish) finishMutation.mutate(confirmFinish);
                setConfirmFinish(null);
              }}
            >
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

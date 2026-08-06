import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DoorOpen, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logAudit, type Room } from "@/lib/queue";
import { archiveRoom, listRooms, saveRoom, type RoomFormValues } from "@/services/rooms";

export const Route = createFileRoute("/_authenticated/salas")({
  head: () => ({
    meta: [
      { title: "Salas e consultórios — ClinicFlow" },
      {
        name: "description",
        content: "Cadastro de salas, consultórios e setores usados nas chamadas de pacientes.",
      },
      { property: "og:title", content: "Salas e consultórios — ClinicFlow" },
      { property: "og:description", content: "Organize salas e setores da clínica no ClinicFlow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomsPage,
});

const emptyForm: RoomFormValues = { name: "", number: "", sector: "" };

function RoomsPage() {
  return (
    <Page
      title="Salas e consultórios"
      description="Usadas nas chamadas do painel"
      allowed={["admin"]}
    >
      {(profile) => <RoomsContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

function RoomsContent({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RoomFormValues | null>(null);
  const [removing, setRemoving] = useState<Room | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["rooms", clinicId],
    queryFn: () => listRooms(clinicId),
  });

  const save = useMutation({
    mutationFn: async (values: RoomFormValues) => {
      const savedId = await saveRoom(clinicId, values);
      if (values.id) {
        await logAudit({ clinicId, action: "update", entity: "rooms", entityId: savedId });
      } else {
        await logAudit({ clinicId, action: "create", entity: "rooms", entityId: savedId });
      }
    },
    onSuccess: () => {
      toast.success("Sala salva");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (mutationError: Error) =>
      toast.error("Erro ao salvar", { description: mutationError.message }),
  });

  const remove = useMutation({
    mutationFn: async (room: Room) => {
      await archiveRoom(clinicId, room.id);
      await logAudit({ clinicId, action: "archive", entity: "rooms", entityId: room.id });
    },
    onSuccess: () => {
      toast.success("Sala arquivada");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (mutationError: Error) => toast.error("Erro", { description: mutationError.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ ...emptyForm })}>
          <Plus className="size-4" /> Nova sala
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : (data ?? []).length === 0 ? (
        <div className="card-soft">
          <EmptyState
            title="Nenhuma sala"
            description="Cadastre consultórios e salas de procedimento."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(data ?? []).map((room) => (
            <div key={room.id} className="card-soft p-4">
              <div className="flex items-center gap-2">
                <DoorOpen className="size-5 text-primary" />
                <p className="font-semibold">{room.name}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {room.number ? `Nº ${room.number}` : "Sem número"} · {room.sector ?? "Sem setor"}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      id: room.id,
                      name: room.name,
                      number: room.number ?? "",
                      sector: room.sector ?? "",
                    })
                  }
                >
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(room)}>
                  <Trash2 className="size-4" /> Arquivar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar sala" : "Nova sala"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="r-name">Nome</Label>
                <Input
                  id="r-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="r-number">Número</Label>
                  <Input
                    id="r-number"
                    value={form.number}
                    onChange={(event) => setForm({ ...form, number: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-sector">Setor</Label>
                  <Input
                    id="r-sector"
                    value={form.sector}
                    onChange={(event) => setForm({ ...form, sector: event.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button disabled={save.isPending} onClick={() => form && save.mutate(form)}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar sala?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} não estará mais disponível para novas chamadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) remove.mutate(removing);
                setRemoving(null);
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

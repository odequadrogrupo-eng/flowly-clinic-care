import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logAudit, type Professional, type Room } from "@/lib/queue";
import {
  archiveProfessional,
  listActiveProfiles,
  listActiveRooms,
  listProfessionals,
  NONE,
  saveProfessional,
  type ProfessionalFormValues,
  type ProfessionalStatus,
} from "@/services/professionals";

export const Route = createFileRoute("/_authenticated/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — ClinicFlow" },
      {
        name: "description",
        content: "Cadastro de profissionais, especialidades, salas e status de disponibilidade.",
      },
      { property: "og:title", content: "Profissionais — ClinicFlow" },
      { property: "og:description", content: "Gestão da equipe de atendimento no ClinicFlow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfessionalsPage,
});

const statusLabel: Record<ProfessionalStatus, string> = {
  available: "Disponível",
  busy: "Ocupado",
  away: "Ausente",
};

const statusClass: Record<ProfessionalStatus, string> = {
  available: "bg-success/15 text-success",
  busy: "bg-warning/20 text-warning-foreground",
  away: "bg-muted text-muted-foreground",
};

const emptyForm: ProfessionalFormValues = {
  full_name: "",
  specialty: "",
  professional_registration: "",
  phone: "",
  email: "",
  room_id: NONE,
  profile_id: NONE,
  status: "available",
};

function ProfessionalsPage() {
  return (
    <Page title="Profissionais" description="Equipe, especialidades e salas" allowed={["admin"]}>
      {(profile) => <ProfessionalsContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

function ProfessionalsContent({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfessionalFormValues | null>(null);
  const [removing, setRemoving] = useState<Professional | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: () => listProfessionals(clinicId),
  });

  const roomsQuery = useQuery({
    queryKey: ["rooms", clinicId],
    queryFn: () => listActiveRooms(clinicId),
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles", clinicId],
    queryFn: () => listActiveProfiles(clinicId),
  });

  const save = useMutation({
    mutationFn: async (values: ProfessionalFormValues) => {
      const savedId = await saveProfessional(clinicId, values);
      if (values.id) {
        await logAudit({ clinicId, action: "update", entity: "professionals", entityId: savedId });
      } else {
        await logAudit({ clinicId, action: "create", entity: "professionals", entityId: savedId });
      }
    },
    onSuccess: () => {
      toast.success("Profissional salvo");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
    },
    onError: (mutationError: Error) =>
      toast.error("Erro ao salvar", { description: mutationError.message }),
  });

  const remove = useMutation({
    mutationFn: async (professional: Professional) => {
      await archiveProfessional(clinicId, professional.id);
      await logAudit({
        clinicId,
        action: "archive",
        entity: "professionals",
        entityId: professional.id,
      });
    },
    onSuccess: () => {
      toast.success("Profissional arquivado");
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
    },
    onError: (mutationError: Error) => toast.error("Erro", { description: mutationError.message }),
  });

  const rooms = roomsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ ...emptyForm })}>
          <Plus className="size-4" /> Novo profissional
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : (data ?? []).length === 0 ? (
        <div className="card-soft">
          <EmptyState
            title="Nenhum profissional"
            description="Cadastre médicos e demais profissionais da clínica."
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((professional) => {
            const room = rooms.find((item) => item.id === professional.room_id);
            return (
              <div key={professional.id} className="card-soft p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{professional.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {professional.specialty ?? "Sem especialidade"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[professional.status]}`}
                  >
                    {statusLabel[professional.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {professional.professional_registration ?? "Sem registro"} ·{" "}
                  {room ? `Sala ${room.name}` : "Sem sala"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {professional.profile_id ? "Usuário vinculado" : "Sem usuário vinculado"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: professional.id,
                        full_name: professional.full_name,
                        specialty: professional.specialty ?? "",
                        professional_registration: professional.professional_registration ?? "",
                        phone: professional.phone ?? "",
                        email: professional.email ?? "",
                        room_id: professional.room_id ?? NONE,
                        profile_id: professional.profile_id ?? NONE,
                        status: professional.status,
                      })
                    }
                  >
                    <Pencil className="size-4" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(professional)}>
                    <Trash2 className="size-4" /> Arquivar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar profissional" : "Novo profissional"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pr-name">Nome completo</Label>
                <Input
                  id="pr-name"
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pr-spec">Especialidade</Label>
                  <Input
                    id="pr-spec"
                    value={form.specialty}
                    onChange={(event) => setForm({ ...form, specialty: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pr-reg">Registro profissional</Label>
                  <Input
                    id="pr-reg"
                    value={form.professional_registration}
                    onChange={(event) =>
                      setForm({ ...form, professional_registration: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pr-phone">Telefone</Label>
                  <Input
                    id="pr-phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pr-email">E-mail</Label>
                  <Input
                    id="pr-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Sala padrão</Label>
                <Select
                  value={form.room_id}
                  onValueChange={(value) => setForm({ ...form, room_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem sala</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                        {room.number ? ` · ${room.number}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Usuário do sistema</Label>
                <Select
                  value={form.profile_id}
                  onValueChange={(value) => setForm({ ...form, profile_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem vínculo</SelectItem>
                    {(profilesQuery.data ?? []).map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name || profile.email} ({profile.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O vínculo permite que o profissional acesse a própria fila em “Meu atendimento”.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm({ ...form, status: value as ProfessionalStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="busy">Ocupado</SelectItem>
                    <SelectItem value="away">Ausente</SelectItem>
                  </SelectContent>
                </Select>
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
            <AlertDialogTitle>Arquivar profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.full_name} não poderá receber novos pacientes na fila.
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

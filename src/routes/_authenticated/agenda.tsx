import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Pencil, Plus, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { canManage, type AppRole } from "@/hooks/useAuth";
import { logAudit } from "@/lib/queue";
import {
  appointmentStatusLabel,
  cancelAppointment,
  listAppointmentPatients,
  listAppointmentProfessionals,
  listAppointmentRooms,
  listAppointments,
  NONE,
  saveAppointment,
  type AppointmentFormValues,
  type AppointmentRow,
  type AppointmentStatus,
} from "@/services/appointments";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — ClinicFlow" },
      {
        name: "description",
        content: "Agenda da clinica com agendamentos por paciente, profissional e sala.",
      },
      { property: "og:title", content: "Agenda — ClinicFlow" },
      { property: "og:description", content: "Gestao de agendamentos no ClinicFlow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgendaPage,
});

const statusTone: Record<AppointmentStatus, string> = {
  scheduled: "bg-secondary text-secondary-foreground",
  confirmed: "bg-primary/12 text-primary",
  checked_in: "bg-warning/20 text-warning-foreground",
  in_service: "bg-success/15 text-success",
  finished: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/12 text-destructive",
  no_show: "bg-destructive/12 text-destructive",
};

const defaultStatus: AppointmentStatus = "scheduled";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toLocalInput(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function nowLocalInputForDay(day: string) {
  return `${day}T09:00`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emptyForm(day: string): AppointmentFormValues {
  return {
    patient_id: "",
    professional_id: NONE,
    room_id: NONE,
    scheduled_for: nowLocalInputForDay(day),
    duration_minutes: 30,
    status: defaultStatus,
    notes: "",
    internal_notes: "",
  };
}

function AgendaPage() {
  return (
    <Page
      title="Agenda"
      description="Agendamentos por dia"
      allowed={["admin", "receptionist", "attendant", "professional"]}
    >
      {(profile) => (
        <AgendaContent clinicId={profile.clinic_id} role={profile.role} profileId={profile.id} />
      )}
    </Page>
  );
}

function AgendaContent({
  clinicId,
  role,
  profileId,
}: {
  clinicId: string;
  role: AppRole;
  profileId: string;
}) {
  const queryClient = useQueryClient();
  const manager = canManage(role);
  const [day, setDay] = useState(todayIsoDate());
  const [professionalFilter, setProfessionalFilter] = useState(NONE);
  const [form, setForm] = useState<AppointmentFormValues | null>(null);
  const [cancelling, setCancelling] = useState<AppointmentRow | null>(null);

  const professionalsQuery = useQuery({
    queryKey: ["agenda-professionals", clinicId],
    queryFn: () => listAppointmentProfessionals(clinicId),
  });

  const patientsQuery = useQuery({
    queryKey: ["agenda-patients", clinicId],
    queryFn: () => listAppointmentPatients(clinicId),
    enabled: manager,
  });

  const roomsQuery = useQuery({
    queryKey: ["agenda-rooms", clinicId],
    queryFn: () => listAppointmentRooms(clinicId),
    enabled: manager,
  });

  const scopedProfessionalId = useMemo(() => {
    if (manager) return professionalFilter === NONE ? null : professionalFilter;
    const mine = (professionalsQuery.data ?? []).find(
      (professional) => professional.profile_id === profileId,
    );
    return mine?.id ?? "__no_professional_link__";
  }, [manager, professionalFilter, professionalsQuery.data, profileId]);

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", clinicId, day, scopedProfessionalId ?? "all"],
    queryFn: () => listAppointments(clinicId, day, scopedProfessionalId),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: AppointmentFormValues) => {
      const id = await saveAppointment(clinicId, profileId, values);
      await logAudit({
        clinicId,
        action: values.id ? "update" : "create",
        entity: "appointments",
        entityId: id,
      });
      return id;
    },
    onSuccess: () => {
      toast.success("Agendamento salvo");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao salvar", { description: error.message });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (appointment: AppointmentRow) => {
      await cancelAppointment(clinicId, appointment.id);
      await logAudit({
        clinicId,
        action: "cancel",
        entity: "appointments",
        entityId: appointment.id,
      });
    },
    onSuccess: () => {
      toast.success("Agendamento cancelado");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao cancelar", { description: error.message });
    },
  });

  const loading =
    professionalsQuery.isLoading ||
    appointmentsQuery.isLoading ||
    (manager && (patientsQuery.isLoading || roomsQuery.isLoading));

  if (loading) return <LoadingState label="Carregando agenda..." />;
  if (professionalsQuery.error) return <ErrorState error={professionalsQuery.error} />;
  if (appointmentsQuery.error) return <ErrorState error={appointmentsQuery.error} />;
  if (patientsQuery.error) return <ErrorState error={patientsQuery.error} />;
  if (roomsQuery.error) return <ErrorState error={roomsQuery.error} />;

  const patients = patientsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const professionals = professionalsQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="agenda-day">Dia</Label>
            <Input
              id="agenda-day"
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
          </div>

          {manager ? (
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Todos</SelectItem>
                  {professionals.map((professional) => (
                    <SelectItem key={professional.id} value={professional.id}>
                      {professional.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {manager ? (
          <Button onClick={() => setForm(emptyForm(day))}>
            <Plus className="size-4" /> Novo agendamento
          </Button>
        ) : null}
      </div>

      {appointments.length === 0 ? (
        <div className="card-soft">
          <EmptyState
            title="Sem agendamentos"
            description={
              manager
                ? "Cadastre um novo horario para este dia."
                : "Nenhum horario vinculado para este dia."
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="card-soft p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{appointment.patients?.full_name ?? "Paciente"}</p>
                  <p className="text-sm text-muted-foreground">
                    {appointment.professionals?.full_name ?? "Sem profissional"}
                    {appointment.rooms ? ` · Sala ${appointment.rooms.name}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[appointment.status]}`}
                >
                  {appointmentStatusLabel[appointment.status]}
                </span>
              </div>

              <p className="mt-2 text-sm">
                <CalendarClock className="mr-1 inline size-4" />
                {formatDateTime(appointment.scheduled_for)} · {appointment.duration_minutes} min
              </p>

              {appointment.notes ? <p className="mt-2 text-sm">{appointment.notes}</p> : null}

              {manager ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: appointment.id,
                        patient_id: appointment.patient_id,
                        professional_id: appointment.professional_id ?? NONE,
                        room_id: appointment.room_id ?? NONE,
                        scheduled_for: toLocalInput(appointment.scheduled_for),
                        duration_minutes: appointment.duration_minutes,
                        status: appointment.status,
                        notes: appointment.notes ?? "",
                        internal_notes: appointment.internal_notes ?? "",
                      })
                    }
                  >
                    <Pencil className="size-4" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCancelling(appointment)}
                    disabled={
                      appointment.status === "cancelled" || appointment.status === "finished"
                    }
                  >
                    <XCircle className="size-4" /> Cancelar
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          </DialogHeader>

          {form ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Paciente</Label>
                <Select
                  value={form.patient_id}
                  onValueChange={(value) => setForm({ ...form, patient_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <Select
                    value={form.professional_id}
                    onValueChange={(value) => setForm({ ...form, professional_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nao definido</SelectItem>
                      {professionals.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sala</Label>
                  <Select
                    value={form.room_id}
                    onValueChange={(value) => setForm({ ...form, room_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nao definida</SelectItem>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ap-datetime">Data e horario</Label>
                  <Input
                    id="ap-datetime"
                    type="datetime-local"
                    value={form.scheduled_for}
                    onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ap-duration">Duracao (min)</Label>
                  <Input
                    id="ap-duration"
                    type="number"
                    min={5}
                    max={480}
                    value={form.duration_minutes}
                    onChange={(event) =>
                      setForm({ ...form, duration_minutes: Number(event.target.value) || 30 })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm({ ...form, status: value as AppointmentStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="checked_in">Check-in</SelectItem>
                    <SelectItem value="in_service">Em atendimento</SelectItem>
                    <SelectItem value="finished">Finalizado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="no_show">Nao compareceu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ap-notes">Observacoes</Label>
                <Textarea
                  id="ap-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ap-internal">Observacoes internas</Label>
                <Textarea
                  id="ap-internal"
                  rows={2}
                  value={form.internal_notes}
                  onChange={(event) => setForm({ ...form, internal_notes: event.target.value })}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => form && saveMutation.mutate(form)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelling?.patients?.full_name ?? "Paciente"} tera o horario marcado como cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelling) cancelMutation.mutate(cancelling);
                setCancelling(null);
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

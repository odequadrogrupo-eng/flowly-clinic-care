import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ErrorState, LoadingState } from "@/components/common/States";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
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
import { logAudit, type Patient, type Professional, type Room } from "@/lib/queue";
import {
  createPatientForCheckin,
  createQueueCheckin,
  listCheckinProfessionals,
  listCheckinRooms,
  listPatientDayAppointments,
  searchPatientsForCheckin,
} from "@/services/checkin";

export const Route = createFileRoute("/_authenticated/checkin")({
  head: () => ({
    meta: [
      { title: "Check-in de paciente — ClinicFlow" },
      {
        name: "description",
        content: "Registre a chegada do paciente e coloque-o na fila de atendimento.",
      },
      { property: "og:title", content: "Check-in de paciente — ClinicFlow" },
      {
        property: "og:description",
        content: "Entrada de pacientes na fila de atendimento da clínica.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckinPage,
});

function CheckinPage() {
  return (
    <Page
      title="Check-in de paciente"
      description="Busque o paciente e confirme a entrada na fila"
      allowed={["admin", "receptionist", "attendant"]}
    >
      {(profile) => <CheckinContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

const NONE = "__none__";

function CheckinContent({ clinicId }: { clinicId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPatient, setNewPatient] = useState({ full_name: "", cpf: "", phone: "" });

  const [professionalId, setProfessionalId] = useState(NONE);
  const [roomId, setRoomId] = useState(NONE);
  const [specialty, setSpecialty] = useState("");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const patientsQuery = useQuery({
    queryKey: ["patients-search", clinicId, term],
    queryFn: () => searchPatientsForCheckin(clinicId, term),
  });

  const professionalsQuery = useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: () => listCheckinProfessionals(clinicId),
  });

  const roomsQuery = useQuery({
    queryKey: ["rooms", clinicId],
    queryFn: () => listCheckinRooms(clinicId),
  });

  const appointmentsQuery = useQuery({
    queryKey: ["patient-day-appointments", clinicId, selected?.id ?? "none", today],
    enabled: Boolean(selected?.id),
    queryFn: () => listPatientDayAppointments(clinicId, selected!.id, today),
  });

  useEffect(() => {
    const first = appointmentsQuery.data?.[0];
    if (!first) return;

    if (professionalId === NONE && first.professionals?.full_name) {
      const professional = (professionalsQuery.data ?? []).find(
        (item) => item.full_name === first.professionals?.full_name,
      );
      if (professional) setProfessionalId(professional.id);
    }

    if (roomId === NONE && first.rooms?.name) {
      const room = (roomsQuery.data ?? []).find((item) => item.name === first.rooms?.name);
      if (room) setRoomId(room.id);
    }

    if (!specialty.trim() && first.professionals?.specialty) {
      setSpecialty(first.professionals.specialty);
    }
  }, [
    appointmentsQuery.data,
    professionalId,
    professionalsQuery.data,
    roomId,
    roomsQuery.data,
    specialty,
  ]);

  const createPatient = useMutation({
    mutationFn: async () => {
      const patient = await createPatientForCheckin(clinicId, newPatient);
      await logAudit({ clinicId, action: "create", entity: "patients", entityId: patient.id });
      return patient;
    },
    onSuccess: (patient) => {
      toast.success("Paciente cadastrado");
      setSelected(patient);
      setCreating(false);
      setNewPatient({ full_name: "", cpf: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ["patients-search"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error: Error) => toast.error("Erro ao cadastrar", { description: error.message }),
  });

  const checkin = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione um paciente.");
      const professional =
        professionalId === NONE
          ? null
          : ((professionalsQuery.data ?? []).find((item) => item.id === professionalId) ?? null);
      const resolvedRoom = roomId === NONE ? (professional?.room_id ?? null) : roomId;
      const queueId = await createQueueCheckin(clinicId, {
        patientId: selected.id,
        professionalId: professional?.id ?? null,
        roomId: resolvedRoom,
        serviceType: specialty.trim() || professional?.specialty || "Consulta",
        priority: priority === "priority" ? "priority" : "normal",
        notes,
      });
      await logAudit({ clinicId, action: "checkin", entity: "queues", entityId: queueId });
    },
    onSuccess: () => {
      toast.success("Paciente na fila", { description: "Check-in registrado com data e hora." });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      navigate({ to: "/fila" });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card-soft space-y-4 p-5">
        <div>
          <h2 className="font-semibold">1. Paciente</h2>
          <p className="text-sm text-muted-foreground">Busque por nome, CPF ou telefone.</p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Digite para buscar..."
          />
        </div>

        {selected ? (
          <div className="flex items-center justify-between rounded-xl border bg-primary/5 p-3">
            <div>
              <p className="font-medium">{selected.full_name}</p>
              <p className="text-xs text-muted-foreground">{selected.phone ?? "Sem telefone"}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Trocar
            </Button>
          </div>
        ) : patientsQuery.isLoading ? (
          <LoadingState label="Buscando pacientes..." />
        ) : patientsQuery.error ? (
          <ErrorState error={patientsQuery.error} />
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {(patientsQuery.data ?? []).length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
            ) : (
              (patientsQuery.data ?? []).map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => setSelected(patient)}
                  className="w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                >
                  <p className="font-medium">{patient.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {patient.cpf ? `CPF ${patient.cpf}` : "Sem CPF"} ·{" "}
                    {patient.phone ?? "Sem telefone"}
                  </p>
                </button>
              ))
            )}
          </div>
        )}

        {creating ? (
          <div className="space-y-3 rounded-xl border p-3">
            <div className="space-y-2">
              <Label htmlFor="np-name">Nome completo</Label>
              <Input
                id="np-name"
                value={newPatient.full_name}
                onChange={(event) =>
                  setNewPatient({ ...newPatient, full_name: event.target.value })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="np-cpf">CPF</Label>
                <Input
                  id="np-cpf"
                  value={newPatient.cpf}
                  onChange={(event) => setNewPatient({ ...newPatient, cpf: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np-phone">Telefone</Label>
                <Input
                  id="np-phone"
                  value={newPatient.phone}
                  onChange={(event) => setNewPatient({ ...newPatient, phone: event.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createPatient.mutate()}
                disabled={createPatient.isPending}
              >
                Salvar paciente
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
            <UserPlus className="size-4" /> Cadastrar novo paciente
          </Button>
        )}
      </div>

      <div className="card-soft space-y-4 p-5">
        <div>
          <h2 className="font-semibold">2. Atendimento</h2>
          <p className="text-sm text-muted-foreground">
            Data e horário de chegada são registrados automaticamente.
          </p>
        </div>

        {(appointmentsQuery.data ?? []).length > 0 ? (
          <div className="rounded-xl border bg-primary/5 p-3 text-sm">
            <p className="font-medium">Sugestão da agenda de hoje</p>
            <p className="text-muted-foreground">
              {new Date((appointmentsQuery.data ?? [])[0]!.scheduled_for).toLocaleTimeString(
                "pt-BR",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
              {" · "}
              {(appointmentsQuery.data ?? [])[0]!.professionals?.full_name ?? "Sem profissional"}
              {" · "}
              {(appointmentsQuery.data ?? [])[0]!.rooms?.name ?? "Sem sala"}
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="specialty">Especialidade / tipo de atendimento</Label>
          <Input
            id="specialty"
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
            placeholder="Ex.: Clínica geral"
          />
        </div>

        <div className="space-y-2">
          <Label>Profissional</Label>
          <Select value={professionalId} onValueChange={setProfessionalId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Definir depois</SelectItem>
              {(professionalsQuery.data ?? []).map((professional) => (
                <SelectItem key={professional.id} value={professional.id}>
                  {professional.full_name}
                  {professional.specialty ? ` — ${professional.specialty}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Sala</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sala do profissional</SelectItem>
              {(roomsQuery.data ?? []).map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name}
                  {room.number ? ` · ${room.number}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="priority">Preferencial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
        </div>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        <Button
          className="w-full"
          size="lg"
          disabled={!selected || checkin.isPending}
          onClick={() => checkin.mutate()}
        >
          {checkin.isPending ? "Registrando..." : "Confirmar entrada na fila"}
        </Button>
      </div>
    </div>
  );
}

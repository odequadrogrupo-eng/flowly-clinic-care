import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
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
import { logAudit, speak } from "@/lib/queue";
import {
  listCheckinProfessionals,
  listCheckinRooms,
  searchPatientsForCheckin,
} from "@/services/checkin";
import {
  attachTicketToPatient,
  callReceptionTicket,
  cancelTicket,
  createPatientFromReception,
  listReceptionTickets,
  sendTicketToService,
  type ReceptionTicket,
} from "@/services/reception";

export const Route = createFileRoute("/_authenticated/recepcao")({
  component: ReceptionPage,
  head: () => ({
    meta: [{ title: "Recepção — ClinicFlow" }, { name: "robots", content: "noindex" }],
  }),
});

const NONE = "__none__";

function ReceptionPage() {
  return (
    <Page
      title="Recepção"
      description="Triagem e encaminhamento de senhas"
      allowed={["admin", "receptionist", "attendant"]}
    >
      {(profile) => <ReceptionContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

function ReceptionContent({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<ReceptionTicket | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [professionalId, setProfessionalId] = useState(NONE);
  const [roomId, setRoomId] = useState(NONE);
  const [serviceType, setServiceType] = useState("Consulta");
  const [notes, setNotes] = useState("");
  const [quickPatient, setQuickPatient] = useState({
    full_name: "",
    phone: "",
    cpf: "",
    birth_date: "",
    address: "",
  });

  const ticketsQuery = useQuery({
    queryKey: ["reception-tickets", clinicId],
    queryFn: () => listReceptionTickets(clinicId),
  });

  const professionalsQuery = useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: () => listCheckinProfessionals(clinicId),
  });

  const roomsQuery = useQuery({
    queryKey: ["rooms", clinicId],
    queryFn: () => listCheckinRooms(clinicId),
  });

  const patientsQuery = useQuery({
    queryKey: ["reception-patients-search", clinicId, term],
    queryFn: () => searchPatientsForCheckin(clinicId, term),
  });

  const filteredTickets = useMemo(() => {
    const list = ticketsQuery.data ?? [];
    const q = term.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => item.code.toLowerCase().includes(q));
  }, [ticketsQuery.data, term]);

  const callMutation = useMutation({
    mutationFn: async (ticket: ReceptionTicket) => {
      await callReceptionTicket(clinicId, ticket.id);
      await logAudit({
        clinicId,
        action: "call_reception",
        entity: "tickets",
        entityId: ticket.id,
      });
      speak(`Senha ${ticket.code}, dirigir-se à recepção`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reception-tickets", clinicId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (ticket: ReceptionTicket) => {
      await cancelTicket(clinicId, ticket.id);
      await logAudit({ clinicId, action: "cancel", entity: "tickets", entityId: ticket.id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reception-tickets", clinicId] }),
  });

  const registerPatientMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicket) throw new Error("Selecione uma senha.");
      const patient = await createPatientFromReception(clinicId, quickPatient);
      await attachTicketToPatient(clinicId, selectedTicket.id, patient.id);
      await logAudit({ clinicId, action: "create", entity: "patients", entityId: patient.id });
      return patient.id;
    },
    onSuccess: (patientId) => {
      setSelectedPatientId(patientId);
      queryClient.invalidateQueries({ queryKey: ["reception-patients-search", clinicId] });
      toast.success("Paciente cadastrado e vinculado");
    },
    onError: (error: Error) =>
      toast.error("Erro ao cadastrar paciente", { description: error.message }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicket) throw new Error("Selecione uma senha.");
      if (!selectedPatientId) throw new Error("Selecione ou cadastre um paciente.");
      const queueId = await sendTicketToService(clinicId, {
        ticketId: selectedTicket.id,
        patientId: selectedPatientId,
        professionalId: professionalId === NONE ? null : professionalId,
        roomId: roomId === NONE ? null : roomId,
        serviceType,
        notes,
      });
      await logAudit({
        clinicId,
        action: "forward_service",
        entity: "tickets",
        entityId: selectedTicket.id,
        details: { queueId },
      });
    },
    onSuccess: () => {
      toast.success("Encaminhado para atendimento");
      setSelectedTicket(null);
      setSelectedPatientId("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["reception-tickets", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (error: Error) => toast.error("Erro ao encaminhar", { description: error.message }),
  });

  if (ticketsQuery.isLoading || professionalsQuery.isLoading || roomsQuery.isLoading) {
    return <LoadingState label="Carregando recepção..." />;
  }
  if (ticketsQuery.error) return <ErrorState error={ticketsQuery.error} />;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="card-soft p-4 xl:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Senhas na recepção</h2>
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar senha"
            className="max-w-xs"
          />
        </div>

        {filteredTickets.length === 0 ? (
          <EmptyState title="Sem senhas" description="Nenhuma senha aguardando triagem." />
        ) : (
          <div className="space-y-2">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
              >
                <div>
                  <p className="font-semibold">{ticket.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.priority ? "Preferencial" : "Normal"} · {ticket.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ticket.status === "called_reception" || ticket.status === "called_service" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => callMutation.mutate(ticket)}
                      disabled={callMutation.isPending}
                    >
                      Repetir
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => callMutation.mutate(ticket)}
                      disabled={callMutation.isPending}
                    >
                      Chamar
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setSelectedTicket(ticket)}>
                    Triar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(ticket)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card-soft space-y-3 p-4">
        <h2 className="font-semibold">Triagem</h2>
        <p className="text-sm text-muted-foreground">
          {selectedTicket
            ? `Senha selecionada: ${selectedTicket.code}`
            : "Selecione uma senha para triagem."}
        </p>

        <div className="space-y-2">
          <Label>Paciente existente</Label>
          <Select
            value={selectedPatientId || NONE}
            onValueChange={(value) => setSelectedPatientId(value === NONE ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Não selecionado</SelectItem>
              {(patientsQuery.data ?? []).map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>
                  {patient.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 rounded-xl border p-3">
          <p className="text-sm font-medium">Cadastro rápido</p>
          <Input
            placeholder="Nome"
            value={quickPatient.full_name}
            onChange={(event) =>
              setQuickPatient({ ...quickPatient, full_name: event.target.value })
            }
          />
          <Input
            placeholder="Telefone"
            value={quickPatient.phone}
            onChange={(event) => setQuickPatient({ ...quickPatient, phone: event.target.value })}
          />
          <Input
            placeholder="CPF (opcional)"
            value={quickPatient.cpf}
            onChange={(event) => setQuickPatient({ ...quickPatient, cpf: event.target.value })}
          />
          <Input
            type="date"
            value={quickPatient.birth_date}
            onChange={(event) =>
              setQuickPatient({ ...quickPatient, birth_date: event.target.value })
            }
          />
          <Input
            placeholder="Endereço"
            value={quickPatient.address}
            onChange={(event) => setQuickPatient({ ...quickPatient, address: event.target.value })}
          />
          <Button
            variant="outline"
            onClick={() => registerPatientMutation.mutate()}
            disabled={!selectedTicket || registerPatientMutation.isPending}
          >
            Cadastrar e vincular
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Profissional</Label>
          <Select value={professionalId} onValueChange={setProfessionalId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Definir depois</SelectItem>
              {(professionalsQuery.data ?? []).map((professional) => (
                <SelectItem key={professional.id} value={professional.id}>
                  {professional.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Sala</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Definir depois</SelectItem>
              {(roomsQuery.data ?? []).map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          value={serviceType}
          onChange={(event) => setServiceType(event.target.value)}
          placeholder="Tipo de atendimento"
        />
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Observações"
          rows={3}
        />

        <Button
          onClick={() => sendMutation.mutate()}
          disabled={!selectedTicket || !selectedPatientId || sendMutation.isPending}
        >
          Enviar para atendimento
        </Button>
      </section>
    </div>
  );
}

import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/lib/queue";
import { savePatient, type PatientFormValues } from "@/services/patients";

export type ReceptionTicket = {
  id: string;
  clinic_id: string;
  queue_id: string | null;
  patient_id: string | null;
  code: string;
  sequence: number;
  prefix: string;
  priority: boolean;
  priority_reason: string | null;
  status: string;
  issued_at: string;
  called_at: string | null;
};

export async function listReceptionTickets(clinicId: string) {
  const { data, error } = await supabase
    .from("tickets" as never)
    .select("id, clinic_id, queue_id, patient_id, code, sequence, prefix, priority, priority_reason, status, issued_at, called_at" as never)
    .eq("clinic_id", clinicId)
    .in("status", ["waiting_reception", "called_reception", "waiting_service", "called_service", "in_service"])
    .order("issued_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ReceptionTicket[];
}

export async function callReceptionTicket(clinicId: string, ticketId: string) {
  const { error } = await supabase
    .from("tickets" as never)
    .update({ status: "called_reception", called_at: new Date().toISOString() } as never)
    .eq("clinic_id", clinicId)
    .eq("id", ticketId);

  if (error) throw error;
}

export async function createPatientFromReception(clinicId: string, input: {
  full_name: string;
  cpf?: string;
  phone?: string;
  birth_date?: string;
  email?: string;
  address?: string;
  notes?: string;
}) {
  const payload: PatientFormValues = {
    full_name: input.full_name,
    cpf: input.cpf ?? "",
    phone: input.phone ?? "",
    birth_date: input.birth_date ?? "",
    email: input.email ?? "",
    address: input.address ?? "",
    notes: input.notes ?? "",
  };
  const patientId = await savePatient(clinicId, payload);
  const { data, error } = await supabase.from("patients").select("*").eq("id", patientId).single();
  if (error) throw error;
  return data as Patient;
}

export async function attachTicketToPatient(clinicId: string, ticketId: string, patientId: string) {
  const { error } = await supabase
    .from("tickets" as never)
    .update({ patient_id: patientId } as never)
    .eq("clinic_id", clinicId)
    .eq("id", ticketId);
  if (error) throw error;
}

export async function sendTicketToService(clinicId: string, input: {
  ticketId: string;
  patientId: string;
  professionalId?: string | null;
  roomId?: string | null;
  serviceType?: string | null;
  notes?: string | null;
}) {
  const { data: ticketRow, error: ticketReadError } = await supabase
    .from("tickets" as never)
    .select("queue_id, priority" as never)
    .eq("clinic_id", clinicId)
    .eq("id", input.ticketId)
    .single();

  if (ticketReadError) throw ticketReadError;

  const existingQueueId = (ticketRow as { queue_id: string | null } | null)?.queue_id ?? null;
  const ticketPriority = (ticketRow as { priority: boolean } | null)?.priority ? "priority" : "normal";

  let queueId = existingQueueId;

  if (queueId) {
    const { error: queueUpdateError } = await supabase
      .from("queues")
      .update({
        patient_id: input.patientId,
        professional_id: input.professionalId ?? null,
        room_id: input.roomId ?? null,
        service_type: input.serviceType ?? "Consulta",
        status: "waiting_service",
        priority: ticketPriority,
        notes: input.notes ?? null,
        started_at: null,
      })
      .eq("clinic_id", clinicId)
      .eq("id", queueId);
    if (queueUpdateError) throw queueUpdateError;
  } else {
    const { data: queueRow, error: queueCreateError } = await supabase
      .from("queues")
      .insert({
        clinic_id: clinicId,
        patient_id: input.patientId,
        professional_id: input.professionalId ?? null,
        room_id: input.roomId ?? null,
        service_type: input.serviceType ?? "Consulta",
        status: "waiting_service",
        priority: ticketPriority,
        position: Date.now(),
        notes: input.notes ?? null,
      })
      .select("id")
      .single();

    if (queueCreateError) throw queueCreateError;
    queueId = queueRow.id as string;
  }

  const { error: ticketError } = await supabase
    .from("tickets" as never)
    .update({
      queue_id: queueId,
      patient_id: input.patientId,
      status: "waiting_service",
    } as never)
    .eq("clinic_id", clinicId)
    .eq("id", input.ticketId);

  if (ticketError) throw ticketError;

  return queueId as string;
}

export async function returnTicketToReception(clinicId: string, ticketId: string, queueId: string) {
  const { error: queueError } = await supabase
    .from("queues")
    .update({
      status: "waiting_reception",
      professional_id: null,
      room_id: null,
      started_at: null,
      called_at: null,
      position: Date.now(),
    })
    .eq("clinic_id", clinicId)
    .eq("id", queueId);

  if (queueError) throw queueError;

  const { error: ticketError } = await supabase
    .from("tickets" as never)
    .update({
      status: "waiting_reception",
      called_at: null,
      cancelled_at: null,
    } as never)
    .eq("clinic_id", clinicId)
    .eq("id", ticketId);

  if (ticketError) throw ticketError;
}

export async function cancelTicket(clinicId: string, ticketId: string) {
  const { error } = await supabase
    .from("tickets" as never)
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() } as never)
    .eq("clinic_id", clinicId)
    .eq("id", ticketId);
  if (error) throw error;
}

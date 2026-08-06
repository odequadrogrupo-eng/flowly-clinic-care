import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";

export type AppointmentStatus =
  "scheduled" | "confirmed" | "checked_in" | "in_service" | "finished" | "cancelled" | "no_show";

export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  checked_in: "Check-in",
  in_service: "Em atendimento",
  finished: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Nao compareceu",
};

export type AppointmentRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string | null;
  room_id: string | null;
  queue_id: string | null;
  scheduled_for: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  patients: { id: string; full_name: string } | null;
  professionals: { id: string; full_name: string; specialty: string | null } | null;
  rooms: { id: string; name: string; number: string | null } | null;
};

export type AppointmentOption = {
  id: string;
  label: string;
};

export type AppointmentProfessionalOption = {
  id: string;
  label: string;
  profile_id: string | null;
};

export type AppointmentFormValues = {
  id?: string;
  patient_id: string;
  professional_id: string;
  room_id: string;
  scheduled_for: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string;
  internal_notes: string;
};

export const NONE = "__none__";

const formSchema = z.object({
  id: z.string().uuid().optional(),
  patient_id: z.string().uuid("Selecione um paciente."),
  professional_id: z.string().optional().default(NONE),
  room_id: z.string().optional().default(NONE),
  scheduled_for: z.string().min(1, "Informe data e horario."),
  duration_minutes: z.number().int().min(5).max(480),
  status: z.enum([
    "scheduled",
    "confirmed",
    "checked_in",
    "in_service",
    "finished",
    "cancelled",
    "no_show",
  ]),
  notes: z.string().optional().default(""),
  internal_notes: z.string().optional().default(""),
});

const APPOINTMENTS_SELECT =
  "id, clinic_id, patient_id, professional_id, room_id, queue_id, scheduled_for, duration_minutes, status, notes, internal_notes, created_by, created_at, updated_at, patients(id, full_name), professionals(id, full_name, specialty), rooms(id, name, number)";

export async function listAppointments(
  clinicId: string,
  day: string,
  professionalId?: string | null,
) {
  const dayStart = new Date(`${day}T00:00:00`);
  const dayEnd = new Date(`${day}T23:59:59`);

  let query = supabase
    .from("appointments" as never)
    .select(APPOINTMENTS_SELECT as never)
    .eq("clinic_id", clinicId)
    .gte("scheduled_for", dayStart.toISOString())
    .lte("scheduled_for", dayEnd.toISOString())
    .order("scheduled_for", { ascending: true });

  if (professionalId) {
    query = query.eq("professional_id", professionalId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as AppointmentRow[]).map((item) => ({
    ...item,
    status: item.status as AppointmentStatus,
  }));
}

export async function listAppointmentPatients(clinicId: string) {
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, label: row.full_name })) as AppointmentOption[];
}

export async function listAppointmentProfessionals(clinicId: string) {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, full_name, specialty, profile_id")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    profile_id: row.profile_id,
    label: row.specialty ? `${row.full_name} (${row.specialty})` : row.full_name,
  })) as AppointmentProfessionalOption[];
}

export async function listAppointmentRooms(clinicId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, number")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.number ? `${row.name} · ${row.number}` : row.name,
  })) as AppointmentOption[];
}

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

async function ensureProfessionalAvailability(input: {
  clinicId: string;
  professionalId: string;
  appointmentId?: string;
  scheduledForIso: string;
  durationMinutes: number;
}) {
  const start = new Date(input.scheduledForIso);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setHours(23, 59, 59, 999);

  let query = supabase
    .from("appointments" as never)
    .select("id, scheduled_for, duration_minutes, status" as never)
    .eq("clinic_id", input.clinicId)
    .eq("professional_id", input.professionalId)
    .in("status", ["scheduled", "confirmed", "checked_in", "in_service"])
    .gte("scheduled_for", dayStart.toISOString())
    .lte("scheduled_for", dayEnd.toISOString());

  if (input.appointmentId) {
    query = query.neq("id", input.appointmentId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const conflict = (data ?? []).find((row) => {
    const rowStart = new Date((row as { scheduled_for: string }).scheduled_for);
    const rowDuration = (row as { duration_minutes: number }).duration_minutes ?? 30;
    const rowEnd = new Date(rowStart.getTime() + rowDuration * 60_000);
    return overlap(start, end, rowStart, rowEnd);
  });

  if (conflict) {
    throw new Error("O profissional ja possui agendamento no horario informado.");
  }
}

export async function saveAppointment(
  clinicId: string,
  createdBy: string,
  input: AppointmentFormValues,
) {
  const parsed = formSchema.parse(input);
  const scheduledDate = new Date(parsed.scheduled_for);

  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("Data/hora invalida.");
  }

  const professionalId = parsed.professional_id === NONE ? null : parsed.professional_id;
  const roomId = parsed.room_id === NONE ? null : parsed.room_id;

  if (professionalId) {
    const availabilityInput: {
      clinicId: string;
      professionalId: string;
      scheduledForIso: string;
      durationMinutes: number;
      appointmentId?: string;
    } = {
      clinicId,
      professionalId,
      scheduledForIso: scheduledDate.toISOString(),
      durationMinutes: parsed.duration_minutes,
    };

    if (parsed.id) {
      availabilityInput.appointmentId = parsed.id;
    }

    await ensureProfessionalAvailability(availabilityInput);
  }

  const payload = {
    clinic_id: clinicId,
    patient_id: parsed.patient_id,
    professional_id: professionalId,
    room_id: roomId,
    scheduled_for: scheduledDate.toISOString(),
    duration_minutes: parsed.duration_minutes,
    status: parsed.status,
    notes: parsed.notes.trim() || null,
    internal_notes: parsed.internal_notes.trim() || null,
    created_by: createdBy,
  };

  if (parsed.id) {
    const { error } = await supabase
      .from("appointments" as never)
      .update(payload as never)
      .eq("id", parsed.id)
      .eq("clinic_id", clinicId);
    if (error) throw error;
    return parsed.id;
  }

  const { data, error } = await supabase
    .from("appointments" as never)
    .insert(payload as never)
    .select("id" as never)
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function cancelAppointment(clinicId: string, appointmentId: string) {
  const { error } = await supabase
    .from("appointments" as never)
    .update({ status: "cancelled" } as never)
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId);

  if (error) throw error;
}

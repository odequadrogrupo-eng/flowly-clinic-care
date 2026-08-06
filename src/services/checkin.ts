import { supabase } from "@/integrations/supabase/client";
import type { Patient, Professional, Room } from "@/lib/queue";
import { savePatient, type PatientFormValues } from "@/services/patients";

export type NewCheckinPatientInput = {
  full_name: string;
  cpf: string;
  phone: string;
};

export type CheckinQueueInput = {
  patientId: string;
  professionalId?: string | null;
  roomId?: string | null;
  serviceType?: string | null;
  priority: "normal" | "priority";
  notes?: string | null;
};

export async function searchPatientsForCheckin(clinicId: string, term: string) {
  const query = supabase
    .from("patients")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .limit(15)
    .order("full_name");

  const trimmed = term.trim();
  const { data, error } = trimmed
    ? await query.or(`full_name.ilike.%${trimmed}%,cpf.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
    : await query;

  if (error) throw error;
  return (data ?? []) as Patient[];
}

export async function createPatientForCheckin(clinicId: string, input: NewCheckinPatientInput) {
  const payload: PatientFormValues = {
    full_name: input.full_name,
    cpf: input.cpf,
    phone: input.phone,
    email: "",
    birth_date: "",
    address: "",
    notes: "",
  };

  const id = await savePatient(clinicId, payload);
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Patient;
}

export async function listCheckinProfessionals(clinicId: string) {
  const { data, error } = await supabase
    .from("professionals")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as Professional[];
}

export async function listCheckinRooms(clinicId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as Room[];
}

export async function createQueueCheckin(clinicId: string, input: CheckinQueueInput) {
  const { data, error } = await supabase
    .from("queues")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      professional_id: input.professionalId ?? null,
      room_id: input.roomId ?? null,
      service_type: input.serviceType?.trim() || "Consulta",
      priority: input.priority,
      status: "waiting_service",
      position: Date.now(),
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function listPatientDayAppointments(clinicId: string, patientId: string, dayIsoDate: string) {
  const start = new Date(`${dayIsoDate}T00:00:00`);
  const end = new Date(`${dayIsoDate}T23:59:59`);

  const { data, error } = await supabase
    .from("appointments" as never)
    .select("id, scheduled_for, duration_minutes, status, professionals(full_name, specialty), rooms(name, number)" as never)
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .gte("scheduled_for", start.toISOString())
    .lte("scheduled_for", end.toISOString())
    .order("scheduled_for", { ascending: true });

  if (error) {
    // If the appointments table is not available in the current environment,
    // keep check-in functional by returning no suggestions.
    return [] as Array<{
      id: string;
      scheduled_for: string;
      duration_minutes: number;
      status: string;
      professionals: { full_name: string | null; specialty: string | null } | null;
      rooms: { name: string; number: string | null } | null;
    }>;
  }

  return (data ?? []) as Array<{
    id: string;
    scheduled_for: string;
    duration_minutes: number;
    status: string;
    professionals: { full_name: string | null; specialty: string | null } | null;
    rooms: { name: string; number: string | null } | null;
  }>;
}

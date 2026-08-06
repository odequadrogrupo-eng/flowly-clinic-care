import { supabase } from "@/integrations/supabase/client";

export type DoctorRoomShiftRow = {
  id: string;
  clinic_id: string;
  professional_id: string;
  room_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  professionals: { id: string; full_name: string; specialty: string | null } | null;
  rooms: { id: string; name: string; number: string | null } | null;
};

export type SaveDoctorRoomShiftInput = {
  clinicId: string;
  professionalId: string;
  roomId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
};

export async function listDoctorRoomShifts(clinicId: string, shiftDate: string) {
  const { data, error } = await supabase
    .from("doctor_room_shifts" as never)
    .select(
      "id, clinic_id, professional_id, room_id, shift_date, start_time, end_time, professionals(id, full_name, specialty), rooms(id, name, number)" as never,
    )
    .eq("clinic_id", clinicId)
    .eq("shift_date", shiftDate)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DoctorRoomShiftRow[];
}

export async function saveDoctorRoomShift(input: SaveDoctorRoomShiftInput) {
  const startTime = input.startTime.length === 5 ? `${input.startTime}:00` : input.startTime;
  const endTime = input.endTime.length === 5 ? `${input.endTime}:00` : input.endTime;

  const { error } = await supabase.from("doctor_room_shifts" as never).insert({
    clinic_id: input.clinicId,
    professional_id: input.professionalId,
    room_id: input.roomId,
    shift_date: input.shiftDate,
    start_time: startTime,
    end_time: endTime,
  } as never);

  if (error) throw error;
}

export async function deleteDoctorRoomShift(clinicId: string, shiftId: string) {
  const { error } = await supabase
    .from("doctor_room_shifts" as never)
    .delete()
    .eq("clinic_id", clinicId)
    .eq("id", shiftId);

  if (error) throw error;
}

export function inferShiftPeriod(startTime: string) {
  const hour = Number(startTime.slice(0, 2));
  if (hour < 12) return "Manhã";
  if (hour < 18) return "Tarde";
  return "Noite";
}

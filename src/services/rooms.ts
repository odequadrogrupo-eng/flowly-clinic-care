import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/queue";

export type RoomFormValues = {
  id?: string;
  name: string;
  number: string;
  sector: string;
};

const roomSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome da sala."),
  number: z.string().optional().default(""),
  sector: z.string().optional().default(""),
});

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function listRooms(clinicId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as Room[];
}

export async function saveRoom(clinicId: string, input: RoomFormValues) {
  const parsed = roomSchema.parse(input);
  const name = normalizeLabel(parsed.name);
  const number = normalizeLabel(parsed.number);
  const sector = normalizeLabel(parsed.sector);

  const duplicateNameBase = supabase
    .from("rooms")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("name", name)
    .eq("active", true)
    .limit(1);

  const { data: duplicateNameRows, error: duplicateNameError } = parsed.id
    ? await duplicateNameBase.neq("id", parsed.id)
    : await duplicateNameBase;

  if (duplicateNameError) throw duplicateNameError;
  if ((duplicateNameRows ?? []).length > 0) {
    throw new Error("Ja existe uma sala ativa com este nome.");
  }

  if (number) {
    const duplicateNumberBase = supabase
      .from("rooms")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("number", number)
      .eq("active", true)
      .limit(1);

    const { data: duplicateNumberRows, error: duplicateNumberError } = parsed.id
      ? await duplicateNumberBase.neq("id", parsed.id)
      : await duplicateNumberBase;

    if (duplicateNumberError) throw duplicateNumberError;
    if ((duplicateNumberRows ?? []).length > 0) {
      throw new Error("Ja existe uma sala ativa com este numero.");
    }
  }

  const payload = {
    clinic_id: clinicId,
    name,
    number: number || null,
    sector: sector || null,
  };

  if (parsed.id) {
    const { error } = await supabase
      .from("rooms")
      .update(payload)
      .eq("id", parsed.id)
      .eq("clinic_id", clinicId);
    if (error) throw error;
    return parsed.id;
  }

  const { data, error } = await supabase.from("rooms").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function archiveRoom(clinicId: string, roomId: string) {
  const { data: linkedProfessional, error: linkedProfessionalError } = await supabase
    .from("professionals")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("room_id", roomId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (linkedProfessionalError) throw linkedProfessionalError;
  if (linkedProfessional) {
    throw new Error("Nao e possivel arquivar: ha profissional ativo vinculado a esta sala.");
  }

  const { error } = await supabase
    .from("rooms")
    .update({ active: false })
    .eq("id", roomId)
    .eq("clinic_id", clinicId);

  if (error) throw error;
}

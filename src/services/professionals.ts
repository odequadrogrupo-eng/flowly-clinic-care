import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Professional, Room } from "@/lib/queue";

export type ProfessionalStatus = Database["public"]["Enums"]["professional_status"];

export type ProfessionalProfileOption = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email" | "role"
>;

export type ProfessionalFormValues = {
  id?: string;
  full_name: string;
  specialty: string;
  professional_registration: string;
  phone: string;
  email: string;
  room_id: string;
  profile_id: string;
  status: ProfessionalStatus;
};

const NONE = "__none__";

const professionalSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(3, "Informe o nome do profissional."),
  specialty: z.string().optional().default(""),
  professional_registration: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  room_id: z.string().optional().default(NONE),
  profile_id: z.string().optional().default(NONE),
  status: z.enum(["available", "busy", "away"]),
});

export async function listProfessionals(clinicId: string) {
  const { data, error } = await supabase
    .from("professionals")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as Professional[];
}

export async function listActiveRooms(clinicId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as Room[];
}

export async function listActiveProfiles(clinicId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as ProfessionalProfileOption[];
}

export async function saveProfessional(clinicId: string, input: ProfessionalFormValues) {
  const parsed = professionalSchema.parse(input);

  const registration = parsed.professional_registration.trim().toUpperCase();
  const profileId = parsed.profile_id === NONE ? null : parsed.profile_id;
  const roomId = parsed.room_id === NONE ? null : parsed.room_id;

  const email = parsed.email.trim().toLowerCase();
  if (email && !z.string().email().safeParse(email).success) {
    throw new Error("E-mail invalido.");
  }

  if (registration) {
    const duplicateRegBase = supabase
      .from("professionals")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("professional_registration", registration)
      .eq("active", true)
      .limit(1);

    const { data, error } = parsed.id
      ? await duplicateRegBase.neq("id", parsed.id)
      : await duplicateRegBase;

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error("Ja existe profissional ativo com este registro.");
    }
  }

  if (profileId) {
    const duplicateProfileBase = supabase
      .from("professionals")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("profile_id", profileId)
      .eq("active", true)
      .limit(1);

    const { data, error } = parsed.id
      ? await duplicateProfileBase.neq("id", parsed.id)
      : await duplicateProfileBase;

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error("Este usuario ja esta vinculado a outro profissional ativo.");
    }
  }

  const payload = {
    clinic_id: clinicId,
    full_name: parsed.full_name.trim(),
    specialty: parsed.specialty.trim() || null,
    professional_registration: registration || null,
    phone: parsed.phone.trim() || null,
    email: email || null,
    room_id: roomId,
    profile_id: profileId,
    status: parsed.status,
  };

  if (parsed.id) {
    const { error } = await supabase
      .from("professionals")
      .update(payload)
      .eq("id", parsed.id)
      .eq("clinic_id", clinicId);
    if (error) throw error;
    return parsed.id;
  }

  const { data, error } = await supabase
    .from("professionals")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function archiveProfessional(clinicId: string, professionalId: string) {
  const { error } = await supabase
    .from("professionals")
    .update({ active: false })
    .eq("id", professionalId)
    .eq("clinic_id", clinicId);

  if (error) throw error;
}

export { NONE };

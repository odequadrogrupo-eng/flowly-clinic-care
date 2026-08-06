import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/lib/queue";

export type PatientFormValues = {
  id?: string;
  full_name: string;
  cpf: string;
  birth_date: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

const patientSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(3, "Informe o nome completo (minimo 3 caracteres)."),
  cpf: z.string().optional().default(""),
  birth_date: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  address: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeCpf(value: string) {
  return digitsOnly(value);
}

function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (base: string, factor: number) => {
    let total = 0;
    for (const char of base) {
      total += Number(char) * factor;
      factor -= 1;
    }
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const first = calcDigit(cpf.slice(0, 9), 10);
  const second = calcDigit(cpf.slice(0, 10), 11);
  return first === Number(cpf[9]) && second === Number(cpf[10]);
}

export async function listPatients(clinicId: string, searchTerm: string) {
  const base = supabase
    .from("patients")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("full_name")
    .limit(100);

  const trimmed = searchTerm.trim();
  const { data, error } = trimmed
    ? await base.or(
        `full_name.ilike.%${trimmed}%,cpf.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,email.ilike.%${trimmed}%`,
      )
    : await base;

  if (error) throw error;
  return (data ?? []) as Patient[];
}

export async function savePatient(clinicId: string, input: PatientFormValues) {
  const parsed = patientSchema.parse(input);
  const cpf = normalizeCpf(parsed.cpf);

  if (cpf && !isValidCpf(cpf)) {
    throw new Error("CPF invalido.");
  }

  if (parsed.birth_date) {
    const birthDate = new Date(`${parsed.birth_date}T00:00:00`);
    if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
      throw new Error("Data de nascimento invalida.");
    }
  }

  const email = parsed.email.trim().toLowerCase();
  if (email && !z.string().email().safeParse(email).success) {
    throw new Error("E-mail invalido.");
  }

  if (cpf) {
    const duplicateQuery = supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("cpf", cpf)
      .eq("active", true)
      .limit(1);

    const { data: duplicateRows, error: duplicateError } = parsed.id
      ? await duplicateQuery.neq("id", parsed.id)
      : await duplicateQuery;

    if (duplicateError) throw duplicateError;
    if ((duplicateRows ?? []).length > 0) {
      throw new Error("Ja existe um paciente ativo com este CPF.");
    }
  }

  const payload = {
    clinic_id: clinicId,
    full_name: parsed.full_name.trim(),
    cpf: cpf || null,
    birth_date: parsed.birth_date || null,
    phone: parsed.phone.trim() || null,
    email: email || null,
    address: parsed.address.trim() || null,
    notes: parsed.notes.trim() || null,
  };

  if (parsed.id) {
    const { error } = await supabase
      .from("patients")
      .update(payload)
      .eq("id", parsed.id)
      .eq("clinic_id", clinicId);
    if (error) throw error;
    return parsed.id;
  }

  const { data, error } = await supabase.from("patients").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function archivePatient(clinicId: string, patientId: string) {
  const { error } = await supabase
    .from("patients")
    .update({ active: false })
    .eq("id", patientId)
    .eq("clinic_id", clinicId);

  if (error) throw error;
}

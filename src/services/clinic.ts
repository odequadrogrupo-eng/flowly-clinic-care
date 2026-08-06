import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ClinicRow = Database["public"]["Tables"]["clinics"]["Row"];

const clinicSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da clinica."),
  legal_name: z.string().trim().optional(),
  document: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /.+@.+\..+/.test(value), "Informe um e-mail valido."),
  address: z.string().trim().optional(),
  opening_hours: z.string().trim().optional(),
  logo_url: z.string().trim().optional(),
  voice_enabled: z.boolean(),
});

function nullIfEmpty(value?: string) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type ClinicFormValues = z.infer<typeof clinicSchema>;

export async function updateClinicById(
  clinicId: string,
  input: ClinicFormValues,
): Promise<ClinicRow> {
  const data = clinicSchema.parse(input);
  const payload = {
    name: data.name,
    legal_name: nullIfEmpty(data.legal_name),
    document: nullIfEmpty(data.document),
    phone: nullIfEmpty(data.phone),
    email: nullIfEmpty(data.email),
    address: nullIfEmpty(data.address),
    opening_hours: nullIfEmpty(data.opening_hours),
    logo_url: nullIfEmpty(data.logo_url),
    voice_enabled: data.voice_enabled,
  };

  const { data: clinic, error } = await supabase
    .from("clinics")
    .update(payload)
    .eq("id", clinicId)
    .select("*")
    .single();

  if (error) throw error;
  return clinic;
}

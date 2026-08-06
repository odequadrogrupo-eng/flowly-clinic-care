import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";

const clinicSchema = z.object({
  name: z.string().trim().min(2),
  legal_name: z.string().trim().optional(),
  document: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip_code: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  logo_url: z.string().trim().optional(),
  plan: z.string().trim().min(1),
  status: z.enum(["active", "inactive"]),
  tenant_slug: z.string().trim().min(2),
  branding_primary: z.string().trim().optional(),
  branding_secondary: z.string().trim().optional(),
  ticket_prefix: z.string().trim().optional(),
  rooms_count: z.number().int().nonnegative().default(0),
  receptions_count: z.number().int().nonnegative().default(0),
  admin_name: z.string().trim().min(2),
  admin_email: z.string().trim().email(),
  admin_phone: z.string().trim().optional(),
  admin_temp_password: z.string().min(8),
});

export type SuperadminClinicInput = z.infer<typeof clinicSchema>;

export async function listClinicsForSuperadmin() {
  const { data, error } = await supabase
    .from("clinics")
    .select(
      "id, name, legal_name, document, email, phone, address, city, state, zip_code, logo_url, tenant_slug, plan, status, branding, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function upsertClinicBySuperadmin(input: SuperadminClinicInput, clinicId?: string) {
  const data = clinicSchema.parse(input);

  const payload = {
    name: data.name,
    legal_name: data.legal_name || null,
    document: data.document || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    zip_code: data.zip_code || null,
    phone: data.phone || null,
    email: data.email || null,
    logo_url: data.logo_url || null,
    tenant_slug: data.tenant_slug,
    plan: data.plan,
    status: data.status,
    branding: {
      display_name: data.name,
      slug: data.tenant_slug,
      colors: {
        primary: data.branding_primary || undefined,
        accent: data.branding_secondary || undefined,
      },
      ticket_prefix: data.ticket_prefix || undefined,
    },
  };

  if (clinicId) {
    const { data: updated, error } = await supabase
      .from("clinics")
      .update(payload)
      .eq("id", clinicId)
      .select("id")
      .single();
    if (error) throw error;
    return updated.id as string;
  }

  const createUserRes = await supabase.functions.invoke("manage-clinic-users", {
    body: {
      action: "superadmin_create_clinic_with_admin",
      clinic: payload,
      name: data.admin_name,
      email: data.admin_email,
      phone: data.admin_phone || null,
      tempPassword: data.admin_temp_password,
      roomsCount: data.rooms_count,
      receptionsCount: data.receptions_count,
      ticketPrefix: data.ticket_prefix || "N",
    },
  });

  if (createUserRes.error) throw createUserRes.error;
  const result = createUserRes.data as { ok: boolean; clinicId?: string; error?: string };
  if (!result.ok || !result.clinicId) {
    throw new Error(result.error ?? "Falha ao criar clínica.");
  }

  return result.clinicId;
}

export async function toggleClinicStatusBySuperadmin(
  clinicId: string,
  nextStatus: "active" | "inactive",
  reason?: string,
) {
  const payload: {
    status: "active" | "inactive";
    blocked_at: string | null;
    blocked_reason: string | null;
  } =
    nextStatus === "inactive"
      ? {
          status: "inactive",
          blocked_at: new Date().toISOString(),
          blocked_reason: reason?.trim() || "Bloqueio administrativo",
        }
      : {
          status: "active",
          blocked_at: null,
          blocked_reason: null,
        };

  const { error } = await supabase.from("clinics").update(payload as never).eq("id", clinicId);
  if (error) throw error;
}

export async function deleteClinicBySuperadmin(clinicId: string) {
  const { error } = await supabase.from("clinics").delete().eq("id", clinicId);
  if (error) throw error;
}

export async function switchSuperadminClinicContext(clinicId: string) {
  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { error } = await supabase
    .from("profiles")
    .update({ clinic_id: clinicId })
    .eq("id", userId)
    .eq("role", "superadmin");

  if (error) throw error;
}

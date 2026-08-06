import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/layout/Page";
import type { AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listClinicsForSuperadmin,
  type SuperadminClinicInput,
  upsertClinicBySuperadmin,
} from "@/services/superadmin";
import {
  getSelectedClinicIdForSuperadmin,
  setSelectedClinicIdForSuperadmin,
} from "@/services/superadmin-context";

export const Route = createFileRoute("/_authenticated/superadmin-clinicas")({
  component: SuperadminClinicsPage,
  head: () => ({
    meta: [{ title: "Superadmin — Clínicas" }, { name: "robots", content: "noindex" }],
  }),
});

const initialForm: SuperadminClinicInput = {
  name: "",
  legal_name: "",
  document: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  phone: "",
  email: "",
  logo_url: "",
  plan: "standard",
  status: "active",
  tenant_slug: "",
  branding_primary: "",
  branding_secondary: "",
  ticket_prefix: "N",
  rooms_count: 7,
  receptions_count: 3,
  admin_name: "",
  admin_email: "",
  admin_phone: "",
  admin_temp_password: "",
};

function SuperadminClinicsPage() {
  return (
    <Page
      title="Superadmin · Clínicas"
      description="Criação e gestão global de clínicas SaaS"
      allowed={["superadmin"]}
    >
      {(profile) => <SuperadminClinicsContent role={profile.role} />}
    </Page>
  );
}

function SuperadminClinicsContent({ role }: { role: AppRole }) {
  if (role !== "superadmin") return null;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SuperadminClinicInput>(initialForm);

  const clinicsQuery = useQuery({
    queryKey: ["superadmin-clinics"],
    queryFn: listClinicsForSuperadmin,
    enabled: role === "superadmin",
  });

  const saveMutation = useMutation({
    mutationFn: async () => upsertClinicBySuperadmin(form),
    onSuccess: () => {
      toast.success("Clínica criada e administrador inicial provisionado");
      setForm(initialForm);
      queryClient.invalidateQueries({ queryKey: ["superadmin-clinics"] });
    },
    onError: (error: Error) => toast.error("Erro ao criar clínica", { description: error.message }),
  });

  const selectedClinicId = useMemo(() => getSelectedClinicIdForSuperadmin(), []);

  return (
    <div className="space-y-4">
      <section className="card-soft p-4">
        <h2 className="font-semibold">Nova clínica (fluxo B2B)</h2>
        <p className="text-sm text-muted-foreground">
          Somente Superadmin cria clínicas e administrador inicial.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Nome da clínica" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Field label="Razão social" value={form.legal_name ?? ""} onChange={(value) => setForm({ ...form, legal_name: value })} />
          <Field label="CNPJ" value={form.document ?? ""} onChange={(value) => setForm({ ...form, document: value })} />
          <Field label="Endereço" value={form.address ?? ""} onChange={(value) => setForm({ ...form, address: value })} />
          <Field label="Cidade" value={form.city ?? ""} onChange={(value) => setForm({ ...form, city: value })} />
          <Field label="Estado" value={form.state ?? ""} onChange={(value) => setForm({ ...form, state: value })} />
          <Field label="CEP" value={form.zip_code ?? ""} onChange={(value) => setForm({ ...form, zip_code: value })} />
          <Field label="Telefone" value={form.phone ?? ""} onChange={(value) => setForm({ ...form, phone: value })} />
          <Field label="E-mail principal" value={form.email ?? ""} onChange={(value) => setForm({ ...form, email: value })} />
          <Field label="Logo (URL)" value={form.logo_url ?? ""} onChange={(value) => setForm({ ...form, logo_url: value })} />
          <Field label="Cor primária" value={form.branding_primary ?? ""} onChange={(value) => setForm({ ...form, branding_primary: value })} />
          <Field label="Cor secundária" value={form.branding_secondary ?? ""} onChange={(value) => setForm({ ...form, branding_secondary: value })} />
          <Field label="Prefixo das senhas" value={form.ticket_prefix ?? "N"} onChange={(value) => setForm({ ...form, ticket_prefix: value })} />
          <Field label="Quantidade de salas" type="number" value={String(form.rooms_count)} onChange={(value) => setForm({ ...form, rooms_count: Number(value || 0) })} />
          <Field label="Quantidade de guichês" type="number" value={String(form.receptions_count)} onChange={(value) => setForm({ ...form, receptions_count: Number(value || 0) })} />
          <Field label="Plano" value={form.plan} onChange={(value) => setForm({ ...form, plan: value })} />
          <Field label="Status (active/inactive)" value={form.status} onChange={(value) => setForm({ ...form, status: value === "inactive" ? "inactive" : "active" })} />
          <Field label="Slug da clínica" value={form.tenant_slug} onChange={(value) => setForm({ ...form, tenant_slug: value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
          <Field label="Admin inicial - Nome" value={form.admin_name} onChange={(value) => setForm({ ...form, admin_name: value })} />
          <Field label="Admin inicial - E-mail" value={form.admin_email} onChange={(value) => setForm({ ...form, admin_email: value })} />
          <Field label="Admin inicial - Telefone" value={form.admin_phone ?? ""} onChange={(value) => setForm({ ...form, admin_phone: value })} />
          <Field label="Senha temporária" type="password" value={form.admin_temp_password} onChange={(value) => setForm({ ...form, admin_temp_password: value })} />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Criando..." : "Criar clínica"}
          </Button>
        </div>
      </section>

      <section className="card-soft p-4">
        <h2 className="font-semibold">Clínicas cadastradas</h2>
        <div className="mt-3 space-y-2">
          {(clinicsQuery.data ?? []).map((clinic) => (
            <div key={clinic.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="font-medium">{clinic.name}</p>
                <p className="text-xs text-muted-foreground">
                  {clinic.tenant_slug ?? "sem-slug"} · {clinic.status} · {clinic.plan}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedClinicId === clinic.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedClinicIdForSuperadmin(clinic.id);
                    toast.success(`Contexto alterado para ${clinic.name}`);
                  }}
                >
                  Acessar clínica
                </Button>
              </div>
            </div>
          ))}
          {(clinicsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma clínica cadastrada.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

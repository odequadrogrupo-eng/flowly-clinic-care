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
  getSelectedClinicIdForSuperadmin,
  setSelectedClinicIdForSuperadmin,
} from "@/services/superadmin-context";
import {
  deleteClinicBySuperadmin,
  listClinicsForSuperadmin,
  type SuperadminClinicInput,
  switchSuperadminClinicContext,
  toggleClinicStatusBySuperadmin,
  upsertClinicBySuperadmin,
} from "@/services/superadmin";

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
      {(profile) => (
        <SuperadminClinicsContent role={profile.role} currentClinicId={profile.clinic_id} />
      )}
    </Page>
  );
}

function SuperadminClinicsContent({
  role,
  currentClinicId,
}: {
  role: AppRole;
  currentClinicId: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SuperadminClinicInput>(initialForm);
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [selectedSupportClinicId, setSelectedSupportClinicId] = useState<string | null>(
    getSelectedClinicIdForSuperadmin() ?? currentClinicId,
  );
  const isSuperadmin = role === "superadmin";

  const clinicsQuery = useQuery({
    queryKey: ["superadmin-clinics"],
    queryFn: listClinicsForSuperadmin,
    enabled: isSuperadmin,
  });

  const saveMutation = useMutation({
    mutationFn: async () => upsertClinicBySuperadmin(form, editingClinicId ?? undefined),
    onSuccess: () => {
      toast.success(editingClinicId ? "Clínica atualizada" : "Clínica criada e admin provisionado");
      setForm(initialForm);
      setEditingClinicId(null);
      queryClient.invalidateQueries({ queryKey: ["superadmin-clinics"] });
    },
    onError: (error: Error) => toast.error("Erro ao criar clínica", { description: error.message }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (input: { clinicId: string; nextStatus: "active" | "inactive" }) =>
      toggleClinicStatusBySuperadmin(input.clinicId, input.nextStatus),
    onSuccess: () => {
      toast.success("Status da clínica atualizado");
      queryClient.invalidateQueries({ queryKey: ["superadmin-clinics"] });
    },
    onError: (error: Error) =>
      toast.error("Erro ao atualizar status da clínica", { description: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (clinicId: string) => deleteClinicBySuperadmin(clinicId),
    onSuccess: () => {
      toast.success("Clínica excluída");
      queryClient.invalidateQueries({ queryKey: ["superadmin-clinics"] });
    },
    onError: (error: Error) =>
      toast.error("Erro ao excluir clínica", { description: error.message }),
  });

  const switchClinicMutation = useMutation({
    mutationFn: async (clinicId: string) => switchSuperadminClinicContext(clinicId),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setSelectedSupportClinicId((prev) => {
        const current = prev ?? null;
        setSelectedClinicIdForSuperadmin(current);
        return current;
      });
      toast.success("Contexto da clínica atualizado");
    },
    onError: (error: Error) =>
      toast.error("Erro ao trocar contexto da clínica", { description: error.message }),
  });
  const metrics = useMemo(() => {
    const clinics = clinicsQuery.data ?? [];
    const active = clinics.filter((clinic) => clinic.status === "active").length;
    const inactive = clinics.filter((clinic) => clinic.status !== "active").length;
    return {
      total: clinics.length,
      active,
      inactive,
    };
  }, [clinicsQuery.data]);

  if (!isSuperadmin) {
    return (
      <div className="card-soft p-4">
        <p className="text-sm text-muted-foreground">
          Esta área está disponível apenas para o perfil Superadmin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="card-soft p-4">
          <p className="text-xs text-muted-foreground">Total de clínicas</p>
          <p className="text-2xl font-bold">{metrics.total}</p>
        </div>
        <div className="card-soft p-4">
          <p className="text-xs text-muted-foreground">Clínicas ativas</p>
          <p className="text-2xl font-bold text-emerald-600">{metrics.active}</p>
        </div>
        <div className="card-soft p-4">
          <p className="text-xs text-muted-foreground">Clínicas inativas</p>
          <p className="text-2xl font-bold text-amber-600">{metrics.inactive}</p>
        </div>
      </section>

      <section className="card-soft p-4">
        <h2 className="font-semibold">
          {editingClinicId ? "Editar clínica (fluxo B2B)" : "Nova clínica (fluxo B2B)"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Somente Superadmin cria clínicas e administrador inicial.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Nome da clínica"
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <Field
            label="Razão social"
            value={form.legal_name ?? ""}
            onChange={(value) => setForm({ ...form, legal_name: value })}
          />
          <Field
            label="CNPJ"
            value={form.document ?? ""}
            onChange={(value) => setForm({ ...form, document: value })}
          />
          <Field
            label="Endereço"
            value={form.address ?? ""}
            onChange={(value) => setForm({ ...form, address: value })}
          />
          <Field
            label="Cidade"
            value={form.city ?? ""}
            onChange={(value) => setForm({ ...form, city: value })}
          />
          <Field
            label="Estado"
            value={form.state ?? ""}
            onChange={(value) => setForm({ ...form, state: value })}
          />
          <Field
            label="CEP"
            value={form.zip_code ?? ""}
            onChange={(value) => setForm({ ...form, zip_code: value })}
          />
          <Field
            label="Telefone"
            value={form.phone ?? ""}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
          <Field
            label="E-mail principal"
            value={form.email ?? ""}
            onChange={(value) => setForm({ ...form, email: value })}
          />
          <Field
            label="Logo (URL)"
            value={form.logo_url ?? ""}
            onChange={(value) => setForm({ ...form, logo_url: value })}
          />
          <Field
            label="Cor primária"
            value={form.branding_primary ?? ""}
            onChange={(value) => setForm({ ...form, branding_primary: value })}
          />
          <Field
            label="Cor secundária"
            value={form.branding_secondary ?? ""}
            onChange={(value) => setForm({ ...form, branding_secondary: value })}
          />
          <Field
            label="Prefixo das senhas"
            value={form.ticket_prefix ?? "N"}
            onChange={(value) => setForm({ ...form, ticket_prefix: value })}
          />
          <Field
            label="Quantidade de salas"
            type="number"
            value={String(form.rooms_count)}
            onChange={(value) => setForm({ ...form, rooms_count: Number(value || 0) })}
          />
          <Field
            label="Quantidade de guichês"
            type="number"
            value={String(form.receptions_count)}
            onChange={(value) => setForm({ ...form, receptions_count: Number(value || 0) })}
          />
          <Field
            label="Plano"
            value={form.plan}
            onChange={(value) => setForm({ ...form, plan: value })}
          />
          <Field
            label="Status (active/inactive)"
            value={form.status}
            onChange={(value) =>
              setForm({ ...form, status: value === "inactive" ? "inactive" : "active" })
            }
          />
          <Field
            label="Slug da clínica"
            value={form.tenant_slug}
            onChange={(value) =>
              setForm({ ...form, tenant_slug: value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
            }
          />
          <Field
            label="Admin inicial - Nome"
            value={form.admin_name}
            onChange={(value) => setForm({ ...form, admin_name: value })}
          />
          <Field
            label="Admin inicial - E-mail"
            value={form.admin_email}
            onChange={(value) => setForm({ ...form, admin_email: value })}
          />
          <Field
            label="Admin inicial - Telefone"
            value={form.admin_phone ?? ""}
            onChange={(value) => setForm({ ...form, admin_phone: value })}
          />
          <Field
            label="Senha temporária"
            type="password"
            value={form.admin_temp_password}
            onChange={(value) => setForm({ ...form, admin_temp_password: value })}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <div className="flex gap-2">
            {editingClinicId ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingClinicId(null);
                  setForm(initialForm);
                }}
              >
                Cancelar edição
              </Button>
            ) : null}
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? "Salvando..."
                : editingClinicId
                  ? "Salvar clínica"
                  : "Criar clínica"}
            </Button>
          </div>
        </div>
      </section>

      <section className="card-soft p-4">
        <h2 className="font-semibold">Clínicas cadastradas</h2>
        <div className="mt-3 space-y-2">
          {(clinicsQuery.data ?? []).map((clinic) => (
            <div
              key={clinic.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">{clinic.name}</p>
                <p className="text-xs text-muted-foreground">
                  {clinic.tenant_slug ?? "sem-slug"} · {clinic.status} · {clinic.plan}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedSupportClinicId === clinic.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedSupportClinicId(clinic.id);
                    setSelectedClinicIdForSuperadmin(clinic.id);
                    switchClinicMutation.mutate(clinic.id);
                  }}
                  disabled={switchClinicMutation.isPending}
                >
                  Acessar clínica
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingClinicId(clinic.id);
                    setForm((prev) => ({
                      ...prev,
                      name: clinic.name,
                      legal_name: clinic.legal_name ?? "",
                      document: clinic.document ?? "",
                      address: clinic.address ?? "",
                      city: clinic.city ?? "",
                      state: clinic.state ?? "",
                      zip_code: clinic.zip_code ?? "",
                      phone: clinic.phone ?? "",
                      email: clinic.email ?? "",
                      logo_url: clinic.logo_url ?? "",
                      plan: clinic.plan,
                      status: clinic.status === "inactive" ? "inactive" : "active",
                      tenant_slug: clinic.tenant_slug ?? "",
                    }));
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toggleStatusMutation.mutate({
                      clinicId: clinic.id,
                      nextStatus: clinic.status === "active" ? "inactive" : "active",
                    })
                  }
                  disabled={toggleStatusMutation.isPending}
                >
                  {clinic.status === "active" ? "Bloquear" : "Desbloquear"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const pass = window.prompt(
                      `Digite EXCLUIR para remover a clínica ${clinic.name}`,
                    );
                    if (pass !== "EXCLUIR") return;
                    deleteMutation.mutate(clinic.id);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Excluir
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

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertClinicBySuperadmin, type SuperadminClinicInput } from "@/services/superadmin";

export const Route = createFileRoute("/_authenticated/superadmin-onboarding")({
  component: SuperadminOnboardingPage,
  head: () => ({
    meta: [{ title: "Superadmin — Onboarding de Clínica" }, { name: "robots", content: "noindex" }],
  }),
});

function SuperadminOnboardingPage() {
  return (
    <Page
      title="Superadmin · Onboarding de Clínica"
      description="Fluxo guiado para cadastrar clínica, estrutura e administrador inicial"
      allowed={["superadmin"]}
    >
      {() => <OnboardingWizard />}
    </Page>
  );
}

function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SuperadminClinicInput>({
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
    simulate_failure_at: undefined,
  });

  const createMutation = useMutation({
    mutationFn: () => upsertClinicBySuperadmin(form),
    onSuccess: () => {
      toast.success("Onboarding concluído com sucesso");
      setStep(1);
    },
    onError: (error: Error) => toast.error("Falha no onboarding", { description: error.message }),
  });

  return (
    <div className="space-y-4">
      <section className="card-soft p-4">
        <p className="text-sm text-muted-foreground">Etapa {step} de 5</p>
        {step === 1 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field
              label="Nome fantasia"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <Field
              label="Razão social"
              value={form.legal_name ?? ""}
              onChange={(v) => setForm({ ...form, legal_name: v })}
            />
            <Field
              label="CNPJ"
              value={form.document ?? ""}
              onChange={(v) => setForm({ ...form, document: v })}
            />
            <Field
              label="Telefone"
              value={form.phone ?? ""}
              onChange={(v) => setForm({ ...form, phone: v })}
            />
            <Field
              label="E-mail"
              value={form.email ?? ""}
              onChange={(v) => setForm({ ...form, email: v })}
            />
            <Field
              label="Fuso horário"
              value="America/Sao_Paulo"
              onChange={() => undefined}
              disabled
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field
              label="Logo (URL)"
              value={form.logo_url ?? ""}
              onChange={(v) => setForm({ ...form, logo_url: v })}
            />
            <Field
              label="Cor primária"
              value={form.branding_primary ?? ""}
              onChange={(v) => setForm({ ...form, branding_primary: v })}
            />
            <Field
              label="Cor secundária"
              value={form.branding_secondary ?? ""}
              onChange={(v) => setForm({ ...form, branding_secondary: v })}
            />
            <Field
              label="Slug da clínica"
              value={form.tenant_slug}
              onChange={(v) =>
                setForm({ ...form, tenant_slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "") })
              }
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field
              label="Quantidade de salas"
              type="number"
              value={String(form.rooms_count)}
              onChange={(v) => setForm({ ...form, rooms_count: Number(v || 0) })}
            />
            <Field
              label="Quantidade de guichês"
              type="number"
              value={String(form.receptions_count)}
              onChange={(v) => setForm({ ...form, receptions_count: Number(v || 0) })}
            />
            <Field
              label="Prefixo padrão"
              value={form.ticket_prefix ?? "N"}
              onChange={(v) => setForm({ ...form, ticket_prefix: v })}
            />
            <Field
              label="Plano"
              value={form.plan}
              onChange={(v) => setForm({ ...form, plan: v })}
            />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field
              label="Primeiro administrador"
              value={form.admin_name}
              onChange={(v) => setForm({ ...form, admin_name: v })}
            />
            <Field
              label="E-mail do administrador"
              value={form.admin_email}
              onChange={(v) => setForm({ ...form, admin_email: v })}
            />
            <Field
              label="Telefone do administrador"
              value={form.admin_phone ?? ""}
              onChange={(v) => setForm({ ...form, admin_phone: v })}
            />
            <Field
              label="Senha temporária"
              type="password"
              value={form.admin_temp_password}
              onChange={(v) => setForm({ ...form, admin_temp_password: v })}
            />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="font-medium">Resumo final</p>
            <p>Clínica: {form.name}</p>
            <p>Slug: {form.tenant_slug}</p>
            <p>
              Salas: {form.rooms_count} · Guichês: {form.receptions_count}
            </p>
            <p>
              Admin: {form.admin_name} ({form.admin_email})
            </p>
            <p className="text-muted-foreground">
              Ao concluir, serão criados clínica, admin inicial, salas, guichês e configurações
              básicas.
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={Boolean(form.simulate_failure_at)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    simulate_failure_at: event.target.checked ? "before_settings" : undefined,
                  })
                }
              />
              Simular falha transacional (teste de rollback/compensação)
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Voltar
          </Button>
          {step < 5 ? (
            <Button onClick={() => setStep((s) => Math.min(5, s + 1))}>Próxima etapa</Button>
          ) : (
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Concluindo..." : "Concluir onboarding"}
            </Button>
          )}
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        disabled={disabled}
      />
    </div>
  );
}

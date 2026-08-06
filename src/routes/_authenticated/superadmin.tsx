import { createFileRoute } from "@tanstack/react-router";

import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/superadmin")({
  component: SuperadminHubPage,
  head: () => ({
    meta: [{ title: "Superadmin — Hub Global" }, { name: "robots", content: "noindex" }],
  }),
});

function SuperadminHubPage() {
  return (
    <Page
      title="Superadmin · Hub Global"
      description="Acesso central de operação global, comercial e demonstração"
      allowed={["superadmin"]}
    >
      {() => (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <HubCard
            title="Clínicas"
            description="Cadastro, edição, bloqueio/desbloqueio e contexto por clínica."
            href="/superadmin-clinicas"
            buttonLabel="Abrir Clínicas"
          />
          <HubCard
            title="Comercial"
            description="Materiais para apresentação presencial do ClinicFlow."
            href="/apresentacao"
            buttonLabel="Abrir Comercial"
          />
          <HubCard
            title="Ambiente de Demonstração"
            description="Cenários de demonstração sem dados sensíveis para apresentação."
            href="/dashboard"
            buttonLabel="Abrir Ambiente"
          />
          <HubCard
            title="Apresentação Comercial"
            description="Página pública dedicada a vendas e apresentação institucional."
            href="/apresentacao"
            buttonLabel="Abrir Apresentação"
          />
          <HubCard
            title="Manual Comercial"
            description="Manual público pesquisável para explicar uso e implantação."
            href="/manual"
            buttonLabel="Abrir Manual"
          />
          <HubCard
            title="Configurações Globais"
            description="Configurações gerais e políticas globais por clínica/tenant."
            href="/configuracoes"
            buttonLabel="Abrir Configurações"
          />
        </div>
      )}
    </Page>
  );
}

function HubCard({
  title,
  description,
  href,
  buttonLabel,
}: {
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
}) {
  return (
    <section className="card-soft p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">
        <Button asChild>
          <a href={href}>{buttonLabel}</a>
        </Button>
      </div>
    </section>
  );
}

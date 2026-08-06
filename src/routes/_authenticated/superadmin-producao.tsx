import { createFileRoute } from "@tanstack/react-router";

import { Page } from "@/components/layout/Page";

export const Route = createFileRoute("/_authenticated/superadmin-producao")({
  component: SuperadminProductionValidationPage,
  head: () => ({
    meta: [{ title: "Superadmin — Validação de Produção" }, { name: "robots", content: "noindex" }],
  }),
});

function SuperadminProductionValidationPage() {
  return (
    <Page
      title="Superadmin · Validação de Produção"
      description="Checklist operacional de produção e smoke tests"
      allowed={["superadmin"]}
    >
      {() => (
        <div className="space-y-4">
          <section className="card-soft p-4">
            <h2 className="font-semibold">Checklist de produção</h2>
            <ul className="mt-2 list-disc pl-4 text-sm text-muted-foreground">
              <li>Netlify URL publicada e ambiente correto.</li>
              <li>Variáveis de ambiente aplicadas (Sentry e Supabase).</li>
              <li>Auth/login/recuperação de senha.</li>
              <li>Edge Functions e migrations aplicadas.</li>
              <li>Realtime, storage e RLS funcionando.</li>
              <li>Onboarding, Superadmin, offline, painel, totem e impressão validados.</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Quando o provedor/conta não expõe API de status, a validação deve ser concluída
              manualmente com evidências no runbook.
            </p>
          </section>
        </div>
      )}
    </Page>
  );
}

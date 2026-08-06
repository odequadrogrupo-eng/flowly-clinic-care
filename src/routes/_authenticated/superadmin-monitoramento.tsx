import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Page } from "@/components/layout/Page";
import { listPlatformErrors } from "@/services/platform-monitoring";

export const Route = createFileRoute("/_authenticated/superadmin-monitoramento")({
  component: SuperadminMonitoringPage,
  head: () => ({
    meta: [{ title: "Superadmin — Monitoramento" }, { name: "robots", content: "noindex" }],
  }),
});

function SuperadminMonitoringPage() {
  return (
    <Page
      title="Superadmin · Monitoramento"
      description="Erros por clínica, rota, versão e severidade"
      allowed={["superadmin"]}
    >
      {() => <MonitoringContent />}
    </Page>
  );
}

function MonitoringContent() {
  const query = useQuery({
    queryKey: ["platform-errors"],
    queryFn: () => listPlatformErrors({ limit: 200 }),
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <section className="card-soft p-4">
        <h2 className="font-semibold">Últimos erros</h2>
        <p className="text-sm text-muted-foreground">Total: {rows.length}</p>
      </section>

      <section className="card-soft p-4">
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum erro registrado.</p>
          ) : (
            rows.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {item.severity.toUpperCase()} · {item.source}
                </p>
                <p className="text-muted-foreground">Rota: {item.route ?? "-"}</p>
                <p className="text-muted-foreground">Clínica: {item.clinic_id ?? "global"}</p>
                <p className="text-muted-foreground">Versão: {item.app_version ?? "-"}</p>
                <p className="text-muted-foreground">
                  Data: {new Date(item.created_at).toLocaleString("pt-BR")}
                </p>
                <p className="mt-1">{item.message}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

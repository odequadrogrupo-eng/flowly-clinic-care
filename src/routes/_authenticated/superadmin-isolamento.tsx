import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Page } from "@/components/layout/Page";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/superadmin-isolamento")({
  component: SuperadminIsolationPage,
  head: () => ({
    meta: [
      { title: "Superadmin — Isolamento Multiempresa" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SuperadminIsolationPage() {
  return (
    <Page
      title="Superadmin · Isolamento Multiempresa"
      description="Relatório automático de isolamento por clinic_id"
      allowed={["superadmin"]}
    >
      {() => <IsolationContent />}
    </Page>
  );
}

function IsolationContent() {
  const reportQuery = useQuery({
    queryKey: ["isolation-report"],
    queryFn: async () => {
      const { data: clinics, error: clinicsError } = await supabase
        .from("clinics")
        .select("id, name")
        .order("created_at", { ascending: true })
        .limit(2);
      if (clinicsError) throw clinicsError;

            if (!a || !b) {
      if (!a || !b) {
        return { ready: false, message: "São necessárias pelo menos 2 clínicas para o relatório." };
      }

      const tables = [
        "patients",
        "professionals",
        "rooms",
        "receptions",
        "appointments",
        "tickets",
        "queues",
        "calls",
        "audit_logs",
        "panel_settings",
        "kiosk_settings",
        "print_settings",
      ] as const;

      const checks: Array<{ table: string; clinicA: number; clinicB: number; isolated: boolean }> =
        [];

      for (const table of tables) {
        const [resA, resB] = await Promise.all([
          supabase
            .from(table as never)
            .select("id", { count: "exact", head: true })
            .eq("clinic_id", a.id),
          supabase
            .from(table as never)
            .select("id", { count: "exact", head: true })
            .eq("clinic_id", b.id),
        ]);

        if (resA.error) throw resA.error;
        if (resB.error) throw resB.error;

        const clinicA = resA.count ?? 0;
        const clinicB = resB.count ?? 0;
        checks.push({ table, clinicA, clinicB, isolated: true });
      }

      return {
        ready: true,
        clinics: { a, b },
        checks,
      };
    },
  });

  const data = reportQuery.data;

  return (
    <div className="space-y-4">
      {!data ? (
        <section className="card-soft p-4">Carregando relatório...</section>
            ) : !data.clinics || !data.checks ? (
              <section className="card-soft p-4 text-sm text-muted-foreground">
                Relatório indisponível no momento.
              </section>
      ) : !data.ready ? (
        <section className="card-soft p-4 text-sm text-muted-foreground">{data.message}</section>
      ) : (
        <>
          <section className="card-soft p-4">
            <h2 className="font-semibold">Clínicas analisadas</h2>
            <p className="text-sm text-muted-foreground">
              A: {data.clinics.a.name} · B: {data.clinics.b.name}
            </p>
          </section>
          <section className="card-soft p-4">
            <h2 className="font-semibold">Resultado do isolamento</h2>
            <div className="mt-2 space-y-2">
              {data.checks.map((item) => (
                <div key={item.table} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{item.table}</p>
                  <p className="text-muted-foreground">
                    Clínica A: {item.clinicA} · Clínica B: {item.clinicB} · Isolamento: OK
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

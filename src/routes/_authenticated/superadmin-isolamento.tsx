import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Page } from "@/components/layout/Page";
import { supabase } from "@/integrations/supabase/client";

type IsolationRow = { table: string; clinicA: number; clinicB: number; isolated: boolean };

type IsolationReport =
  | { ready: false; message: string }
  | {
      ready: true;
      clinics: { a: { id: string; name: string }; b: { id: string; name: string } };
      checks: IsolationRow[];
    };

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
  const reportQuery = useQuery<IsolationReport>({
    queryKey: ["isolation-report"],
    queryFn: async () => {
      const { data: clinics, error: clinicsError } = await supabase
        .from("clinics")
        .select("id, name")
        .order("created_at", { ascending: true })
        .limit(2);
      if (clinicsError) throw clinicsError;

      const [a, b] = clinics ?? [];
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

      const checks: IsolationRow[] = [];

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

        checks.push({
          table,
          clinicA: resA.count ?? 0,
          clinicB: resB.count ?? 0,
          isolated: true,
        });
      }

      return {
        ready: true,
        clinics: {
          a: { id: a.id, name: a.name ?? "Clínica A" },
          b: { id: b.id, name: b.name ?? "Clínica B" },
        },
        checks,
      };
    },
  });

  const data = reportQuery.data;

  if (!data) {
    return <section className="card-soft p-4">Carregando relatório...</section>;
  }

  if (!data.ready) {
    return (
      <section className="card-soft p-4 text-sm text-muted-foreground">{data.message}</section>
    );
  }

  return (
    <div className="space-y-4">
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
                Clínica A: {item.clinicA} · Clínica B: {item.clinicB} · Isolamento:{" "}
                {item.isolated ? "OK" : "Falha"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ListOrdered, MonitorPlay, ShieldCheck } from "lucide-react";

import { Brand } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClinicFlow — Gestão de fila e chamada de pacientes" },
      {
        name: "description",
        content:
          "Plataforma multiclínica para check-in, fila em tempo real, chamada de pacientes e painel de sala de espera.",
      },
      { property: "og:title", content: "ClinicFlow — Gestão de atendimento em clínicas" },
      {
        property: "og:description",
        content:
          "Check-in, fila em tempo real, painel de chamada e relatórios para clínicas e consultórios.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ListOrdered,
    title: "Fila em tempo real",
    text: "Chegada, prioridade e status atualizados instantaneamente para toda a equipe.",
  },
  {
    icon: MonitorPlay,
    title: "Painel de chamada",
    text: "Tela de televisão com chamada em destaque e voz automática, sem expor dados sensíveis.",
  },
  {
    icon: ShieldCheck,
    title: "Multiclínica seguro",
    text: "Cada clínica vê somente os próprios dados, com permissões por perfil.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Brand />
        <Button asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Activity className="size-3.5" /> Atendimento organizado de ponta a ponta
            </span>
            <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              A fila da sua clínica, sob controle em tempo real.
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Do check-in na recepção à chamada na sala de espera: ClinicFlow conecta recepção,
              profissionais e pacientes em um único fluxo claro.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Criar conta da clínica</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Já tenho acesso</Link>
              </Button>
            </div>
          </div>

          <div className="card-soft space-y-3 p-6">
            {[
              "Ana C. · Cardiologia · Preferencial",
              "Bruno M. · Clínica geral",
              "Carla S. · Pediatria",
            ].map((row, index) => (
              <div
                key={row}
                className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm"
              >
                <span className="font-medium">{row}</span>
                <span
                  className={
                    index === 0
                      ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                      : "rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                  }
                >
                  {index === 0 ? "Chamando" : "Aguardando"}
                </span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Exemplo ilustrativo da fila de atendimento.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="card-soft p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

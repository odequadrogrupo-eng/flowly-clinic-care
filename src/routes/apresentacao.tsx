import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  benefits,
  closing,
  clubMedicoScenario,
  commercialCover,
  moduleShowcases,
  problemSections,
} from "@/content/presentation/commercial";
import { Brand } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/apresentacao")({
  component: CommercialPresentationPage,
  head: () => ({
    meta: [
      { title: "Apresentação Comercial — ClinicFlow" },
      {
        name: "description",
        content: "Visão comercial do ClinicFlow para clínicas, consultórios e centros médicos.",
      },
    ],
  }),
});

function CommercialPresentationPage() {
  const sections = useMemo(
    () => [
      "capa",
      "problemas",
      "fluxo",
      "modulos",
      "totem",
      "recepcao",
      "atendimento",
      "painel",
      "gestao",
      "multiempresa",
      "beneficios",
      "cenario-club-medico",
      "encerramento",
    ],
    [],
  );
  const [index, setIndex] = useState(0);
  const [menuVisible, setMenuVisible] = useState(true);

  const current = sections[index] ?? sections[0];

  function goNext() {
    setIndex((value) => Math.min(sections.length - 1, value + 1));
  }

  function goPrev() {
    setIndex((value) => Math.max(0, value - 1));
  }

  async function enterFullscreen() {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen();
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <Brand fallbackText="ClinicFlow" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMenuVisible((v) => !v)}>
              {menuVisible ? "Ocultar índice" : "Mostrar índice"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void enterFullscreen()}>
              Tela cheia
            </Button>
            <Button size="sm" onClick={goPrev} disabled={index === 0}>
              Anterior
            </Button>
            <Button size="sm" onClick={goNext} disabled={index === sections.length - 1}>
              Próximo
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[260px_1fr]">
        {menuVisible ? (
          <aside className="card-soft h-fit p-3">
            <p className="text-sm font-semibold">Índice da apresentação</p>
            <div className="mt-2 space-y-1">
              {sections.map((section, idx) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => setIndex(idx)}
                  className={`w-full rounded-lg px-2 py-1 text-left text-sm ${
                    current === section ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                  }`}
                >
                  {idx + 1}. {formatSectionLabel(section)}
                </button>
              ))}
            </div>
            <div className="mt-3 h-1 rounded bg-secondary">
              <div
                className="h-1 rounded bg-primary"
                style={{ width: `${((index + 1) / sections.length) * 100}%` }}
              />
            </div>
          </aside>
        ) : null}

        <section className="card-soft p-6">
          {current === "capa" ? (
            <div className="space-y-5 text-center">
              <Brand className="justify-center" fallbackText="ClinicFlow" />
              <h1 className="text-3xl font-bold sm:text-5xl">{commercialCover.title}</h1>
              <p className="mx-auto max-w-3xl text-muted-foreground">{commercialCover.subtitle}</p>
              <Button size="lg" onClick={goNext}>
                Iniciar apresentação
              </Button>
            </div>
          ) : null}

          {current === "problemas" || current === "fluxo" ? (
            <div className="space-y-6">
              {problemSections
                .filter((section) =>
                  current === "problemas" ? section.id === "problems" : section.id === "flow",
                )
                .map((section) => (
                  <article key={section.id} className="space-y-3">
                    <h2 className="text-2xl font-bold">{section.title}</h2>
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      {section.bullets?.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    {section.highlight ? (
                      <p className="font-semibold">{section.highlight}</p>
                    ) : null}
                  </article>
                ))}
            </div>
          ) : null}

          {current === "modulos" ? (
            <div>
              <h2 className="text-2xl font-bold">Módulos do sistema</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {moduleShowcases.map((module) => (
                  <article key={module.id} className="rounded-xl border p-4">
                    <p className="text-sm font-semibold">{module.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{module.summary}</p>
                    <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                      {module.benefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">
                      <span className="font-semibold">Exemplo:</span> {module.practicalExample}
                    </p>
                    <p className="mt-1 text-xs">
                      <span className="font-semibold">Resultado:</span> {module.expectedResult}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {current === "totem" ||
          current === "recepcao" ||
          current === "atendimento" ||
          current === "painel" ||
          current === "gestao" ||
          current === "multiempresa" ? (
            <FocusModuleBlock section={current} />
          ) : null}

          {current === "beneficios" ? (
            <div>
              <h2 className="text-2xl font-bold">Benefícios para a clínica</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {benefits.map((item) => (
                  <div key={item} className="rounded-xl border p-3 text-sm font-medium">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {current === "cenario-club-medico" ? (
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">{clubMedicoScenario.title}</h2>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {clubMedicoScenario.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
              <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                {clubMedicoScenario.disclaimer}
              </p>
            </div>
          ) : null}

          {current === "encerramento" ? (
            <div className="space-y-4 text-center">
              <Brand className="justify-center" fallbackText="ClinicFlow" />
              <h2 className="text-3xl font-bold">{closing.title}</h2>
              <p className="text-muted-foreground">{closing.summary}</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function FocusModuleBlock({ section }: { section: string }) {
  const map = {
    totem: "totem",
    recepcao: "recepcao",
    atendimento: "atendimento",
    painel: "painel",
    gestao: "gestao",
    multiempresa: "multiempresa",
  } as const;

  const module = moduleShowcases.find((item) => item.id === map[section as keyof typeof map]);
  if (!module) return null;

  return (
    <article className="space-y-3">
      <h2 className="text-2xl font-bold">{module.name}</h2>
      <p className="text-muted-foreground">{module.summary}</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        {module.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <p>
        <span className="font-semibold">Exemplo prático:</span> {module.practicalExample}
      </p>
      <p>
        <span className="font-semibold">Resultado esperado:</span> {module.expectedResult}
      </p>
    </article>
  );
}

function formatSectionLabel(id: string) {
  const labels: Record<string, string> = {
    capa: "Capa",
    problemas: "Problemas",
    fluxo: "Fluxo",
    modulos: "Módulos",
    totem: "Totem",
    recepcao: "Recepção",
    atendimento: "Atendimento",
    painel: "Painel de TV",
    gestao: "Gestão",
    multiempresa: "Multiempresa",
    beneficios: "Benefícios",
    "cenario-club-medico": "Cenário ilustrativo",
    encerramento: "Encerramento",
  };
  return labels[id] ?? id;
}

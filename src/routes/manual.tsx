import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { helpArticles } from "@/content/help/articles";
import { Brand } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/manual")({
  component: PublicManualPage,
  head: () => ({
    meta: [
      { title: "Manual Público — ClinicFlow" },
      {
        name: "description",
        content: "Manual público com guias de configuração e uso do ClinicFlow.",
      },
    ],
  }),
});

function PublicManualPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return helpArticles;
    return helpArticles.filter((article) =>
      [article.title, article.summary, article.servesFor, ...article.steps]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const selected = filtered.find((article) => article.id === selectedId) || filtered[0] || null;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <Brand fallbackText="ClinicFlow" />
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href="/apresentacao">Apresentação</a>
            </Button>
            <Button asChild>
              <a href="/auth">Entrar no sistema</a>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[320px_1fr]">
        <aside className="card-soft p-4">
          <Input
            placeholder="Buscar no manual..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-3 space-y-2">
            {filtered.map((article) => (
              <button
                key={article.id}
                type="button"
                className="w-full rounded-xl border p-3 text-left hover:bg-secondary"
                onClick={() => setSelectedId(article.id)}
              >
                <p className="text-sm font-semibold">{article.title}</p>
                <p className="text-xs text-muted-foreground">{article.category}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="card-soft p-5">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Nenhum conteúdo encontrado.</p>
          ) : (
            <article className="space-y-4">
              <h1 className="text-2xl font-bold">{selected.title}</h1>
              <p className="text-sm text-muted-foreground">{selected.summary}</p>

              <Block title="Para que serve" lines={[selected.servesFor]} />
              <Block title="Quem pode acessar" lines={selected.roles} />
              <Block title="Pré-requisitos" lines={selected.prerequisites} />
              <Block title="Passo a passo" lines={selected.steps} ordered />
              <Block title="Erros comuns" lines={selected.commonErrors} />
              <Block title="Como resolver" lines={selected.fixes} />
              <Block title="Boas práticas" lines={selected.tips} />
            </article>
          )}
        </section>
      </div>
    </main>
  );
}

function Block({ title, lines, ordered }: { title: string; lines: string[]; ordered?: boolean }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      {ordered ? (
        <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { helpArticles, type HelpArticle } from "@/content/help/articles";
import { Page } from "@/components/layout/Page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/ajuda")({
  component: HelpCenterPage,
  head: () => ({
    meta: [{ title: "Central de Ajuda — ClinicFlow" }, { name: "robots", content: "noindex" }],
  }),
});

function HelpCenterPage() {
  return (
    <Page
      title="Central de Ajuda e Guias de Uso"
      description="Guias práticos por módulo, perfil e fluxo operacional."
      allowed={["superadmin", "admin", "receptionist", "attendant", "professional", "public_display"]}
    >
      {(profile) => <HelpCenterContent role={profile.role} />}
    </Page>
  );
}

function HelpCenterContent({ role }: { role: HelpArticle["roles"][number] }) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(helpArticles.map((article) => article.category)))],
    [],
  );

  const availableArticles = useMemo(() => {
    return helpArticles.filter((article) => article.roles.includes(role));
  }, [role]);

  const filtered = useMemo(() => {
    return availableArticles.filter((article) => {
      if (categoryFilter !== "all" && article.category !== categoryFilter) return false;
      if (!query.trim()) return true;
      const text = [article.title, article.summary, article.servesFor, ...article.steps]
        .join(" ")
        .toLowerCase();
      return text.includes(query.trim().toLowerCase());
    });
  }, [availableArticles, categoryFilter, query]);

  const selected =
    filtered.find((article) => article.id === selectedArticleId) || filtered[0] || null;

  function toggleFavorite(id: string) {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="card-soft p-4">
        <Input
          placeholder="Buscar por palavra..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              size="sm"
              variant={categoryFilter === category ? "default" : "outline"}
              onClick={() => setCategoryFilter(category)}
            >
              {category === "all" ? "Todas" : category}
            </Button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {filtered.map((article) => (
            <button
              key={article.id}
              type="button"
              onClick={() => setSelectedArticleId(article.id)}
              className="w-full rounded-xl border p-3 text-left hover:bg-secondary"
            >
              <p className="text-sm font-semibold">{article.title}</p>
              <p className="text-xs text-muted-foreground">{article.category}</p>
              <div className="mt-2 flex justify-between">
                <span className="text-xs text-muted-foreground">{article.summary}</span>
                <button
                  type="button"
                  className="text-xs text-primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFavorite(article.id);
                  }}
                >
                  {favoriteIds.includes(article.id) ? "★" : "☆"}
                </button>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="card-soft p-5">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Nenhum artigo disponível para este perfil.</p>
        ) : (
          <article className="space-y-4">
            <header>
              <h2 className="text-xl font-bold">{selected.title}</h2>
              <p className="text-sm text-muted-foreground">{selected.summary}</p>
            </header>

            <HelpBlock title="1. Para que serve" lines={[selected.servesFor]} />
            <HelpBlock title="2. Quem pode acessar" lines={[...selected.roles]} />
            <HelpBlock title="3. Pré-requisitos" lines={selected.prerequisites} />
            <HelpBlock title="4. Explicação da tela" lines={selected.screenOverview} />
            <HelpBlock title="5. Passo a passo" lines={selected.steps} ordered />
            <HelpBlock title="6. Exemplo prático" lines={[selected.practicalExample]} />
            <HelpBlock title="7. Erros comuns" lines={selected.commonErrors} />
            <HelpBlock title="8. Como corrigir" lines={selected.fixes} />
            <HelpBlock title="9. Dicas" lines={selected.tips} />

            <div>
              <p className="font-semibold">10. Perguntas frequentes</p>
              <div className="mt-2 space-y-2">
                {selected.faqs.map((faq) => (
                  <div key={faq.q} className="rounded-lg border p-3">
                    <p className="font-medium">{faq.q}</p>
                    <p className="text-sm text-muted-foreground">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>

            <HelpBlock title="11. Permissões necessárias" lines={selected.requiredPermissions} />
            <HelpBlock title="12. Relação com outros módulos" lines={selected.relatedModules} />

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => window.print()}>
                Imprimir guia
              </Button>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}

function HelpBlock({
  title,
  lines,
  ordered,
}: {
  title: string;
  lines: string[];
  ordered?: boolean;
}) {
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

import { useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import type { AppRole } from "@/hooks/useAuth";
import { helpArticles, helpRouteMap } from "@/content/help/articles";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const hiddenPrefixes = ["/totem/", "/painel/"];

export function HowToUseCurrentScreen({ role }: { role: AppRole }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const article = useMemo(() => {
    if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) return null;
    const mapped = helpRouteMap[pathname];
    if (!mapped) return null;
    const found = helpArticles.find((item) => item.id === mapped);
    if (!found) return null;
    if (!found.roles.includes(role)) return null;
    return found;
  }, [pathname, role]);

  if (!article) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          ❓ Como usar esta tela
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{article.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="font-medium">Para que serve</p>
            <p className="text-muted-foreground">{article.servesFor}</p>
          </div>

          <div>
            <p className="font-medium">Passo a passo</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-muted-foreground">
              {article.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          <div>
            <p className="font-medium">Permissões necessárias</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              {article.requiredPermissions.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-medium">Dica rápida</p>
            <p className="text-muted-foreground">{article.tips[0] ?? "Sem dicas adicionais."}</p>
          </div>

          <div>
            <a className="text-primary underline" href={`/ajuda?artigo=${article.id}`}>
              Abrir artigo completo na Central de Ajuda
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

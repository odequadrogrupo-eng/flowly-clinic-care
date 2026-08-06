import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ error, label }: { error?: unknown; label?: string }) {
  const message = error instanceof Error ? error.message : "Tente novamente em instantes.";
  return (
    <div className="flex flex-col items-center gap-2 p-10 text-center">
      <AlertCircle className="size-6 text-destructive" />
      <p className="font-medium">{label ?? "Não foi possível carregar os dados"}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 p-10 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card-soft flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {icon ? <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span> : null}
    </div>
  );
}

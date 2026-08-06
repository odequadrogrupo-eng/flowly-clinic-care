import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ListOrdered,
  UserPlus,
  Users,
  Stethoscope,
  DoorOpen,
  MonitorPlay,
  ClipboardList,
  LogOut,
  Menu,
  Activity,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { canManage, roleLabels, type AppRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Users; roles: AppRole[] };

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "receptionist", "professional"] },
  { to: "/fila", label: "Fila de atendimento", icon: ListOrdered, roles: ["admin", "receptionist"] },
  { to: "/checkin", label: "Check-in", icon: UserPlus, roles: ["admin", "receptionist"] },
  { to: "/atendimento", label: "Meu atendimento", icon: ClipboardList, roles: ["admin", "professional"] },
  { to: "/pacientes", label: "Pacientes", icon: Users, roles: ["admin", "receptionist"] },
  { to: "/profissionais", label: "Profissionais", icon: Stethoscope, roles: ["admin", "receptionist"] },
  { to: "/salas", label: "Salas", icon: DoorOpen, roles: ["admin", "receptionist"] },
  { to: "/painel", label: "Painel de chamada", icon: MonitorPlay, roles: ["admin", "receptionist", "professional", "public_display"] },
];

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Activity className="size-5" />
      </span>
      <span className="text-lg font-bold tracking-tight">ClinicFlow</span>
    </div>
  );
}

function NavList({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = navItems.filter((item) => item.roles.includes(role));

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="size-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  title,
  description,
  actions,
  role,
  clinicName,
  userName,
}: {
  children: ReactNode;
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  role: AppRole;
  clinicName: string;
  userName: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const footer = (
    <div className="mt-auto space-y-3 border-t pt-4">
      <div className="px-1">
        <p className="truncate text-sm font-semibold">{userName}</p>
        <p className="text-xs text-muted-foreground">
          {roleLabels[role]} · {clinicName}
        </p>
      </div>
      <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSignOut}>
        <LogOut className="size-4" /> Sair
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-[268px] shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand className="px-1 pt-2" />
        <NavList role={role} />
        {footer}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur lg:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[280px] flex-col gap-6 p-4">
              <Brand className="px-1 pt-2" />
              <NavList role={role} onNavigate={() => setMobileOpen(false)} />
              {footer}
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
            {description ? (
              <p className="hidden truncate text-sm text-muted-foreground sm:block">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function RoleGate({ role, allowed, children }: { role: AppRole; allowed: AppRole[]; children: ReactNode }) {
  if (!allowed.includes(role)) {
    return (
      <div className="card-soft p-8 text-center">
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seu perfil ({roleLabels[role]}) não tem permissão para esta área.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export { canManage };

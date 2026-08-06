import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  CalendarClock,
  ListOrdered,
  Bell,
  UserPlus,
  Users,
  Stethoscope,
  DoorOpen,
  MonitorPlay,
  Printer,
  FileBarChart,
  Settings,
  Shield,
  ConciergeBell,
  ClipboardList,
  LogOut,
  Menu,
  Activity,
  BookOpen,
  Building2,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ClinicLogo } from "@/components/common/ClinicLogo";
import { canManage, roleLabels, type AppRole } from "@/hooks/useAuth";
import { signOutCurrentUser } from "@/services/auth";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Users; roles: AppRole[] };

const navItems: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["superadmin", "admin", "receptionist", "professional"],
  },
  {
    to: "/fila",
    label: "Fila de atendimento",
    icon: ListOrdered,
    roles: ["superadmin", "admin", "receptionist"],
  },
  {
    to: "/checkin",
    label: "Check-in",
    icon: UserPlus,
    roles: ["superadmin", "admin", "receptionist"],
  },
  {
    to: "/recepcao",
    label: "Recepção",
    icon: ConciergeBell,
    roles: ["superadmin", "admin", "receptionist"],
  },
  {
    to: "/agenda",
    label: "Agenda",
    icon: CalendarClock,
    roles: ["superadmin", "admin", "receptionist", "professional"],
  },
  {
    to: "/chamada",
    label: "Chamadas",
    icon: Bell,
    roles: ["superadmin", "admin", "receptionist", "professional"],
  },
  {
    to: "/atendimento",
    label: "Meu atendimento",
    icon: ClipboardList,
    roles: ["superadmin", "admin", "professional"],
  },
  {
    to: "/pacientes",
    label: "Pacientes",
    icon: Users,
    roles: ["superadmin", "admin", "receptionist"],
  },
  {
    to: "/profissionais",
    label: "Profissionais",
    icon: Stethoscope,
    roles: ["superadmin", "admin"],
  },
  { to: "/salas", label: "Salas", icon: DoorOpen, roles: ["superadmin", "admin"] },
  {
    to: "/relatorios",
    label: "Relatórios",
    icon: FileBarChart,
    roles: ["superadmin", "admin", "receptionist"],
  },
  {
    to: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    roles: ["superadmin", "admin"],
  },
  {
    to: "/impressao",
    label: "Impressora",
    icon: Printer,
    roles: ["superadmin", "admin"],
  },
  {
    to: "/auditoria",
    label: "Auditoria/LGPD",
    icon: Shield,
    roles: ["superadmin", "admin"],
  },
  {
    to: "/painel",
    label: "Painel de chamada",
    icon: MonitorPlay,
    roles: ["superadmin", "admin", "receptionist", "professional", "public_display"],
  },
  {
    to: "/ajuda",
    label: "Central de Ajuda",
    icon: BookOpen,
    roles: ["superadmin", "admin", "receptionist", "attendant", "professional", "public_display"],
  },
  {
    to: "/superadmin",
    label: "Superadmin · Hub",
    icon: Building2,
    roles: ["superadmin"],
  },
  {
    to: "/superadmin-clinicas",
    label: "Superadmin · Clínicas",
    icon: Building2,
    roles: ["superadmin"],
  },
];

export function Brand({
  className,
  logoSrc,
  fallbackText,
}: {
  className?: string;
  logoSrc?: string | null | undefined;
  fallbackText?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {logoSrc ? (
        <ClinicLogo
          src={logoSrc}
          alt={fallbackText ?? "Clinica"}
          fallbackText={fallbackText ?? "Clinica"}
          className="h-11 w-20"
          imgClassName="h-9"
        />
      ) : (
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Activity className="size-5" />
        </span>
      )}
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
  clinicLogoUrl,
  userName,
}: {
  children: ReactNode;
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  role: AppRole;
  clinicName: string;
  clinicLogoUrl?: string | null;
  userName: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOutCurrentUser();
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
        <Brand className="px-1 pt-2" logoSrc={clinicLogoUrl} fallbackText={clinicName} />
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
              <Brand className="px-1 pt-2" logoSrc={clinicLogoUrl} fallbackText={clinicName} />
              <NavList role={role} onNavigate={() => setMobileOpen(false)} />
              {footer}
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
            {description ? (
              <p className="hidden truncate text-sm text-muted-foreground sm:block">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function RoleGate({
  role,
  allowed,
  children,
}: {
  role: AppRole;
  allowed: AppRole[];
  children: ReactNode;
}) {
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

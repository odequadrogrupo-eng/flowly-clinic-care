import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, CalendarClock, Clock, Copy, Stethoscope, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, StatCard } from "@/components/common/States";
import { ClinicLogo } from "@/components/common/ClinicLogo";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { roleLabels, type AppRole, type ProfileWithClinic } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { supabase } from "@/integrations/supabase/client";
import {
  QUEUE_SELECT,
  formatDuration,
  formatTime,
  minutesBetween,
  statusLabels,
  statusTone,
  type QueueItem,
} from "@/lib/queue";
import { logAudit } from "@/lib/queue";
import { updateClinicById, type ClinicFormValues } from "@/services/clinic";
import {
  createClinicAuthUser,
  deleteClinicAuthUser,
  createClinicInvite,
  listClinicUsers,
  listPendingInvites,
  revokeInvite,
  updateClinicAuthUser,
} from "@/services/user-permissions";
import {
  getDemoRunActorName,
  listDemoRuns,
  runResetAndRecreateDemoClubMedico,
  runSeedDemoClubMedico,
  type DemoRunRow,
  type DemoSeedSummary,
} from "@/services/demo-admin";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ClinicFlow" },
      {
        name: "description",
        content: "Indicadores de espera, atendimentos e profissionais disponíveis da clínica.",
      },
      { property: "og:title", content: "Dashboard — ClinicFlow" },
      {
        property: "og:description",
        content: "Visão geral do atendimento da clínica em tempo real.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function startOfDaysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function DashboardPage() {
  return (
    <Page
      title="Dashboard"
      description="Visão geral do atendimento de hoje"
      allowed={["admin", "receptionist", "professional"]}
    >
      {(profile) => <DashboardContent profile={profile} />}
    </Page>
  );
}

function DashboardContent({ profile }: { profile: ProfileWithClinic }) {
  const clinicId = profile.clinic_id;
  const queryClient = useQueryClient();
  useRealtime(["queues", "calls"], ["dashboard-queues", "queue"], clinicId);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("receptionist");
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<AppRole>("receptionist");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [lastGeneratedPassword, setLastGeneratedPassword] = useState("");
  const [demoResult, setDemoResult] = useState<DemoSeedSummary | null>(null);
  const [demoProgressLabel, setDemoProgressLabel] = useState<string | null>(null);

  const [clinicForm, setClinicForm] = useState<ClinicFormValues>({
    name: profile.clinics?.name ?? "",
    tenant_slug: profile.clinics?.tenant_slug ?? "",
    legal_name: profile.clinics?.legal_name ?? "",
    document: profile.clinics?.document ?? "",
    phone: profile.clinics?.phone ?? "",
    email: profile.clinics?.email ?? "",
    address: profile.clinics?.address ?? "",
    opening_hours: profile.clinics?.opening_hours ?? "",
    logo_url: profile.clinics?.logo_url ?? "",
    color_primary: "",
    color_primary_foreground: "",
    color_accent: "",
    color_accent_foreground: "",
    voice_enabled: profile.clinics?.voice_enabled ?? true,
  });

  useEffect(() => {
    setClinicForm({
      name: profile.clinics?.name ?? "",
      tenant_slug: profile.clinics?.tenant_slug ?? "",
      legal_name: profile.clinics?.legal_name ?? "",
      document: profile.clinics?.document ?? "",
      phone: profile.clinics?.phone ?? "",
      email: profile.clinics?.email ?? "",
      address: profile.clinics?.address ?? "",
      opening_hours: profile.clinics?.opening_hours ?? "",
      logo_url: profile.clinics?.logo_url ?? "",
      color_primary: "",
      color_primary_foreground: "",
      color_accent: "",
      color_accent_foreground: "",
      voice_enabled: profile.clinics?.voice_enabled ?? true,
    });
  }, [profile.clinics]);

  const saveClinic = useMutation({
    mutationFn: async () => {
      await updateClinicById(clinicId, clinicForm);
      await logAudit({ clinicId, action: "update", entity: "clinics", entityId: clinicId });
    },
    onSuccess: () => {
      toast.success("Cadastro da clinica atualizado");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao salvar clinica", { description: error.message });
    },
  });

  const usersQuery = useQuery({
    queryKey: ["clinic-users", clinicId],
    enabled: profile.role === "admin",
    queryFn: () => listClinicUsers(clinicId),
  });

  const invitesQuery = useQuery({
    queryKey: ["clinic-invites", clinicId],
    enabled: profile.role === "admin",
    queryFn: () => listPendingInvites(clinicId),
  });

  const createAuthUserMutation = useMutation({
    mutationFn: async () => {
      const result = await createClinicAuthUser({
        email: newUserEmail,
        fullName: newUserName,
        role: newUserRole,
        active: true,
        password: newUserPassword,
      });

      await logAudit({
        clinicId,
        action: "create",
        entity: "auth_user",
        entityId: result.user.id,
        details: {
          email: result.user.email,
          role: result.user.role,
          via: "dashboard_auth_crud",
        },
      });

      return result;
    },
    onSuccess: async (result) => {
      setLastGeneratedPassword(result.generatedPassword);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      toast.success("Usuário criado no Auth e vinculado à clínica");
      queryClient.invalidateQueries({ queryKey: ["clinic-users", clinicId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar usuário", { description: error.message });
    },
  });

  const updateAuthUserMutation = useMutation({
    mutationFn: async (input: {
      userId: string;
      email: string;
      role: AppRole;
      active: boolean;
      fullName: string;
      password?: string;
    }) => {
      const payload: {
        userId: string;
        email: string;
        fullName: string;
        role: AppRole;
        active: boolean;
        password?: string;
      } = {
        userId: input.userId,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        active: input.active,
      };
      if (input.password) payload.password = input.password;

      const result = await updateClinicAuthUser(payload);

      await logAudit({
        clinicId,
        action: "update",
        entity: "auth_user",
        entityId: input.userId,
        details: {
          email: input.email,
          role: input.role,
          active: input.active,
          via: "dashboard_auth_crud",
        },
      });

      return result;
    },
    onSuccess: () => {
      toast.success("Usuário atualizado no Auth");
      queryClient.invalidateQueries({ queryKey: ["clinic-users", clinicId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar usuário", { description: error.message });
    },
  });

  const deleteAuthUserMutation = useMutation({
    mutationFn: async (input: { userId: string; email: string }) => {
      await deleteClinicAuthUser(input.userId);
      await logAudit({
        clinicId,
        action: "delete",
        entity: "auth_user",
        entityId: input.userId,
        details: { email: input.email, via: "dashboard_auth_crud" },
      });
    },
    onSuccess: () => {
      toast.success("Usuário removido do Auth e da clínica");
      queryClient.invalidateQueries({ queryKey: ["clinic-users", clinicId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover usuário", { description: error.message });
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const clinicName = profile.clinics?.name ?? "Clinica";
      const { invite, inviteUrl } = await createClinicInvite(clinicId, clinicName, profile.id, {
        email: inviteEmail,
        role: inviteRole,
      });

      await logAudit({ clinicId, action: "create", entity: "clinic_invites", entityId: invite.id });
      return inviteUrl;
    },
    onSuccess: async (inviteUrl) => {
      setLastInviteUrl(inviteUrl);
      setInviteEmail("");
      toast.success("Convite criado");
      await navigator.clipboard.writeText(inviteUrl).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["clinic-invites", clinicId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar convite", { description: error.message });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      await revokeInvite(clinicId, inviteId);
      await logAudit({ clinicId, action: "revoke", entity: "clinic_invites", entityId: inviteId });
    },
    onSuccess: () => {
      toast.success("Convite cancelado");
      queryClient.invalidateQueries({ queryKey: ["clinic-invites", clinicId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao cancelar convite", { description: error.message });
    },
  });

  const queuesQuery = useQuery({
    queryKey: ["dashboard-queues", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queues")
        .select(QUEUE_SELECT)
        .gte("checkin_at", startOfDaysAgo(6).toISOString())
        .order("checkin_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QueueItem[];
    },
  });

  const professionalsQuery = useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const appointmentsTodayQuery = useQuery({
    queryKey: ["appointments-today", clinicId],
    queryFn: async () => {
      const from = startOfDaysAgo(0).toISOString();
      const toDate = new Date();
      toDate.setHours(23, 59, 59, 999);
      const to = toDate.toISOString();
      const { data, error } = await supabase
        .from("appointments" as never)
        .select("status" as never)
        .eq("clinic_id", clinicId)
        .gte("scheduled_for", from)
        .lte("scheduled_for", to);
      if (error) return [] as Array<{ status: string }>;
      return (data ?? []) as Array<{ status: string }>;
    },
  });

  const demoRunsQuery = useQuery({
    queryKey: ["demo-seed-runs", clinicId],
    enabled: profile.role === "admin",
    queryFn: async () => {
      const runs = await listDemoRuns(clinicId, 10);
      const enriched = await Promise.all(
        runs.map(async (run) => ({
          ...run,
          actorName: await getDemoRunActorName(run.triggered_by),
        })),
      );
      return enriched;
    },
  });

  const seedDemoMutation = useMutation({
    mutationFn: async () => {
      setDemoProgressLabel("Validando permissões e iniciando seed...");
      const response = await runSeedDemoClubMedico();
      if (!response.ok || !response.summary) {
        throw new Error(response.error ?? "Falha ao popular ambiente demo.");
      }
      return response.summary;
    },
    onSuccess: (result) => {
      setDemoProgressLabel("Finalizado com sucesso.");
      setDemoResult(result);
      toast.success("Ambiente de demonstração atualizado");
      queryClient.invalidateQueries({ queryKey: ["demo-seed-runs", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-queues", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (error: Error) => {
      setDemoProgressLabel(null);
      toast.error("Erro ao popular dados demo", { description: error.message });
    },
  });

  const recreateDemoMutation = useMutation({
    mutationFn: async () => {
      const pass1 = window.prompt("Digite exatamente: RECRIAR CLUB MEDICO");
      if (pass1 !== "RECRIAR CLUB MEDICO") {
        throw new Error("Primeira confirmação inválida.");
      }
      const pass2 = window.prompt("Digite exatamente: APAGAR SOMENTE DEMO");
      if (pass2 !== "APAGAR SOMENTE DEMO") {
        throw new Error("Segunda confirmação inválida.");
      }

      setDemoProgressLabel("Limpando dados demo e recriando ambiente...");
      const response = await runResetAndRecreateDemoClubMedico();
      if (!response.ok || !response.recreated) {
        throw new Error(response.error ?? "Falha ao recriar ambiente demo.");
      }
      return response.recreated;
    },
    onSuccess: (result) => {
      setDemoProgressLabel("Recriação concluída.");
      setDemoResult(result);
      toast.success("Dados de demonstração recriados");
      queryClient.invalidateQueries({ queryKey: ["demo-seed-runs", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-queues", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (error: Error) => {
      setDemoProgressLabel(null);
      toast.error("Erro ao recriar dados demo", { description: error.message });
    },
  });

  if (queuesQuery.isLoading) return <LoadingState />;
  if (queuesQuery.error) return <ErrorState error={queuesQuery.error} />;

  const all = queuesQuery.data ?? [];
  const todayStart = startOfDaysAgo(0);
  const today = all.filter((item) => new Date(item.checkin_at) >= todayStart);

  const waiting = today.filter((item) => item.status === "waiting");
  const inService = today.filter((item) => item.status === "in_service");
  const finished = today.filter((item) => item.status === "finished");

  const waitTimes = today
    .filter((item) => item.called_at)
    .map((item) => minutesBetween(item.checkin_at, item.called_at));
  const avgWait = waitTimes.length
    ? Math.round(waitTimes.reduce((sum, value) => sum + value, 0) / waitTimes.length)
    : 0;

  const availableProfessionals = (professionalsQuery.data ?? []).filter(
    (professional) => professional.status === "available",
  ).length;
  const appointmentsToday = appointmentsTodayQuery.data ?? [];
  const appointmentsConfirmed = appointmentsToday.filter(
    (item) => item.status === "confirmed" || item.status === "checked_in",
  ).length;

  const chartData = Array.from({ length: 7 }, (_, index) => {
    const day = startOfDaysAgo(6 - index);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return {
      label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: all.filter((item) => {
        const at = new Date(item.checkin_at);
        return at >= day && at < next;
      }).length,
    };
  });

  const latest = all.slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="card-soft flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-muted-foreground">Clínica ativa</p>
          <p className="text-lg font-semibold">{profile.clinics?.name ?? "Club Médico"}</p>
        </div>
        <ClinicLogo
          src={profile.clinics?.logo_url ?? "/brands/club-medico/logo.png"}
          alt={profile.clinics?.name ?? "Club Médico"}
          fallbackText="Club Médico"
          className="h-16 w-44"
          imgClassName="h-12"
        />
      </section>

      {profile.role === "admin" ? (
        <>
          <section className="card-soft p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Ambiente de demonstração</h2>
                <p className="text-sm text-muted-foreground">
                  Popula e recria com segurança o cenário Club Médico via Edge Functions protegidas.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard.writeText("admin@clubmedico.teste\nClubMedico@2026")
                }
              >
                Copiar credenciais de teste
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  const ok = window.confirm(
                    "Confirmar população idempotente dos dados Club Médico?",
                  );
                  if (ok) seedDemoMutation.mutate();
                }}
                disabled={seedDemoMutation.isPending || recreateDemoMutation.isPending}
              >
                Popular dados do Club Médico
              </Button>
              <Button
                variant="destructive"
                onClick={() => recreateDemoMutation.mutate()}
                disabled={seedDemoMutation.isPending || recreateDemoMutation.isPending}
              >
                Recriar dados de demonstração
              </Button>
            </div>

            {demoProgressLabel ? (
              <p className="mt-3 text-sm text-muted-foreground">{demoProgressLabel}</p>
            ) : null}

            {demoResult ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  label="Clínica"
                  value={demoResult.clinic === "created" ? "Criada" : "Atualizada"}
                  icon={<Activity className="size-5" />}
                />
                <StatCard
                  label="Usuários criados"
                  value={demoResult.usersCreated}
                  icon={<Users className="size-5" />}
                />
                <StatCard
                  label="Usuários atualizados"
                  value={demoResult.usersUpdated}
                  icon={<Users className="size-5" />}
                />
                <StatCard
                  label="Médicos criados"
                  value={demoResult.doctorsCreated}
                  icon={<Stethoscope className="size-5" />}
                />
                <StatCard
                  label="Pacientes criados"
                  value={demoResult.patientsCreated}
                  icon={<Users className="size-5" />}
                />
                <StatCard
                  label="Tickets processados"
                  value={demoResult.ticketsCreated}
                  icon={<Activity className="size-5" />}
                />
              </div>
            ) : null}

            {demoResult?.tenantValidation?.checks?.length ? (
              <div className="mt-4 rounded-xl border p-3">
                <p className="text-sm font-medium">Validação multiempresa</p>
                <div className="mt-2 space-y-1 text-sm">
                  {demoResult.tenantValidation.checks.map((check) => (
                    <p
                      key={check.table}
                      className={check.passed ? "text-emerald-600" : "text-destructive"}
                    >
                      {check.table}: {check.passed ? "OK" : "Falhou"} - {check.details}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border p-3">
              <p className="text-sm font-medium">Últimas execuções</p>
              <div className="mt-2 space-y-2 text-sm">
                {(demoRunsQuery.data ?? []).length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma execução registrada ainda.</p>
                ) : (
                  (demoRunsQuery.data ?? []).map(
                    (run: DemoRunRow & { actorName: string | null }) => (
                      <div key={run.id} className="rounded-lg border p-2">
                        <p className="font-medium">
                          {run.action} · {run.status}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(run.created_at).toLocaleString("pt-BR")} ·{" "}
                          {run.actorName ?? "Usuário"}
                        </p>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>
          </section>

          <section className="card-soft p-5">
            <h2 className="font-semibold">Cadastro da clinica</h2>
            <p className="text-sm text-muted-foreground">Dados institucionais usados no sistema.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clinic-name">Nome fantasia</Label>
                <Input
                  id="clinic-name"
                  value={clinicForm.name}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-legal-name">Razao social</Label>
                <Input
                  id="clinic-legal-name"
                  value={clinicForm.legal_name}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, legal_name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-document">CNPJ/Documento</Label>
                <Input
                  id="clinic-document"
                  value={clinicForm.document}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, document: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-phone">Telefone</Label>
                <Input
                  id="clinic-phone"
                  value={clinicForm.phone}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="clinic-email">E-mail institucional</Label>
                <Input
                  id="clinic-email"
                  type="email"
                  value={clinicForm.email}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="clinic-address">Endereco</Label>
                <Textarea
                  id="clinic-address"
                  rows={2}
                  value={clinicForm.address}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-hours">Horario de funcionamento</Label>
                <Input
                  id="clinic-hours"
                  value={clinicForm.opening_hours}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, opening_hours: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-logo">URL do logo</Label>
                <Input
                  id="clinic-logo"
                  value={clinicForm.logo_url}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, logo_url: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={clinicForm.voice_enabled}
                  onChange={(event) =>
                    setClinicForm((prev) => ({ ...prev, voice_enabled: event.target.checked }))
                  }
                />
                Chamada por voz habilitada
              </label>
              <Button onClick={() => saveClinic.mutate()} disabled={saveClinic.isPending}>
                {saveClinic.isPending ? "Salvando..." : "Salvar cadastro"}
              </Button>
            </div>
          </section>

          <section className="card-soft p-5">
            <h2 className="font-semibold">Usuarios e permissoes</h2>
            <p className="text-sm text-muted-foreground">
              CRUD de usuários integrado ao Supabase Auth + convites de acesso.
            </p>

            <div className="mt-4 space-y-3 rounded-xl border p-3">
              <h3 className="text-sm font-semibold">Criar usuário direto no sistema</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  placeholder="Nome completo"
                  value={newUserName}
                  onChange={(event) => setNewUserName(event.target.value)}
                />
                <Input
                  placeholder="email@clinica.com"
                  type="email"
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                />
                <Select value={newUserRole} onValueChange={(value: AppRole) => setNewUserRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="receptionist">Recepcionista</SelectItem>
                    <SelectItem value="attendant">Atendente</SelectItem>
                    <SelectItem value="professional">Profissional</SelectItem>
                    <SelectItem value="public_display">Painel publico</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Senha inicial (opcional)"
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => createAuthUserMutation.mutate()}
                  disabled={createAuthUserMutation.isPending}
                >
                  {createAuthUserMutation.isPending ? "Criando..." : "Criar usuário"}
                </Button>
                {lastGeneratedPassword ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard
                        .writeText(lastGeneratedPassword)
                        .catch(() => undefined);
                      toast.success("Senha temporária copiada");
                    }}
                  >
                    Copiar senha gerada
                  </Button>
                ) : null}
              </div>
              {lastGeneratedPassword ? (
                <p className="text-xs text-muted-foreground">
                  Senha temporária gerada: {lastGeneratedPassword}
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_220px_auto]">
              <Input
                placeholder="email@clinica.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
              <Select value={inviteRole} onValueChange={(value: AppRole) => setInviteRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receptionist">Recepcionista</SelectItem>
                  <SelectItem value="attendant">Atendente</SelectItem>
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="public_display">Painel publico</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => createInviteMutation.mutate()}
                disabled={createInviteMutation.isPending}
              >
                {createInviteMutation.isPending ? "Gerando..." : "Criar convite"}
              </Button>
            </div>

            {lastInviteUrl ? (
              <div className="mt-3 rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Ultimo link de convite:</p>
                <div className="mt-1 flex items-center gap-2">
                  <Input value={lastInviteUrl} readOnly />
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(lastInviteUrl).catch(() => undefined);
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold">Usuarios ativos/inativos</h3>
              {(usersQuery.data ?? []).map((user) => (
                <div
                  key={user.id}
                  className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_1fr_220px_120px_auto_auto] md:items-center"
                >
                  <Input
                    defaultValue={user.full_name}
                    onBlur={(event) => {
                      const name = event.target.value;
                      if (name === user.full_name) return;
                      updateAuthUserMutation.mutate({
                        userId: user.id,
                        email: user.email ?? "",
                        role: user.role,
                        active: user.active,
                        fullName: name,
                      });
                    }}
                  />
                  <Input
                    defaultValue={user.email ?? ""}
                    onBlur={(event) => {
                      const email = event.target.value;
                      if (email === (user.email ?? "")) return;
                      updateAuthUserMutation.mutate({
                        userId: user.id,
                        email,
                        role: user.role,
                        active: user.active,
                        fullName: user.full_name,
                      });
                    }}
                  />
                  <Select
                    defaultValue={user.role}
                    onValueChange={(value: AppRole) => {
                      updateAuthUserMutation.mutate({
                        userId: user.id,
                        email: user.email ?? "",
                        role: value,
                        active: user.active,
                        fullName: user.full_name,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="receptionist">Recepcionista</SelectItem>
                      <SelectItem value="attendant">Atendente</SelectItem>
                      <SelectItem value="professional">Profissional</SelectItem>
                      <SelectItem value="public_display">Painel publico</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={user.active}
                      onChange={(event) => {
                        updateAuthUserMutation.mutate({
                          userId: user.id,
                          email: user.email ?? "",
                          role: user.role,
                          active: event.target.checked,
                          fullName: user.full_name,
                        });
                      }}
                    />
                    Ativo
                  </Label>
                  <p className="text-xs text-muted-foreground">{roleLabels[user.role]}</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const confirmation = window.prompt(
                        `Para remover ${user.email ?? user.full_name}, digite REMOVER`,
                      );
                      if (confirmation !== "REMOVER") return;
                      deleteAuthUserMutation.mutate({
                        userId: user.id,
                        email: user.email ?? "",
                      });
                    }}
                    disabled={deleteAuthUserMutation.isPending || user.id === profile.id}
                  >
                    Remover
                  </Button>
                </div>
              ))}
              {(usersQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum usuario encontrado para esta clinica.
                </p>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold">Convites pendentes</h3>
              {(invitesQuery.data ?? []).map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                >
                  <p className="text-sm">
                    {invite.email} · {roleLabels[invite.role]}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeInviteMutation.mutate(invite.id)}
                    disabled={revokeInviteMutation.isPending}
                  >
                    Cancelar convite
                  </Button>
                </div>
              ))}
              {(invitesQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem convites pendentes.</p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Aguardando agora"
          value={waiting.length}
          icon={<Users className="size-5" />}
        />
        <StatCard
          label="Atendidos hoje"
          value={finished.length}
          icon={<Activity className="size-5" />}
        />
        <StatCard
          label="Tempo médio de espera"
          value={formatDuration(avgWait)}
          hint="Da chegada até a chamada"
          icon={<Clock className="size-5" />}
        />
        <StatCard
          label="Profissionais disponíveis"
          value={availableProfessionals}
          hint={`${professionalsQuery.data?.length ?? 0} cadastrados`}
          icon={<Stethoscope className="size-5" />}
        />
        <StatCard
          label="Agendados hoje"
          value={appointmentsToday.length}
          icon={<CalendarClock className="size-5" />}
        />
        <StatCard
          label="Confirmados/check-in"
          value={appointmentsConfirmed}
          icon={<CalendarClock className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-soft p-5 lg:col-span-2">
          <h2 className="font-semibold">Atendimentos por dia</h2>
          <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--color-border)"
                />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Atendimentos"
                  fill="var(--color-chart-1)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-soft p-5">
          <h2 className="font-semibold">Em andamento</h2>
          <p className="text-sm text-muted-foreground">{inService.length} atendimento(s)</p>
          <div className="mt-4 space-y-2">
            {inService.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atendimento em andamento.</p>
            ) : (
              inService.map((item) => (
                <div key={item.id} className="rounded-xl border p-3">
                  <p className="font-medium">{item.patients?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.professionals?.full_name ?? "Sem profissional"} · início{" "}
                    {formatTime(item.started_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="border-b p-5">
          <h2 className="font-semibold">Últimos atendimentos</h2>
        </div>
        {latest.length === 0 ? (
          <EmptyState
            title="Nenhum atendimento registrado"
            description="Faça um check-in para iniciar a fila."
          />
        ) : (
          <div className="divide-y">
            {latest.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.patients?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.service_type ?? "Atendimento"} ·{" "}
                    {item.professionals?.full_name ?? "Sem profissional"} · chegada{" "}
                    {formatTime(item.checkin_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[item.status]}`}
                >
                  {statusLabels[item.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

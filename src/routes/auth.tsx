import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/layout/AppShell";
import { ClinicLogo } from "@/components/common/ClinicLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestPasswordReset, signInWithEmail, signUpWithClinic } from "@/services/auth";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { hasActiveSession } = await import("@/services/auth");
    if (await hasActiveSession()) {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  head: () => ({
    meta: [
      { title: "Entrar — ClinicFlow" },
      {
        name: "description",
        content: "Acesse o ClinicFlow para gerenciar a fila de atendimento da sua clínica.",
      },
      { property: "og:title", content: "Entrar — ClinicFlow" },
      { property: "og:description", content: "Acesso da equipe da clínica ao ClinicFlow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");

  const inviteParams = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        inviteToken: "",
        inviteRole: "",
        invitedEmail: "",
        invitedClinicName: "",
        invitedMode: "",
      };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      inviteToken: params.get("invite") ?? "",
      inviteRole: params.get("role") ?? "",
      invitedEmail: params.get("email") ?? "",
      invitedClinicName: params.get("clinic") ?? "",
      invitedMode: params.get("mode") ?? "",
    };
  }, []);

  const isInviteFlow = inviteParams.inviteToken.length > 0;

  useEffect(() => {
    if (!isInviteFlow) return;
    if (inviteParams.invitedMode === "signup") setMode("signup");
    if (inviteParams.invitedEmail) setEmail(inviteParams.invitedEmail);
    if (inviteParams.invitedClinicName) setClinicName(inviteParams.invitedClinicName);
  }, [inviteParams, isInviteFlow]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    let handledError: string | null = null;
    try {
      await signInWithEmail({ email, password });
    } catch (authError) {
      handledError = authError instanceof Error ? authError.message : "Nao foi possivel entrar.";
    }
    setLoading(false);
    if (handledError) {
      setError(handledError);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    let signUpData: Awaited<ReturnType<typeof signUpWithClinic>> | null = null;
    let handledError: string | null = null;
    try {
      const inviteRole =
        inviteParams.inviteRole === "admin" ||
        inviteParams.inviteRole === "receptionist" ||
        inviteParams.inviteRole === "attendant" ||
        inviteParams.inviteRole === "professional" ||
        inviteParams.inviteRole === "public_display"
          ? inviteParams.inviteRole
          : null;

      const signUpPayload: Parameters<typeof signUpWithClinic>[0] = {
        email,
        password,
        fullName,
      };

      if (inviteParams.inviteToken) {
        signUpPayload.inviteToken = inviteParams.inviteToken;
      } else {
        signUpPayload.clinicName = clinicName;
      }

      if (inviteRole) {
        signUpPayload.inviteRole = inviteRole;
      }

      signUpData = await signUpWithClinic(signUpPayload);
    } catch (authError) {
      handledError =
        authError instanceof Error ? authError.message : "Nao foi possivel criar a conta.";
    }
    setLoading(false);
    if (handledError) {
      setError(handledError);
      return;
    }
    if (signUpData?.session) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    toast.success("Conta criada", {
      description: "Confirme o e-mail enviado para ativar o acesso.",
    });
    setMode("login");
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    let handledError: string | null = null;
    try {
      await requestPasswordReset(email);
    } catch (authError) {
      handledError =
        authError instanceof Error ? authError.message : "Nao foi possivel enviar o e-mail.";
    }
    setLoading(false);
    if (handledError) {
      setError(handledError);
      return;
    }
    toast.success("E-mail enviado", {
      description: "Confira sua caixa de entrada para redefinir a senha.",
    });
    setMode("login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <Link to="/" className="mx-auto">
          <Brand logoSrc="/brands/club-medico/logo.png" fallbackText="Club Médico" />
        </Link>

        <div className="mt-4 flex justify-center">
          <ClinicLogo
            src="/brands/club-medico/logo.png"
            alt="Club Médico"
            fallbackText="Club Médico"
            className="h-16 w-40"
            imgClassName="h-12"
          />
        </div>

        <div className="card-soft mt-6 p-6">
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
              <TabsTrigger value="reset">Senha</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-5">
              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@clinica.com.br"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode("reset")}
                  className="w-full text-sm text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form className="space-y-4" onSubmit={handleSignUp}>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Seu nome completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinicName">Nome da clínica</Label>
                  <Input
                    id="clinicName"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    disabled={isInviteFlow}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupEmail">E-mail</Label>
                  <Input
                    id="signupEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupPassword">Senha</Label>
                  <Input
                    id="signupPassword"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : isInviteFlow ? "Criar conta" : "Criar clínica e conta"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {isInviteFlow
                    ? "Seu convite define clínica e permissões automaticamente."
                    : "Você será o administrador da clínica e poderá convidar a equipe depois."}
                </p>
              </form>
            </TabsContent>

            <TabsContent value="reset" className="mt-5">
              <form className="space-y-4" onSubmit={handleReset}>
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">E-mail cadastrado</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

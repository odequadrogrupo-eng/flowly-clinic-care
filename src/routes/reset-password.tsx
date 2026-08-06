import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearTemporaryPasswordFlag, updateCurrentUserPassword } from "@/services/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — ClinicFlow" },
      { name: "description", content: "Defina uma nova senha para acessar o ClinicFlow." },
      { property: "og:title", content: "Redefinir senha — ClinicFlow" },
      { property: "og:description", content: "Defina uma nova senha de acesso ao ClinicFlow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    let handledError: string | null = null;
    try {
      await updateCurrentUserPassword({ password, confirmPassword: confirm });
      await clearTemporaryPasswordFlag();
    } catch (authError) {
      handledError = authError instanceof Error ? authError.message : "Nao foi possivel atualizar a senha.";
    }
    setLoading(false);
    if (handledError) {
      setError(handledError);
      return;
    }
    toast.success("Senha atualizada");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-md">
        <Brand className="justify-center" />
        <form className="card-soft mt-6 space-y-4 p-6" onSubmit={handleSubmit}>
          <div>
            <h1 className="text-lg font-semibold">Definir nova senha</h1>
            <p className="text-sm text-muted-foreground">Use o link recebido por e-mail para concluir.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input id="newPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input id="confirmPassword" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}

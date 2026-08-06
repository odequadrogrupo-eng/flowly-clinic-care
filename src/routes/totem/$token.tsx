import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ClinicLogo } from "@/components/common/ClinicLogo";
import { getKioskPublicConfig, issueTicketByToken } from "@/services/totem";
import { printDirect, printWithBrowser, tryPrintWithWebApi } from "@/services/print";

export const Route = createFileRoute("/totem/$token")({
  component: KioskPage,
  ssr: false,
  head: () => ({
    meta: [{ title: "Totem de atendimento — ClinicFlow" }, { name: "robots", content: "noindex" }],
  }),
});

function KioskPage() {
  const { token } = Route.useParams();
  const [fullscreenReady, setFullscreenReady] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [issuedType, setIssuedType] = useState<"normal" | "priority" | null>(null);

  const configQuery = useQuery({
    queryKey: ["kiosk-public-config", token],
    queryFn: () => getKioskPublicConfig(token),
  });

  const issueMutation = useMutation({
    mutationFn: async (priority: boolean) => issueTicketByToken(token, { priority }),
    onSuccess: async (data) => {
      if (!data.ok || !data.ticket_code) return;
      setIssuedCode(data.ticket_code);
      setIssuedType(data.priority ? "priority" : "normal");

      if (data.print_auto && configQuery.data?.clinic_name) {
        const payload = {
          clinicName: configQuery.data.clinic_name,
          logoUrl: configQuery.data.clinic_logo ?? null,
          welcomeMessage: configQuery.data.welcome_message ?? "Bem-vindo",
          ticketCode: data.ticket_code,
          issuedAtIso: data.issued_at ?? new Date().toISOString(),
          footerMessage: data.footer_text ?? "Aguarde ser chamado",
          paperSize: data.paper_size ?? "58mm",
          qrEnabled: data.qr_enabled ?? false,
          qrValue: data.ticket_code,
        } as const;

        const mode = configQuery.data.print_method ?? "browser";
        if (mode === "browser") {
          printWithBrowser(payload);
          return;
        }

        if (mode === "webusb" || mode === "webserial") {
          try {
            await printDirect(payload, mode);
            return;
          } catch {
            if (configQuery.data.browser_fallback_enabled) {
              printWithBrowser(payload);
              return;
            }
          }
        }

        const endpoint =
          configQuery.data.local_agent_endpoint?.trim() || "http://127.0.0.1:3311/print";

        try {
          await tryPrintWithWebApi(payload, mode === "agent" ? "webusb" : mode, endpoint);
        } catch {
          if (configQuery.data.browser_fallback_enabled) {
            printWithBrowser(payload);
          }
        }
      }
    },
  });

  useEffect(() => {
    const element = document.documentElement;
    async function ensureFullscreen() {
      try {
        if (!document.fullscreenElement && element.requestFullscreen) {
          await element.requestFullscreen();
        }
      } catch {
        // silent: kiosk mode may be locked by browser policy
      } finally {
        setFullscreenReady(true);
      }
    }

    void ensureFullscreen();
  }, []);

  useEffect(() => {
    if (!issuedCode) return;
    const timer = window.setTimeout(() => {
      setIssuedCode(null);
      setIssuedType(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [issuedCode]);

  if (configQuery.isLoading) {
    return <main className="grid min-h-screen place-items-center">Carregando totem...</main>;
  }

  const config = configQuery.data;
  if (!config?.ok) {
    return (
      <main className="grid min-h-screen place-items-center">Totem indisponível no momento.</main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border bg-card p-6 text-center shadow-sm">
        {!fullscreenReady && config.kiosk_mode ? (
          <p className="mb-2 text-xs text-muted-foreground">Ativando modo tela cheia...</p>
        ) : null}

        <ClinicLogo
          src={config.clinic_logo ?? null}
          alt={config.clinic_name ?? "ClinicFlow"}
          fallbackText={config.clinic_name ?? "ClinicFlow"}
          className="mb-3 h-16 w-44"
          imgClassName="h-12"
        />
        <h1 className="text-2xl font-bold">{config.clinic_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {config.custom_text || "Toque para retirar sua senha"}
        </p>

        {issuedCode ? (
          <div className="mt-6 w-full rounded-2xl border bg-primary/5 p-6">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Senha emitida {issuedType === "priority" ? "(Prioritário)" : "(Normal)"}
            </p>
            <p className="mt-2 text-5xl font-black">{issuedCode}</p>
            <p className="mt-3 text-sm text-muted-foreground">Aguarde ser chamado.</p>
          </div>
        ) : (
          <div className="mt-6 w-full space-y-3">
            {config.allow_normal ? (
              <Button
                className="h-20 w-full text-2xl"
                onClick={() => issueMutation.mutate(false)}
                disabled={issueMutation.isPending}
              >
                Atendimento Normal
              </Button>
            ) : null}

            {config.allow_priority ? (
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="h-20 w-full text-2xl"
                  onClick={() => issueMutation.mutate(true)}
                  disabled={issueMutation.isPending}
                >
                  Atendimento Prioritário
                </Button>
                <p className="text-xs text-muted-foreground">{config.priority_help_text}</p>
              </div>
            ) : null}
          </div>
        )}

        {config.footer_text ? (
          <p className="mt-6 text-xs text-muted-foreground">{config.footer_text}</p>
        ) : null}
      </div>
    </main>
  );
}

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getKioskPublicConfig, issueTicketByToken } from "@/services/totem";
import { buildPrintHtml } from "@/services/print";

export const Route = createFileRoute("/totem/$token")({
  component: KioskPage,
  ssr: false,
  head: () => ({
    meta: [{ title: "Totem de atendimento — ClinicFlow" }, { name: "robots", content: "noindex" }],
  }),
});

function KioskPage() {
  const { token } = Route.useParams();
  const [priorityReason, setPriorityReason] = useState("");
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["kiosk-public-config", token],
    queryFn: () => getKioskPublicConfig(token),
  });

  const issueMutation = useMutation({
    mutationFn: async (priority: boolean) => issueTicketByToken(token, { priority, priorityReason }),
    onSuccess: (data) => {
      if (!data.ok || !data.ticket_code) return;
      setIssuedCode(data.ticket_code);

      if (data.print_auto && configQuery.data?.clinic_name) {
        const html = buildPrintHtml({
          clinicName: configQuery.data.clinic_name,
          logoUrl: configQuery.data.clinic_logo ?? null,
          welcomeMessage: configQuery.data.custom_text ?? "Bem-vindo",
          ticketCode: data.ticket_code,
          issuedAtIso: data.issued_at ?? new Date().toISOString(),
          footerMessage: data.footer_text ?? "Aguarde ser chamado",
          paperSize: data.paper_size ?? "58mm",
          qrEnabled: data.qr_enabled ?? false,
          qrValue: data.ticket_code,
        });

        const printWindow = window.open("", "_blank", "width=360,height=620");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      }
    },
  });

  useEffect(() => {
    if (!issuedCode) return;
    const timer = window.setTimeout(() => {
      setIssuedCode(null);
      setPriorityReason("");
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [issuedCode]);

  if (configQuery.isLoading) {
    return <main className="grid min-h-screen place-items-center">Carregando totem...</main>;
  }

  const config = configQuery.data;
  if (!config?.ok) {
    return <main className="grid min-h-screen place-items-center">Totem indisponível no momento.</main>;
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border bg-card p-6 text-center shadow-sm">
        {config.clinic_logo ? <img src={config.clinic_logo} alt={config.clinic_name} className="mb-3 h-16 object-contain" /> : null}
        <h1 className="text-2xl font-bold">{config.clinic_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{config.custom_text || "Selecione o tipo de atendimento"}</p>

        {issuedCode ? (
          <div className="mt-6 w-full rounded-2xl border bg-primary/5 p-6">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Senha emitida</p>
            <p className="mt-2 text-5xl font-black">{issuedCode}</p>
            <p className="mt-3 text-sm text-muted-foreground">Aguarde ser chamado.</p>
          </div>
        ) : (
          <div className="mt-6 w-full space-y-3">
            {config.allow_normal ? (
              <Button
                className="h-14 w-full text-lg"
                onClick={() => issueMutation.mutate(false)}
                disabled={issueMutation.isPending}
              >
                Atendimento normal
              </Button>
            ) : null}

            {config.allow_priority ? (
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="h-14 w-full text-lg"
                  onClick={() => issueMutation.mutate(true)}
                  disabled={issueMutation.isPending}
                >
                  Tenho prioridade
                </Button>
                <p className="text-xs text-muted-foreground">{config.priority_help_text}</p>
                <Input
                  value={priorityReason}
                  onChange={(event) => setPriorityReason(event.target.value)}
                  placeholder="Motivo (opcional)"
                />
              </div>
            ) : null}
          </div>
        )}

        {config.footer_text ? <p className="mt-6 text-xs text-muted-foreground">{config.footer_text}</p> : null}
      </div>
    </main>
  );
}

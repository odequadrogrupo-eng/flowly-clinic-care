import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPrintSettings } from "@/services/totem";
import { buildPrintHtml, printWithBrowser, tryPrintWithWebApi } from "@/services/print";

export const Route = createFileRoute("/_authenticated/impressao")({
  component: PrintPage,
  head: () => ({
    meta: [{ title: "Impressão térmica — ClinicFlow" }, { name: "robots", content: "noindex" }],
  }),
});

function PrintPage() {
  return (
    <Page title="Impressão térmica" description="Teste e configuração de impressão" allowed={["admin", "receptionist", "attendant"]}>
      {(profile) => <PrintContent clinicId={profile.clinic_id} clinicName={profile.clinics?.name ?? "Clínica"} logoUrl={profile.clinics?.logo_url ?? null} />}
    </Page>
  );
}

function PrintContent({ clinicId, clinicName, logoUrl }: { clinicId: string; clinicName: string; logoUrl: string | null }) {
  const [ticketCode, setTicketCode] = useState("N-001");
  const settingsQuery = useQuery({
    queryKey: ["print-settings", clinicId],
    queryFn: () => getPrintSettings(clinicId),
  });

  const testMutation = useMutation({
    mutationFn: async (mode: "browser" | "webusb" | "webserial") => {
      const settings = settingsQuery.data;
      if (!settings) return;
      const payload = {
        clinicName,
        logoUrl,
        welcomeMessage: settings.welcome_message,
        ticketCode,
        issuedAtIso: new Date().toISOString(),
        footerMessage: settings.footer_message,
        paperSize: settings.paper_size,
        qrEnabled: settings.qr_enabled,
        qrValue: ticketCode,
      } as const;

      if (mode === "browser") {
        printWithBrowser(payload);
        return;
      }

      const result = await tryPrintWithWebApi(payload, mode);
      return result;
    },
    onSuccess: (result) => {
      if (!result) {
        toast.success("Teste enviado para impressão no navegador");
        return;
      }
      toast.success("Payload de impressão preparado", { description: `${result.mode} -> ${result.endpoint}` });
    },
    onError: (error: Error) => {
      toast.error("Falha no teste de impressão", { description: error.message });
    },
  });

  const settings = settingsQuery.data;
  const previewHtml = settings
    ? buildPrintHtml({
        clinicName,
        logoUrl,
        welcomeMessage: settings.welcome_message,
        ticketCode,
        issuedAtIso: new Date().toISOString(),
        footerMessage: settings.footer_message,
        paperSize: settings.paper_size,
        qrEnabled: settings.qr_enabled,
        qrValue: ticketCode,
      })
    : "";

  return (
    <div className="space-y-4">
      <div className="card-soft grid gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="print-ticket">Senha de teste</Label>
          <Input id="print-ticket" value={ticketCode} onChange={(event) => setTicketCode(event.target.value)} />
        </div>
        <Button onClick={() => testMutation.mutate("browser")} disabled={testMutation.isPending}>Imprimir navegador</Button>
        <Button variant="outline" onClick={() => testMutation.mutate("webusb")} disabled={testMutation.isPending}>Teste WebUSB</Button>
        <Button variant="outline" onClick={() => testMutation.mutate("webserial")} disabled={testMutation.isPending}>Teste WebSerial</Button>
      </div>

      <div className="card-soft p-4">
        <h2 className="font-semibold">Visualização prévia</h2>
        <iframe title="print-preview" className="mt-3 h-[420px] w-full rounded-xl border" srcDoc={previewHtml} />
      </div>

      <div className="card-soft p-4 text-sm text-muted-foreground">
        Endpoint preparado para futuro Print Agent: {settings?.local_agent_endpoint ?? "http://127.0.0.1:3311/print"}
      </div>
    </div>
  );
}

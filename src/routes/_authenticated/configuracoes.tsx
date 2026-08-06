import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Page } from "@/components/layout/Page";
import { ClinicLogo } from "@/components/common/ClinicLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logAudit } from "@/lib/queue";
import { updateClinicById, type ClinicFormValues } from "@/services/clinic";
import {
  getKioskSettings,
  getPanelSettings,
  getPrintSettings,
  regenerateKioskToken,
  regeneratePanelToken,
  updateKioskSettings,
  updatePanelSettings,
  updatePrintSettings,
  type KioskSettingsRow,
  type PanelSettingsRow,
  type PrintSettingsRow,
} from "@/services/totem";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — ClinicFlow" },
      { name: "description", content: "Configurações institucionais e preferências operacionais da clínica." },
      { property: "og:title", content: "Configurações — ClinicFlow" },
      { property: "og:description", content: "Gerencie dados da clínica e preferências de chamada." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Page title="Configurações" description="Dados institucionais da clínica" allowed={["admin"]}>
      {(profile) => <SettingsContent clinicId={profile.clinic_id} profileId={profile.id} initial={profile.clinics} />}
    </Page>
  );
}

function SettingsContent({
  clinicId,
  profileId,
  initial,
}: {
  clinicId: string;
  profileId: string;
  initial: {
    name: string;
    legal_name: string | null;
    document: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    opening_hours: string | null;
    logo_url: string | null;
    voice_enabled: boolean;
  } | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClinicFormValues>({
    name: initial?.name ?? "",
    legal_name: initial?.legal_name ?? "",
    document: initial?.document ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
    opening_hours: initial?.opening_hours ?? "",
    logo_url: initial?.logo_url ?? "",
    voice_enabled: initial?.voice_enabled ?? true,
  });

  const [kioskForm, setKioskForm] = useState<KioskSettingsRow | null>(null);
  const [panelForm, setPanelForm] = useState<PanelSettingsRow | null>(null);
  const [printForm, setPrintForm] = useState<PrintSettingsRow | null>(null);

  const kioskQuery = useQuery({
    queryKey: ["kiosk-settings", clinicId],
    queryFn: () => getKioskSettings(clinicId),
  });

  const panelQuery = useQuery({
    queryKey: ["panel-settings", clinicId],
    queryFn: () => getPanelSettings(clinicId),
  });

  const printQuery = useQuery({
    queryKey: ["print-settings", clinicId],
    queryFn: () => getPrintSettings(clinicId),
  });

  useEffect(() => {
    if (kioskQuery.data) setKioskForm(kioskQuery.data);
  }, [kioskQuery.data]);

  useEffect(() => {
    if (panelQuery.data) setPanelForm(panelQuery.data);
  }, [panelQuery.data]);

  useEffect(() => {
    if (printQuery.data) setPrintForm(printQuery.data);
  }, [printQuery.data]);

  const kioskPublicUrl = useMemo(() => {
    if (!kioskForm?.public_token) return "";
    return `${window.location.origin}/totem/${kioskForm.public_token}`;
  }, [kioskForm?.public_token]);

  const panelPublicUrl = useMemo(() => {
    if (!panelForm?.public_token) return "";
    return `${window.location.origin}/painel/${panelForm.public_token}`;
  }, [panelForm?.public_token]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateClinicById(clinicId, form);
      await logAudit({
        clinicId,
        action: "update",
        entity: "clinics",
        entityId: clinicId,
        details: { actor: profileId, section: "configuracoes" },
      });
    },
    onSuccess: () => toast.success("Configurações atualizadas"),
    onError: (error: Error) => toast.error("Erro ao salvar", { description: error.message }),
  });

  const saveKioskMutation = useMutation({
    mutationFn: async () => {
      if (!kioskForm) return;
      await updateKioskSettings(clinicId, kioskForm);
      await logAudit({ clinicId, action: "update", entity: "kiosk_settings", entityId: clinicId });
    },
    onSuccess: () => {
      toast.success("Configurações do totem salvas");
      queryClient.invalidateQueries({ queryKey: ["kiosk-settings", clinicId] });
    },
    onError: (error: Error) => toast.error("Erro no totem", { description: error.message }),
  });

  const savePanelMutation = useMutation({
    mutationFn: async () => {
      if (!panelForm) return;
      await updatePanelSettings(clinicId, panelForm);
      await logAudit({ clinicId, action: "update", entity: "panel_settings", entityId: clinicId });
    },
    onSuccess: () => {
      toast.success("Configurações do painel salvas");
      queryClient.invalidateQueries({ queryKey: ["panel-settings", clinicId] });
    },
    onError: (error: Error) => toast.error("Erro no painel", { description: error.message }),
  });

  const savePrintMutation = useMutation({
    mutationFn: async () => {
      if (!printForm) return;
      await updatePrintSettings(clinicId, printForm);
      await logAudit({ clinicId, action: "update", entity: "print_settings", entityId: clinicId });
    },
    onSuccess: () => {
      toast.success("Configurações de impressão salvas");
      queryClient.invalidateQueries({ queryKey: ["print-settings", clinicId] });
    },
    onError: (error: Error) => toast.error("Erro na impressão", { description: error.message }),
  });

  const regenerateKioskMutation = useMutation({
    mutationFn: () => regenerateKioskToken(clinicId),
    onSuccess: async (token) => {
      toast.success("Token do totem regenerado");
      setKioskForm((prev) => (prev ? { ...prev, public_token: token } : prev));
      await logAudit({ clinicId, action: "regenerate_token", entity: "kiosk_settings", entityId: clinicId });
    },
  });

  const regeneratePanelMutation = useMutation({
    mutationFn: () => regeneratePanelToken(clinicId),
    onSuccess: async (token) => {
      toast.success("Token do painel regenerado");
      setPanelForm((prev) => (prev ? { ...prev, public_token: token } : prev));
      await logAudit({ clinicId, action: "regenerate_token", entity: "panel_settings", entityId: clinicId });
    },
  });

  return (
    <div className="space-y-4">
      <section className="card-soft p-5">
        <h2 className="font-semibold">Cadastro da clínica</h2>
        <p className="text-sm text-muted-foreground">Esses dados são usados em todo o sistema.</p>

      <div className="mt-4">
        <ClinicLogo
          src={form.logo_url || "/brands/club-medico/logo.png"}
          alt={form.name || "Club Médico"}
          fallbackText="Club Médico"
          className="h-16 w-44"
          imgClassName="h-12"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cfg-name">Nome fantasia</Label>
          <Input id="cfg-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-legal">Razão social</Label>
          <Input
            id="cfg-legal"
            value={form.legal_name}
            onChange={(event) => setForm({ ...form, legal_name: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-doc">Documento</Label>
          <Input
            id="cfg-doc"
            value={form.document}
            onChange={(event) => setForm({ ...form, document: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-phone">Telefone</Label>
          <Input
            id="cfg-phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="cfg-email">E-mail</Label>
          <Input
            id="cfg-email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="cfg-address">Endereço</Label>
          <Textarea
            id="cfg-address"
            rows={2}
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-hours">Horário de funcionamento</Label>
          <Input
            id="cfg-hours"
            value={form.opening_hours}
            onChange={(event) => setForm({ ...form, opening_hours: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-logo">URL do logo</Label>
          <Input
            id="cfg-logo"
            value={form.logo_url}
            onChange={(event) => setForm({ ...form, logo_url: event.target.value })}
          />
        </div>
      </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.voice_enabled}
              onChange={(event) => setForm({ ...form, voice_enabled: event.target.checked })}
            />
            Chamada por voz habilitada
          </label>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </section>

      {kioskForm ? (
        <section className="card-soft p-5">
          <h2 className="font-semibold">Totem</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={kioskForm.enabled} onChange={(e) => setKioskForm({ ...kioskForm, enabled: e.target.checked })} />
              Totem ativo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={kioskForm.kiosk_mode} onChange={(e) => setKioskForm({ ...kioskForm, kiosk_mode: e.target.checked })} />
              Modo kiosk/tela cheia
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={kioskForm.allow_normal} onChange={(e) => setKioskForm({ ...kioskForm, allow_normal: e.target.checked })} />
              Permitir atendimento normal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={kioskForm.allow_priority} onChange={(e) => setKioskForm({ ...kioskForm, allow_priority: e.target.checked })} />
              Permitir atendimento preferencial
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input value={kioskForm.normal_prefix} onChange={(e) => setKioskForm({ ...kioskForm, normal_prefix: e.target.value.toUpperCase() })} placeholder="Prefixo normal" />
            <Input value={kioskForm.priority_prefix} onChange={(e) => setKioskForm({ ...kioskForm, priority_prefix: e.target.value.toUpperCase() })} placeholder="Prefixo preferencial" />
            <Textarea value={kioskForm.custom_text ?? ""} onChange={(e) => setKioskForm({ ...kioskForm, custom_text: e.target.value })} placeholder="Texto personalizado" />
            <Textarea value={kioskForm.footer_text ?? ""} onChange={(e) => setKioskForm({ ...kioskForm, footer_text: e.target.value })} placeholder="Mensagem de rodapé" />
          </div>
          <div className="mt-4 rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">URL pública do totem</p>
            <div className="mt-1 flex gap-2">
              <Input value={kioskPublicUrl} readOnly />
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(kioskPublicUrl)}>Copiar</Button>
              <Button variant="outline" onClick={() => regenerateKioskMutation.mutate()} disabled={regenerateKioskMutation.isPending}>Regenerar</Button>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => saveKioskMutation.mutate()} disabled={saveKioskMutation.isPending}>Salvar totem</Button>
          </div>
        </section>
      ) : null}

      {panelForm ? (
        <section className="card-soft p-5">
          <h2 className="font-semibold">Painel de TV</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input value={panelForm.name} onChange={(e) => setPanelForm({ ...panelForm, name: e.target.value })} placeholder="Nome do painel" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={panelForm.enabled} onChange={(e) => setPanelForm({ ...panelForm, enabled: e.target.checked })} />
              Painel ativo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={panelForm.full_screen} onChange={(e) => setPanelForm({ ...panelForm, full_screen: e.target.checked })} />
              Tela cheia
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={panelForm.show_clock} onChange={(e) => setPanelForm({ ...panelForm, show_clock: e.target.checked })} />
              Exibir relógio
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={panelForm.show_latest_calls} onChange={(e) => setPanelForm({ ...panelForm, show_latest_calls: e.target.checked })} />
              Exibir últimas chamadas
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={panelForm.sound_enabled} onChange={(e) => setPanelForm({ ...panelForm, sound_enabled: e.target.checked })} />
              Aviso sonoro
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={panelForm.voice_enabled} onChange={(e) => setPanelForm({ ...panelForm, voice_enabled: e.target.checked })} />
              Voz ativa
            </label>
            <div className="space-y-2">
              <Label>Privacidade de exibição</Label>
              <Select value={panelForm.show_mode} onValueChange={(value: PanelSettingsRow["show_mode"]) => setPanelForm({ ...panelForm, show_mode: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ticket_only">Somente senha</SelectItem>
                  <SelectItem value="first_name">Primeiro nome</SelectItem>
                  <SelectItem value="name_abbreviated">Nome abreviado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template de voz</Label>
              <Input value={panelForm.phrase_template} onChange={(e) => setPanelForm({ ...panelForm, phrase_template: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Volume (0 a 1)</Label>
              <Input type="number" min="0" max="1" step="0.05" value={panelForm.voice_volume} onChange={(e) => setPanelForm({ ...panelForm, voice_volume: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Velocidade</Label>
              <Input type="number" min="0.5" max="2" step="0.05" value={panelForm.voice_rate} onChange={(e) => setPanelForm({ ...panelForm, voice_rate: Number(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <Label>Tom</Label>
              <Input type="number" min="0" max="2" step="0.05" value={panelForm.voice_pitch} onChange={(e) => setPanelForm({ ...panelForm, voice_pitch: Number(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <Label>Repetições</Label>
              <Input type="number" min="1" max="5" step="1" value={panelForm.voice_repeat_count} onChange={(e) => setPanelForm({ ...panelForm, voice_repeat_count: Number(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <Label>Intervalo entre repetições (s)</Label>
              <Input type="number" min="1" max="10" step="1" value={panelForm.voice_repeat_interval_seconds} onChange={(e) => setPanelForm({ ...panelForm, voice_repeat_interval_seconds: Number(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <Label>Qtd. de últimas chamadas</Label>
              <Input type="number" min="1" max="20" step="1" value={panelForm.latest_calls_limit} onChange={(e) => setPanelForm({ ...panelForm, latest_calls_limit: Number(e.target.value) || 5 })} />
            </div>
          </div>
          <div className="mt-4 rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">URL pública do painel</p>
            <div className="mt-1 flex gap-2">
              <Input value={panelPublicUrl} readOnly />
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(panelPublicUrl)}>Copiar</Button>
              <Button variant="outline" onClick={() => regeneratePanelMutation.mutate()} disabled={regeneratePanelMutation.isPending}>Regenerar</Button>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => savePanelMutation.mutate()} disabled={savePanelMutation.isPending}>Salvar painel</Button>
          </div>
        </section>
      ) : null}

      {printForm ? (
        <section className="card-soft p-5">
          <h2 className="font-semibold">Impressão</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={printForm.paper_size} onValueChange={(value: PrintSettingsRow["paper_size"]) => setPrintForm({ ...printForm, paper_size: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58 mm</SelectItem>
                  <SelectItem value="80mm">80 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input value={printForm.local_agent_endpoint} onChange={(e) => setPrintForm({ ...printForm, local_agent_endpoint: e.target.value })} placeholder="Endpoint local do Print Agent" />
            <Input value={printForm.welcome_message} onChange={(e) => setPrintForm({ ...printForm, welcome_message: e.target.value })} placeholder="Mensagem de boas-vindas" />
            <Input value={printForm.footer_message} onChange={(e) => setPrintForm({ ...printForm, footer_message: e.target.value })} placeholder="Mensagem de rodapé" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={printForm.qr_enabled} onChange={(e) => setPrintForm({ ...printForm, qr_enabled: e.target.checked })} />
              QR Code
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={printForm.browser_fallback_enabled} onChange={(e) => setPrintForm({ ...printForm, browser_fallback_enabled: e.target.checked })} />
              Fallback navegador
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={printForm.webusb_enabled} onChange={(e) => setPrintForm({ ...printForm, webusb_enabled: e.target.checked })} />
              WebUSB
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={printForm.webserial_enabled} onChange={(e) => setPrintForm({ ...printForm, webserial_enabled: e.target.checked })} />
              WebSerial
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => savePrintMutation.mutate()} disabled={savePrintMutation.isPending}>Salvar impressão</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

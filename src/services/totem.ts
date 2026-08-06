import { supabase } from "@/integrations/supabase/client";

export type KioskPublicConfig = {
  ok: boolean;
  message?: string;
  clinic_id?: string;
  clinic_name?: string;
  clinic_logo?: string | null;
  allow_normal?: boolean;
  allow_priority?: boolean;
  normal_prefix?: string;
  priority_prefix?: string;
  custom_text?: string | null;
  footer_text?: string | null;
  qr_enabled?: boolean;
  paper_size?: "58mm" | "80mm";
  print_auto?: boolean;
  print_method?: "browser" | "webusb" | "webserial" | "agent";
  browser_fallback_enabled?: boolean;
  webusb_enabled?: boolean;
  webserial_enabled?: boolean;
  local_agent_endpoint?: string;
  welcome_message?: string;
  kiosk_mode?: boolean;
  priority_help_text?: string;
};

export type IssuedTicket = {
  ok: boolean;
  message?: string;
  ticket_id?: string;
  ticket_code?: string;
  issued_at?: string;
  priority?: boolean;
  paper_size?: "58mm" | "80mm";
  print_auto?: boolean;
  qr_enabled?: boolean;
  footer_text?: string | null;
};

export async function getKioskPublicConfig(token: string): Promise<KioskPublicConfig> {
  const { data, error } = await supabase.rpc(
    "get_kiosk_public_config" as never,
    { _token: token } as never,
  );
  if (error) throw error;
  return data as KioskPublicConfig;
}

export async function issueTicketByToken(
  token: string,
  input: { priority: boolean; priorityReason?: string },
) {
  const { data, error } = await supabase.rpc(
    "issue_ticket_by_token" as never,
    {
      _token: token,
      _priority: input.priority,
      _priority_reason: input.priorityReason ?? null,
    } as never,
  );
  if (error) throw error;
  return data as IssuedTicket;
}

export type KioskSettingsRow = {
  clinic_id: string;
  enabled: boolean;
  public_token: string;
  allow_normal: boolean;
  allow_priority: boolean;
  normal_prefix: string;
  priority_prefix: string;
  custom_text: string | null;
  footer_text: string | null;
  logo_url: string | null;
  paper_size: "58mm" | "80mm";
  print_auto: boolean;
  print_method: "browser" | "webusb" | "webserial" | "agent";
  qr_enabled: boolean;
  priority_help_text: string;
  kiosk_mode: boolean;
};

export type PanelSettingsRow = {
  clinic_id: string;
  name: string;
  enabled: boolean;
  public_token: string;
  panel_title: string;
  current_call_label: string;
  previous_calls_label: string;
  privacy_message: string;
  show_mode: "ticket_only" | "first_name" | "name_abbreviated";
  show_ticket: boolean;
  show_patient_name: boolean;
  show_professional: boolean;
  show_called_time: boolean;
  show_destination: boolean;
  show_room: boolean;
  show_desk: boolean;
  show_office: boolean;
  show_priority: boolean;
  room_label: string;
  desk_label: string;
  office_label: string;
  reception_label: string;
  full_screen: boolean;
  show_clock: boolean;
  show_latest_calls: boolean;
  latest_calls_limit: number;
  highlight_seconds: number;
  brand_primary: string | null;
  brand_secondary: string | null;
  logo_override_url: string | null;
  sound_enabled: boolean;
  voice_enabled: boolean;
  voice_name: string | null;
  voice_volume: number;
  voice_rate: number;
  voice_pitch: number;
  voice_repeat_count: number;
  voice_repeat_interval_seconds: number;
  phrase_template: string;
};

export type PrintSettingsRow = {
  clinic_id: string;
  paper_size: "58mm" | "80mm";
  welcome_message: string;
  footer_message: string;
  qr_enabled: boolean;
  browser_fallback_enabled: boolean;
  webusb_enabled: boolean;
  webserial_enabled: boolean;
  local_agent_endpoint: string;
};

export async function getKioskSettings(clinicId: string) {
  const { data, error } = await supabase
    .from("kiosk_settings" as never)
    .select(
      "clinic_id, enabled, public_token, allow_normal, allow_priority, normal_prefix, priority_prefix, custom_text, footer_text, logo_url, paper_size, print_auto, print_method, qr_enabled, priority_help_text, kiosk_mode" as never,
    )
    .eq("clinic_id", clinicId)
    .single();
  if (error) throw error;
  return data as KioskSettingsRow;
}

export async function updateKioskSettings(clinicId: string, input: Partial<KioskSettingsRow>) {
  const { error } = await supabase
    .from("kiosk_settings" as never)
    .update(input as never)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

export async function regenerateKioskToken(clinicId: string) {
  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("kiosk_settings" as never)
    .update({ public_token: token } as never)
    .eq("clinic_id", clinicId);
  if (error) throw error;
  return token;
}

export async function getPanelSettings(clinicId: string) {
  const { data, error } = await supabase
    .from("panel_settings" as never)
    .select(
      "clinic_id, name, enabled, public_token, panel_title, current_call_label, previous_calls_label, privacy_message, show_mode, show_ticket, show_patient_name, show_professional, show_called_time, show_destination, show_room, show_desk, show_office, show_priority, room_label, desk_label, office_label, reception_label, full_screen, show_clock, show_latest_calls, latest_calls_limit, highlight_seconds, brand_primary, brand_secondary, logo_override_url, sound_enabled, voice_enabled, voice_name, voice_volume, voice_rate, voice_pitch, voice_repeat_count, voice_repeat_interval_seconds, phrase_template" as never,
    )
    .eq("clinic_id", clinicId)
    .single();
  if (error) throw error;
  return data as PanelSettingsRow;
}

export async function updatePanelSettings(clinicId: string, input: Partial<PanelSettingsRow>) {
  const { error } = await supabase
    .from("panel_settings" as never)
    .update(input as never)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

export async function regeneratePanelToken(clinicId: string) {
  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("panel_settings" as never)
    .update({ public_token: token } as never)
    .eq("clinic_id", clinicId);
  if (error) throw error;
  return token;
}

export async function getPrintSettings(clinicId: string) {
  const { data, error } = await supabase
    .from("print_settings" as never)
    .select(
      "clinic_id, paper_size, welcome_message, footer_message, qr_enabled, browser_fallback_enabled, webusb_enabled, webserial_enabled, local_agent_endpoint" as never,
    )
    .eq("clinic_id", clinicId)
    .single();
  if (error) throw error;
  return data as PrintSettingsRow;
}

export async function updatePrintSettings(clinicId: string, input: Partial<PrintSettingsRow>) {
  const { error } = await supabase
    .from("print_settings" as never)
    .update(input as never)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

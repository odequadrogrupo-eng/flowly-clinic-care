-- Totem public flow hardening + print method selection per clinic

ALTER TABLE public.kiosk_settings
  ADD COLUMN IF NOT EXISTS print_method text NOT NULL DEFAULT 'browser'
  CHECK (print_method IN ('browser', 'webusb', 'webserial', 'agent'));

CREATE OR REPLACE FUNCTION public.get_kiosk_public_config(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  p record;
BEGIN
  SELECT
    ks.*, c.name AS clinic_name, c.logo_url AS clinic_logo
  INTO r
  FROM public.kiosk_settings ks
  JOIN public.clinics c ON c.id = ks.clinic_id
  WHERE ks.public_token = _token
    AND ks.enabled = true;

  IF r.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Totem indisponivel');
  END IF;

  SELECT
    ps.browser_fallback_enabled,
    ps.webusb_enabled,
    ps.webserial_enabled,
    ps.local_agent_endpoint,
    ps.welcome_message,
    ps.footer_message
  INTO p
  FROM public.print_settings ps
  WHERE ps.clinic_id = r.clinic_id;

  RETURN jsonb_build_object(
    'ok', true,
    'clinic_id', r.clinic_id,
    'clinic_name', r.clinic_name,
    'clinic_logo', COALESCE(r.logo_url, r.clinic_logo),
    'allow_normal', r.allow_normal,
    'allow_priority', r.allow_priority,
    'normal_prefix', r.normal_prefix,
    'priority_prefix', r.priority_prefix,
    'custom_text', r.custom_text,
    'footer_text', COALESCE(r.footer_text, p.footer_message),
    'qr_enabled', r.qr_enabled,
    'paper_size', r.paper_size,
    'print_auto', r.print_auto,
    'print_method', r.print_method,
    'browser_fallback_enabled', COALESCE(p.browser_fallback_enabled, true),
    'webusb_enabled', COALESCE(p.webusb_enabled, true),
    'webserial_enabled', COALESCE(p.webserial_enabled, true),
    'local_agent_endpoint', COALESCE(p.local_agent_endpoint, 'http://127.0.0.1:3311/print'),
    'welcome_message', COALESCE(p.welcome_message, 'Bem-vindo ao atendimento'),
    'priority_help_text', r.priority_help_text
  );
END;
$$;

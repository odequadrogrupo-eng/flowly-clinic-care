-- Complete SaaS foundation for ClinicFlow
-- Non-destructive, idempotent expansion over existing schema.

-- Roles: add attendant profile role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'attendant'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'attendant';
  END IF;
END $$;

-- Queue lifecycle statuses for reception + service flow.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'queue_status' AND e.enumlabel = 'waiting_reception'
  ) THEN
    ALTER TYPE public.queue_status ADD VALUE 'waiting_reception';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'queue_status' AND e.enumlabel = 'called_reception'
  ) THEN
    ALTER TYPE public.queue_status ADD VALUE 'called_reception';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'queue_status' AND e.enumlabel = 'waiting_service'
  ) THEN
    ALTER TYPE public.queue_status ADD VALUE 'waiting_service';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'queue_status' AND e.enumlabel = 'called_service'
  ) THEN
    ALTER TYPE public.queue_status ADD VALUE 'called_service';
  END IF;
END $$;

-- Profile hardening for temporary password lifecycle.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS temp_password_issued_at timestamptz;

-- Specialty catalog.
CREATE TABLE IF NOT EXISTS public.specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name)
);

DROP TRIGGER IF EXISTS t_specialties_updated ON public.specialties;
CREATE TRIGGER t_specialties_updated
BEFORE UPDATE ON public.specialties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Optional relation between professionals and specialties.
CREATE TABLE IF NOT EXISTS public.professional_specialties (
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  specialty_id uuid NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (professional_id, specialty_id)
);

-- Reception desks and attendants
CREATE TABLE IF NOT EXISTS public.receptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name)
);

DROP TRIGGER IF EXISTS t_receptions_updated ON public.receptions;
CREATE TRIGGER t_receptions_updated
BEFORE UPDATE ON public.receptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.attendants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reception_id uuid REFERENCES public.receptions(id) ON DELETE SET NULL,
  display_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, profile_id)
);

DROP TRIGGER IF EXISTS t_attendants_updated ON public.attendants;
CREATE TRIGGER t_attendants_updated
BEFORE UPDATE ON public.attendants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ticketing / totem
CREATE TABLE IF NOT EXISTS public.kiosk_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  public_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  allow_normal boolean NOT NULL DEFAULT true,
  allow_priority boolean NOT NULL DEFAULT true,
  normal_prefix text NOT NULL DEFAULT 'N',
  priority_prefix text NOT NULL DEFAULT 'P',
  sequence_reset_daily boolean NOT NULL DEFAULT true,
  custom_text text,
  footer_text text,
  logo_url text,
  paper_size text NOT NULL DEFAULT '58mm' CHECK (paper_size IN ('58mm', '80mm')),
  print_auto boolean NOT NULL DEFAULT false,
  qr_enabled boolean NOT NULL DEFAULT false,
  priority_help_text text NOT NULL DEFAULT 'Preferencial: idoso, gestante ou PCD',
  kiosk_mode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS t_kiosk_settings_updated ON public.kiosk_settings;
CREATE TRIGGER t_kiosk_settings_updated
BEFORE UPDATE ON public.kiosk_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.print_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  paper_size text NOT NULL DEFAULT '58mm' CHECK (paper_size IN ('58mm', '80mm')),
  welcome_message text NOT NULL DEFAULT 'Bem-vindo ao atendimento',
  footer_message text NOT NULL DEFAULT 'Aguarde ser chamado',
  qr_enabled boolean NOT NULL DEFAULT false,
  browser_fallback_enabled boolean NOT NULL DEFAULT true,
  webusb_enabled boolean NOT NULL DEFAULT true,
  webserial_enabled boolean NOT NULL DEFAULT true,
  local_agent_endpoint text NOT NULL DEFAULT 'http://127.0.0.1:3311/print',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS t_print_settings_updated ON public.print_settings;
CREATE TRIGGER t_print_settings_updated
BEFORE UPDATE ON public.print_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.panel_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  public_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  show_mode text NOT NULL DEFAULT 'name_abbreviated' CHECK (show_mode IN ('ticket_only', 'first_name', 'name_abbreviated')),
  show_destination boolean NOT NULL DEFAULT true,
  voice_enabled boolean NOT NULL DEFAULT true,
  voice_name text,
  voice_volume numeric(3,2) NOT NULL DEFAULT 1.0,
  voice_rate numeric(3,2) NOT NULL DEFAULT 0.95,
  phrase_template text NOT NULL DEFAULT 'Senha {{ticket}}, dirigir-se à {{destination}}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS t_panel_settings_updated ON public.panel_settings;
CREATE TRIGGER t_panel_settings_updated
BEFORE UPDATE ON public.panel_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  queue_id uuid REFERENCES public.queues(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  code text NOT NULL,
  sequence integer NOT NULL,
  prefix text NOT NULL,
  priority boolean NOT NULL DEFAULT false,
  priority_reason text,
  status text NOT NULL DEFAULT 'waiting_reception' CHECK (status IN ('waiting_reception','called_reception','waiting_service','called_service','in_service','finished','cancelled','no_show')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, code)
);

DROP TRIGGER IF EXISTS t_tickets_updated ON public.tickets;
CREATE TRIGGER t_tickets_updated
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tickets_clinic_issued ON public.tickets(clinic_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_clinic_status ON public.tickets(clinic_id, status);

CREATE TABLE IF NOT EXISTS public.ticket_counters (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  counter_date date NOT NULL,
  prefix text NOT NULL,
  next_value integer NOT NULL DEFAULT 1,
  PRIMARY KEY (clinic_id, counter_date, prefix)
);

-- Expand appointments statuses.
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled','confirmed','checked_in','in_service','finished','cancelled','no_show','compromisso','bloqueado','aniversario','feriado'));

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS specialty_id uuid REFERENCES public.specialties(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS locked_conflict boolean NOT NULL DEFAULT true;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialties, public.professional_specialties, public.receptions, public.attendants, public.kiosk_settings, public.print_settings, public.panel_settings, public.tickets, public.ticket_counters TO authenticated;
GRANT ALL ON public.specialties, public.professional_specialties, public.receptions, public.attendants, public.kiosk_settings, public.print_settings, public.panel_settings, public.tickets, public.ticket_counters TO service_role;

ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_counters ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS specialties_select_clinic ON public.specialties;
DROP POLICY IF EXISTS specialties_insert_staff ON public.specialties;
DROP POLICY IF EXISTS specialties_update_staff ON public.specialties;
CREATE POLICY specialties_select_clinic ON public.specialties FOR SELECT TO authenticated USING (clinic_id = public.current_clinic_id());
CREATE POLICY specialties_insert_staff ON public.specialties FOR INSERT TO authenticated WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());
CREATE POLICY specialties_update_staff ON public.specialties FOR UPDATE TO authenticated USING (clinic_id = public.current_clinic_id() AND public.is_staff()) WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

DROP POLICY IF EXISTS receptions_select_clinic ON public.receptions;
DROP POLICY IF EXISTS receptions_insert_staff ON public.receptions;
DROP POLICY IF EXISTS receptions_update_staff ON public.receptions;
CREATE POLICY receptions_select_clinic ON public.receptions FOR SELECT TO authenticated USING (clinic_id = public.current_clinic_id());
CREATE POLICY receptions_insert_staff ON public.receptions FOR INSERT TO authenticated WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());
CREATE POLICY receptions_update_staff ON public.receptions FOR UPDATE TO authenticated USING (clinic_id = public.current_clinic_id() AND public.is_staff()) WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

DROP POLICY IF EXISTS attendants_select_clinic ON public.attendants;
DROP POLICY IF EXISTS attendants_insert_admin ON public.attendants;
DROP POLICY IF EXISTS attendants_update_admin ON public.attendants;
CREATE POLICY attendants_select_clinic ON public.attendants FOR SELECT TO authenticated USING (clinic_id = public.current_clinic_id());
CREATE POLICY attendants_insert_admin ON public.attendants FOR INSERT TO authenticated WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY attendants_update_admin ON public.attendants FOR UPDATE TO authenticated USING (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS kiosk_select_staff ON public.kiosk_settings;
DROP POLICY IF EXISTS kiosk_insert_admin ON public.kiosk_settings;
DROP POLICY IF EXISTS kiosk_update_admin ON public.kiosk_settings;
CREATE POLICY kiosk_select_staff ON public.kiosk_settings FOR SELECT TO authenticated USING (clinic_id = public.current_clinic_id());
CREATE POLICY kiosk_insert_admin ON public.kiosk_settings FOR INSERT TO authenticated WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY kiosk_update_admin ON public.kiosk_settings FOR UPDATE TO authenticated USING (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS print_select_staff ON public.print_settings;
DROP POLICY IF EXISTS print_insert_admin ON public.print_settings;
DROP POLICY IF EXISTS print_update_admin ON public.print_settings;
CREATE POLICY print_select_staff ON public.print_settings FOR SELECT TO authenticated USING (clinic_id = public.current_clinic_id());
CREATE POLICY print_insert_admin ON public.print_settings FOR INSERT TO authenticated WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY print_update_admin ON public.print_settings FOR UPDATE TO authenticated USING (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS panel_select_staff ON public.panel_settings;
DROP POLICY IF EXISTS panel_insert_admin ON public.panel_settings;
DROP POLICY IF EXISTS panel_update_admin ON public.panel_settings;
CREATE POLICY panel_select_staff ON public.panel_settings FOR SELECT TO authenticated USING (clinic_id = public.current_clinic_id());
CREATE POLICY panel_insert_admin ON public.panel_settings FOR INSERT TO authenticated WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY panel_update_admin ON public.panel_settings FOR UPDATE TO authenticated USING (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS tickets_select_clinic ON public.tickets;
DROP POLICY IF EXISTS tickets_insert_staff ON public.tickets;
DROP POLICY IF EXISTS tickets_update_staff_prof ON public.tickets;
CREATE POLICY tickets_select_clinic ON public.tickets FOR SELECT TO authenticated USING (clinic_id = public.current_clinic_id());
CREATE POLICY tickets_insert_staff ON public.tickets FOR INSERT TO authenticated WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());
CREATE POLICY tickets_update_staff_prof ON public.tickets FOR UPDATE TO authenticated USING (clinic_id = public.current_clinic_id() AND (public.is_staff() OR public.has_role(auth.uid(),'professional'))) WITH CHECK (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS ticket_counters_select_staff ON public.ticket_counters;
DROP POLICY IF EXISTS ticket_counters_write_staff ON public.ticket_counters;
CREATE POLICY ticket_counters_select_staff ON public.ticket_counters FOR SELECT TO authenticated USING (clinic_id = public.current_clinic_id());
CREATE POLICY ticket_counters_write_staff ON public.ticket_counters FOR ALL TO authenticated USING (clinic_id = public.current_clinic_id() AND public.is_staff()) WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

DROP POLICY IF EXISTS professional_specialties_select_clinic ON public.professional_specialties;
DROP POLICY IF EXISTS professional_specialties_write_staff ON public.professional_specialties;
CREATE POLICY professional_specialties_select_clinic ON public.professional_specialties FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.professionals p
    WHERE p.id = professional_specialties.professional_id
      AND p.clinic_id = public.current_clinic_id()
  )
);
CREATE POLICY professional_specialties_write_staff ON public.professional_specialties FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.professionals p
    WHERE p.id = professional_specialties.professional_id
      AND p.clinic_id = public.current_clinic_id()
      AND public.is_staff()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.professionals p
    WHERE p.id = professional_specialties.professional_id
      AND p.clinic_id = public.current_clinic_id()
      AND public.is_staff()
  )
);

-- Public token-driven helpers for Totem/Panel
CREATE OR REPLACE FUNCTION public.get_kiosk_public_config(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
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
    'footer_text', r.footer_text,
    'qr_enabled', r.qr_enabled,
    'paper_size', r.paper_size,
    'print_auto', r.print_auto,
    'priority_help_text', r.priority_help_text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_ticket_by_token(
  _token uuid,
  _priority boolean DEFAULT false,
  _priority_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg record;
  effective_prefix text;
  current_date date := (now() at time zone 'America/Sao_Paulo')::date;
  seq integer;
  code text;
  new_ticket_id uuid;
BEGIN
  SELECT *
  INTO cfg
  FROM public.kiosk_settings
  WHERE public_token = _token
    AND enabled = true;

  IF cfg.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Totem indisponivel');
  END IF;

  IF _priority AND cfg.allow_priority = false THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Atendimento preferencial desativado');
  END IF;

  IF NOT _priority AND cfg.allow_normal = false THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Atendimento normal desativado');
  END IF;

  effective_prefix := CASE WHEN _priority THEN cfg.priority_prefix ELSE cfg.normal_prefix END;

  INSERT INTO public.ticket_counters (clinic_id, counter_date, prefix, next_value)
  VALUES (cfg.clinic_id, current_date, effective_prefix, 1)
  ON CONFLICT (clinic_id, counter_date, prefix) DO NOTHING;

  UPDATE public.ticket_counters
  SET next_value = next_value + 1
  WHERE clinic_id = cfg.clinic_id
    AND counter_date = current_date
    AND prefix = effective_prefix
  RETURNING next_value - 1 INTO seq;

  code := format('%s-%s', effective_prefix, lpad(seq::text, 3, '0'));

  INSERT INTO public.tickets (clinic_id, code, sequence, prefix, priority, priority_reason, status)
  VALUES (
    cfg.clinic_id,
    code,
    seq,
    effective_prefix,
    _priority,
    CASE WHEN _priority THEN NULLIF(trim(_priority_reason), '') ELSE NULL END,
    'waiting_reception'
  )
  RETURNING id INTO new_ticket_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ticket_id', new_ticket_id,
    'ticket_code', code,
    'issued_at', now(),
    'priority', _priority,
    'paper_size', cfg.paper_size,
    'print_auto', cfg.print_auto,
    'qr_enabled', cfg.qr_enabled,
    'footer_text', cfg.footer_text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kiosk_public_config(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_ticket_by_token(uuid, boolean, text) TO anon, authenticated;

-- Ensure default settings rows for all clinics.
INSERT INTO public.kiosk_settings (clinic_id)
SELECT c.id
FROM public.clinics c
WHERE NOT EXISTS (SELECT 1 FROM public.kiosk_settings ks WHERE ks.clinic_id = c.id);

INSERT INTO public.print_settings (clinic_id)
SELECT c.id
FROM public.clinics c
WHERE NOT EXISTS (SELECT 1 FROM public.print_settings ps WHERE ps.clinic_id = c.id);

INSERT INTO public.panel_settings (clinic_id)
SELECT c.id
FROM public.clinics c
WHERE NOT EXISTS (SELECT 1 FROM public.panel_settings ps WHERE ps.clinic_id = c.id);

-- Demo data (idempotent) for Club Medico
DO $$
DECLARE
  clinic_uuid uuid;
  reception_uuid uuid;
  room1 uuid;
  room2 uuid;
  room3 uuid;
  room4 uuid;
  room5 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;
  prof1 uuid; prof2 uuid; prof3 uuid; prof4 uuid; prof5 uuid;
  d date;
  i integer;
  qid uuid;
  tcode text;
BEGIN
  SELECT id INTO clinic_uuid FROM public.clinics WHERE lower(name) = lower('Club Medico') LIMIT 1;
  IF clinic_uuid IS NULL THEN
    INSERT INTO public.clinics (name, legal_name, document, phone, email, address, opening_hours)
    VALUES (
      'Club Medico',
      'Club Medico Clinica Integrada Ltda.',
      '12.345.678/0001-90',
      '(11) 4000-2026',
      'contato@clubmedico.teste',
      'Avenida Paulista, 1000, Sao Paulo - SP',
      'segunda a sexta, 08:00 as 18:00'
    )
    RETURNING id INTO clinic_uuid;
  ELSE
    UPDATE public.clinics
    SET legal_name = 'Club Medico Clinica Integrada Ltda.',
        document = '12.345.678/0001-90',
        phone = '(11) 4000-2026',
        email = 'contato@clubmedico.teste',
        address = 'Avenida Paulista, 1000, Sao Paulo - SP',
        opening_hours = 'segunda a sexta, 08:00 as 18:00'
    WHERE id = clinic_uuid;
  END IF;

  INSERT INTO public.receptions (clinic_id, name, location)
  VALUES (clinic_uuid, 'Recepcao principal', 'Terreo')
  ON CONFLICT (clinic_id, name) DO NOTHING;

  SELECT id INTO reception_uuid FROM public.receptions WHERE clinic_id = clinic_uuid AND name = 'Recepcao principal' LIMIT 1;

  INSERT INTO public.rooms (clinic_id, name, number, sector)
  VALUES
    (clinic_uuid, 'Sala 01', '01', 'Cardiologia'),
    (clinic_uuid, 'Sala 02', '02', 'Clinica Geral'),
    (clinic_uuid, 'Sala 03', '03', 'Pediatria'),
    (clinic_uuid, 'Sala 04', '04', 'Ortopedia'),
    (clinic_uuid, 'Sala 05', '05', 'Dermatologia')
  ON CONFLICT DO NOTHING;

  SELECT id INTO room1 FROM public.rooms WHERE clinic_id = clinic_uuid AND name = 'Sala 01' LIMIT 1;
  SELECT id INTO room2 FROM public.rooms WHERE clinic_id = clinic_uuid AND name = 'Sala 02' LIMIT 1;
  SELECT id INTO room3 FROM public.rooms WHERE clinic_id = clinic_uuid AND name = 'Sala 03' LIMIT 1;
  SELECT id INTO room4 FROM public.rooms WHERE clinic_id = clinic_uuid AND name = 'Sala 04' LIMIT 1;
  SELECT id INTO room5 FROM public.rooms WHERE clinic_id = clinic_uuid AND name = 'Sala 05' LIMIT 1;

  INSERT INTO public.specialties (clinic_id, name) VALUES
    (clinic_uuid, 'Cardiologia'),
    (clinic_uuid, 'Clinica Geral'),
    (clinic_uuid, 'Pediatria'),
    (clinic_uuid, 'Ortopedia'),
    (clinic_uuid, 'Dermatologia')
  ON CONFLICT (clinic_id, name) DO NOTHING;

  INSERT INTO public.professionals (clinic_id, full_name, specialty, professional_registration, room_id, status, active)
  VALUES
    (clinic_uuid, 'Dra. Ana Martins', 'Cardiologia', 'CRM/SP 123456', room1, 'available', true),
    (clinic_uuid, 'Dr. Bruno Lima', 'Clinica Geral', 'CRM/SP 234567', room2, 'available', true),
    (clinic_uuid, 'Dra. Carla Souza', 'Pediatria', 'CRM/SP 345678', room3, 'available', true),
    (clinic_uuid, 'Dr. Diego Alves', 'Ortopedia', 'CRM/SP 456789', room4, 'available', true),
    (clinic_uuid, 'Dra. Elisa Rocha', 'Dermatologia', 'CRM/SP 567890', room5, 'available', true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO prof1 FROM public.professionals WHERE clinic_id = clinic_uuid AND full_name = 'Dra. Ana Martins' LIMIT 1;
  SELECT id INTO prof2 FROM public.professionals WHERE clinic_id = clinic_uuid AND full_name = 'Dr. Bruno Lima' LIMIT 1;
  SELECT id INTO prof3 FROM public.professionals WHERE clinic_id = clinic_uuid AND full_name = 'Dra. Carla Souza' LIMIT 1;
  SELECT id INTO prof4 FROM public.professionals WHERE clinic_id = clinic_uuid AND full_name = 'Dr. Diego Alves' LIMIT 1;
  SELECT id INTO prof5 FROM public.professionals WHERE clinic_id = clinic_uuid AND full_name = 'Dra. Elisa Rocha' LIMIT 1;

  INSERT INTO public.patients (clinic_id, full_name, phone, cpf, birth_date, address, notes)
  VALUES
    (clinic_uuid, 'Alice Ferreira', '(11) 98888-0001', '11122233301', '1989-02-10', 'Rua A, 10', 'Paciente demo'),
    (clinic_uuid, 'Bruno Nunes', '(11) 98888-0002', '11122233302', '1978-04-12', 'Rua B, 20', 'Paciente demo'),
    (clinic_uuid, 'Carla Mendes', '(11) 98888-0003', '11122233303', '1992-06-18', 'Rua C, 30', 'Paciente demo'),
    (clinic_uuid, 'Daniel Costa', '(11) 98888-0004', '11122233304', '1985-03-09', 'Rua D, 40', 'Paciente demo'),
    (clinic_uuid, 'Elisa Prado', '(11) 98888-0005', '11122233305', '1990-09-01', 'Rua E, 50', 'Paciente demo'),
    (clinic_uuid, 'Fabio Dias', '(11) 98888-0006', '11122233306', '1987-11-11', 'Rua F, 60', 'Paciente demo'),
    (clinic_uuid, 'Gabi Rocha', '(11) 98888-0007', '11122233307', '1994-01-27', 'Rua G, 70', 'Paciente demo'),
    (clinic_uuid, 'Helio Castro', '(11) 98888-0008', '11122233308', '1970-08-17', 'Rua H, 80', 'Paciente demo'),
    (clinic_uuid, 'Iara Azevedo', '(11) 98888-0009', '11122233309', '1982-05-14', 'Rua I, 90', 'Paciente demo'),
    (clinic_uuid, 'Joao Viana', '(11) 98888-0010', '11122233310', '1991-12-03', 'Rua J, 100', 'Paciente demo'),
    (clinic_uuid, 'Kelly Ramos', '(11) 98888-0011', '11122233311', '1988-07-25', 'Rua K, 110', 'Paciente demo'),
    (clinic_uuid, 'Luis Barreto', '(11) 98888-0012', '11122233312', '1977-10-19', 'Rua L, 120', 'Paciente demo'),
    (clinic_uuid, 'Marina Toledo', '(11) 98888-0013', '11122233313', '1996-02-02', 'Rua M, 130', 'Paciente demo'),
    (clinic_uuid, 'Nicolas Tavares', '(11) 98888-0014', '11122233314', '1983-04-08', 'Rua N, 140', 'Paciente demo'),
    (clinic_uuid, 'Olivia Farias', '(11) 98888-0015', '11122233315', '1995-06-15', 'Rua O, 150', 'Paciente demo'),
    (clinic_uuid, 'Paulo Freitas', '(11) 98888-0016', '11122233316', '1979-09-13', 'Rua P, 160', 'Paciente demo'),
    (clinic_uuid, 'Quezia Lemos', '(11) 98888-0017', '11122233317', '1986-03-21', 'Rua Q, 170', 'Paciente demo'),
    (clinic_uuid, 'Rafael Pinto', '(11) 98888-0018', '11122233318', '1993-01-31', 'Rua R, 180', 'Paciente demo'),
    (clinic_uuid, 'Sonia Guedes', '(11) 98888-0019', '11122233319', '1975-12-22', 'Rua S, 190', 'Paciente demo'),
    (clinic_uuid, 'Tiago Barros', '(11) 98888-0020', '11122233320', '1990-10-30', 'Rua T, 200', 'Paciente demo')
  ON CONFLICT DO NOTHING;

  -- Seed appointments, queues, tickets and calls for last 30 days.
  FOR i IN 0..29 LOOP
    d := (now()::date - i);

    INSERT INTO public.appointments (clinic_id, patient_id, professional_id, room_id, scheduled_for, duration_minutes, status, notes)
    SELECT
      clinic_uuid,
      p.id,
      CASE (row_number() OVER ()) % 5
        WHEN 0 THEN prof1
        WHEN 1 THEN prof2
        WHEN 2 THEN prof3
        WHEN 3 THEN prof4
        ELSE prof5
      END,
      CASE (row_number() OVER ()) % 5
        WHEN 0 THEN room1
        WHEN 1 THEN room2
        WHEN 2 THEN room3
        WHEN 3 THEN room4
        ELSE room5
      END,
      (d + make_interval(hours => (8 + ((row_number() OVER ()) % 8))::int))::timestamptz,
      30,
      CASE (row_number() OVER ()) % 7
        WHEN 0 THEN 'scheduled'
        WHEN 1 THEN 'confirmed'
        WHEN 2 THEN 'checked_in'
        WHEN 3 THEN 'finished'
        WHEN 4 THEN 'cancelled'
        WHEN 5 THEN 'compromisso'
        ELSE 'scheduled'
      END,
      'Seed demo'
    FROM public.patients p
    WHERE p.clinic_id = clinic_uuid
    ORDER BY p.created_at
    LIMIT 4;

    INSERT INTO public.queues (clinic_id, patient_id, professional_id, room_id, service_type, priority, status, position, checkin_at, called_at, started_at, finished_at, notes)
    SELECT
      clinic_uuid,
      p.id,
      CASE (row_number() OVER ()) % 5
        WHEN 0 THEN prof1
        WHEN 1 THEN prof2
        WHEN 2 THEN prof3
        WHEN 3 THEN prof4
        ELSE prof5
      END,
      CASE (row_number() OVER ()) % 5
        WHEN 0 THEN room1
        WHEN 1 THEN room2
        WHEN 2 THEN room3
        WHEN 3 THEN room4
        ELSE room5
      END,
      'Consulta',
      CASE WHEN (row_number() OVER ()) % 4 = 0 THEN 'priority'::public.queue_priority ELSE 'normal'::public.queue_priority END,
      CASE (row_number() OVER ()) % 6
        WHEN 0 THEN 'waiting_reception'
        WHEN 1 THEN 'waiting_service'
        WHEN 2 THEN 'called_service'
        WHEN 3 THEN 'in_service'
        WHEN 4 THEN 'finished'
        ELSE 'cancelled'
      END::public.queue_status,
      extract(epoch from (d + make_interval(hours => (8 + ((row_number() OVER ()) % 8))::int))::timestamptz)::integer,
      (d + make_interval(hours => (8 + ((row_number() OVER ()) % 8))::int))::timestamptz,
      (d + make_interval(hours => (8 + ((row_number() OVER ()) % 8))::int, mins => 12))::timestamptz,
      (d + make_interval(hours => (8 + ((row_number() OVER ()) % 8))::int, mins => 18))::timestamptz,
      (d + make_interval(hours => (8 + ((row_number() OVER ()) % 8))::int, mins => 35))::timestamptz,
      'Seed demo'
    FROM public.patients p
    WHERE p.clinic_id = clinic_uuid
    ORDER BY p.created_at DESC
    LIMIT 3;

    FOR qid IN
      SELECT q.id
      FROM public.queues q
      WHERE q.clinic_id = clinic_uuid
        AND q.checkin_at::date = d
      ORDER BY q.checkin_at DESC
      LIMIT 3
    LOOP
      tcode := format('%s-%s', CASE WHEN random() > 0.3 THEN 'N' ELSE 'P' END, lpad((floor(random()*999)::int)::text, 3, '0'));

      INSERT INTO public.tickets (clinic_id, queue_id, patient_id, code, sequence, prefix, priority, status, issued_at, called_at)
      SELECT
        clinic_uuid,
        q.id,
        q.patient_id,
        tcode,
        floor(random() * 999)::int,
        split_part(tcode, '-', 1),
        split_part(tcode, '-', 1) = 'P',
        q.status::text,
        q.checkin_at,
        q.called_at
      FROM public.queues q
      WHERE q.id = qid
      ON CONFLICT (clinic_id, code) DO NOTHING;

      INSERT INTO public.calls (clinic_id, queue_id, patient_id, professional_id, room_id, display_name, professional_name, room_name, called_at)
      SELECT
        clinic_uuid,
        q.id,
        q.patient_id,
        q.professional_id,
        q.room_id,
        CASE
          WHEN p.full_name IS NULL THEN 'Paciente'
          ELSE split_part(p.full_name, ' ', 1) || ' ' || left(split_part(p.full_name, ' ', array_length(string_to_array(p.full_name, ' '), 1)), 1) || '.'
        END,
        pr.full_name,
        r.name,
        COALESCE(q.called_at, q.checkin_at + interval '10 min')
      FROM public.queues q
      JOIN public.patients p ON p.id = q.patient_id
      LEFT JOIN public.professionals pr ON pr.id = q.professional_id
      LEFT JOIN public.rooms r ON r.id = q.room_id
      WHERE q.id = qid
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Ensure base settings rows for the demo clinic.
  INSERT INTO public.kiosk_settings (clinic_id, custom_text, footer_text)
  VALUES (clinic_uuid, 'Bem-vindo ao Club Medico', 'Guarde sua senha para ser atendido')
  ON CONFLICT (clinic_id) DO UPDATE
  SET custom_text = excluded.custom_text,
      footer_text = excluded.footer_text;

  INSERT INTO public.print_settings (clinic_id, paper_size, welcome_message, footer_message)
  VALUES (clinic_uuid, '58mm', 'Bem-vindo ao Club Medico', 'Aguarde ser chamado')
  ON CONFLICT (clinic_id) DO UPDATE
  SET welcome_message = excluded.welcome_message,
      footer_message = excluded.footer_message;

  INSERT INTO public.panel_settings (clinic_id, show_mode, voice_enabled)
  VALUES (clinic_uuid, 'name_abbreviated', true)
  ON CONFLICT (clinic_id) DO UPDATE
  SET show_mode = excluded.show_mode,
      voice_enabled = excluded.voice_enabled;
END $$;

-- Club Medico demonstration foundation
-- Non-destructive and idempotent.

-- Optional role label compatibility for panel operator naming.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'public_panel'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'public_panel';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS zip_code text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'demo';

ALTER TABLE public.kiosk_settings ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Totem principal';
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Painel principal';
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS full_screen boolean NOT NULL DEFAULT true;
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS show_clock boolean NOT NULL DEFAULT true;
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS show_latest_calls boolean NOT NULL DEFAULT true;
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS latest_calls_limit integer NOT NULL DEFAULT 5;
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS voice_pitch numeric(3,2) NOT NULL DEFAULT 1.0;
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS voice_repeat_count integer NOT NULL DEFAULT 2;
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS voice_repeat_interval_seconds integer NOT NULL DEFAULT 2;
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (
    status IN (
      'scheduled','confirmed','checked_in','in_service','finished','cancelled','no_show',
      'compromisso','bloqueado','aniversario','feriado',
      'commitment','blocked','birthday','holiday'
    )
  );

CREATE OR REPLACE FUNCTION public.seed_demo_clinic(_clinic_name text DEFAULT 'Club Medico')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_day date;
  v_i integer;
  v_queue_id uuid;
  v_ticket_status text;
  v_prof_id uuid;
  v_room_id uuid;
  v_patient_id uuid;
  v_prefix text;
  v_seq integer;
  v_patient_count integer := 0;
  v_queue_count integer := 0;
  v_ticket_count integer := 0;
  v_appointment_count integer := 0;
  v_call_count integer := 0;
BEGIN
  SELECT id INTO v_clinic_id
  FROM public.clinics
  WHERE lower(name) IN (lower(_clinic_name), lower('Club Medico'), lower('Club Médico'))
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    INSERT INTO public.clinics (
      name, legal_name, document, phone, whatsapp, email, address, district, city, state, zip_code,
      opening_hours, timezone, status, plan, voice_enabled
    )
    VALUES (
      'Club Médico',
      'Club Médico Unidade Sacramento Ltda.',
      '12.345.678/0001-90',
      '(34) 3333-2026',
      '(34) 99999-2026',
      'contato@clubmedico.teste',
      'Avenida Sacramento, 1000',
      'Centro',
      'Sacramento',
      'Minas Gerais',
      '38190-000',
      'segunda a sexta, das 08:00 às 18:00',
      'America/Sao_Paulo',
      'active',
      'demo',
      true
    )
    RETURNING id INTO v_clinic_id;
  ELSE
    UPDATE public.clinics
    SET
      name = 'Club Médico',
      legal_name = 'Club Médico Unidade Sacramento Ltda.',
      document = '12.345.678/0001-90',
      phone = '(34) 3333-2026',
      whatsapp = '(34) 99999-2026',
      email = 'contato@clubmedico.teste',
      address = 'Avenida Sacramento, 1000',
      district = 'Centro',
      city = 'Sacramento',
      state = 'Minas Gerais',
      zip_code = '38190-000',
      opening_hours = 'segunda a sexta, das 08:00 às 18:00',
      timezone = 'America/Sao_Paulo',
      status = 'active',
      plan = 'demo'
    WHERE id = v_clinic_id;
  END IF;

  -- Rooms
  INSERT INTO public.rooms (clinic_id, name, number, sector, active)
  SELECT v_clinic_id, x.name, x.number, x.sector, true
  FROM (
    VALUES
      ('Recepção Principal', 'RCP', 'Recepção'),
      ('Consultório 01', '01', 'Cardiologia'),
      ('Consultório 02', '02', 'Clínica Geral'),
      ('Consultório 03', '03', 'Pediatria'),
      ('Consultório 04', '04', 'Ortopedia'),
      ('Consultório 05', '05', 'Dermatologia'),
      ('Sala de Procedimentos', 'PROC', 'Procedimentos'),
      ('Sala de Espera', 'ESP', 'Espera')
  ) AS x(name, number, sector)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rooms r WHERE r.clinic_id = v_clinic_id AND r.name = x.name
  );

  -- Specialties
  INSERT INTO public.specialties (clinic_id, name, active)
  SELECT v_clinic_id, x.name, true
  FROM (
    VALUES ('Cardiologia'), ('Clinica Geral'), ('Pediatria'), ('Ortopedia'), ('Dermatologia')
  ) AS x(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.specialties s WHERE s.clinic_id = v_clinic_id AND s.name = x.name
  );

  -- Professionals (profile_id is linked by seed script)
  INSERT INTO public.professionals (clinic_id, full_name, specialty, professional_registration, room_id, status, active, email)
  SELECT
    v_clinic_id,
    p.full_name,
    p.specialty,
    p.crm,
    (SELECT id FROM public.rooms r WHERE r.clinic_id = v_clinic_id AND r.name = p.room_name LIMIT 1),
    p.status,
    true,
    p.email
  FROM (
    VALUES
      ('Dra. Ana Martins', 'Cardiologia', 'CRM/MG 123456', 'Consultório 01', 'available', 'ana.martins@clubmedico.teste'),
      ('Dr. Bruno Lima', 'Clinica Geral', 'CRM/MG 234567', 'Consultório 02', 'available', 'bruno.lima@clubmedico.teste'),
      ('Dra. Carla Souza', 'Pediatria', 'CRM/MG 345678', 'Consultório 03', 'busy', 'carla.souza@clubmedico.teste'),
      ('Dr. Diego Alves', 'Ortopedia', 'CRM/MG 456789', 'Consultório 04', 'available', 'diego.alves@clubmedico.teste'),
      ('Dra. Elisa Rocha', 'Dermatologia', 'CRM/MG 567890', 'Consultório 05', 'away', 'elisa.rocha@clubmedico.teste')
  ) AS p(full_name, specialty, crm, room_name, status, email)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.professionals pr WHERE pr.clinic_id = v_clinic_id AND lower(pr.email) = lower(p.email)
  );

  -- Patients (20 demo profiles, fake identifiers)
  INSERT INTO public.patients (clinic_id, full_name, cpf, birth_date, phone, email, address, notes, active)
  SELECT
    v_clinic_id,
    d.full_name,
    d.cpf,
    d.birth_date,
    d.phone,
    d.email,
    d.address,
    d.notes,
    true
  FROM (
    VALUES
      ('Lia Souza', '90000000001', '2017-04-11', '(34) 99100-0001', 'lia.souza@demo.teste', 'Rua A, 10 - Sacramento/MG', 'Crianca. Historico pediatrico demo.'),
      ('Caio Mendes', '90000000002', '2015-08-22', '(34) 99100-0002', 'caio.mendes@demo.teste', 'Rua B, 22 - Sacramento/MG', 'Crianca com alergia leve (ficticia).'),
      ('Rafaela Lima', '90000000003', '1998-01-05', '(34) 99100-0003', 'rafaela.lima@demo.teste', 'Rua C, 35 - Sacramento/MG', 'Gestante ficticia, prioridade legal.'),
      ('Aline Faria', '90000000004', '1987-09-30', '(34) 99100-0004', 'aline.faria@demo.teste', 'Rua D, 48 - Sacramento/MG', 'Adulto geral.'),
      ('Bruno Prado', '90000000005', '1990-03-14', '(34) 99100-0005', 'bruno.prado@demo.teste', 'Rua E, 59 - Sacramento/MG', 'Adulto geral, retorno.'),
      ('Celia Duarte', '90000000006', '1958-12-10', '(34) 99100-0006', 'celia.duarte@demo.teste', 'Rua F, 63 - Sacramento/MG', 'Idosa, preferencial.'),
      ('Davi Nogueira', '90000000007', '1976-02-12', '(34) 99100-0007', 'davi.nogueira@demo.teste', 'Rua G, 70 - Sacramento/MG', 'Ortopedia, dor cronica ficticia.'),
      ('Ester Campos', '90000000008', '2001-07-19', '(34) 99100-0008', 'ester.campos@demo.teste', 'Rua H, 83 - Sacramento/MG', 'Dermato, revisao.'),
      ('Felipe Ramos', '90000000009', '1982-11-03', '(34) 99100-0009', 'felipe.ramos@demo.teste', 'Rua I, 91 - Sacramento/MG', 'PCD ficticio, prioridade.'),
      ('Giovana Teixeira', '90000000010', '1995-06-27', '(34) 99100-0010', 'giovana.teixeira@demo.teste', 'Rua J, 102 - Sacramento/MG', 'Adulto geral.'),
      ('Heitor Lopes', '90000000011', '1961-10-01', '(34) 99100-0011', 'heitor.lopes@demo.teste', 'Rua K, 111 - Sacramento/MG', 'Idoso, acompanhamento cardio.'),
      ('Isabela Rocha', '90000000012', '1993-05-13', '(34) 99100-0012', 'isabela.rocha@demo.teste', 'Rua L, 120 - Sacramento/MG', 'Retorno em 15 dias.'),
      ('Joao Pedro Silva', '90000000013', '1988-04-04', '(34) 99100-0013', 'joao.silva@demo.teste', 'Rua M, 132 - Sacramento/MG', 'Consulta de rotina.'),
      ('Karen Moreira', '90000000014', '1970-09-09', '(34) 99100-0014', 'karen.moreira@demo.teste', 'Rua N, 146 - Sacramento/MG', 'No-show anterior para teste.'),
      ('Leandro Costa', '90000000015', '2004-02-18', '(34) 99100-0015', 'leandro.costa@demo.teste', 'Rua O, 150 - Sacramento/MG', 'Primeira consulta.'),
      ('Marina Valente', '90000000016', '1981-08-08', '(34) 99100-0016', 'marina.valente@demo.teste', 'Rua P, 165 - Sacramento/MG', 'Bloqueio de agenda vinculado.'),
      ('Nicolas Araujo', '90000000017', '2010-01-21', '(34) 99100-0017', 'nicolas.araujo@demo.teste', 'Rua Q, 177 - Sacramento/MG', 'Crianca, retorno pediatria.'),
      ('Olivia Freitas', '90000000018', '1999-12-02', '(34) 99100-0018', 'olivia.freitas@demo.teste', 'Rua R, 188 - Sacramento/MG', 'Consulta encaixe.'),
      ('Paula Rezende', '90000000019', '1966-03-16', '(34) 99100-0019', 'paula.rezende@demo.teste', 'Rua S, 199 - Sacramento/MG', 'Idosa, mobilidade reduzida ficticia.'),
      ('Ruan Vieira', '90000000020', '1984-07-24', '(34) 99100-0020', 'ruan.vieira@demo.teste', 'Rua T, 210 - Sacramento/MG', 'Controle de exames.')
  ) AS d(full_name, cpf, birth_date, phone, email, address, notes)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.patients p WHERE p.clinic_id = v_clinic_id AND p.cpf = d.cpf
  );

  SELECT count(*) INTO v_patient_count FROM public.patients WHERE clinic_id = v_clinic_id;

  -- Settings for totem, panel and print.
  INSERT INTO public.kiosk_settings (
    clinic_id, name, enabled, allow_normal, allow_priority, normal_prefix, priority_prefix,
    custom_text, footer_text, logo_url, paper_size, print_auto, qr_enabled, priority_help_text, kiosk_mode
  )
  VALUES (
    v_clinic_id, 'Totem Principal Club Médico', true, true, true, 'N', 'P',
    'Bem-vindo ao Club Médico', 'Aguarde ser chamado no painel', '/brands/club-medico/logo.png',
    '80mm', true, true,
    'Idoso, gestante, pessoa com deficiência ou mobilidade reduzida', true
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    name = excluded.name,
    enabled = excluded.enabled,
    allow_normal = excluded.allow_normal,
    allow_priority = excluded.allow_priority,
    normal_prefix = excluded.normal_prefix,
    priority_prefix = excluded.priority_prefix,
    custom_text = excluded.custom_text,
    footer_text = excluded.footer_text,
    logo_url = excluded.logo_url,
    paper_size = excluded.paper_size,
    print_auto = excluded.print_auto,
    qr_enabled = excluded.qr_enabled,
    priority_help_text = excluded.priority_help_text,
    kiosk_mode = excluded.kiosk_mode;

  INSERT INTO public.print_settings (
    clinic_id, paper_size, welcome_message, footer_message, qr_enabled,
    browser_fallback_enabled, webusb_enabled, webserial_enabled, local_agent_endpoint
  )
  VALUES (
    v_clinic_id, '80mm', 'Seja bem-vindo(a)', 'Aguarde ser chamado', true,
    true, true, true, 'http://127.0.0.1:3311/print'
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    paper_size = excluded.paper_size,
    welcome_message = excluded.welcome_message,
    footer_message = excluded.footer_message,
    qr_enabled = excluded.qr_enabled,
    browser_fallback_enabled = excluded.browser_fallback_enabled,
    webusb_enabled = excluded.webusb_enabled,
    webserial_enabled = excluded.webserial_enabled,
    local_agent_endpoint = excluded.local_agent_endpoint;

  INSERT INTO public.panel_settings (
    clinic_id, name, enabled, show_mode, show_destination, voice_enabled, voice_name, voice_volume,
    voice_rate, voice_pitch, voice_repeat_count, voice_repeat_interval_seconds, sound_enabled,
    phrase_template, full_screen, show_clock, show_latest_calls, latest_calls_limit
  )
  VALUES (
    v_clinic_id,
    'Painel Principal Club Médico',
    true,
    'ticket_only',
    true,
    true,
    null,
    0.80,
    1.0,
    1.0,
    2,
    2,
    true,
    'Senha {{ticket}}, dirigir-se a {{destination}}.',
    true,
    true,
    true,
    5
  )
  ON CONFLICT (clinic_id) DO UPDATE
  SET
    name = excluded.name,
    enabled = excluded.enabled,
    show_mode = excluded.show_mode,
    show_destination = excluded.show_destination,
    voice_enabled = excluded.voice_enabled,
    voice_name = excluded.voice_name,
    voice_volume = excluded.voice_volume,
    voice_rate = excluded.voice_rate,
    voice_pitch = excluded.voice_pitch,
    voice_repeat_count = excluded.voice_repeat_count,
    voice_repeat_interval_seconds = excluded.voice_repeat_interval_seconds,
    sound_enabled = excluded.sound_enabled,
    phrase_template = excluded.phrase_template,
    full_screen = excluded.full_screen,
    show_clock = excluded.show_clock,
    show_latest_calls = excluded.show_latest_calls,
    latest_calls_limit = excluded.latest_calls_limit;

  -- Historical appointments: last 30 days, today and next 15 days.
  FOR v_i IN -30..15 LOOP
    v_day := (now() at time zone 'America/Sao_Paulo')::date + v_i;

    FOR v_prof_id, v_room_id, v_patient_id IN
      SELECT
        pr.id,
        pr.room_id,
        p.id
      FROM public.professionals pr
      JOIN public.patients p ON p.clinic_id = v_clinic_id
      WHERE pr.clinic_id = v_clinic_id
      ORDER BY pr.full_name, p.created_at
      LIMIT 5
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.clinic_id = v_clinic_id
          AND a.professional_id = v_prof_id
          AND a.patient_id = v_patient_id
          AND a.scheduled_for = (v_day + interval '09:00')
          AND a.notes = format('DEMO-CM-APT-%s', v_day)
      ) THEN
        INSERT INTO public.appointments (
          clinic_id, patient_id, professional_id, room_id, scheduled_for, duration_minutes, status, notes, internal_notes
        )
        VALUES (
          v_clinic_id,
          v_patient_id,
          v_prof_id,
          v_room_id,
          v_day + interval '09:00',
          30,
          CASE (abs(v_i) + extract(day from v_day)::int) % 7
            WHEN 0 THEN 'scheduled'
            WHEN 1 THEN 'confirmed'
            WHEN 2 THEN 'commitment'
            WHEN 3 THEN 'blocked'
            WHEN 4 THEN 'birthday'
            WHEN 5 THEN 'holiday'
            ELSE 'cancelled'
          END,
          format('DEMO-CM-APT-%s', v_day),
          'Seed demo Club Medico'
        );
        v_appointment_count := v_appointment_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Current day queue/ticket matrix requested.
  FOR v_prefix, v_seq, v_ticket_status IN
    SELECT * FROM (VALUES
      ('N', 1, 'waiting_reception'),
      ('N', 2, 'waiting_reception'),
      ('P', 1, 'waiting_reception'),
      ('N', 3, 'called_reception'),
      ('P', 2, 'waiting_service'),
      ('N', 4, 'called_service'),
      ('P', 3, 'in_service'),
      ('N', 5, 'finished'),
      ('N', 6, 'cancelled'),
      ('P', 4, 'no_show')
    ) AS t(prefix, seq, status)
  LOOP
    SELECT p.id INTO v_patient_id
    FROM public.patients p
    WHERE p.clinic_id = v_clinic_id
    ORDER BY p.created_at
    OFFSET ((v_seq - 1) % 20)
    LIMIT 1;

    SELECT pr.id, pr.room_id INTO v_prof_id, v_room_id
    FROM public.professionals pr
    WHERE pr.clinic_id = v_clinic_id
    ORDER BY pr.full_name
    OFFSET ((v_seq - 1) % 5)
    LIMIT 1;

    SELECT q.id INTO v_queue_id
    FROM public.queues q
    WHERE q.clinic_id = v_clinic_id
      AND q.notes = format('DEMO-CM-QUEUE-%s-%s', v_prefix, lpad(v_seq::text, 3, '0'))
    LIMIT 1;

    IF v_queue_id IS NULL THEN
      INSERT INTO public.queues (
        clinic_id, patient_id, professional_id, room_id, service_type, priority, status,
        position, checkin_at, called_at, started_at, finished_at, cancelled_at, notes, internal_notes
      )
      VALUES (
        v_clinic_id,
        v_patient_id,
        v_prof_id,
        v_room_id,
        'Consulta',
        CASE WHEN v_prefix = 'P' THEN 'priority' ELSE 'normal' END,
        CASE v_ticket_status
          WHEN 'waiting_reception' THEN 'waiting_reception'::public.queue_status
          WHEN 'called_reception' THEN 'called_reception'::public.queue_status
          WHEN 'waiting_service' THEN 'waiting_service'::public.queue_status
          WHEN 'called_service' THEN 'called_service'::public.queue_status
          WHEN 'in_service' THEN 'in_service'::public.queue_status
          WHEN 'finished' THEN 'finished'::public.queue_status
          WHEN 'cancelled' THEN 'cancelled'::public.queue_status
          ELSE 'no_show'::public.queue_status
        END,
        extract(epoch from (now() - make_interval(mins => v_seq * 7))),
        now() - make_interval(mins => 90 - (v_seq * 5)),
        CASE WHEN v_ticket_status IN ('called_reception', 'called_service', 'in_service', 'finished') THEN now() - make_interval(mins => 60 - (v_seq * 3)) ELSE null END,
        CASE WHEN v_ticket_status IN ('in_service', 'finished') THEN now() - make_interval(mins => 40 - (v_seq * 2)) ELSE null END,
        CASE WHEN v_ticket_status = 'finished' THEN now() - make_interval(mins => 10) ELSE null END,
        CASE WHEN v_ticket_status = 'cancelled' THEN now() - make_interval(mins => 12) ELSE null END,
        format('DEMO-CM-QUEUE-%s-%s', v_prefix, lpad(v_seq::text, 3, '0')),
        'Seed demo Club Medico'
      )
      RETURNING id INTO v_queue_id;

      v_queue_count := v_queue_count + 1;
    END IF;

    INSERT INTO public.tickets (
      clinic_id, queue_id, patient_id, code, sequence, prefix, priority, status,
      issued_at, called_at, finished_at, cancelled_at
    )
    VALUES (
      v_clinic_id,
      v_queue_id,
      CASE WHEN v_seq = 2 THEN null ELSE v_patient_id END,
      format('%s-%s', v_prefix, lpad(v_seq::text, 3, '0')),
      v_seq,
      v_prefix,
      v_prefix = 'P',
      v_ticket_status,
      now() - make_interval(mins => 95 - (v_seq * 6)),
      CASE WHEN v_ticket_status IN ('called_reception', 'called_service', 'in_service', 'finished') THEN now() - make_interval(mins => 70 - (v_seq * 4)) ELSE null END,
      CASE WHEN v_ticket_status = 'finished' THEN now() - make_interval(mins => 15) ELSE null END,
      CASE WHEN v_ticket_status = 'cancelled' THEN now() - make_interval(mins => 16) ELSE null END
    )
    ON CONFLICT (clinic_id, code) DO UPDATE
    SET
      queue_id = excluded.queue_id,
      patient_id = excluded.patient_id,
      priority = excluded.priority,
      status = excluded.status,
      called_at = excluded.called_at,
      finished_at = excluded.finished_at,
      cancelled_at = excluded.cancelled_at,
      updated_at = now();

    v_ticket_count := v_ticket_count + 1;
  END LOOP;

  -- Call history for panel.
  FOR v_prefix, v_seq, v_ticket_status IN
    SELECT * FROM (VALUES
      ('P', 1, 'Recepção'),
      ('N', 3, 'Recepção'),
      ('N', 4, 'Consultório 01'),
      ('P', 2, 'Consultório 03'),
      ('N', 2, 'Consultório 02')
    ) AS h(prefix, seq, destination)
  LOOP
    SELECT t.queue_id, q.patient_id, q.professional_id, q.room_id
    INTO v_queue_id, v_patient_id, v_prof_id, v_room_id
    FROM public.tickets t
    JOIN public.queues q ON q.id = t.queue_id
    WHERE t.clinic_id = v_clinic_id
      AND t.code = format('%s-%s', v_prefix, lpad(v_seq::text, 3, '0'))
    LIMIT 1;

    IF v_queue_id IS NOT NULL THEN
      INSERT INTO public.calls (
        clinic_id, queue_id, patient_id, professional_id, room_id,
        display_name, professional_name, room_name, called_at
      )
      SELECT
        v_clinic_id,
        v_queue_id,
        q.patient_id,
        q.professional_id,
        q.room_id,
        format('%s %s.', split_part(p.full_name, ' ', 1), left(split_part(p.full_name, ' ', array_length(string_to_array(p.full_name, ' '), 1)), 1)),
        pr.full_name,
        r.name,
        now() - make_interval(mins => v_seq * 3)
      FROM public.queues q
      JOIN public.patients p ON p.id = q.patient_id
      LEFT JOIN public.professionals pr ON pr.id = q.professional_id
      LEFT JOIN public.rooms r ON r.id = q.room_id
      WHERE q.id = v_queue_id
        AND NOT EXISTS (
          SELECT 1 FROM public.calls c
          WHERE c.clinic_id = v_clinic_id
            AND c.queue_id = v_queue_id
            AND c.called_at::date = now()::date
        );

      IF FOUND THEN
        v_call_count := v_call_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- Audit trail samples.
  INSERT INTO public.audit_logs (clinic_id, user_id, action, entity, entity_id, details)
  SELECT
    v_clinic_id,
    null,
    a.action,
    a.entity,
    null,
    jsonb_build_object('source', 'seed_demo_club_medico', 'seed_key', a.seed_key)
  FROM (
    VALUES
      ('login', 'auth', 'log-01'),
      ('create_patient', 'patients', 'log-02'),
      ('update_patient', 'patients', 'log-03'),
      ('issue_ticket', 'tickets', 'log-04'),
      ('call', 'calls', 'log-05'),
      ('repeat_call', 'calls', 'log-06'),
      ('start_service', 'queues', 'log-07'),
      ('finish_service', 'queues', 'log-08'),
      ('cancel', 'queues', 'log-09'),
      ('transfer', 'queues', 'log-10'),
      ('change_priority', 'tickets', 'log-11'),
      ('update_settings', 'panel_settings', 'log-12')
  ) AS a(action, entity, seed_key)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.audit_logs l
    WHERE l.clinic_id = v_clinic_id
      AND l.details->>'seed_key' = a.seed_key
  );

  RETURN jsonb_build_object(
    'ok', true,
    'clinic_id', v_clinic_id,
    'patients_total', v_patient_count,
    'appointments_inserted', v_appointment_count,
    'queues_inserted', v_queue_count,
    'tickets_processed', v_ticket_count,
    'calls_inserted', v_call_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_clinic(text) TO authenticated, service_role;

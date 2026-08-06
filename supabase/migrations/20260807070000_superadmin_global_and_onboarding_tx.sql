-- Superadmin global model + transactional onboarding backend.

-- 1) Allow clinic_id NULL only for superadmin profiles.
ALTER TABLE public.profiles
  ALTER COLUMN clinic_id DROP NOT NULL;

UPDATE public.profiles
SET clinic_id = NULL
WHERE role = 'superadmin';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_clinic_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_clinic_role_check
  CHECK (
    (role = 'superadmin' AND clinic_id IS NULL)
    OR (role <> 'superadmin' AND clinic_id IS NOT NULL)
  );

-- 2) Superadmin support context table.
CREATE TABLE IF NOT EXISTS public.superadmin_support_context (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_support_context_clinic
  ON public.superadmin_support_context(clinic_id);

ALTER TABLE public.superadmin_support_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superadmin_support_context_self_select ON public.superadmin_support_context;
CREATE POLICY superadmin_support_context_self_select ON public.superadmin_support_context
FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.is_superadmin());

DROP POLICY IF EXISTS superadmin_support_context_self_upsert ON public.superadmin_support_context;
CREATE POLICY superadmin_support_context_self_upsert ON public.superadmin_support_context
FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.is_superadmin())
WITH CHECK (user_id = auth.uid() AND public.is_superadmin());

-- 3) Resolve clinic context from explicit support-context when user is superadmin.
CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.role = 'superadmin' THEN (
      SELECT ssc.clinic_id
      FROM public.superadmin_support_context ssc
      WHERE ssc.user_id = p.id
      LIMIT 1
    )
    ELSE p.clinic_id
  END
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.active
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.set_superadmin_support_context(_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: superadmin required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = _clinic_id) THEN
    RAISE EXCEPTION 'Target clinic not found';
  END IF;

  INSERT INTO public.superadmin_support_context (user_id, clinic_id)
  VALUES (auth.uid(), _clinic_id)
  ON CONFLICT (user_id)
  DO UPDATE SET clinic_id = excluded.clinic_id, updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_superadmin_support_context(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_superadmin_support_context(uuid) TO authenticated, service_role;

-- 4) Superadmin global read visibility on sensitive tables.
DROP POLICY IF EXISTS superadmin_select_all_profiles ON public.profiles;
CREATE POLICY superadmin_select_all_profiles ON public.profiles
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_patients ON public.patients;
CREATE POLICY superadmin_select_all_patients ON public.patients
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_professionals ON public.professionals;
CREATE POLICY superadmin_select_all_professionals ON public.professionals
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_rooms ON public.rooms;
CREATE POLICY superadmin_select_all_rooms ON public.rooms
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_receptions ON public.receptions;
CREATE POLICY superadmin_select_all_receptions ON public.receptions
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_appointments ON public.appointments;
CREATE POLICY superadmin_select_all_appointments ON public.appointments
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_tickets ON public.tickets;
CREATE POLICY superadmin_select_all_tickets ON public.tickets
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_queues ON public.queues;
CREATE POLICY superadmin_select_all_queues ON public.queues
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_calls ON public.calls;
CREATE POLICY superadmin_select_all_calls ON public.calls
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_audit_logs ON public.audit_logs;
CREATE POLICY superadmin_select_all_audit_logs ON public.audit_logs
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_panel_settings ON public.panel_settings;
CREATE POLICY superadmin_select_all_panel_settings ON public.panel_settings
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_kiosk_settings ON public.kiosk_settings;
CREATE POLICY superadmin_select_all_kiosk_settings ON public.kiosk_settings
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_print_settings ON public.print_settings;
CREATE POLICY superadmin_select_all_print_settings ON public.print_settings
FOR SELECT TO authenticated
USING (public.is_superadmin());

DROP POLICY IF EXISTS superadmin_select_all_doctor_room_shifts ON public.doctor_room_shifts;
CREATE POLICY superadmin_select_all_doctor_room_shifts ON public.doctor_room_shifts
FOR SELECT TO authenticated
USING (public.is_superadmin());

-- 5) Transactional clinic onboarding finalizer.
CREATE OR REPLACE FUNCTION public.superadmin_finalize_clinic_onboarding(
  _actor_user_id uuid,
  _admin_user_id uuid,
  _admin_name text,
  _admin_email text,
  _admin_phone text,
  _clinic jsonb,
  _rooms_count integer,
  _receptions_count integer,
  _ticket_prefix text,
  _force_password_change boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role public.app_role;
  v_clinic_id uuid;
  v_timezone text;
  v_existing_id uuid;
  v_ticket_prefix text;
  i integer;
BEGIN
  SELECT role
  INTO v_actor_role
  FROM public.profiles
  WHERE id = _actor_user_id
    AND active
  LIMIT 1;

  IF v_actor_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: superadmin required';
  END IF;

  IF _clinic IS NULL THEN
    RAISE EXCEPTION 'Clinic payload required';
  END IF;

  IF coalesce(trim(_clinic->>'tenant_slug'), '') = '' THEN
    RAISE EXCEPTION 'tenant_slug required';
  END IF;

  SELECT id
  INTO v_existing_id
  FROM public.clinics
  WHERE tenant_slug = (_clinic->>'tenant_slug')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Clinic slug already exists';
  END IF;

  v_timezone := COALESCE(NULLIF(_clinic->>'timezone',''), 'America/Sao_Paulo');
  v_ticket_prefix := COALESCE(NULLIF(_ticket_prefix, ''), 'N');

  INSERT INTO public.clinics (
    name,
    legal_name,
    document,
    address,
    city,
    state,
    zip_code,
    phone,
    email,
    logo_url,
    tenant_slug,
    plan,
    status,
    timezone,
    branding
  )
  VALUES (
    COALESCE(NULLIF(_clinic->>'name',''), 'Nova Clínica'),
    NULLIF(_clinic->>'legal_name',''),
    NULLIF(_clinic->>'document',''),
    NULLIF(_clinic->>'address',''),
    NULLIF(_clinic->>'city',''),
    NULLIF(_clinic->>'state',''),
    NULLIF(_clinic->>'zip_code',''),
    NULLIF(_clinic->>'phone',''),
    NULLIF(_clinic->>'email',''),
    NULLIF(_clinic->>'logo_url',''),
    NULLIF(_clinic->>'tenant_slug',''),
    COALESCE(NULLIF(_clinic->>'plan',''), 'standard'),
    COALESCE(NULLIF(_clinic->>'status',''), 'active'),
    v_timezone,
    COALESCE(_clinic->'branding', '{}'::jsonb)
  )
  RETURNING id INTO v_clinic_id;

  INSERT INTO public.profiles (
    id,
    clinic_id,
    full_name,
    email,
    role,
    active,
    force_password_change,
    temp_password_issued_at
  )
  VALUES (
    _admin_user_id,
    v_clinic_id,
    COALESCE(NULLIF(trim(_admin_name),''), NULLIF(_admin_email,''), 'Administrador'),
    NULLIF(_admin_email,''),
    'admin',
    true,
    _force_password_change,
    CASE WHEN _force_password_change THEN now() ELSE NULL END
  );

  INSERT INTO public.kiosk_settings (clinic_id, normal_prefix, priority_prefix)
  VALUES (v_clinic_id, v_ticket_prefix, 'P')
  ON CONFLICT (clinic_id) DO NOTHING;

  INSERT INTO public.panel_settings (clinic_id)
  VALUES (v_clinic_id)
  ON CONFLICT (clinic_id) DO NOTHING;

  INSERT INTO public.print_settings (clinic_id)
  VALUES (v_clinic_id)
  ON CONFLICT (clinic_id) DO NOTHING;

  FOR i IN 1..GREATEST(COALESCE(_rooms_count, 0), 0) LOOP
    INSERT INTO public.rooms (clinic_id, name, number, active)
    VALUES (v_clinic_id, format('Sala %s', i), i::text, true)
    ON CONFLICT (clinic_id, name) DO NOTHING;
  END LOOP;

  FOR i IN 1..GREATEST(COALESCE(_receptions_count, 0), 0) LOOP
    INSERT INTO public.receptions (clinic_id, name, location, active)
    VALUES (v_clinic_id, format('Guichê %s', i), 'Recepção', true)
    ON CONFLICT (clinic_id, name) DO NOTHING;
  END LOOP;

  INSERT INTO public.audit_logs (clinic_id, user_id, action, entity, entity_id, details)
  VALUES (
    v_clinic_id,
    _actor_user_id,
    'superadmin_onboarding_complete',
    'clinics',
    v_clinic_id,
    jsonb_build_object(
      'admin_user_id', _admin_user_id,
      'admin_email', _admin_email,
      'admin_phone', _admin_phone,
      'rooms_count', GREATEST(COALESCE(_rooms_count, 0), 0),
      'receptions_count', GREATEST(COALESCE(_receptions_count, 0), 0),
      'ticket_prefix', v_ticket_prefix
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'clinicId', v_clinic_id,
    'adminUserId', _admin_user_id,
    'roomsCount', GREATEST(COALESCE(_rooms_count, 0), 0),
    'receptionsCount', GREATEST(COALESCE(_receptions_count, 0), 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.superadmin_finalize_clinic_onboarding(
  uuid, uuid, text, text, text, jsonb, integer, integer, text, boolean
) FROM anon;

GRANT EXECUTE ON FUNCTION public.superadmin_finalize_clinic_onboarding(
  uuid, uuid, text, text, text, jsonb, integer, integer, text, boolean
) TO authenticated, service_role;

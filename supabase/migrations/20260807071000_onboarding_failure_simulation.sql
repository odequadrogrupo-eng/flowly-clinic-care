-- Allow controlled failure simulation in onboarding SQL transaction for rollback tests.

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
  v_simulate_failure_at text;
  i integer;
BEGIN
  v_simulate_failure_at := NULLIF(_clinic->>'simulate_failure_at','');

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

  SELECT id INTO v_existing_id
  FROM public.clinics
  WHERE tenant_slug = (_clinic->>'tenant_slug')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Clinic slug already exists';
  END IF;

  v_timezone := COALESCE(NULLIF(_clinic->>'timezone',''), 'America/Sao_Paulo');
  v_ticket_prefix := COALESCE(NULLIF(_ticket_prefix, ''), 'N');

  INSERT INTO public.clinics (
    name, legal_name, document, address, city, state, zip_code,
    phone, email, logo_url, tenant_slug, plan, status, timezone, branding
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

  IF v_simulate_failure_at = 'before_profile' THEN
    RAISE EXCEPTION 'Simulated onboarding failure at before_profile';
  END IF;

  INSERT INTO public.profiles (
    id, clinic_id, full_name, email, role, active, force_password_change, temp_password_issued_at
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

  IF v_simulate_failure_at = 'before_settings' THEN
    RAISE EXCEPTION 'Simulated onboarding failure at before_settings';
  END IF;

  INSERT INTO public.kiosk_settings (clinic_id, normal_prefix, priority_prefix)
  VALUES (v_clinic_id, v_ticket_prefix, 'P')
  ON CONFLICT (clinic_id) DO NOTHING;

  INSERT INTO public.panel_settings (clinic_id)
  VALUES (v_clinic_id)
  ON CONFLICT (clinic_id) DO NOTHING;

  INSERT INTO public.print_settings (clinic_id)
  VALUES (v_clinic_id)
  ON CONFLICT (clinic_id) DO NOTHING;

  IF v_simulate_failure_at = 'before_rooms' THEN
    RAISE EXCEPTION 'Simulated onboarding failure at before_rooms';
  END IF;

  FOR i IN 1..GREATEST(COALESCE(_rooms_count, 0), 0) LOOP
    INSERT INTO public.rooms (clinic_id, name, number, active)
    VALUES (v_clinic_id, format('Sala %s', i), i::text, true)
    ON CONFLICT (clinic_id, name) DO NOTHING;
  END LOOP;

  IF v_simulate_failure_at = 'before_receptions' THEN
    RAISE EXCEPTION 'Simulated onboarding failure at before_receptions';
  END IF;

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

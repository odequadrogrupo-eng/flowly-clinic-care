-- B2B SaaS hardening step 2: policies and trigger behavior after enum update.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'superadmin'
      AND active
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, service_role;

DROP POLICY IF EXISTS "superadmin read all clinics" ON public.clinics;
CREATE POLICY "superadmin read all clinics" ON public.clinics
FOR SELECT TO authenticated
USING (public.is_superadmin() OR id = public.current_clinic_id());

DROP POLICY IF EXISTS "superadmin update all clinics" ON public.clinics;
CREATE POLICY "superadmin update all clinics" ON public.clinics
FOR UPDATE TO authenticated
USING (public.is_superadmin() OR (id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin')))
WITH CHECK (public.is_superadmin() OR id = public.current_clinic_id());

DROP POLICY IF EXISTS "superadmin insert clinics" ON public.clinics;
CREATE POLICY "superadmin insert clinics" ON public.clinics
FOR INSERT TO authenticated
WITH CHECK (public.is_superadmin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invited_record public.clinic_invites%ROWTYPE;
  requested_role public.app_role;
  input_token text;
BEGIN
  input_token := COALESCE(NEW.raw_user_meta_data->>'invite_token', '');

  IF input_token = '' THEN
    RAISE EXCEPTION 'Public signup disabled. Use admin invitation flow.';
  END IF;

  SELECT *
  INTO invited_record
  FROM public.clinic_invites
  WHERE invite_token::text = input_token
    AND lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invited_record.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite.';
  END IF;

  requested_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'invite_role', '')::public.app_role,
    invited_record.role
  );

  INSERT INTO public.profiles (id, clinic_id, full_name, email, role)
  VALUES (
    NEW.id,
    invited_record.clinic_id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NEW.email),
    NEW.email,
    CASE
      WHEN requested_role IN ('superadmin', 'admin', 'receptionist', 'attendant', 'professional', 'public_display')
        THEN requested_role
      ELSE invited_record.role
    END
  );

  UPDATE public.clinic_invites
  SET accepted_at = now()
  WHERE id = invited_record.id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

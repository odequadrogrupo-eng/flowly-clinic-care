-- User invites and profile linkage hardening for multi-role onboarding.

CREATE TABLE IF NOT EXISTS public.clinic_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'receptionist',
  invite_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_invites_email_lower_chk CHECK (email = lower(email))
);

CREATE INDEX IF NOT EXISTS idx_clinic_invites_clinic_pending
  ON public.clinic_invites(clinic_id, created_at DESC)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_invites_email_pending
  ON public.clinic_invites(email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.clinic_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.clinic_invites TO authenticated;
GRANT ALL ON public.clinic_invites TO service_role;

DROP POLICY IF EXISTS "invites_admin_select" ON public.clinic_invites;
DROP POLICY IF EXISTS "invites_admin_insert" ON public.clinic_invites;
DROP POLICY IF EXISTS "invites_admin_update" ON public.clinic_invites;

CREATE POLICY "invites_admin_select" ON public.clinic_invites
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "invites_admin_insert" ON public.clinic_invites
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.has_role(auth.uid(), 'admin')
  AND role IN ('admin', 'receptionist', 'attendant', 'professional', 'public_display')
  AND created_by = auth.uid()
);

CREATE POLICY "invites_admin_update" ON public.clinic_invites
FOR UPDATE TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_clinic uuid;
  invited_record public.clinic_invites%ROWTYPE;
  requested_role public.app_role;
  input_token text;
BEGIN
  input_token := COALESCE(NEW.raw_user_meta_data->>'invite_token', '');

  IF input_token <> '' THEN
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
  END IF;

  IF invited_record.id IS NOT NULL THEN
    requested_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'invite_role', '')::public.app_role, invited_record.role);

    INSERT INTO public.profiles (id, clinic_id, full_name, email, role)
    VALUES (
      NEW.id,
      invited_record.clinic_id,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NEW.email),
      NEW.email,
      CASE
        WHEN requested_role IN ('receptionist', 'professional', 'public_display') THEN requested_role
        ELSE invited_record.role
      END
    );

    UPDATE public.clinic_invites
    SET accepted_at = now()
    WHERE id = invited_record.id;

    RETURN NEW;
  END IF;

  INSERT INTO public.clinics (name)
  VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'clinic_name',''), 'Minha Clinica'))
  RETURNING id INTO new_clinic;

  INSERT INTO public.profiles (id, clinic_id, full_name, email, role)
  VALUES (
    NEW.id,
    new_clinic,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NEW.email),
    NEW.email,
    'admin'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

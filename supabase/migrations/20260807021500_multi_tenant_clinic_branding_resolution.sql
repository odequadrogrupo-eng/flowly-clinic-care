-- Multi-tenant clinic identification and dynamic branding support
-- Adds tenant slug + branding payload and provides secure resolver for login context.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS tenant_slug text,
  ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Normalize missing slugs from current clinic names.
WITH base_values AS (
  SELECT
    c.id,
    COALESCE(
      NULLIF(
        trim(both '-' FROM regexp_replace(lower(COALESCE(c.name, 'clinica')), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'clinica'
    ) AS base_slug
  FROM public.clinics c
),
ranked AS (
  SELECT
    b.id,
    b.base_slug,
    row_number() OVER (PARTITION BY b.base_slug ORDER BY b.id) AS rn
  FROM base_values b
)
UPDATE public.clinics c
SET tenant_slug = CASE
  WHEN r.rn = 1 THEN r.base_slug
  ELSE r.base_slug || '-' || r.rn::text
END
FROM ranked r
WHERE c.id = r.id
  AND (c.tenant_slug IS NULL OR length(trim(c.tenant_slug)) = 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clinics_tenant_slug_key'
      AND conrelid = 'public.clinics'::regclass
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_tenant_slug_key UNIQUE (tenant_slug);
  END IF;
END $$;

UPDATE public.clinics
SET branding = COALESCE(branding, '{}'::jsonb)
WHERE branding IS NULL;

-- Utility for deterministic slug generation on new clinic creation.
CREATE OR REPLACE FUNCTION public.generate_tenant_slug(_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  candidate text;
  suffix integer := 1;
BEGIN
  base_slug := COALESCE(
    NULLIF(trim(both '-' FROM regexp_replace(lower(COALESCE(_name, 'clinica')), '[^a-z0-9]+', '-', 'g')), ''),
    'clinica'
  );

  candidate := base_slug;

  WHILE EXISTS (SELECT 1 FROM public.clinics WHERE tenant_slug = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix::text;
  END LOOP;

  RETURN candidate;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_tenant_slug(text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_clinic uuid;
  invited_record public.clinic_invites%ROWTYPE;
  requested_role public.app_role;
  input_token text;
  clinic_name text;
  clinic_slug text;
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
        WHEN requested_role IN ('receptionist', 'professional', 'public_display', 'attendant') THEN requested_role
        ELSE invited_record.role
      END
    );

    UPDATE public.clinic_invites
    SET accepted_at = now()
    WHERE id = invited_record.id;

    RETURN NEW;
  END IF;

  clinic_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'clinic_name',''), 'Minha Clinica');
  clinic_slug := public.generate_tenant_slug(clinic_name);

  INSERT INTO public.clinics (name, tenant_slug, branding)
  VALUES (
    clinic_name,
    clinic_slug,
    jsonb_build_object(
      'display_name', clinic_name,
      'slug', clinic_slug,
      'colors', jsonb_build_object()
    )
  )
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

-- Public-safe resolver for login branding by host/subdomain and/or explicit slug code.
CREATE OR REPLACE FUNCTION public.resolve_clinic_branding(_identifier text DEFAULT NULL, _host text DEFAULT NULL)
RETURNS TABLE (
  clinic_id uuid,
  tenant_slug text,
  display_name text,
  logo_url text,
  branding jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  host_slug text;
  normalized_identifier text;
BEGIN
  normalized_identifier := NULLIF(trim(lower(COALESCE(_identifier, ''))), '');

  IF _host IS NOT NULL AND length(trim(_host)) > 0 THEN
    host_slug := split_part(lower(trim(_host)), '.', 1);
    IF host_slug IN ('www', 'localhost', '127', '0', 'clinicflow') THEN
      host_slug := NULL;
    END IF;
  END IF;

  IF host_slug IS NOT NULL THEN
    RETURN QUERY
    SELECT
      c.id,
      c.tenant_slug,
      c.name,
      c.logo_url,
      COALESCE(c.branding, '{}'::jsonb)
    FROM public.clinics c
    WHERE c.tenant_slug = host_slug
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF normalized_identifier IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.tenant_slug,
    c.name,
    c.logo_url,
    COALESCE(c.branding, '{}'::jsonb)
  FROM public.clinics c
  WHERE c.tenant_slug = normalized_identifier
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_clinic_branding(text, text) TO anon, authenticated;

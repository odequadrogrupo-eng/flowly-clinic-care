-- B2B SaaS hardening step 1: add superadmin role to enum in isolated migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'superadmin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'superadmin';
  END IF;
END $$;

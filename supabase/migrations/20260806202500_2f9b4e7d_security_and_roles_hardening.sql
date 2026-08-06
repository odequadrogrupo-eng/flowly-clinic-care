-- Security and role hardening for ClinicFlow domain tables.
-- Keeps existing schema, adds missing constraints/indexes, and refines RLS policies per role.

-- 1) Ensure profiles are always linked to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_id_auth_users_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_auth_users_fkey
      FOREIGN KEY (id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Soft delete support (applies to entities already using active flag)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_soft_delete_timestamp() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.active = false AND OLD.active = true AND NEW.deleted_at IS NULL THEN
    NEW.deleted_at = now();
  ELSIF NEW.active = true AND OLD.active = false THEN
    NEW.deleted_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_patients_soft_delete ON public.patients;
CREATE TRIGGER t_patients_soft_delete
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.sync_soft_delete_timestamp();

DROP TRIGGER IF EXISTS t_professionals_soft_delete ON public.professionals;
CREATE TRIGGER t_professionals_soft_delete
BEFORE UPDATE ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.sync_soft_delete_timestamp();

DROP TRIGGER IF EXISTS t_rooms_soft_delete ON public.rooms;
CREATE TRIGGER t_rooms_soft_delete
BEFORE UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.sync_soft_delete_timestamp();

-- 3) Indexes for common filtered paths and joins
CREATE INDEX IF NOT EXISTS idx_profiles_clinic_role_active ON public.profiles(clinic_id, role, active);
CREATE INDEX IF NOT EXISTS idx_professionals_profile_id ON public.professionals(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_professionals_clinic_active ON public.professionals(clinic_id, active);
CREATE INDEX IF NOT EXISTS idx_rooms_clinic_active ON public.rooms(clinic_id, active);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_active ON public.patients(clinic_id, active);
CREATE INDEX IF NOT EXISTS idx_queues_clinic_prof_status ON public.queues(clinic_id, professional_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_patient_id ON public.queues(patient_id);
CREATE INDEX IF NOT EXISTS idx_calls_clinic_recent ON public.calls(clinic_id, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_professional_id ON public.calls(professional_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_created ON public.audit_logs(clinic_id, created_at DESC);

-- 4) Enforce RLS everywhere (idempotent)
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5) Replace broad policies with role-scoped clinic policies
-- Clinics
DROP POLICY IF EXISTS "clinic members read clinic" ON public.clinics;
DROP POLICY IF EXISTS "admins update clinic" ON public.clinics;

CREATE POLICY "clinics_select_own" ON public.clinics
FOR SELECT TO authenticated
USING (id = public.current_clinic_id());

CREATE POLICY "clinics_update_admin" ON public.clinics
FOR UPDATE TO authenticated
USING (
  id = public.current_clinic_id()
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  id = public.current_clinic_id()
  AND public.has_role(auth.uid(), 'admin')
);

-- Profiles
DROP POLICY IF EXISTS "read own clinic profiles" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
DROP POLICY IF EXISTS "admins manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins insert profiles" ON public.profiles;

CREATE POLICY "profiles_select_own_clinic" ON public.profiles
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() AND clinic_id = public.current_clinic_id())
WITH CHECK (id = auth.uid() AND clinic_id = public.current_clinic_id());

CREATE POLICY "profiles_admin_insert" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "profiles_admin_update" ON public.profiles
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.has_role(auth.uid(), 'admin')
);

-- Patients (admin/receptionist manage; professionals can read within clinic)
DROP POLICY IF EXISTS "staff read patients" ON public.patients;
DROP POLICY IF EXISTS "staff insert patients" ON public.patients;
DROP POLICY IF EXISTS "staff update patients" ON public.patients;

CREATE POLICY "patients_select_clinic_members" ON public.patients
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    public.is_staff()
    OR public.has_role(auth.uid(), 'professional')
    OR public.has_role(auth.uid(), 'public_display')
  )
);

CREATE POLICY "patients_insert_staff" ON public.patients
FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

CREATE POLICY "patients_update_staff" ON public.patients
FOR UPDATE TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.is_staff())
WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

-- Professionals
DROP POLICY IF EXISTS "clinic read professionals" ON public.professionals;
DROP POLICY IF EXISTS "staff insert professionals" ON public.professionals;
DROP POLICY IF EXISTS "staff update professionals" ON public.professionals;

CREATE POLICY "professionals_select_clinic" ON public.professionals
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY "professionals_insert_staff" ON public.professionals
FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

CREATE POLICY "professionals_update_staff_or_self" ON public.professionals
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    public.is_staff()
    OR profile_id = auth.uid()
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND (
    public.is_staff()
    OR profile_id = auth.uid()
  )
);

-- Rooms (admin/receptionist manage)
DROP POLICY IF EXISTS "clinic read rooms" ON public.rooms;
DROP POLICY IF EXISTS "staff insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "staff update rooms" ON public.rooms;

CREATE POLICY "rooms_select_clinic" ON public.rooms
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY "rooms_insert_staff" ON public.rooms
FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

CREATE POLICY "rooms_update_staff" ON public.rooms
FOR UPDATE TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.is_staff())
WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

-- Queues
DROP POLICY IF EXISTS "clinic read queues" ON public.queues;
DROP POLICY IF EXISTS "staff insert queues" ON public.queues;
DROP POLICY IF EXISTS "staff or owner update queues" ON public.queues;

CREATE POLICY "queues_select_staff" ON public.queues
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.is_staff());

CREATE POLICY "queues_select_professional_own" ON public.queues
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id IN (SELECT public.my_professional_ids())
);

CREATE POLICY "queues_insert_staff" ON public.queues
FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

CREATE POLICY "queues_update_staff" ON public.queues
FOR UPDATE TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.is_staff())
WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

CREATE POLICY "queues_update_professional_own" ON public.queues
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id IN (SELECT public.my_professional_ids())
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND professional_id IN (SELECT public.my_professional_ids())
);

-- Calls (minimal public display data should be consumed at app query level)
DROP POLICY IF EXISTS "clinic read calls" ON public.calls;
DROP POLICY IF EXISTS "clinic insert calls" ON public.calls;

CREATE POLICY "calls_select_staff" ON public.calls
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.is_staff());

CREATE POLICY "calls_select_professional_own" ON public.calls
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND professional_id IN (SELECT public.my_professional_ids())
);

CREATE POLICY "calls_select_public_display" ON public.calls
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.has_role(auth.uid(), 'public_display')
);

CREATE POLICY "calls_insert_staff_or_professional" ON public.calls
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND (
    public.is_staff()
    OR public.has_role(auth.uid(), 'professional')
  )
);

-- Audit logs
DROP POLICY IF EXISTS "admins read audit" ON public.audit_logs;
DROP POLICY IF EXISTS "members insert audit" ON public.audit_logs;

CREATE POLICY "audit_select_admin" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "audit_insert_members" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND user_id = auth.uid()
);

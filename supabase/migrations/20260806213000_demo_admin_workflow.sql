-- Demo admin workflow foundation (non-destructive)

-- Demo markers
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.receptions ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.receptions ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.attendants ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendants ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.specialties ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.specialties ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.kiosk_settings ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.kiosk_settings ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.panel_settings ADD COLUMN IF NOT EXISTS demo_batch_id text;

ALTER TABLE public.print_settings ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.print_settings ADD COLUMN IF NOT EXISTS demo_batch_id text;

-- Medical room shifts (doctors are not permanently assigned to rooms)
CREATE TABLE IF NOT EXISTS public.doctor_room_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  demo_batch_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, professional_id, room_id, shift_date, start_time, end_time)
);

DROP TRIGGER IF EXISTS t_doctor_room_shifts_updated ON public.doctor_room_shifts;
CREATE TRIGGER t_doctor_room_shifts_updated
BEFORE UPDATE ON public.doctor_room_shifts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_doctor_room_shifts_clinic_date ON public.doctor_room_shifts(clinic_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_doctor_room_shifts_demo ON public.doctor_room_shifts(clinic_id, is_demo, demo_batch_id);

-- Demo runs status table
CREATE TABLE IF NOT EXISTS public.demo_seed_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  triggered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('seed', 'reset', 'validate_tenant')),
  status text NOT NULL CHECK (status IN ('running', 'success', 'error')),
  summary jsonb,
  error_message text,
  demo_batch_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_demo_seed_runs_clinic_created_at ON public.demo_seed_runs(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_seed_runs_action_status ON public.demo_seed_runs(action, status, created_at DESC);

GRANT SELECT, INSERT ON public.doctor_room_shifts TO authenticated;
GRANT SELECT, INSERT ON public.demo_seed_runs TO authenticated;
GRANT ALL ON public.doctor_room_shifts TO service_role;
GRANT ALL ON public.demo_seed_runs TO service_role;

ALTER TABLE public.doctor_room_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_seed_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doctor_room_shifts_select_clinic ON public.doctor_room_shifts;
DROP POLICY IF EXISTS doctor_room_shifts_write_admin ON public.doctor_room_shifts;

CREATE POLICY doctor_room_shifts_select_clinic ON public.doctor_room_shifts
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

CREATE POLICY doctor_room_shifts_write_admin ON public.doctor_room_shifts
FOR ALL TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS demo_seed_runs_select_admin ON public.demo_seed_runs;
DROP POLICY IF EXISTS demo_seed_runs_insert_admin ON public.demo_seed_runs;

CREATE POLICY demo_seed_runs_select_admin ON public.demo_seed_runs
FOR SELECT TO authenticated
USING (
  (clinic_id IS NULL OR clinic_id = public.current_clinic_id())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY demo_seed_runs_insert_admin ON public.demo_seed_runs
FOR INSERT TO authenticated
WITH CHECK (
  (clinic_id IS NULL OR clinic_id = public.current_clinic_id())
  AND public.has_role(auth.uid(), 'admin')
);

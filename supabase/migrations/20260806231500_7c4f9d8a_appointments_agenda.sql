-- Agenda appointments module

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  queue_id uuid REFERENCES public.queues(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'checked_in', 'in_service', 'finished', 'cancelled', 'no_show')),
  notes text,
  internal_notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_datetime ON public.appointments(clinic_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_appointments_professional_datetime ON public.appointments(clinic_id, professional_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(clinic_id, status);

DROP TRIGGER IF EXISTS t_appointments_updated ON public.appointments;
CREATE TRIGGER t_appointments_updated
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select_clinic" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_staff" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_staff" ON public.appointments;

CREATE POLICY "appointments_select_clinic" ON public.appointments
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (
    public.is_staff()
    OR professional_id IN (
      SELECT p.id
      FROM public.professionals p
      WHERE p.profile_id = auth.uid() AND p.active = true
    )
  )
);

CREATE POLICY "appointments_insert_staff" ON public.appointments
FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

CREATE POLICY "appointments_update_staff" ON public.appointments
FOR UPDATE TO authenticated
USING (clinic_id = public.current_clinic_id() AND public.is_staff())
WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());

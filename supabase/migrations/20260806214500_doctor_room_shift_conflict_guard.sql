-- Prevent overlapping doctor-room shifts within the same clinic/day.
-- Non-destructive: adds validation trigger only.

CREATE OR REPLACE FUNCTION public.ensure_doctor_room_shift_no_conflict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Shift end time must be greater than start time';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.doctor_room_shifts s
    WHERE s.clinic_id = NEW.clinic_id
      AND s.shift_date = NEW.shift_date
      AND s.professional_id = NEW.professional_id
      AND s.id <> COALESCE(NEW.id, gen_random_uuid())
      AND NEW.start_time < s.end_time
      AND s.start_time < NEW.end_time
  ) THEN
    RAISE EXCEPTION 'Professional already has another shift that overlaps this period';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.doctor_room_shifts s
    WHERE s.clinic_id = NEW.clinic_id
      AND s.shift_date = NEW.shift_date
      AND s.room_id = NEW.room_id
      AND s.id <> COALESCE(NEW.id, gen_random_uuid())
      AND NEW.start_time < s.end_time
      AND s.start_time < NEW.end_time
  ) THEN
    RAISE EXCEPTION 'Room already has another shift that overlaps this period';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_doctor_room_shifts_conflict_guard ON public.doctor_room_shifts;
CREATE TRIGGER t_doctor_room_shifts_conflict_guard
BEFORE INSERT OR UPDATE ON public.doctor_room_shifts
FOR EACH ROW
EXECUTE FUNCTION public.ensure_doctor_room_shift_no_conflict();

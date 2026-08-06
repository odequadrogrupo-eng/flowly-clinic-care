
CREATE TYPE public.app_role AS ENUM ('admin','receptionist','professional','public_display');
CREATE TYPE public.queue_status AS ENUM ('waiting','called','in_service','finished','cancelled','no_show');
CREATE TYPE public.queue_priority AS ENUM ('normal','priority');
CREATE TYPE public.professional_status AS ENUM ('available','busy','away');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  document text,
  phone text,
  email text,
  address text,
  logo_url text,
  opening_hours text,
  voice_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  role public.app_role NOT NULL DEFAULT 'receptionist',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  number text,
  sector text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  cpf text,
  birth_date date,
  phone text,
  email text,
  address text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  specialty text,
  professional_registration text,
  phone text,
  email text,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  status public.professional_status NOT NULL DEFAULT 'available',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  service_type text,
  priority public.queue_priority NOT NULL DEFAULT 'normal',
  status public.queue_status NOT NULL DEFAULT 'waiting',
  position integer,
  notes text,
  internal_notes text,
  checkin_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  queue_id uuid REFERENCES public.queues(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  professional_name text,
  room_name text,
  called_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_queues_clinic_status ON public.queues(clinic_id, status);
CREATE INDEX idx_calls_clinic_called ON public.calls(clinic_id, called_at DESC);
CREATE INDEX idx_patients_clinic ON public.patients(clinic_id);

-- helper functions
CREATE OR REPLACE FUNCTION public.current_clinic_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role AND active)
$$;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active
    AND role IN ('admin','receptionist'))
$$;

CREATE OR REPLACE FUNCTION public.my_professional_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.professionals WHERE profile_id = auth.uid()
$$;

-- signup: create clinic + admin profile
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_clinic uuid;
BEGIN
  INSERT INTO public.clinics (name)
  VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'clinic_name',''), 'Minha Clínica'))
  RETURNING id INTO new_clinic;

  INSERT INTO public.profiles (id, clinic_id, full_name, email, role)
  VALUES (NEW.id, new_clinic,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NEW.email),
    NEW.email, 'admin');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER t_clinics_updated BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_professionals_updated BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_rooms_updated BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_queues_updated BEFORE UPDATE ON public.queues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics, public.profiles, public.patients,
  public.professionals, public.rooms, public.queues, public.calls, public.audit_logs TO authenticated;
GRANT ALL ON public.clinics, public.profiles, public.patients, public.professionals,
  public.rooms, public.queues, public.calls, public.audit_logs TO service_role;

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic members read clinic" ON public.clinics FOR SELECT TO authenticated
  USING (id = public.current_clinic_id());
CREATE POLICY "admins update clinic" ON public.clinics FOR UPDATE TO authenticated
  USING (id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = public.current_clinic_id());

CREATE POLICY "read own clinic profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR clinic_id = public.current_clinic_id());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND clinic_id = public.current_clinic_id());
CREATE POLICY "admins manage profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (clinic_id = public.current_clinic_id());
CREATE POLICY "admins insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "staff read patients" ON public.patients FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id()
    AND (public.is_staff() OR public.has_role(auth.uid(),'professional')));
CREATE POLICY "staff insert patients" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());
CREATE POLICY "staff update patients" ON public.patients FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_staff())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "clinic read professionals" ON public.professionals FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "staff insert professionals" ON public.professionals FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());
CREATE POLICY "staff update professionals" ON public.professionals FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id()
    AND (public.is_staff() OR profile_id = auth.uid()))
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "clinic read rooms" ON public.rooms FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "staff insert rooms" ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());
CREATE POLICY "staff update rooms" ON public.rooms FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.is_staff())
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "clinic read queues" ON public.queues FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "staff insert queues" ON public.queues FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_staff());
CREATE POLICY "staff or owner update queues" ON public.queues FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id()
    AND (public.is_staff() OR professional_id IN (SELECT public.my_professional_ids())))
  WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "clinic read calls" ON public.calls FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "clinic insert calls" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id()
    AND (public.is_staff() OR public.has_role(auth.uid(),'professional')));

CREATE POLICY "admins read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "members insert audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

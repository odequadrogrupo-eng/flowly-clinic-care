-- Administrative panel text and display controls per clinic.

ALTER TABLE public.panel_settings
  ADD COLUMN IF NOT EXISTS panel_title text NOT NULL DEFAULT 'Painel de chamadas',
  ADD COLUMN IF NOT EXISTS current_call_label text NOT NULL DEFAULT 'Chamando agora',
  ADD COLUMN IF NOT EXISTS previous_calls_label text NOT NULL DEFAULT 'Chamadas anteriores',
  ADD COLUMN IF NOT EXISTS privacy_message text NOT NULL DEFAULT 'Por privacidade, exibimos apenas o primeiro nome e a inicial do sobrenome do paciente.',
  ADD COLUMN IF NOT EXISTS show_ticket boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_patient_name boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_professional boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_called_time boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_room boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_desk boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_office boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_priority boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS room_label text NOT NULL DEFAULT 'Sala',
  ADD COLUMN IF NOT EXISTS desk_label text NOT NULL DEFAULT 'Guichê',
  ADD COLUMN IF NOT EXISTS office_label text NOT NULL DEFAULT 'Consultório',
  ADD COLUMN IF NOT EXISTS reception_label text NOT NULL DEFAULT 'Recepção',
  ADD COLUMN IF NOT EXISTS highlight_seconds integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS brand_primary text,
  ADD COLUMN IF NOT EXISTS brand_secondary text,
  ADD COLUMN IF NOT EXISTS logo_override_url text;

DROP POLICY IF EXISTS panel_update_admin ON public.panel_settings;
CREATE POLICY panel_update_admin ON public.panel_settings
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND (public.has_role(auth.uid(),'admin') OR public.is_superadmin())
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND (public.has_role(auth.uid(),'admin') OR public.is_superadmin())
);

DROP POLICY IF EXISTS panel_insert_admin ON public.panel_settings;
CREATE POLICY panel_insert_admin ON public.panel_settings
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND (public.has_role(auth.uid(),'admin') OR public.is_superadmin())
);

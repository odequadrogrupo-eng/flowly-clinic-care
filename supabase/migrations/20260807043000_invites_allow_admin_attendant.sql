-- Expand invite roles for complete in-app team management.

DROP POLICY IF EXISTS "invites_admin_insert" ON public.clinic_invites;

CREATE POLICY "invites_admin_insert" ON public.clinic_invites
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.has_role(auth.uid(), 'admin')
  AND role IN ('admin', 'receptionist', 'attendant', 'professional', 'public_display')
  AND created_by = auth.uid()
);

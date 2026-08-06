-- Allow superadmin to switch own clinic context to support global support access.

DROP POLICY IF EXISTS "superadmin switch own clinic context" ON public.profiles;
CREATE POLICY "superadmin switch own clinic context" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() AND public.is_superadmin())
WITH CHECK (id = auth.uid() AND public.is_superadmin());

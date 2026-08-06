-- Superadmin ops foundation: monitoring, backup metadata and contingency sync logs.

CREATE TABLE IF NOT EXISTS public.platform_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'frontend',
  route text,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  app_version text,
  environment text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.backup_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  format text NOT NULL CHECK (format IN ('csv', 'json')),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'running', 'failed')),
  retention_days integer NOT NULL DEFAULT 30,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contingency_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  synced_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operation_type text NOT NULL,
  local_operation_id text,
  status text NOT NULL CHECK (status IN ('synced', 'conflict', 'failed')),
  conflict_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_errors_clinic_created
ON public.platform_errors(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backup_exports_clinic_created
ON public.backup_exports(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contingency_sync_logs_clinic_created
ON public.contingency_sync_logs(clinic_id, created_at DESC);

ALTER TABLE public.platform_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contingency_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_errors_select_scoped ON public.platform_errors;
CREATE POLICY platform_errors_select_scoped ON public.platform_errors
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR clinic_id = public.current_clinic_id()
);

DROP POLICY IF EXISTS platform_errors_insert_scoped ON public.platform_errors;
CREATE POLICY platform_errors_insert_scoped ON public.platform_errors
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'superadmin')
  OR clinic_id = public.current_clinic_id()
  OR clinic_id IS NULL
);

DROP POLICY IF EXISTS backup_exports_select_scoped ON public.backup_exports;
CREATE POLICY backup_exports_select_scoped ON public.backup_exports
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS backup_exports_insert_admin ON public.backup_exports;
CREATE POLICY backup_exports_insert_admin ON public.backup_exports
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'superadmin')
  OR (clinic_id = public.current_clinic_id() AND public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS contingency_sync_logs_select_scoped ON public.contingency_sync_logs;
CREATE POLICY contingency_sync_logs_select_scoped ON public.contingency_sync_logs
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR clinic_id = public.current_clinic_id()
);

DROP POLICY IF EXISTS contingency_sync_logs_insert_scoped ON public.contingency_sync_logs;
CREATE POLICY contingency_sync_logs_insert_scoped ON public.contingency_sync_logs
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'superadmin')
  OR clinic_id = public.current_clinic_id()
);

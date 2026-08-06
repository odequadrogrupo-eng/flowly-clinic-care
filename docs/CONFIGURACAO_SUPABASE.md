# Configuracao Supabase

## 1) Projeto e chaves

No Supabase Dashboard, obtenha:

- Project URL
- Publishable/Anon key

Configure no arquivo .env local:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY

## 2) Banco e migrations

Pasta de migrations:

- supabase/migrations

Migrations principais de demo/seguranca:

- 20260806202500_2f9b4e7d_security_and_roles_hardening.sql
- 20260806204000_club_medico_demo_seed_function.sql
- 20260806212000_b9e2f4a1_user_invites_and_permissions.sql
- 20260806213000_demo_admin_workflow.sql
- 20260806231500_7c4f9d8a_appointments_agenda.sql
- 20260807003000_complete_saas_foundation.sql

## 3) Edge Functions

Funcoes criadas:

- seed-demo-clinic
- reset-demo-clinic

Arquivos compartilhados:

- supabase/functions/_shared/cors.ts
- supabase/functions/_shared/demo.ts

## 4) Seguranca

- RLS habilitado nas tabelas sensiveis.
- Policies por clinic_id.
- Acao de seed/reset protegida por role admin no backend.
- Nao usar SUPABASE_SERVICE_ROLE_KEY no frontend.

## 5) Ambiente demo Club Medico

A forma recomendada e via painel admin (sem SQL manual):

- Dashboard > Ambiente de demonstracao
- Botao Popular dados do Club Medico
- Botao Recriar dados de demonstracao

A rotina registra execucoes em demo_seed_runs e auditoria em audit_logs.

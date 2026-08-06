# Estrutura do Banco

## Multiempresa

- Isolamento por clinic_id
- Perfil de usuario em profiles
- Controle de acesso por role

## Tabelas de dominio

- clinics
- profiles
- patients
- professionals
- rooms
- receptions
- attendants
- specialties
- appointments
- queues
- tickets
- calls
- audit_logs

## Tabelas/configuracoes de exibicao e impressao

- kiosk_settings
- panel_settings
- print_settings

## Tabelas da camada demo/admin

- doctor_room_shifts
- demo_seed_runs

## Observacoes de integridade

- Chaves estrangeiras por clinic_id e entidades relacionadas
- Indices para consultas operacionais e historicas
- Trigger update_updated_at_column aplicado em tabelas com updated_at
- RLS habilitado com policies por clinic_id e role

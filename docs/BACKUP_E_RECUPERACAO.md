# Backup e Recuperacao - ClinicFlow

## Objetivo
Garantir continuidade operacional por clinica sem mistura de dados multiempresa.

## Escopo
- Banco Supabase (schema e dados)
- Storage Supabase (logos, arquivos)
- Exportacao por clinica (JSON/CSV)

## Backup do Supabase
1. Utilizar rotina de backup gerenciada do Supabase.
2. Validar periodicidade diaria e retencao minima de 30 dias.
3. Registrar no painel Superadmin a data do ultimo backup conhecido.

## Backup do Banco
- Priorizar snapshots gerenciados + export por clinica para contingencia operacional.
- Nunca executar restore em producao sem janela aprovada.

## Backup do Storage
- Replicar buckets criticos periodicamente.
- Validar restauracao de amostra (logo e anexo nao sensivel).

## Exportacao por Clinica
- Permitir export em JSON e CSV.
- Filtrar sempre por clinic_id.
- Tabelas recomendadas:
  patients, professionals, rooms, receptions, appointments, tickets, queues, calls,
  panel_settings, kiosk_settings, print_settings, audit_logs.

## Restauracao
1. Confirmacao dupla por Superadmin.
2. Validar ambiente alvo (homologacao antes de producao).
3. Executar restore de forma assistida.
4. Revalidar integridade por clinic_id.

## Teste de Restauracao
- Frequencia sugerida: mensal.
- Checklist:
  - importar amostra por clinic_id;
  - validar consultas principais;
  - validar painel, totem e relatorios;
  - validar RLS.

## Politica de Retencao
- Backups gerenciados: minimo 30 dias.
- Exportacoes operacionais: 30 dias (configuravel por politica interna).

## Responsabilidade Operacional
- Superadmin: aprovar export/restore e auditar.
- Time tecnico: executar procedimento e registrar evidencias.

## Checklist de Desastre
1. Confirmar incidente e escopo.
2. Congelar alteracoes nao essenciais.
3. Coletar ultimo backup valido.
4. Restaurar em homologacao e validar.
5. Executar restauracao em producao com confirmacao dupla.
6. Validar operacao por clinica.
7. Registrar auditoria global e post-mortem.

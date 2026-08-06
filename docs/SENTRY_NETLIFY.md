# Sentry e Netlify - ClinicFlow

## Variáveis recomendadas
- SENTRY_DSN
- SENTRY_ENVIRONMENT
- SENTRY_RELEASE
- VITE_SENTRY_DSN
- VITE_SENTRY_ENVIRONMENT
- VITE_SENTRY_RELEASE

## Observações
- Nunca enviar SERVICE_ROLE, tokens, senha, CPF completo ou dados clínicos sensíveis.
- O sanitizador do app remove chaves sensíveis em payloads de erro.
- Se o DSN não estiver configurado, o monitoramento fica desativado sem quebrar o app.

## Checklist de produção
1. Configurar variáveis no site da Netlify.
2. Fazer redeploy do branch main.
3. Validar captura de erro controlado.
4. Validar contexto: clinic_id, user_id, role, rota, versão, ambiente.

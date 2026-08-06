# Handoff local (sem autenticacao obrigatoria durante desenvolvimento)

## Estado atual

- Projeto roda localmente com `npm run dev`.
- TypeScript e build OK.
- Integracao Supabase no frontend usando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Migrations SQL prontas em `supabase/migrations`.

## Arquivos de ambiente

1. Copie `.env.example` para `.env`.
2. Preencha:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Validacao local

```bash
npm run quality:check
```

Opcional (mais rigido, inclui lint global):

```bash
npm run quality:strict
```

## Fases 10, 11 e 12 (pendencias finais)

- Fase 10 (impressao):
   - Teste no navegador em `/_authenticated/impressao`.
   - Para impressora termica direta, use Chrome/Edge e tente WebUSB/WebSerial.
   - Se WebUSB/WebSerial falhar por permissao/dispositivo, configure o Print Agent local e use endpoint de `print_settings.local_agent_endpoint`.

- Fase 11 (relatorios/exportacao):
   - CSV ja disponivel na tela de relatorios.
   - PDF: use botao "Abrir versao PDF" e salve com "Imprimir > Salvar como PDF".

- Fase 12 (auditoria/seed/quality):
   - Auditoria ja disponivel em `/_authenticated/auditoria`.
   - Seed demo via SQL Editor (Supabase):

```sql
select public.seed_demo_clinic('Club Medico');
```

   - Revalide app apos seed:

```bash
npm run quality:check
```

## Quando for versionar no GitHub (depois)

```bash
git remote -v
git status
git add .
git commit -m "feat: configurar supabase"
```

## Quando for aplicar banco no Supabase (depois)

```bash
npx --yes supabase@2.111.0 login
npx --yes supabase@2.111.0 link --project-ref fsdzsftodylbqtakgrkg
npx --yes supabase@2.111.0 migration list
npx --yes supabase@2.111.0 db push --linked
```

## Migrations existentes

- `20260806183746_7751c7ca-1119-4649-a282-cc094960481f.sql`
- `20260806183815_fd7190c1-5d27-43eb-8a9b-670626b8318e.sql`
- `20260806202500_2f9b4e7d_security_and_roles_hardening.sql`

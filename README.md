# ClinicFlow

Sistema SaaS de fluxo de atendimento para clinicas com foco em multiempresa, tempo real e operacao de recepcao/totem/painel.

## Stack

- React + TypeScript
- Vite + TanStack Start
- Tailwind CSS
- Supabase (Auth, Database, Realtime, Storage, Edge Functions)

## Funcionalidades principais

- Login, sessao e recuperacao de senha
- Controle de permissao por perfil (admin, recepcao, atendimento, profissional, painel)
- Dashboard operacional
- Cadastro e historico de pacientes
- Cadastro de profissionais, salas e guiches
- Check-in, fila, tickets, chamadas e atendimento
- Painel TV em tempo real com voz
- Totem com emissao de senha e QR
- Impressao termica (58/80mm) + fallback navegador
- Relatorios e auditoria
- Ambiente de demonstracao Club Medico

## Execucao local

1. Instalar dependencias:

```bash
npm install
```

2. Copiar ambiente:

```bash
copy .env.example .env
```

3. Preencher .env:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY

4. Rodar em dev:

```bash
npm run dev
```

## Qualidade

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Supabase

- Migrations em supabase/migrations
- Seed de demo via Edge Function protegida (sem SQL manual)
- Funcoes:
  - supabase/functions/seed-demo-clinic
  - supabase/functions/reset-demo-clinic

## Netlify

Arquivo netlify.toml configurado com:

- build command: npm run build
- publish dir: dist
- redirect SPA para /index.html

Ver guia completo em docs/DEPLOY_NETLIFY.md.

## Ambiente demo Club Medico

No dashboard admin existe a secao Ambiente de demonstracao com:

- Popular dados do Club Medico
- Recriar dados de demonstracao (dupla confirmacao)
- Status e historico de execucoes
- Copia de credenciais de teste

## Logo Club Medico

Arquivos presentes:

- public/brands/club-medico/logo/CLUB MEDICO LOGO sem fundo.png
- public/brands/club-medico/logo.png

Se quiser trocar a arte, substitua o arquivo sem fundo acima e mantenha uma versao em logo.png para exibicao padrao.

## Documentacao

- docs/INSTALACAO.md
- docs/CONFIGURACAO_SUPABASE.md
- docs/DEPLOY_NETLIFY.md
- docs/ESTRUTURA_BANCO.md
- docs/CREDENCIAIS_DEMO.md
- docs/CHECKLIST_PUBLICACAO.md
- docs/UPLOAD_GITHUB.md

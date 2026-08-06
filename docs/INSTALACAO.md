# Instalacao Local - ClinicFlow

## Requisitos

- Node.js 20+
- npm 10+
- Projeto Supabase ja criado

## Passo a passo

1. Instale dependencias:

```bash
npm install
```

2. Copie o ambiente:

```bash
copy .env.example .env
```

3. Preencha no arquivo .env:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY

4. Rode em desenvolvimento:

```bash
npm run dev
```

5. Validacao tecnica:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Observacoes

- O frontend usa somente chaves anon/publishable.
- Chave service role e usada apenas em rotinas administrativas no backend/scripts locais.

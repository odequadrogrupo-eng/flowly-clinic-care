# Club Medico Demo Setup (Local-Only)

This setup is idempotent and non-destructive.

## 1) Prepare logo file

Required file path:

- `public/brands/club-medico/logo.png`

Fallback in UI: text `Club Medico` when logo is not available.

## 2) Apply migrations manually (do not auto-run remote)

Use Supabase SQL editor or CLI (manual approval only):

- `supabase/migrations/20260806204000_club_medico_demo_seed_function.sql`

This migration adds:

- clinic operational fields (timezone, status, plan, whatsapp, address split);
- panel voice/display fields (repeat, pitch, clock, latest calls);
- idempotent function `public.seed_demo_clinic(text)`.

## 3) Database seed (idempotent)

Option A (SQL only):

```sql
select public.seed_demo_clinic('Club Medico');
```

Option B (full Auth + Database + Storage seed):

- Set env vars in local shell:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SEED_CONFIRM=CLUB_MEDICO_DEMO`
  - optional: `APP_BASE_URL=http://localhost:3000`
- Run:

```bash
npm run seed:club-medico
```

The script:

- creates/updates demo Auth users;
- upserts profiles with `force_password_change=true`;
- uploads logo to Storage bucket `brand-assets` (`brands/club-medico/logo.png`);
- sets clinic/totem logo URL;
- links professional users to professionals;
- calls `public.seed_demo_clinic('Club Medico')`.

## 4) Demo Auth users and temporary passwords

- Admin: `admin@clubmedico.teste` / `ClubMedico@2026`
- Receptionist: `recepcao@clubmedico.teste` / `Recepcao@2026`
- Attendant: `atendimento@clubmedico.teste` / `Atendimento@2026`
- Panel operator: `painel@clubmedico.teste` / `Painel@2026`
- Doctor 1: `ana.martins@clubmedico.teste` / `AnaMedica@2026`
- Doctor 2: `bruno.lima@clubmedico.teste` / `BrunoMedico@2026`
- Doctor 3: `carla.souza@clubmedico.teste` / `CarlaMedica@2026`
- Doctor 4: `diego.alves@clubmedico.teste` / `DiegoMedico@2026`
- Doctor 5: `elisa.rocha@clubmedico.teste` / `ElisaMedica@2026`

## 5) Runtime validation

```bash
npm run typecheck
npm run build
npm run quality:check
```

## 6) Netlify manual publish

1. Build command: `npm run build`
2. Publish directory: `dist/client`
3. Env vars in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. O build oficial do TanStack Start para Netlify gera `dist/client` e a função SSR em `.netlify/v1/functions/server.mjs`; nao use `.output/public` como publish directory.

## 7) GitHub manual send (no automatic remote actions)

```bash
git status
git add .
git commit -m "feat: demo club medico seed and branding"
# push manually when you decide
```

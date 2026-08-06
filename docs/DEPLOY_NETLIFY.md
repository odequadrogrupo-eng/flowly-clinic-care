# Deploy Netlify

## 1) Conectar repositorio no Netlify

1. Entre em https://app.netlify.com
2. Clique em Add new site > Import an existing project
3. Conecte seu provedor Git e selecione o repositorio com o upload manual

## 2) Configuracoes de build

Use exatamente:

- Build Command: npm run build
- Publish Directory: dist

Essas configuracoes tambem estao em netlify.toml.

## 3) Variaveis de ambiente (Site settings > Environment variables)

Crie:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Nao adicionar SUPABASE_SERVICE_ROLE_KEY no frontend.

## 4) SPA Redirect

Ja configurado em netlify.toml:

- /* -> /index.html (200)

## 5) Ajuste no Supabase Auth

No Supabase Dashboard:

1. Authentication > URL Configuration
2. Site URL: URL principal da Netlify (ex.: https://clinicflow-demo.netlify.app)
3. Additional redirect URLs: inclua URLs de preview se necessario

## 6) Validacao pos-deploy

- Login
- Recuperacao de senha
- Dashboard
- Totem
- Painel TV
- Relatorios
- Impressao fallback navegador

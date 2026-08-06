# Clinic Flow Pro

Crie um sistema SaaS web responsivo para gestão de atendimento em clínicas e consultórios, inspirado no fluxo de sistemas de fila e chamada de pacientes, mas com identidade visual, código e estrutura próprios.

O sistema deve ser multiempresa, permitindo que várias clínicas utilizem a plataforma com dados totalmente separados. Cada usuário deve acessar apenas os dados da clínica à qual pertence.

Nome provisório do sistema: ClinicFlow.

Tecnologias:

React com TypeScript.

Tailwind CSS.

Supabase para banco de dados, autenticação e realtime.

Interface responsiva para desktop, tablet e celular.

Código organizado em componentes reutilizáveis.

Preparar o projeto para integração com GitHub.

Identidade visual:

Aparência moderna, limpa e profissional.

Fundo claro.

Cores principais em azul, verde e tons neutros.

Cards com bordas suaves.

Menu lateral no desktop.

Menu adaptado para celular.

Não copiar logotipo, textos, cores ou layout exato de outros sistemas.

Perfis de usuário:

Administrador da clínica.

Recepcionista.

Profissional de atendimento.

Usuário da tela pública.

Criar autenticação com:

Login por e-mail e senha.

Recuperação de senha.

Controle de sessão.

Proteção de rotas.

Controle de acesso por perfil.

Criar as seguintes telas:

Login

Campo de e-mail.

Campo de senha.

Recuperar senha.

Mensagens de erro.

Redirecionamento após login.

Dashboard

Quantidade de pacientes aguardando.

Quantidade de pacientes atendidos no dia.

Tempo médio de espera.

Profissionais disponíveis.

Atendimentos em andamento.

Gráfico simples de atendimentos por dia.

Lista dos últimos atendimentos.

Fila de atendimento

Lista de pacientes aguardando.

Nome do paciente.

Horário de chegada.

Tempo de espera.

Tipo de atendimento.

Prioridade normal ou preferencial.

Profissional ou especialidade.

Status do atendimento.

Botão para chamar.

Botão para iniciar atendimento.

Botão para finalizar.

Botão para cancelar.

Permitir reordenar a fila respeitando as prioridades.

Atualização em tempo real usando Supabase Realtime.

Check-in de paciente

Pesquisar paciente por nome, CPF ou telefone.

Cadastrar novo paciente.

Escolher especialidade.

Escolher profissional.

Selecionar atendimento normal ou preferencial.

Informar observações.

Confirmar entrada na fila.

Registrar data e horário automaticamente.

Pacientes

Lista com busca e filtros.

Cadastro de paciente.

Nome completo.

CPF.

Data de nascimento.

Telefone.

E-mail.

Endereço.

Observações.

Histórico de atendimentos.

Editar e desativar paciente.

Não excluir definitivamente registros importantes.

Tela do profissional

Exibir fila do profissional.

Botão “Chamar próximo”.

Exibir paciente chamado.

Botão “Repetir chamada”.

Botão “Iniciar atendimento”.

Botão “Finalizar atendimento”.

Campo de observações internas.

Exibir tempo de espera e tempo de atendimento.

Atualização em tempo real.

Painel público de chamada

Tela em modo televisão.

Exibir nome ou código do paciente.

Exibir sala ou consultório.

Exibir profissional responsável.

Lista das últimas chamadas.

Chamada visual em destaque.

Preparar recurso de chamada por voz usando SpeechSynthesis do navegador.

Não exibir dados pessoais desnecessários.

Criar modo tela cheia.

Atualização em tempo real.

Profissionais

Cadastrar profissional.

Nome.

Especialidade.

Registro profissional.

Telefone.

E-mail.

Sala padrão.

Status disponível, ocupado ou ausente.

Vincular usuário ao profissional.

Salas e consultórios

Cadastrar sala.

Nome da sala.

Número.

Setor.

Status ativo ou inativo.

Usuários e permissões

Listar usuários da clínica.

Criar convite para novo usuário.

Definir perfil.

Ativar ou desativar usuário.

Administrador acessa tudo.

Recepcionista gerencia pacientes e filas.

Profissional acessa somente sua fila e atendimentos.

Usuário da tela pública acessa apenas o painel de chamada.

Relatórios

Atendimentos por período.

Atendimentos por profissional.

Atendimentos por especialidade.

Tempo médio de espera.

Tempo médio de atendimento.

Quantidade de cancelamentos.

Filtros por data, profissional e especialidade.

Botão para exportação futura em CSV ou PDF.

Configurações

Dados da clínica.

Nome fantasia.

Razão social.

CNPJ.

Telefone.

E-mail.

Endereço.

Logotipo.

Horário de funcionamento.

Configuração do painel público.

Configuração da chamada por voz.

Configuração de prioridades.

Estrutura inicial do banco de dados no Supabase:

Tabela clinics:

id

name

document

phone

email

address

logo_url

created_at

updated_at

Tabela profiles:

id

clinic_id

full_name

email

role

active

created_at

updated_at

Tabela patients:

id

clinic_id

full_name

cpf

birth_date

phone

email

address

notes

active

created_at

updated_at

Tabela professionals:

id

clinic_id

profile_id

full_name

specialty

professional_registration

room_id

status

active

created_at

updated_at

Tabela rooms:

id

clinic_id

name

number

sector

active

created_at

updated_at

Tabela queues:

id

clinic_id

patient_id

professional_id

room_id

service_type

priority

status

notes

checkin_at

called_at

started_at

finished_at

cancelled_at

created_at

updated_at

Tabela calls:

id

clinic_id

queue_id

patient_id

professional_id

room_id

display_name

called_at

created_at

Tabela audit_logs:

id

clinic_id

user_id

action

entity

entity_id

details

created_at

Usar os seguintes status na fila:

waiting

called

in_service

finished

cancelled

no_show

Regras obrigatórias:

Todas as tabelas devem ter clinic_id quando aplicável.

Criar Row Level Security no Supabase.

O usuário só pode consultar dados da própria clínica.

Profissionais só podem acessar atendimentos vinculados a eles.

O painel público deve acessar apenas dados necessários para exibição.

Não usar dados simulados como solução definitiva.

Criar estados de loading, erro e vazio.

Criar validações de formulário.

Criar mensagens de confirmação antes de cancelar ou finalizar atendimentos.

Registrar no audit_logs ações importantes.

Usar boas práticas básicas de LGPD.

Evitar mostrar CPF, telefone e informações sensíveis no painel público.

Comece pelo MVP funcional com:

autenticação;

dashboard;

cadastro de pacientes;

cadastro de profissionais;

cadastro de salas;

check-in;

fila em tempo real;

tela do profissional;

painel público de chamada.

Primeiro gere a estrutura do projeto, as rotas, os componentes, o banco no Supabase e as telas principais. Depois conecte os formulários ao banco e implemente o fluxo completo:

check-in → entrada na fila → chamada → início do atendimento → finalização.

Entregue uma interface funcional e não apenas um protótipo visual.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flowly-clinic-care.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/869ae4ae-969c-4c11-ad8f-f3365b42993e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

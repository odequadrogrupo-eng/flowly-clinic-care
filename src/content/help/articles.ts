import type { AppRole } from "@/hooks/useAuth";

export type HelpCategory =
  | "Primeiros passos"
  | "Administração"
  | "Recepção"
  | "Atendimento"
  | "Pacientes"
  | "Agenda"
  | "Totem"
  | "Impressão"
  | "Painel de TV"
  | "Voz"
  | "Relatórios"
  | "Configurações"
  | "Segurança"
  | "LGPD"
  | "Solução de problemas";

export type HelpArticle = {
  id: string;
  title: string;
  category: HelpCategory;
  roles: AppRole[];
  summary: string;
  servesFor: string;
  prerequisites: string[];
  screenOverview: string[];
  steps: string[];
  practicalExample: string;
  commonErrors: string[];
  fixes: string[];
  tips: string[];
  faqs: Array<{ q: string; a: string }>;
  requiredPermissions: string[];
  relatedModules: string[];
};

type GuideSpec = {
  id: string;
  title: string;
  category: HelpCategory;
  roles: AppRole[];
  routeHint?: string;
  relatedModules: string[];
};

const ALL_AUTH_ROLES: AppRole[] = [
  "superadmin",
  "admin",
  "receptionist",
  "attendant",
  "professional",
  "public_display",
];

const ADMIN_ROLES: AppRole[] = ["superadmin", "admin"];
const RECEPTION_ROLES: AppRole[] = ["superadmin", "admin", "receptionist", "attendant"];
const PROFESSIONAL_ROLES: AppRole[] = ["superadmin", "admin", "professional"];

const guideSpecs: GuideSpec[] = [
  {
    id: "login",
    title: "Login",
    category: "Primeiros passos",
    roles: ALL_AUTH_ROLES,
    routeHint: "/auth",
    relatedModules: ["Segurança", "Usuários e permissões"],
  },
  {
    id: "criar-clinica",
    title: "Criar clínica",
    category: "Administração",
    roles: ["superadmin"],
    routeHint: "/superadmin-clinicas",
    relatedModules: ["Multiempresa", "Configurações"],
  },
  {
    id: "criar-usuario",
    title: "Criar usuário",
    category: "Administração",
    roles: ADMIN_ROLES,
    routeHint: "/dashboard",
    relatedModules: ["Usuários e permissões", "Segurança"],
  },
  {
    id: "criar-medico",
    title: "Criar médico",
    category: "Administração",
    roles: ADMIN_ROLES,
    routeHint: "/profissionais",
    relatedModules: ["Agenda", "Atendimento"],
  },
  {
    id: "criar-recepcionista",
    title: "Criar recepcionista",
    category: "Administração",
    roles: ADMIN_ROLES,
    routeHint: "/dashboard",
    relatedModules: ["Recepção", "Check-in"],
  },
  {
    id: "criar-atendente",
    title: "Criar atendente",
    category: "Administração",
    roles: ADMIN_ROLES,
    routeHint: "/dashboard",
    relatedModules: ["Recepção", "Fila"],
  },
  {
    id: "criar-administrador",
    title: "Criar administrador",
    category: "Administração",
    roles: ADMIN_ROLES,
    routeHint: "/dashboard",
    relatedModules: ["Configurações", "Segurança"],
  },
  {
    id: "cadastrar-paciente",
    title: "Cadastrar paciente",
    category: "Pacientes",
    roles: RECEPTION_ROLES,
    routeHint: "/pacientes",
    relatedModules: ["Check-in", "Recepção"],
  },
  {
    id: "criar-sala",
    title: "Criar sala",
    category: "Configurações",
    roles: ADMIN_ROLES,
    routeHint: "/salas",
    relatedModules: ["Atendimento", "Escala médico x sala"],
  },
  {
    id: "criar-guiche",
    title: "Criar guichê",
    category: "Configurações",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Recepção", "Totem"],
  },
  {
    id: "configurar-escala",
    title: "Configurar escala",
    category: "Agenda",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Agenda", "Salas"],
  },
  {
    id: "configurar-agenda",
    title: "Configurar agenda",
    category: "Agenda",
    roles: ["superadmin", "admin", "receptionist"],
    routeHint: "/agenda",
    relatedModules: ["Profissionais", "Salas"],
  },
  {
    id: "fazer-checkin",
    title: "Fazer check-in",
    category: "Recepção",
    roles: RECEPTION_ROLES,
    routeHint: "/checkin",
    relatedModules: ["Fila", "Recepção"],
  },
  {
    id: "emitir-senha",
    title: "Emitir senha",
    category: "Totem",
    roles: RECEPTION_ROLES,
    routeHint: "/recepcao",
    relatedModules: ["Totem", "Impressão"],
  },
  {
    id: "configurar-totem",
    title: "Configurar totem",
    category: "Totem",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Impressão", "Recepção"],
  },
  {
    id: "configurar-impressora",
    title: "Configurar impressora",
    category: "Impressão",
    roles: ADMIN_ROLES,
    routeHint: "/impressao",
    relatedModules: ["Totem", "Recepção"],
  },
  {
    id: "chamar-senha-recepcao",
    title: "Chamar senha na recepção",
    category: "Recepção",
    roles: RECEPTION_ROLES,
    routeHint: "/recepcao",
    relatedModules: ["Fila", "Painel de TV"],
  },
  {
    id: "cadastrar-paciente-por-senha",
    title: "Cadastrar paciente pela senha",
    category: "Recepção",
    roles: RECEPTION_ROLES,
    routeHint: "/recepcao",
    relatedModules: ["Pacientes", "Fila"],
  },
  {
    id: "encaminhar-paciente",
    title: "Encaminhar paciente",
    category: "Recepção",
    roles: RECEPTION_ROLES,
    routeHint: "/recepcao",
    relatedModules: ["Atendimento", "Chamada"],
  },
  {
    id: "chamar-para-sala",
    title: "Chamar paciente para sala",
    category: "Atendimento",
    roles: PROFESSIONAL_ROLES,
    routeHint: "/atendimento",
    relatedModules: ["Painel de TV", "Voz"],
  },
  {
    id: "iniciar-atendimento",
    title: "Iniciar atendimento",
    category: "Atendimento",
    roles: PROFESSIONAL_ROLES,
    routeHint: "/atendimento",
    relatedModules: ["Fila", "Agenda"],
  },
  {
    id: "finalizar-atendimento",
    title: "Finalizar atendimento",
    category: "Atendimento",
    roles: PROFESSIONAL_ROLES,
    routeHint: "/atendimento",
    relatedModules: ["Relatórios", "Auditoria"],
  },
  {
    id: "transferir-atendimento",
    title: "Transferir atendimento",
    category: "Atendimento",
    roles: PROFESSIONAL_ROLES,
    routeHint: "/atendimento",
    relatedModules: ["Fila", "Profissionais"],
  },
  {
    id: "marcar-ausencia",
    title: "Marcar ausência",
    category: "Atendimento",
    roles: PROFESSIONAL_ROLES,
    routeHint: "/atendimento",
    relatedModules: ["Relatórios", "Fila"],
  },
  {
    id: "devolver-recepcao",
    title: "Devolver para recepção",
    category: "Atendimento",
    roles: PROFESSIONAL_ROLES,
    routeHint: "/atendimento",
    relatedModules: ["Recepção", "Fila"],
  },
  {
    id: "configurar-painel-tv",
    title: "Configurar painel de TV",
    category: "Painel de TV",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Voz", "Totem"],
  },
  {
    id: "configurar-voz",
    title: "Configurar voz",
    category: "Voz",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Painel de TV", "Chamadas"],
  },
  {
    id: "repetir-chamada",
    title: "Repetir chamada",
    category: "Voz",
    roles: ["superadmin", "admin", "receptionist", "professional"],
    routeHint: "/chamada",
    relatedModules: ["Painel de TV", "Recepção"],
  },
  {
    id: "gerar-relatorio",
    title: "Gerar relatório",
    category: "Relatórios",
    roles: ["superadmin", "admin", "receptionist"],
    routeHint: "/relatorios",
    relatedModules: ["Dashboard", "Auditoria"],
  },
  {
    id: "exportar-csv",
    title: "Exportar CSV",
    category: "Relatórios",
    roles: ["superadmin", "admin", "receptionist"],
    routeHint: "/relatorios",
    relatedModules: ["Relatórios", "LGPD"],
  },
  {
    id: "consultar-auditoria",
    title: "Consultar auditoria",
    category: "LGPD",
    roles: ADMIN_ROLES,
    routeHint: "/auditoria",
    relatedModules: ["Segurança", "Relatórios"],
  },
  {
    id: "configurar-privacidade",
    title: "Configurar privacidade",
    category: "LGPD",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Painel de TV", "Auditoria"],
  },
  {
    id: "configurar-identidade-visual",
    title: "Configurar identidade visual",
    category: "Configurações",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Multiempresa", "Painel de TV"],
  },
  {
    id: "configurar-prefixos",
    title: "Configurar prefixos",
    category: "Configurações",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Totem", "Impressão"],
  },
  {
    id: "configurar-permissoes",
    title: "Configurar permissões",
    category: "Segurança",
    roles: ADMIN_ROLES,
    routeHint: "/dashboard",
    relatedModules: ["Usuários e permissões", "Auditoria"],
  },
  {
    id: "configurar-urls-publicas",
    title: "Configurar URLs públicas",
    category: "Configurações",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Totem", "Painel de TV"],
  },
  {
    id: "usar-ambiente-demo",
    title: "Usar o ambiente de demonstração",
    category: "Primeiros passos",
    roles: ADMIN_ROLES,
    routeHint: "/dashboard",
    relatedModules: ["Multiempresa", "Dashboard"],
  },
  {
    id: "dashboard",
    title: "Guia do Dashboard",
    category: "Administração",
    roles: ["superadmin", "admin", "receptionist", "professional"],
    routeHint: "/dashboard",
    relatedModules: ["Relatórios", "Recepção", "Atendimento"],
  },
  {
    id: "totem-config",
    title: "Configurar Totem",
    category: "Totem",
    roles: ADMIN_ROLES,
    routeHint: "/configuracoes",
    relatedModules: ["Impressão", "Recepção", "Fila"],
  },
  {
    id: "impressora",
    title: "Configurar Impressora",
    category: "Impressão",
    roles: ADMIN_ROLES,
    routeHint: "/impressao",
    relatedModules: ["Totem", "Recepção"],
  },
  {
    id: "recepcao",
    title: "Guia da Recepção",
    category: "Recepção",
    roles: RECEPTION_ROLES,
    routeHint: "/recepcao",
    relatedModules: ["Check-in", "Fila", "Chamada"],
  },
  {
    id: "multiempresa",
    title: "Como funciona o Multiempresa",
    category: "Segurança",
    roles: ADMIN_ROLES,
    routeHint: "/superadmin-clinicas",
    relatedModules: ["Configurações", "Usuários e permissões", "Auditoria"],
  },
];

function articleTemplate(spec: GuideSpec): HelpArticle {
  return {
    id: spec.id,
    title: spec.title,
    category: spec.category,
    roles: spec.roles,
    summary: `${spec.title}: orientação prática para uso seguro e eficiente no ClinicFlow.`,
    servesFor: `Ajudar a equipe a executar ${spec.title.toLowerCase()} com padrão operacional e rastreabilidade.`,
    prerequisites: [
      "Usuário autenticado no perfil adequado",
      "Módulos relacionados já configurados",
      "Dados básicos da clínica preenchidos",
    ],
    screenOverview: [
      "Campos principais e validações",
      "Botões de ação e confirmações",
      "Status, mensagens e histórico operacional",
    ],
    steps: [
      `Acesse ${spec.routeHint ?? "o módulo correspondente"}`,
      "Confira pré-requisitos e permissões da ação",
      "Preencha os dados obrigatórios com validação em tela",
      "Confirme a operação e valide o resultado no fluxo seguinte",
    ],
    practicalExample: `Exemplo: a equipe executa ${spec.title.toLowerCase()} durante o turno e reduz retrabalho operacional.`,
    commonErrors: [
      "Operação feita sem permissão adequada",
      "Dados incompletos ou inconsistentes",
      "Ordem do fluxo não seguida",
    ],
    fixes: [
      "Revisar perfil e permissões do usuário",
      "Corrigir campos obrigatórios e tentar novamente",
      "Executar novamente seguindo a sequência recomendada",
    ],
    tips: [
      "Use o botão ‘Como usar esta tela’ durante o uso diário",
      "Padronize o procedimento da equipe por turno",
      "Revise indicadores e auditoria para melhoria contínua",
    ],
    faqs: [
      {
        q: `Quem pode usar ${spec.title.toLowerCase()}?`,
        a: `Os perfis habilitados para este guia são: ${spec.roles.join(", ")}.`,
      },
      {
        q: "O que fazer se aparecer erro?",
        a: "Verifique permissões, dados obrigatórios e tente novamente seguindo o passo a passo.",
      },
    ],
    requiredPermissions: [
      "Permissão de acesso à rota/módulo",
      "Perfil autorizado conforme política da clínica",
    ],
    relatedModules: spec.relatedModules,
  };
}

export const helpArticles: HelpArticle[] = guideSpecs.map(articleTemplate);

export const helpRouteMap: Record<string, string> = {
  "/agenda": "configurar-agenda",
  "/atendimento": "iniciar-atendimento",
  "/chamada": "repetir-chamada",
  "/dashboard": "dashboard",
  "/pacientes": "cadastrar-paciente",
  "/profissionais": "criar-medico",
  "/salas": "criar-sala",
  "/recepcao": "recepcao",
  "/checkin": "fazer-checkin",
  "/fila": "recepcao",
  "/configuracoes": "totem-config",
  "/impressao": "impressora",
  "/superadmin-clinicas": "criar-clinica",
  "/ajuda": "dashboard",
};

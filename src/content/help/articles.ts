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

export const helpArticles: HelpArticle[] = [
  {
    id: "dashboard",
    title: "Guia do Dashboard",
    category: "Administração",
    roles: ["superadmin", "admin", "receptionist", "attendant", "professional"],
    summary: "Acompanhe os principais indicadores operacionais da clínica.",
    servesFor: "Monitorar filas, tempo médio e produtividade diária.",
    prerequisites: ["Usuário autenticado", "Perfil com acesso ao Dashboard"],
    screenOverview: ["Cards de indicadores", "Gráficos", "Últimas movimentações"],
    steps: [
      "Abra o menu Dashboard",
      "Selecione o período desejado",
      "Compare tempos de espera e volume de atendimentos",
      "Use os dados para ajustar equipe e escala",
    ],
    practicalExample:
      "Ao identificar alta espera no início da manhã, abrir mais guichê nesse horário reduz o gargalo.",
    commonErrors: ["Interpretar pico pontual como tendência", "Não filtrar por período"],
    fixes: ["Comparar vários dias", "Validar com relatório detalhado"],
    tips: ["Revisar diariamente no início e no fim do expediente"],
    faqs: [
      {
        q: "O Dashboard mostra dados em tempo real?",
        a: "Sim, as informações de fila e chamadas atualizam continuamente.",
      },
    ],
    requiredPermissions: ["Acesso à rota /dashboard"],
    relatedModules: ["Relatórios", "Recepção", "Atendimento"],
  },
  {
    id: "totem-config",
    title: "Configurar Totem",
    category: "Totem",
    roles: ["superadmin", "admin"],
    summary: "Prepare URL pública, impressão automática e modo kiosk do totem.",
    servesFor: "Permitir retirada de senha de forma autônoma pelo paciente.",
    prerequisites: ["Clínica ativa", "Impressora configurada"],
    screenOverview: ["Token/URL pública", "Método de impressão", "Teste de impressora"],
    steps: [
      "Acesse Configurações > Totem",
      "Copie a URL pública e abra no dispositivo touch",
      "Defina modo kiosk e método de impressão",
      "Teste a impressora antes de liberar uso ao público",
    ],
    practicalExample:
      "Na recepção, um tablet fixo com totem reduz fila de cadastro inicial e acelera triagem.",
    commonErrors: ["URL antiga após regenerar token", "Método de impressão incompatível"],
    fixes: ["Atualizar atalho do totem", "Usar fallback navegador ou agente local"],
    tips: ["Fixar navegador em tela cheia no dispositivo do totem"],
    faqs: [
      {
        q: "Quando usar WebUSB ou WebSerial?",
        a: "Quando a impressora local suportar esses recursos e o navegador estiver autorizado.",
      },
    ],
    requiredPermissions: ["Perfil administrador"],
    relatedModules: ["Impressão", "Recepção", "Fila"],
  },
  {
    id: "impressora",
    title: "Configurar Impressora",
    category: "Impressão",
    roles: ["superadmin", "admin"],
    summary: "Teste e ajuste a impressão térmica por método técnico da clínica.",
    servesFor: "Garantir emissão de ticket sem falhas operacionais.",
    prerequisites: ["Acesso admin", "Impressora disponível"],
    screenOverview: ["Senha de teste", "Preview do ticket", "Diagnóstico e calibração"],
    steps: [
      "Abra Impressora no menu",
      "Informe uma senha de teste",
      "Teste navegador/WebUSB/WebSerial",
      "Ajuste mensagens e tamanho de papel",
    ],
    practicalExample:
      "Antes da abertura da unidade, validar impressão evita interrupções de atendimento.",
    commonErrors: ["Porta USB sem permissão", "Agente local offline"],
    fixes: ["Reautorizar dispositivo", "Validar endpoint local"],
    tips: ["Manter um teste rápido no checklist de abertura"],
    faqs: [
      {
        q: "Qual método usar primeiro?",
        a: "Navegador, depois evoluir para WebUSB/WebSerial/agente conforme infraestrutura.",
      },
    ],
    requiredPermissions: ["Perfil administrador"],
    relatedModules: ["Totem", "Recepção"],
  },
  {
    id: "recepcao",
    title: "Guia da Recepção",
    category: "Recepção",
    roles: ["admin", "receptionist", "attendant"],
    summary: "Organize guichês, chamadas e encaminhamento inicial de pacientes.",
    servesFor: "Conduzir o paciente da senha até o fluxo correto de atendimento.",
    prerequisites: ["Guichês ativos", "Fila funcionando"],
    screenOverview: ["Fila da recepção", "Ações de chamada", "Encaminhamento"],
    steps: [
      "Selecione o guichê",
      "Chame a próxima senha",
      "Vincule paciente quando necessário",
      "Encaminhe para atendimento/sala",
    ],
    practicalExample:
      "Senha prioritária é chamada primeiro e encaminhada para profissional disponível.",
    commonErrors: ["Paciente sem vínculo de cadastro", "Fila parada por falta de chamada"],
    fixes: ["Cadastrar paciente rápido", "Repetir chamada"],
    tips: ["Acompanhar tempo de espera no Dashboard durante o turno"],
    faqs: [
      {
        q: "Recepção pode finalizar atendimento médico?",
        a: "Não. A finalização clínica ocorre no módulo de Atendimento.",
      },
    ],
    requiredPermissions: ["Acesso à rota /recepcao"],
    relatedModules: ["Check-in", "Fila", "Chamada"],
  },
  {
    id: "multiempresa",
    title: "Como funciona o Multiempresa",
    category: "Segurança",
    roles: ["superadmin", "admin"],
    summary: "Entenda isolamento de dados, branding e configurações por clínica.",
    servesFor: "Garantir operação segura de múltiplas clínicas no mesmo produto.",
    prerequisites: ["Estrutura de clínicas configurada"],
    screenOverview: ["Identidade da clínica", "Permissões", "Dados segregados"],
    steps: [
      "Defina slug e branding da clínica",
      "Configure usuários e papéis",
      "Valide URLs públicas de totem e painel",
      "Revise auditoria e LGPD periodicamente",
    ],
    practicalExample:
      "Uma rede com várias unidades opera no mesmo ClinicFlow sem compartilhar pacientes.",
    commonErrors: ["Slug duplicado", "Usuário sem vínculo correto de clínica"],
    fixes: ["Ajustar slug único", "Revisar perfil/permissão do usuário"],
    tips: ["Padronize naming e branding por unidade para facilitar suporte"],
    faqs: [
      {
        q: "Um admin de clínica pode ver outra clínica?",
        a: "Não. Apenas superadmin tem visão global e troca de contexto.",
      },
    ],
    requiredPermissions: ["Administração da clínica ou superadmin"],
    relatedModules: ["Configurações", "Usuários e permissões", "Auditoria"],
  },
];

export const helpRouteMap: Record<string, string> = {
  "/dashboard": "dashboard",
  "/recepcao": "recepcao",
  "/checkin": "recepcao",
  "/fila": "recepcao",
  "/configuracoes": "totem-config",
  "/impressao": "impressora",
  "/ajuda": "dashboard",
};

export type PresentationSection = {
  id: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  highlight?: string;
};

export type ModuleShowcase = {
  id: string;
  name: string;
  summary: string;
  benefits: string[];
  practicalExample: string;
  expectedResult: string;
  image?: string;
  validation?: boolean;
};

export const commercialCover = {
  title: "Gestão de atendimento para clínicas, consultórios e centros médicos",
  subtitle:
    "Organização da recepção, redução de filas e atendimento em tempo real do totem ao relatório.",
};

export const problemSections: PresentationSection[] = [
  {
    id: "problems",
    title: "Problemas que o ClinicFlow resolve",
    bullets: [
      "Filas desorganizadas e sem priorização padronizada",
      "Dificuldade para acompanhar cada paciente",
      "Chamadas manuais com risco de erro",
      "Falta de indicadores para gestão",
      "Ausência de integração entre recepção, profissionais e painel",
      "Demora no atendimento e gargalos ocultos",
      "Dificuldade para organizar salas e escalas",
    ],
  },
  {
    id: "flow",
    title: "Visão geral do fluxo",
    bullets: [
      "Totem → retirada de senha",
      "Recepção → identificação e encaminhamento",
      "Fila → organização por prioridade e status",
      "Chamada → recepção e consultório",
      "Atendimento → início, transferência, finalização",
      "Relatório → indicadores e produtividade",
    ],
    highlight: "Atendimento organizado do início ao fim.",
  },
];

export const moduleShowcases: ModuleShowcase[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    summary: "Visão executiva em tempo real da operação da clínica.",
    benefits: ["Indicadores atualizados", "Gargalos visíveis", "Acompanhamento diário"],
    practicalExample:
      "O gestor identifica aumento no tempo de espera e redistribui equipe na recepção.",
    expectedResult: "Decisão rápida com base em dados operacionais.",
    image: "/presentation/dashboard.png",
  },
  {
    id: "totem",
    name: "Totem de autoatendimento",
    summary: "Paciente retira senha normal ou prioritária em tela touch da própria clínica.",
    benefits: ["Agilidade na chegada", "Menos fila física", "Identidade visual própria"],
    practicalExample: "Paciente retira senha e ticket já impresso para aguardar chamada.",
    expectedResult: "Recepção mais organizada e menor tempo de triagem.",
    image: "/presentation/totem.png",
  },
  {
    id: "impressao",
    name: "Impressão térmica",
    summary: "Configuração centralizada da impressão por navegador, WebUSB, WebSerial ou agente.",
    benefits: ["Flexibilidade técnica", "Teste rápido", "Fallback de impressão"],
    practicalExample: "Admin valida impressão no método da unidade antes da operação.",
    expectedResult: "Ticket consistente em qualquer unidade.",
    image: "/presentation/impressora.png",
  },
  {
    id: "recepcao",
    name: "Recepção e Guichês",
    summary: "Gestão dos 3 guichês com chamada, cadastro e encaminhamento de pacientes.",
    benefits: ["Triagem padronizada", "Menos retrabalho", "Tempo de espera monitorado"],
    practicalExample: "Recepção chama senha e envia paciente para fila do profissional correto.",
    expectedResult: "Fluxo contínuo sem perda de contexto.",
    image: "/presentation/recepcao.png",
  },
  {
    id: "atendimento",
    name: "Atendimento médico",
    summary: "Controle da fila do profissional com início, transferência e finalização.",
    benefits: ["Rastreabilidade", "Menos chamadas manuais", "Produtividade clínica"],
    practicalExample:
      "Médico inicia atendimento, transfere quando necessário e finaliza com histórico.",
    expectedResult: "Consultórios com fluxo previsível.",
    image: "/presentation/atendimento.png",
  },
  {
    id: "painel",
    name: "Painel de TV + Voz",
    summary:
      "Exibição pública de senha, guichê/sala e últimas chamadas com atualização em tempo real.",
    benefits: ["Comunicação clara", "Privacidade configurável", "Menos ruído na recepção"],
    practicalExample: "Senha chamada aparece no painel e voz anuncia o destino automaticamente.",
    expectedResult: "Experiência melhor para paciente e equipe.",
    image: "/presentation/painel-tv.png",
  },
  {
    id: "gestao",
    name: "Gestão da clínica",
    summary: "Relatórios, produtividade, faltas, cancelamentos e auditoria LGPD.",
    benefits: ["Conformidade", "Visão histórica", "Ajuste operacional"],
    practicalExample: "Admin exporta CSV de produtividade por período para reunião de gestão.",
    expectedResult: "Melhoria contínua da operação.",
    image: "/presentation/relatorios.png",
  },
  {
    id: "multiempresa",
    name: "Multiempresa",
    summary: "Cada clínica com identidade, usuários, pacientes e configurações isolados.",
    benefits: ["Segurança por clínica", "Escalabilidade", "Operação padronizada"],
    practicalExample: "Rede com múltiplas unidades operando no mesmo produto sem misturar dados.",
    expectedResult: "Expansão segura e sustentável.",
    image: "/presentation/multiempresa.png",
  },
];

export const benefits = [
  "Redução do tempo de espera",
  "Melhor experiência do paciente",
  "Organização da recepção",
  "Acompanhamento em tempo real",
  "Redução de chamadas manuais",
  "Gestão por indicadores",
  "Padronização do atendimento",
  "Escalabilidade multiempresa",
];

export const clubMedicoScenario = {
  title: "Cenário ilustrativo: ambiente Club Médico",
  details: [
    "7 salas",
    "3 guichês de recepção",
    "11 médicos",
    "Escala por turno",
    "Totem + Painel + Fila + Relatórios",
  ],
  disclaimer: "Ambiente de demonstração sem dados sensíveis e sem credenciais públicas.",
};

export const closing = {
  title: "Atendimento organizado do início ao fim.",
  summary:
    "ClinicFlow integra totem, recepção, atendimento, painel e gestão para clínicas de todos os portes.",
};

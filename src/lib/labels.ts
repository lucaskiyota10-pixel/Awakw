export const TASK_STATUS: [string, string][] = [
  ["TODO", "A fazer"],
  ["IN_PROGRESS", "Em andamento"],
  ["IN_REVIEW", "Em revisão"],
  ["AWAITING_APPROVAL", "Aguardando aprovação"],
  ["APPROVED", "Aprovado"],
  ["DONE", "Concluído"],
];
export const TASK_STATUS_LABEL = Object.fromEntries(TASK_STATUS) as Record<string, string>;

export const PRIORITY: [string, string][] = [
  ["LOW", "Baixa"],
  ["MEDIUM", "Média"],
  ["HIGH", "Alta"],
  ["URGENT", "Urgente"],
];
export const PRIORITY_LABEL = Object.fromEntries(PRIORITY) as Record<string, string>;

export const SECTORS = ["Planejamento", "Atendimento", "Criação", "Redação"];

export const PUB_STATUS: [string, string][] = [
  ["DRAFT", "Rascunho"],
  ["WRITING", "Redação"],
  ["CREATIVE", "Criação"],
  ["PLANNING_REVIEW", "Revisão Planejamento"],
  ["ACCOUNT_REVIEW", "Revisão Atendimento"],
  ["APPROVED", "Aprovado"],
  ["SCHEDULED", "Agendado (simulado)"],
];
export const PUB_STATUS_LABEL = Object.fromEntries(PUB_STATUS) as Record<string, string>;

export const PUB_TYPE: [string, string][] = [
  ["FEED", "Post"],
  ["CAROUSEL", "Carrossel"],
  ["REEL", "Reels"],
  ["STORY", "Story"],
];
export const PUB_TYPE_LABEL = Object.fromEntries(PUB_TYPE) as Record<string, string>;

export const JOURNEY = ["Descoberta", "Consideração", "Decisão", "Pós-compra", "Fidelização"];

export const CAMPAIGN_OBJECTIVES: [string, string][] = [
  ["AWARENESS", "Reconhecimento"],
  ["ENGAGEMENT", "Engajamento"],
  ["TRAFFIC", "Tráfego"],
  ["LEADS", "Contatos (leads)"],
  ["CONVERSION", "Conversão"],
  ["REMARKETING", "Remarketing"],
];
export const CAMPAIGN_OBJECTIVE_LABEL = Object.fromEntries(CAMPAIGN_OBJECTIVES) as Record<string, string>;

export const CAMPAIGN_STATUS: [string, string][] = [
  ["PLANNING", "Planejamento"],
  ["IN_REVIEW", "Em revisão"],
  ["APPROVED", "Aprovada"],
  ["RUNNING_SIM", "Em veiculação (simulada)"],
  ["FINISHED", "Encerrada"],
];
export const CAMPAIGN_STATUS_LABEL = Object.fromEntries(CAMPAIGN_STATUS) as Record<string, string>;

export const DECISION_STATUS: Record<string, string> = {
  PROPOSED: "Proposta",
  IN_DISCUSSION: "Em discussão",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
};

export const APPROVAL_STATUS: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  CHANGES_REQUESTED: "Ajustes solicitados",
};

export const REVIEW_STATUS: Record<string, string> = { DRAFT: "Rascunho", IN_REVIEW: "Em revisão", APPROVED: "Aprovado" };

export const TARGET_LABEL: Record<string, string> = {
  task: "Tarefa",
  decision: "Decisão",
  publication: "Publicação",
  scenario: "Cenário",
  document: "Documento",
  campaign: "Campanha",
  budget: "Verba",
};

export const ACTION_LABEL: Record<string, string> = {
  create: "criou",
  update: "editou",
  delete: "excluiu",
  move: "moveu",
  comment: "comentou",
  status: "alterou status",
  upload: "enviou arquivo",
  request_approval: "solicitou aprovação",
  approval_approved: "aprovou",
  approval_rejected: "reprovou",
  approval_changes_requested: "pediu ajustes",
  login: "entrou",
  invite: "convidou",
  restore: "restaurou versão",
  duplicate: "duplicou",
  export: "exportou",
  check: "marcou",
  uncheck: "desmarcou",
};

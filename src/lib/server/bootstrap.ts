import type { Prisma, PrismaClient } from "@prisma/client";
import { SUGGESTED_ALLOCATIONS, scaleTo } from "../budget";
import { addMonths } from "../sim/dates";
import { PROVISIONAL_LAUNCH } from "../sim/defaults";

export const SECTORS = ["Planejamento", "Atendimento", "Criação", "Redação"] as const;

export const AWAKE_BRIEFING = {
  client: "Awake Home Decor",
  alternateName: "Wake Home Decor",
  segment: "Comunicação visual, impressão e decoração de interiores",
  products: "Acessórios para paredes e esculturas de design personalizáveis",
  differentials: "Inovação, personalização, acabamento premium, materiais de qualidade e agilidade",
  audience: "B2C prioritário, perfil socioeconômico B+",
  ticket: "Ticket médio estimado R$ 300–400, podendo chegar a aproximadamente R$ 900",
  launch: "Primeira ou segunda semana de novembro de 2026 (data exata pendente)",
  objectives: "Vendas, reconhecimento de marca, valor percebido, presença digital e formação de públicos para remarketing",
  archetypes: "Explorador, Sábio e Governante",
  tone: "Confiante, moderno, inspirador, direto e sofisticado",
  history: "Não há histórico de mídia paga — não há desempenho real a reportar",
};

export { DEFAULT_BRAND } from "./bootstrap-shared";

const PIXEL_EVENTS = [
  ["PageView", "Carregamento de qualquer página", "—"],
  ["ViewContent", "Visualização de página de produto", "content_ids, content_type, value, currency"],
  ["AddToCart", "Clique em adicionar ao carrinho", "content_ids, value, currency"],
  ["InitiateCheckout", "Início do checkout", "value, currency, num_items"],
  ["Purchase", "Confirmação de pedido", "value, currency, content_ids, order_id"],
];

const DAILY = [
  "Verificar gasto diário vs. planejado",
  "Checar reprovações de anúncios",
  "Conferir disparo de eventos (Gerenciador de Eventos)",
  "Registrar anomalias de CPM/CTR",
  "Responder comentários e mensagens pendentes",
];

const LAUNCH = [
  "Confirmar nome oficial da marca (Awake × Wake)",
  "Confirmar data exata de lançamento",
  "Validar acesso ao Business Manager e conta de anúncios",
  "Validar Meta Pixel e API de Conversões com evidência",
  "Implementar banner de consentimento (LGPD)",
  "Padronizar UTMs de todas as peças",
  "Aprovar verba final com o cliente",
  "Aprovar peças com Atendimento",
  "Configurar públicos de remarketing",
  "Definir rotina de relatório semanal",
];

const DIAGNOSTIC: [string, string][] = [
  ["INSTAGRAM", "Perfil comercial configurado e vinculado ao Business Manager"],
  ["SITE", "Site no ar com páginas de produto"],
  ["ECOMMERCE", "Plataforma de e-commerce e meios de pagamento"],
  ["ACCESS", "Acessos de anunciante concedidos à equipe"],
  ["TOOLS", "Ferramentas de análise (GA4, Gerenciador de Eventos)"],
  ["OPERATION", "Capacidade de produção e prazos de entrega"],
];

type Tx = Prisma.TransactionClient | PrismaClient;

export async function bootstrapProject(tx: Tx, projectId: string, userId: string, opts: { awake?: boolean; launch?: string; budget?: number; brand?: string } = {}) {
  const budget = opts.budget && opts.budget > 0 ? opts.budget : 10000;
  const launch = opts.launch ?? PROVISIONAL_LAUNCH;
  await tx.channel.createMany({
    data: [
      { projectId, name: "geral", type: "GENERAL" },
      ...SECTORS.map((s) => ({ projectId, name: s.toLowerCase(), type: "SECTOR" as const, sector: s })),
    ],
  });
  await tx.milestone.createMany({
    data: [
      { projectId, title: "Lançamento", date: new Date(launch), kind: "LAUNCH", description: "Data provisória — confirmar com o cliente" },
      { projectId, title: "Fim do 1º mês", date: new Date(addMonths(launch, 1)), kind: "MONTH1" },
      { projectId, title: "Fim do 1º trimestre", date: new Date(addMonths(launch, 3)), kind: "QUARTER" },
      { projectId, title: "Fim do 1º semestre", date: new Date(addMonths(launch, 6)), kind: "SEMESTER" },
      { projectId, title: "1 ano de marca", date: new Date(addMonths(launch, 12)), kind: "YEAR" },
    ],
  });
  await tx.budgetPlan.create({
    data: {
      projectId,
      name: "Sugestão inicial 30/60/10 (não aprovada)",
      total: budget,
      allocations: scaleTo(budget, 10000, SUGGESTED_ALLOCATIONS) as unknown as Prisma.InputJsonValue,
      status: "PROPOSED",
      isSuggestion: true,
      note: "Sugestão inicial calculada sobre a verba do projeto. Requer aprovação.",
      authorId: userId,
    },
  });
  await tx.pixelEvent.createMany({
    data: PIXEL_EVENTS.map(([name, trigger, parameters], i) => ({
      projectId,
      name,
      trigger,
      parameters,
      consent: "Disparar somente após consentimento (LGPD)",
      dedup: "event_id idêntico no Pixel e na API de Conversões",
      testPlan: "Ferramenta de teste de eventos + pedido de teste",
      status: "PLANNED",
      order: i,
    })),
  });
  await tx.checklistItem.createMany({
    data: [
      ...DAILY.map((text, i) => ({ projectId, list: "DAILY", text, order: i })),
      ...LAUNCH.map((text, i) => ({ projectId, list: "LAUNCH", text, order: i })),
    ],
  });
  await tx.diagnosticItem.createMany({
    data: DIAGNOSTIC.map(([area, item]) => ({ projectId, area, item, status: "PENDING", notes: "Pendente de levantamento" })),
  });
  await tx.instagramProfile.create({
    data: {
      projectId,
      displayName: opts.awake ? "Awake Home Decor" : opts.brand || "Nova marca",
      username: opts.awake ? "awake.homedecor" : (opts.brand || "nova.marca").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._]/g, "").slice(0, 30) || "nova.marca",
      category: opts.awake ? "Decoração de interiores" : "",
      bio: opts.awake ? "Arte de parede e esculturas de design personalizáveis.\nAcabamento premium. Feito para você." : "",
      link: "",
    },
  });
}

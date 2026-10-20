/**
 * Seed DEMONSTRATIVO — identificado como tal (isDemo = true em usuários e projeto).
 * Não contém desempenho real: apenas estrutura de planejamento, premissas-hipótese e rascunhos.
 * Senha dos usuários demo: variável SEED_DEMO_PASSWORD (obrigatória).
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AWAKE_BRIEFING, bootstrapProject, DEFAULT_BRAND } from "../src/lib/server/bootstrap";
import { defaultGrowth, defaultGrowthSources, defaultMetrics, defaultMetricsSources } from "../src/lib/sim/defaults";

const prisma = new PrismaClient();

const TEAM: { key: string; name: string; nickname?: string; sector: string; resp: string; role: "ADMIN" | "COORDINATOR" | "MEMBER" | "VIEWER" }[] = [
  { key: "juh", name: "Jhiulyana", nickname: "Juh", sector: "Planejamento", resp: "Estratégia, objetivos, público e jornada", role: "COORDINATOR" },
  { key: "isabely", name: "Isabely", sector: "Planejamento", resp: "Plano de mídia, formatos, públicos, verba e testes", role: "MEMBER" },
  { key: "lucas", name: "Lucas", sector: "Planejamento", resp: "Mensuração, Pixel/API, UTMs, KPIs, relatórios e checklist", role: "ADMIN" },
  { key: "gustavo", name: "Gustavo", sector: "Atendimento", resp: "Relacionamento e aprovações", role: "COORDINATOR" },
  { key: "nicole", name: "Nicole", sector: "Atendimento", resp: "Demandas, feedbacks e prazos", role: "MEMBER" },
  { key: "danielle", name: "Danielle", sector: "Criação", resp: "Direção de arte", role: "MEMBER" },
  { key: "vitoria", name: "Vitória", sector: "Criação", resp: "Peças estáticas", role: "MEMBER" },
  { key: "beatriz", name: "Beatriz", sector: "Criação", resp: "Vídeos e Reels", role: "MEMBER" },
  { key: "gabriella", name: "Gabriella", sector: "Criação", resp: "Adaptações criativas", role: "MEMBER" },
  { key: "leticia", name: "Letícia", sector: "Redação", resp: "Slogans, legendas, anúncios, CTAs e roteiros", role: "MEMBER" },
  { key: "professor", name: "Professor(a) Orientador(a)", sector: "Banca", resp: "Acompanhamento (somente leitura e comentários)", role: "VIEWER" },
];

async function main() {
  const pw = process.env.SEED_DEMO_PASSWORD;
  if (!pw || pw.length < 10) throw new Error("Defina SEED_DEMO_PASSWORD (mín. 10 caracteres) no .env para semear usuários demonstrativos.");
  if (await prisma.project.findFirst({ where: { isDemo: true } })) {
    console.log("Seed demonstrativo já aplicado — nada a fazer. Use `npm run db:reset` para recriar.");
    return;
  }
  const hash = await bcrypt.hash(pw, 12);
  const agency = await prisma.agency.create({ data: { name: "Agência Experimental (demonstração)" } });
  const ids: Record<string, string> = {};
  for (const t of TEAM) {
    const email = `${t.key}@awake.demo`;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: t.name, nickname: t.nickname ?? null, passwordHash: hash, isDemo: true },
    });
    ids[t.key] = u.id;
    await prisma.membership.create({ data: { userId: u.id, agencyId: agency.id, role: t.role, sector: t.sector, responsibilities: t.resp } });
  }

  const project = await prisma.project.create({
    data: {
      agencyId: agency.id,
      name: "Awake Home Decor",
      alternateName: "Wake Home Decor",
      officialNameConfirmed: false,
      segment: AWAKE_BRIEFING.segment,
      launchDate: new Date("2026-11-09"),
      launchDateConfirmed: false,
      briefing: AWAKE_BRIEFING as Prisma.InputJsonValue,
      brand: DEFAULT_BRAND as Prisma.InputJsonValue,
      academic: { cidade: "", ano: "2026" } as Prisma.InputJsonValue,
      isDemo: true,
    },
  });
  const P = project.id;
  await bootstrapProject(prisma, P, ids.lucas, { awake: true });

  const day = (d: string) => new Date(d);
  const tasks: Prisma.TaskCreateManyInput[] = [
    { title: "Confirmar nome oficial (Awake × Wake)", sector: "Atendimento", assigneeId: ids.gustavo, status: "IN_PROGRESS", priority: "URGENT", dueDate: day("2026-10-24") },
    { title: "Confirmar data exata de lançamento", sector: "Atendimento", assigneeId: ids.nicole, status: "TODO", priority: "HIGH", dueDate: day("2026-10-27") },
    { title: "Definir personas e jornada de compra", sector: "Planejamento", assigneeId: ids.juh, status: "IN_PROGRESS", priority: "HIGH", dueDate: day("2026-10-28") },
    { title: "Plano de mídia e distribuição de verba", sector: "Planejamento", assigneeId: ids.isabely, status: "IN_REVIEW", priority: "HIGH", dueDate: day("2026-10-30") },
    { title: "Plano de mensuração + checklist Pixel/API", sector: "Planejamento", assigneeId: ids.lucas, status: "IN_PROGRESS", priority: "HIGH", dueDate: day("2026-10-31") },
    { title: "Moodboard e direção de arte Quiet Luxury", sector: "Criação", assigneeId: ids.danielle, status: "AWAITING_APPROVAL", priority: "MEDIUM", dueDate: day("2026-10-26") },
    { title: "Peças estáticas de lançamento (feed)", sector: "Criação", assigneeId: ids.vitoria, status: "TODO", priority: "MEDIUM", dueDate: day("2026-11-04") },
    { title: "Roteiro e edição de Reels de lançamento", sector: "Criação", assigneeId: ids.beatriz, status: "TODO", priority: "MEDIUM", dueDate: day("2026-11-05") },
    { title: "Adaptações para Stories e formatos de anúncio", sector: "Criação", assigneeId: ids.gabriella, status: "TODO", priority: "LOW", dueDate: day("2026-11-06") },
    { title: "Slogans, legendas e CTAs de lançamento", sector: "Redação", assigneeId: ids.leticia, status: "IN_PROGRESS", priority: "HIGH", dueDate: day("2026-10-29") },
  ].map((t, i) => ({
    ...t,
    projectId: P,
    createdById: ids.juh,
    order: i,
    checklist: [] as Prisma.InputJsonValue,
    description: "Tarefa demonstrativa do seed.",
  })) as Prisma.TaskCreateManyInput[];
  await prisma.task.createMany({ data: tasks });

  await prisma.decision.createMany({
    data: [
      { projectId: P, title: "Nome oficial da marca", proposal: "O briefing apresenta 'Awake Home Decor' e 'Wake Home Decor'. Propomos confirmar com o cliente antes de emitir documentos e peças finais.", responsibleIds: [ids.gustavo, ids.juh], createdById: ids.juh, status: "IN_DISCUSSION" },
      { projectId: P, title: "Uso da cor 'rosa modernidade'", proposal: "O briefing menciona 'rosa modernidade'. Disponibilizar como opção visual configurável, sem tratá-la como cor oficial aprovada.", responsibleIds: [ids.danielle], createdById: ids.danielle, status: "PROPOSED" },
    ],
  });

  const scen = (name: string, level: "CONSERVATIVE" | "MODERATE" | "OPTIMISTIC") =>
    prisma.scenario.create({
      data: {
        projectId: P,
        kind: "GROWTH",
        level,
        name,
        premises: { values: defaultGrowth(level), sources: defaultGrowthSources() } as unknown as Prisma.InputJsonValue,
        authorId: ids.isabely,
      },
    });
  await scen("Growth — Conservador (R$ 10 mil único)", "CONSERVATIVE");
  await scen("Growth — Moderado (R$ 10 mil único)", "MODERATE");
  await scen("Growth — Otimista (R$ 10 mil único)", "OPTIMISTIC");
  for (const level of ["CONSERVATIVE", "MODERATE", "OPTIMISTIC"] as const) {
    await prisma.scenario.create({
      data: {
        projectId: P,
        kind: "METRICS",
        level,
        name: `Métricas — ${level === "CONSERVATIVE" ? "Conservador" : level === "MODERATE" ? "Moderado" : "Otimista"}`,
        premises: { values: defaultMetrics(level), sources: defaultMetricsSources() } as unknown as Prisma.InputJsonValue,
        authorId: ids.isabely,
      },
    });
  }

  await prisma.swotItem.createMany({
    data: [
      { projectId: P, quadrant: "S", text: "Produtos personalizáveis com acabamento premium", basis: "HYPOTHESIS", source: "Briefing do cliente (declaração a validar)" },
      { projectId: P, quadrant: "S", text: "Agilidade de produção", basis: "HYPOTHESIS", source: "Briefing do cliente (declaração a validar)" },
      { projectId: P, quadrant: "W", text: "Marca nova, sem histórico de mídia paga ou base de clientes digital", basis: "EVIDENCE", source: "Briefing" },
      { projectId: P, quadrant: "O", text: "Datas sazonais de fim de ano próximas ao lançamento", basis: "HYPOTHESIS", source: "Pendente de pesquisa" },
      { projectId: P, quadrant: "T", text: "Concorrência de marketplaces com preços baixos", basis: "HYPOTHESIS", source: "Pendente de pesquisa de mercado" },
    ],
  });

  const campaign = await prisma.campaign.create({
    data: {
      projectId: P,
      name: "Lançamento Awake — Novembro/2026",
      objective: "CONVERSION",
      audience: "B2C, B+, interessados em decoração de interiores e design",
      positioning: "Arte de parede e esculturas de design, personalizáveis e premium",
      message: "Sua parede, sua assinatura.",
      products: "Acessórios para paredes; esculturas de design",
      channels: "Instagram, Facebook (Meta Ads)",
      formats: "Reels, carrossel, stories, feed",
      budget: 10000,
      startDate: day("2026-11-09"),
      endDate: day("2027-02-07"),
      kpis: "Compras, CPA, ROAS, alcance, seguidores",
      responsibleIds: [ids.isabely, ids.juh],
      status: "PLANNING",
      abTests: [
        { id: "ab1", variable: "CREATIVE", hypothesis: "Reels de processo de produção geram mais cliques que foto estática do produto", a: { label: "Foto estática", ctr: 0.01, conversionRate: 0.02 }, b: { label: "Reels de processo", ctr: 0.014, conversionRate: 0.02 }, metric: "CTR" },
      ] as Prisma.InputJsonValue,
      createdById: ids.isabely,
    },
  });

  const pubs = [
    { type: "REEL", title: "Teaser de lançamento", caption: "Algo novo vai despertar nas suas paredes.", hashtags: "#awakehomedecor #decoracao #design", cta: "Ative o lembrete", coverColor: "#252521", scheduledAt: day("2026-11-05T19:00:00Z"), journeyStage: "Descoberta", objective: "Reconhecimento" },
    { type: "CAROUSEL", title: "Coleção de lançamento", caption: "Peças de design, acabamento premium e o seu toque pessoal.", hashtags: "#arteparaparede #homedecor", cta: "Conheça a coleção", coverColor: "#B6A18B", scheduledAt: day("2026-11-09T18:00:00Z"), journeyStage: "Consideração", objective: "Tráfego" },
    { type: "FEED", title: "Manifesto da marca", caption: "Para quem explora, aprende e assina o próprio espaço.", hashtags: "#awake", cta: "Saiba mais no link da bio", coverColor: "#E9E2D8", scheduledAt: day("2026-11-10T18:00:00Z"), journeyStage: "Descoberta", objective: "Reconhecimento" },
    { type: "STORY", title: "Bastidores do acabamento", caption: "Do material ao detalhe final.", hashtags: "", cta: "Responda a caixinha", coverColor: "#8C7A66", scheduledAt: day("2026-11-11T15:00:00Z"), journeyStage: "Consideração", objective: "Engajamento" },
  ] as const;
  let i = 0;
  for (const p of pubs) {
    await prisma.publication.create({
      data: { ...p, projectId: P, campaignId: campaign.id, responsibleId: ids.leticia, createdById: ids.leticia, feedOrder: i++, status: "WRITING", product: "Coleção de lançamento" },
    });
  }
  await prisma.highlight.createMany({
    data: ["Coleção", "Personalize", "Bastidores", "Dúvidas"].map((title, i) => ({ projectId: P, title, order: i, coverColor: ["#252521", "#B6A18B", "#E9E2D8", "#8C7A66"][i] })),
  });
  await prisma.measurementItem.createMany({
    data: [
      { projectId: P, objective: "Vendas", event: "Purchase (valor, moeda)", responsible: "Lucas", status: "PLANNED" },
      { projectId: P, objective: "Remarketing", event: "ViewContent / AddToCart", responsible: "Lucas", status: "PLANNED" },
      { projectId: P, objective: "Reconhecimento", event: "Alcance e frequência (Gerenciador de Anúncios)", responsible: "Isabely", status: "PLANNED" },
    ],
  });
  console.log(`Seed concluído. Projeto ${P}. Usuários: <nome>@awake.demo (ex.: lucas@awake.demo) com a senha de SEED_DEMO_PASSWORD.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

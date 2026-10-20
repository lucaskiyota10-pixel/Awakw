import "server-only";
import { prisma } from "./db";
import { projectMembers } from "./access";
import { contributions } from "./contributions";
import { referenceGrowthScenario } from "./scenarios";
import { aggregate, cumulative } from "../sim/aggregate";
import { simulateMetrics } from "../sim/metrics";
import { simulateGrowth } from "../sim/growth";
import { readGrowth, readMetrics } from "../sim/scenario";
import { ORIGINS, SIM_DISCLAIMER, type SourceMap } from "../sim/origin";
import { LEVEL_LABEL } from "../sim/defaults";
import { PENDING } from "../docs/markdown";
import { CAMPAIGN_OBJECTIVE_LABEL, CAMPAIGN_STATUS_LABEL, PUB_STATUS_LABEL, PUB_TYPE_LABEL, TASK_STATUS_LABEL, DECISION_STATUS } from "../labels";
import { brl, num, pct } from "../format";

export const DOC_KINDS: [string, string][] = [
  ["FINAL", "Relatório final consolidado"],
  ["STRATEGIC", "Planejamento estratégico"],
  ["SWOT", "Análise SWOT"],
  ["MARKET", "Pesquisa de mercado e concorrentes"],
  ["AUDIENCE", "Público e jornada"],
  ["MEDIA", "Plano de mídia"],
  ["CAMPAIGN", "Planejamento de campanha"],
  ["EDITORIAL", "Calendário editorial"],
  ["MEASUREMENT", "Plano de mensuração e KPIs"],
  ["SIMULATIONS", "Simulações financeiras e projeções"],
  ["MINUTES", "Ata de reunião"],
  ["INDIVIDUAL", "Relatório individual"],
  ["FREE", "Documento livre"],
];

const P = `**${PENDING}**`;
const cellEsc = (s: unknown) => String(s ?? "—").replace(/\|/g, "/").replace(/\n+/g, " ").trim() || "—";
export function mdTable(header: string[], rows: unknown[][]) {
  if (!rows.length) return `${P} (sem registros)\n`;
  return [`| ${header.map(cellEsc).join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(cellEsc).join(" | ")} |`)].join("\n") + "\n";
}
const or = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? P : String(v));
const date = (d: Date | null | undefined) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");

async function load(projectId: string) {
  const [project, members, tasks, decisions, competitors, swot, campaigns, budgets, pubs, measurement, pixel, milestones, scenarios, entries, references] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    projectMembers(projectId),
    prisma.task.findMany({ where: { projectId }, orderBy: { dueDate: "asc" } }),
    prisma.decision.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.competitor.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    prisma.swotItem.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.campaign.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.budgetPlan.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.publication.findMany({ where: { projectId }, orderBy: { scheduledAt: "asc" } }),
    prisma.measurementItem.findMany({ where: { projectId } }),
    prisma.pixelEvent.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.milestone.findMany({ where: { projectId }, orderBy: { date: "asc" } }),
    prisma.scenario.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.metricEntry.findMany({ where: { projectId }, orderBy: { date: "asc" } }),
    prisma.reference.findMany({ where: { projectId } }),
  ]);
  return { project, members, tasks, decisions, competitors, swot, campaigns, budgets, pubs, measurement, pixel, milestones, scenarios, entries, references, briefing: (project.briefing ?? {}) as Record<string, string> };
}
type Data = Awaited<ReturnType<typeof load>>;
const name = (d: Data, id: string | null | undefined) => d.members.find((m) => m.id === id)?.name ?? "—";

function intro(d: Data) {
  return `# Introdução

${P} — apresentar o contexto do trabalho, o problema de comunicação, os objetivos e a estrutura do documento.

Este documento foi gerado a partir dos dados registrados pela equipe na plataforma Campaign Forge para o cliente **${d.project.name}**${d.project.alternateName && !d.project.officialNameConfirmed ? ` (o briefing também apresenta a grafia "${d.project.alternateName}"; nome oficial pendente de confirmação)` : ""}. Números de simulação são hipotéticos: ${SIM_DISCLAIMER}
`;
}

function context(d: Data) {
  const b = d.briefing;
  return `# Contexto e briefing

## Cliente
${mdTable(["Item", "Informação"], [
    ["Cliente", d.project.name + (d.project.officialNameConfirmed ? "" : " (nome oficial pendente)")],
    ["Segmento", or(d.project.segment)],
    ["Produtos", or(b.products)],
    ["Diferenciais", or(b.differentials)],
    ["Público prioritário", or(b.audience)],
    ["Ticket médio", or(b.ticket)],
    ["Lançamento", d.project.launchDate ? `${date(d.project.launchDate)} ${d.project.launchDateConfirmed ? "(confirmado)" : "(provisório)"}` : or(b.launch)],
    ["Histórico de mídia", or(b.history)],
  ])}
## Objetivos de comunicação
${or(b.objectives)}

## Posicionamento, arquétipos e tom de voz
- Arquétipos: ${or(b.archetypes)}
- Tom de voz: ${or(b.tone)}
`;
}

function audience(d: Data) {
  return `# Público e jornada

## Público-alvo
${or(d.briefing.audience)}

## Personas
${P} — descrever personas com base em pesquisa (dados demográficos, comportamentais e motivações), citando as fontes.

## Jornada de compra
${mdTable(["Etapa", "Objetivo", "Publicações planejadas"], ["Descoberta", "Consideração", "Decisão", "Pós-compra", "Fidelização"].map((s) => [s, P, d.pubs.filter((p) => p.journeyStage === s).map((p) => p.title).join("; ") || "—"]))}`;
}

function market(d: Data) {
  return `# Pesquisa de mercado e concorrentes

${d.competitors.length ? "Dados observados pela equipe, com fonte e data de observação." : `${P} — nenhum concorrente registrado.`}

${mdTable(["Concorrente", "Posicionamento", "Preços observados", "Diferenciais", "Fonte", "Data"], d.competitors.map((c) => [c.name, c.positioning, c.observedPrices, c.differentials, c.sources ?? P, date(c.observedAt)]))}`;
}

function swotSection(d: Data) {
  const q = (k: string) => d.swot.filter((s) => s.quadrant === k).map((s) => `${s.text} (${s.basis === "EVIDENCE" ? "evidência" : "hipótese"}${s.source ? `; fonte: ${s.source}` : ""})`);
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : P);
  return `# Análise SWOT

Fatores internos (forças e fraquezas) e externos (oportunidades e ameaças). Cada item indica se é evidência ou hipótese.

## Forças
${list(q("S"))}

## Fraquezas
${list(q("W"))}

## Oportunidades
${list(q("O"))}

## Ameaças
${list(q("T"))}
`;
}

function campaignsSection(d: Data) {
  if (!d.campaigns.length) return `# Planejamento de campanha\n\n${P}\n`;
  return `# Planejamento de campanha

${d.campaigns
  .map(
    (c) => `## ${c.name}
${mdTable(["Item", "Definição"], [
      ["Objetivo", CAMPAIGN_OBJECTIVE_LABEL[c.objective]],
      ["Status", CAMPAIGN_STATUS_LABEL[c.status]],
      ["Público", or(c.audience)],
      ["Segmentação", or(c.segmentation)],
      ["Posicionamento", or(c.positioning)],
      ["Mensagem", or(c.message)],
      ["Produtos", or(c.products)],
      ["Canais e formatos", `${or(c.channels)} · ${or(c.formats)}`],
      ["Orçamento planejado", c.budget ? brl(c.budget, 0) : P],
      ["Cronograma", c.startDate ? `${date(c.startDate)} a ${date(c.endDate)}` : P],
      ["KPIs", or(c.kpis)],
      ["Responsáveis", c.responsibleIds.map((id) => name(d, id)).join(", ") || P],
    ])}
${((c.abTests ?? []) as { variable: string; hypothesis: string; a: { label: string; ctr: number }; b: { label: string; ctr: number } }[]).length ? `**Testes A/B simulados (hipóteses):**\n\n${mdTable(["Variável", "Hipótese", "A", "B"], ((c.abTests ?? []) as { variable: string; hypothesis: string; a: { label: string; ctr: number }; b: { label: string; ctr: number } }[]).map((t) => [t.variable, t.hypothesis, `${t.a.label} (CTR ${pct(t.a.ctr, 2)})`, `${t.b.label} (CTR ${pct(t.b.ctr, 2)})`]))}` : ""}`,
  )
  .join("\n")}`;
}

function mediaSection(d: Data) {
  const approved = d.budgets.find((b) => b.status === "APPROVED");
  const proposed = [...d.budgets].reverse().find((b) => b.status === "PROPOSED");
  const plan = approved ?? proposed;
  const al = (plan?.allocations ?? []) as unknown as { label: string; amount: number }[];
  return `# Plano de mídia

## Distribuição de verba
${plan ? `Plano: **${plan.name}** — ${approved ? "verba APROVADA" : "proposta NÃO aprovada"} — total ${brl(plan.total, 0)}.\n\n${mdTable(["Linha", "Valor", "%"], al.map((a) => [a.label, brl(a.amount, 0), pct(plan.total ? a.amount / plan.total : 0)]))}\n![Distribuição da verba](chart:budget-allocation)` : P}

## Campanhas, formatos e públicos
${mdTable(["Campanha", "Objetivo", "Formatos", "Público", "Orçamento"], d.campaigns.map((c) => [c.name, CAMPAIGN_OBJECTIVE_LABEL[c.objective], c.formats, c.audience, c.budget ? brl(c.budget, 0) : "—"]))}`;
}

function editorialSection(d: Data) {
  return `# Calendário editorial

${mdTable(["Data", "Formato", "Título", "Objetivo", "Jornada", "Responsável", "Status"], d.pubs.map((p) => [p.scheduledAt ? p.scheduledAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—", PUB_TYPE_LABEL[p.type], p.title, p.objective, p.journeyStage, name(d, p.responsibleId), PUB_STATUS_LABEL[p.status] ?? p.status]))}
> Perfil e publicações simulados no Instagram Studio (perfil fictício); curtidas, comentários e visualizações são hipotéticos.
`;
}

function measurementSection(d: Data) {
  const pixelStatus: Record<string, string> = { PLANNED: "Planejado", IMPLEMENTED_UNVALIDATED: "Implementado — não validado", VALIDATED: "Validado" };
  const t = d.entries.reduce((a, e) => ({ spend: a.spend + (e.spend ?? 0), imp: a.imp + (e.impressions ?? 0), clicks: a.clicks + (e.clicks ?? 0), conv: a.conv + (e.conversions ?? 0), rev: a.rev + (e.revenue ?? 0) }), { spend: 0, imp: 0, clicks: 0, conv: 0, rev: 0 });
  return `# Plano de mensuração e KPIs

## Objetivos e eventos
${mdTable(["Objetivo", "Evento/métrica", "Responsável", "Status", "Evidência"], d.measurement.map((m) => [m.objective, m.event, m.responsible, m.status, m.evidence ?? "—"]))}
## Meta Pixel e API de Conversões
Nenhuma integração é declarada ativa sem validação real com evidência.

${mdTable(["Evento", "Gatilho", "Consentimento", "Deduplicação", "Status", "Evidência"], d.pixel.map((p) => [p.name, p.trigger, p.consent, p.dedup, pixelStatus[p.status] ?? p.status, p.evidence ?? "—"]))}
## KPIs
${mdTable(["KPI", "Definição"], [["CTR", "cliques ÷ impressões"], ["CPC", "investimento ÷ cliques"], ["CPM", "investimento ÷ impressões × 1000"], ["CPA", "investimento ÷ compras"], ["ROAS", "receita ÷ investimento"]])}
## Resultados reais registrados
${d.entries.length ? mdTable(["Investimento", "Impressões", "CTR", "CPC", "Conversões", "CPA", "Receita", "ROAS"], [[brl(t.spend), num(t.imp), pct(t.imp ? t.clicks / t.imp : null, 2), brl(t.clicks ? t.spend / t.clicks : null), num(t.conv), brl(t.conv ? t.spend / t.conv : null), brl(t.rev), num(t.spend ? t.rev / t.spend : null, 2)]]) : "Não há dados reais de veiculação registrados até o momento (a marca não possui histórico de mídia paga)."}
`;
}

function sourcesTable(values: Record<string, unknown>, sources: SourceMap) {
  const rows = Object.entries(sources).map(([k, s]) => [k, typeof values[k] === "number" ? num(values[k] as number, 4) : String(values[k] ?? "—"), ORIGINS[s.origin], s.note ?? "—"]);
  return mdTable(["Premissa", "Valor", "Origem", "Nota/referência"], rows);
}

async function simulationsSection(d: Data) {
  const metrics = d.scenarios.filter((s) => s.kind === "METRICS");
  const growth = d.scenarios.filter((s) => s.kind === "GROWTH");
  const ref = await referenceGrowthScenario(d.project.id);
  let out = `# Simulações financeiras e projeções

> ${SIM_DISCLAIMER}

## Simulador de métricas — comparação de cenários
${mdTable(["Cenário", "Nível", "Status", "Investimento", "Impressões", "Cliques", "Compras", "Receita", "CPA", "ROAS"], metrics.map((s) => {
    const r = simulateMetrics(readMetrics(s.premises).values);
    return r.ok && r.total ? [s.name, LEVEL_LABEL[s.level], s.status, brl(r.total.budget, 0), num(r.total.impressions), num(r.total.clicks), num(r.total.purchases, 1), brl(r.total.revenue, 0), brl(r.total.cpa), num(r.total.roas, 2)] : [s.name, LEVEL_LABEL[s.level], s.status, "inválido", "", "", "", "", "", ""];
  }))}
![Receita por campanha](chart:metrics-campaigns-revenue)

## Growth Simulator — cenários
${mdTable(["Cenário", "Nível", "Status", "Modo de orçamento", "Investimento", "Seguidores (fim)", "Compras", "Receita", "ROAS"], growth.map((s) => {
    const v = readGrowth(s.premises).values;
    const r = simulateGrowth(v);
    if (!r.ok) return [s.name, LEVEL_LABEL[s.level], s.status, "—", "inválido", "", "", "", ""];
    const tot = r.days.reduce((a, x) => ({ p: a.p + x.purchases, rev: a.rev + x.revenue }), { p: 0, rev: 0 });
    return [s.name, LEVEL_LABEL[s.level], s.status, v.budgetMode === "ONE_TIME" ? "Único" : "Mensal recorrente", brl(r.totalInvestment, 0), num(r.days.at(-1)?.followers ?? 0), num(tot.p, 1), brl(tot.rev, 0), num(r.totalInvestment ? tot.rev / r.totalInvestment : null, 2)];
  }))}
![Receita total por cenário](chart:scenarios-revenue)
`;
  if (ref && ref.result.ok) {
    const R = ref.result;
    const row = (r: ReturnType<typeof aggregate>[number]) => [r.label, brl(r.budget, 0), num(r.impressions), num(r.clicks), num(r.followers), num(r.purchases, 1), brl(r.revenue, 0), brl(r.cpa), num(r.roas, 2)];
    const H = ["Período", "Investimento", "Impressões", "Cliques", "Seguidores", "Compras", "Receita", "CPA", "ROAS"];
    out += `
## Projeções do cenário de referência: ${ref.scenario.name}
${R.investmentExplanation}

### Projeção semanal (12 primeiras semanas)
${mdTable(H, aggregate(R.days, ref.values.startDate, R.endDate, "WEEK").slice(0, 12).map(row))}
### Projeção mensal
${mdTable(H, aggregate(R.days, ref.values.startDate, R.endDate, "MONTH").map(row))}
![Receita hipotética por mês](chart:growth-monthly-revenue)

### Projeção trimestral
${mdTable(H, aggregate(R.days, ref.values.startDate, R.endDate, "QUARTER").map(row))}
### Projeção anual (acumulado)
${mdTable(H, cumulative(aggregate(R.days, ref.values.startDate, R.endDate, "YEAR")).map(row))}
### Premissas e origem dos números
${sourcesTable(ref.values as unknown as Record<string, unknown>, ref.sources)}
Demais números das tabelas são cálculos do modelo a partir dessas premissas.
`;
  }
  return out;
}

function timelineSection(d: Data) {
  return `# Linha do tempo estratégica

${mdTable(["Marco", "Data", "Descrição"], d.milestones.map((m) => [m.title, date(m.date), m.description ?? "—"]))}`;
}

function conclusion() {
  return `# Considerações finais

${P} — sintetizar aprendizados, recomendações e próximos passos. Não apresentar resultados simulados como resultados reais.
`;
}

function minutes(d: Data) {
  const open = d.tasks.filter((t) => t.status !== "DONE" && t.status !== "APPROVED");
  return `# Ata de reunião

${mdTable(["Item", "Registro"], [["Data", P], ["Local/plataforma", P], ["Participantes", d.members.map((m) => m.name).join(", ")], ["Redator(a)", P]])}
## Pauta
${P}

## Decisões registradas
${mdTable(["Decisão", "Status", "Responsáveis", "Decidida em"], d.decisions.map((x) => [x.title, DECISION_STATUS[x.status], x.responsibleIds.map((id) => name(d, id)).join(", "), date(x.decidedAt)]))}
## Encaminhamentos (tarefas em aberto)
${mdTable(["Tarefa", "Responsável", "Prazo", "Status"], open.map((t) => [t.title, name(d, t.assigneeId), date(t.dueDate), TASK_STATUS_LABEL[t.status]]))}`;
}

async function individual(d: Data, memberId?: string) {
  const all = await contributions(d.project.id);
  const c = all.find((x) => x.id === memberId) ?? all[0];
  if (!c) return `# Relatório individual\n\n${P}\n`;
  const mine = d.tasks.filter((t) => t.assigneeId === c.id);
  return `# Relatório individual — ${c.name}

## Função e responsabilidades
- Setor: ${or(c.sector)}
- Responsabilidades: ${or(c.responsibilities)}

## Atividades realizadas
${mdTable(["Tarefa", "Status", "Prazo"], mine.map((t) => [t.title, TASK_STATUS_LABEL[t.status], date(t.dueDate)]))}
## Contribuições registradas na plataforma
${mdTable(["Indicador", "Quantidade"], [["Versões de documentos", c.docVersions], ["Caracteres adicionados/removidos", `${num(c.charsAdded)} / ${num(c.charsRemoved)}`], ["Sugestões (aceitas)", `${c.suggestions} (${c.suggestionsAccepted})`], ["Comentários", c.comments], ["Mensagens no chat", c.messages], ["Tarefas concluídas/atribuídas", `${c.tasksDone}/${c.tasksAssigned}`], ["Publicações criadas", c.publications], ["Ações registradas (auditoria)", c.actions]])}
## Reflexão individual
${P} — aprendizados, dificuldades e contribuição para o resultado do grupo.
`;
}

async function contributionsSection(d: Data) {
  const all = await contributions(d.project.id);
  return `# Contribuições individuais

${mdTable(["Integrante", "Setor", "Versões de docs", "Comentários", "Mensagens", "Tarefas concluídas"], all.map((c) => [c.name, c.sector, c.docVersions, c.comments, c.messages, `${c.tasksDone}/${c.tasksAssigned}`]))}`;
}

/** Gera o conteúdo (Markdown) de um documento acadêmico a partir dos dados reais do projeto. */
export async function generateDocument(projectId: string, kind: string, opts: { memberId?: string } = {}): Promise<{ title: string; content: string }> {
  const d = await load(projectId);
  const label = DOC_KINDS.find((k) => k[0] === kind)?.[1] ?? "Documento";
  const title = `${label} — ${d.project.name}`;
  const parts: string[] = [];
  switch (kind) {
    case "STRATEGIC":
      parts.push(intro(d), context(d), audience(d), swotSection(d), campaignsSection(d), timelineSection(d), conclusion());
      break;
    case "SWOT":
      parts.push(swotSection(d));
      break;
    case "MARKET":
      parts.push(market(d));
      break;
    case "AUDIENCE":
      parts.push(audience(d));
      break;
    case "MEDIA":
      parts.push(mediaSection(d));
      break;
    case "CAMPAIGN":
      parts.push(campaignsSection(d));
      break;
    case "EDITORIAL":
      parts.push(editorialSection(d));
      break;
    case "MEASUREMENT":
      parts.push(measurementSection(d));
      break;
    case "SIMULATIONS":
      parts.push(await simulationsSection(d));
      break;
    case "MINUTES":
      parts.push(minutes(d));
      break;
    case "INDIVIDUAL":
      parts.push(await individual(d, opts.memberId));
      break;
    case "FINAL":
      parts.push(intro(d), context(d), audience(d), market(d), swotSection(d), campaignsSection(d), mediaSection(d), editorialSection(d), measurementSection(d), await simulationsSection(d), timelineSection(d), await contributionsSection(d), conclusion());
      break;
    default:
      parts.push(`# Introdução\n\n${P}\n`);
  }
  return { title, content: parts.join("\n") };
}

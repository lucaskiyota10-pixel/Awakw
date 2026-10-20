import "server-only";
import { prisma } from "./db";
import { projectMembers } from "./access";
import { referenceGrowthScenario } from "./scenarios";
import { aggregate } from "../sim/aggregate";
import { simulateGrowth } from "../sim/growth";
import { readGrowth } from "../sim/scenario";
import { LEVEL_LABEL } from "../sim/defaults";
import { brandOf } from "../brand";
import { parseMarkdown, plain, PENDING } from "../docs/markdown";
import { CAMPAIGN_OBJECTIVE_LABEL, PUB_TYPE_LABEL, PUB_STATUS_LABEL } from "../labels";

export type Slide =
  | { kind: "cover"; title: string; subtitle: string; lines: string[] }
  | { kind: "bullets"; title: string; bullets: [string, string][]; note?: string }
  | { kind: "swot"; title: string; quadrants: { label: string; items: string[] }[] }
  | { kind: "table"; title: string; header: string[]; rows: string[][]; sim?: boolean; note?: string }
  | { kind: "chart"; title: string; labels: string[]; series: { name: string; values: number[] }[]; format: "brl" | "num"; sim: boolean; note?: string }
  | { kind: "instagram"; title: string }
  | { kind: "timeline"; title: string; items: { title: string; date: string; description: string }[] }
  | { kind: "text"; title: string; paragraphs: string[] };

const P = PENDING;
const or = (v?: string | null) => (v && v.trim() ? v : P);
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const date = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });

export async function presentationData(projectId: string) {
  const [project, members, swot, campaigns, budgets, pubs, scenarios, milestones, pixel, docs] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    projectMembers(projectId),
    prisma.swotItem.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.campaign.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.budgetPlan.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } }),
    prisma.publication.findMany({ where: { projectId }, orderBy: { scheduledAt: "asc" } }),
    prisma.scenario.findMany({ where: { projectId, kind: "GROWTH" }, orderBy: { createdAt: "asc" } }),
    prisma.milestone.findMany({ where: { projectId }, orderBy: { date: "asc" } }),
    prisma.pixelEvent.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.document.findMany({ where: { projectId, kind: { in: ["FINAL", "STRATEGIC"] } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const b = (project.briefing ?? {}) as Record<string, string>;
  const a = (project.academic ?? {}) as Record<string, string>;
  const brand = brandOf(project.brand);
  const displayName = project.officialNameConfirmed ? project.name : `${project.name}${project.alternateName ? ` / ${project.alternateName}` : ""}`;
  const slides: Slide[] = [];

  slides.push({
    kind: "cover",
    title: displayName,
    subtitle: a.titulo?.trim() || "Planejamento de campanha de lançamento",
    lines: [a.disciplina ? `${a.disciplina}${a.professor ? ` — Prof.(a) ${a.professor}` : ""}` : "", a.faculdade ?? "", members.filter((m) => m.role !== "VIEWER").map((m) => m.nickname ?? m.name).join(" · "), project.officialNameConfirmed ? "" : "Nome oficial pendente de confirmação"].filter(Boolean),
  });
  slides.push({ kind: "bullets", title: "Briefing", bullets: [["Segmento", or(project.segment)], ["Produtos", or(b.products)], ["Diferenciais", or(b.differentials)], ["Público", or(b.audience)], ["Ticket médio", or(b.ticket)], ["Lançamento", project.launchDate ? `${date(project.launchDate)} ${project.launchDateConfirmed ? "(confirmado)" : "(provisório)"}` : or(b.launch)]] });
  slides.push({ kind: "bullets", title: "Objetivos e posicionamento", bullets: [["Objetivos", or(b.objectives)], ["Arquétipos", or(b.archetypes)], ["Tom de voz", or(b.tone)], ["Histórico", or(b.history)]] });
  slides.push({
    kind: "swot",
    title: "Análise SWOT",
    quadrants: [["S", "Forças"], ["W", "Fraquezas"], ["O", "Oportunidades"], ["T", "Ameaças"]].map(([k, l]) => ({ label: l, items: swot.filter((s) => s.quadrant === k).map((s) => `${s.text}${s.basis === "HYPOTHESIS" ? " (hipótese)" : ""}`) })),
  });
  const stages = ["Descoberta", "Consideração", "Decisão", "Pós-compra", "Fidelização"];
  slides.push({ kind: "table", title: "Público e jornada", header: ["Etapa da jornada", "Publicações planejadas"], rows: stages.map((s) => [s, pubs.filter((p) => p.journeyStage === s).map((p) => p.title).join("; ") || "—"]), note: `Público prioritário: ${or(b.audience)}` });
  slides.push({ kind: "table", title: "Estratégia de campanhas", header: ["Campanha", "Objetivo", "Mensagem", "Formatos"], rows: campaigns.map((c) => [c.name, CAMPAIGN_OBJECTIVE_LABEL[c.objective], c.message ?? "—", c.formats ?? "—"]) });
  slides.push({ kind: "instagram", title: "Instagram (perfil fictício)" });
  slides.push({ kind: "table", title: "Calendário editorial", header: ["Data", "Formato", "Publicação", "Etapa", "Status"], rows: pubs.slice(0, 10).map((p) => [p.scheduledAt ? date(p.scheduledAt) : "—", PUB_TYPE_LABEL[p.type], p.title, p.journeyStage ?? "—", PUB_STATUS_LABEL[p.status] ?? p.status]) });
  const plan = budgets.find((x) => x.status === "APPROVED") ?? budgets.find((x) => x.status === "PROPOSED");
  if (plan) {
    const al = plan.allocations as unknown as { label: string; amount: number }[];
    slides.push({ kind: "chart", title: "Plano de mídia e orçamento", labels: al.map((x) => x.label), series: [{ name: "Verba (R$)", values: al.map((x) => x.amount) }], format: "brl", sim: false, note: `${plan.name} — ${plan.status === "APPROVED" ? "verba aprovada" : "proposta NÃO aprovada"} · total ${brl(plan.total)}` });
  }
  slides.push({
    kind: "table",
    title: "Cenários comparados",
    sim: true,
    header: ["Cenário", "Nível", "Investimento", "Seguidores", "Compras", "Receita", "ROAS"],
    rows: scenarios.map((s) => {
      const r = simulateGrowth(readGrowth(s.premises).values);
      if (!r.ok) return [s.name, LEVEL_LABEL[s.level], "—", "—", "—", "—", "—"];
      const t = r.days.reduce((x, d) => ({ p: x.p + d.purchases, rev: x.rev + d.revenue }), { p: 0, rev: 0 });
      return [s.name, LEVEL_LABEL[s.level], brl(r.totalInvestment), num(r.days.at(-1)?.followers ?? 0), num(t.p), brl(t.rev), (r.totalInvestment ? t.rev / r.totalInvestment : 0).toFixed(2).replace(".", ",")];
    }),
  });
  const ref = await referenceGrowthScenario(projectId);
  if (ref?.result.ok) {
    const rows = aggregate(ref.result.days, ref.values.startDate, ref.result.endDate, "MONTH");
    slides.push({ kind: "chart", title: "Projeção mês a mês", labels: rows.map((r) => r.label.replace("Mês ", "M")), series: [{ name: "Receita hipotética (R$)", values: rows.map((r) => Math.round(r.revenue)) }, { name: "Investimento (R$)", values: rows.map((r) => Math.round(r.budget)) }], format: "brl", sim: true, note: `${ref.scenario.name} · ${ref.result.investmentExplanation}` });
    slides.push({ kind: "chart", title: "Seguidores hipotéticos", labels: rows.map((r) => r.label.replace("Mês ", "M")), series: [{ name: "Seguidores (fim do mês)", values: rows.map((r) => Math.round(r.followers)) }], format: "num", sim: true });
  }
  slides.push({ kind: "bullets", title: "KPIs e mensuração", bullets: [["KPIs", "Alcance, impressões, CTR, CPC, CPM, sessões, conversões, CPA, ROAS e receita"], ["Pixel / API de Conversões", pixel.map((x) => `${x.name}: ${x.status === "VALIDATED" ? "validado" : x.status === "IMPLEMENTED_UNVALIDATED" ? "implementado, não validado" : "planejado"}`).join(" · ") || P], ["Rotina", "Checklist diário, relatório semanal e checklist de lançamento"]] });
  slides.push({ kind: "timeline", title: "Linha do tempo", items: milestones.map((m) => ({ title: m.title, date: date(m.date), description: m.description ?? "" })) });

  // Conclusões: seção "Considerações finais" do documento final/estratégico mais recente
  let conclusion: string[] = [];
  for (const d of docs) {
    const blocks = parseMarkdown(d.content);
    const idx = blocks.findIndex((x) => x.type === "heading" && /considera[cç][oõ]es finais|conclus/i.test(x.text));
    if (idx >= 0) {
      for (let i = idx + 1; i < blocks.length; i++) {
        const x = blocks[i];
        if (x.type === "heading" && x.level === 1) break;
        if (x.type === "paragraph") conclusion.push(plain(x.runs));
        if (x.type === "list") conclusion.push(...x.items.map((it) => `• ${plain(it)}`));
      }
      break;
    }
  }
  if (!conclusion.length) conclusion = [`${P} — escreva as considerações finais no documento final.`];
  slides.push({ kind: "text", title: "Conclusões", paragraphs: conclusion });

  return { slides, brand, projectName: displayName };
}
export type PresentationData = Awaited<ReturnType<typeof presentationData>>;

import "server-only";
import { prisma } from "./db";
import { referenceGrowthScenario } from "./scenarios";
import { aggregate, type Granularity } from "../sim/aggregate";
import { simulateGrowth } from "../sim/growth";
import { simulateMetrics } from "../sim/metrics";
import { readGrowth, readMetrics } from "../sim/scenario";

export interface ChartData {
  title: string;
  labels: string[];
  values: number[];
  format: "brl" | "num";
  simulated: boolean;
}

export const CHART_KEYS: [string, string][] = [
  ["growth-monthly-revenue", "Receita hipotética por mês"],
  ["growth-monthly-purchases", "Compras hipotéticas por mês"],
  ["growth-monthly-followers", "Seguidores hipotéticos (fim de cada mês)"],
  ["growth-monthly-budget", "Investimento por mês"],
  ["growth-weekly-revenue", "Receita hipotética por semana (12 primeiras)"],
  ["growth-quarterly-revenue", "Receita hipotética por trimestre"],
  ["growth-semester-revenue", "Receita hipotética por semestre"],
  ["scenarios-revenue", "Receita total por cenário de crescimento"],
  ["budget-allocation", "Distribuição da verba"],
  ["metrics-campaigns-revenue", "Receita hipotética por campanha (simulador de métricas)"],
];

export async function resolveChart(projectId: string, key: string): Promise<ChartData | null> {
  const title = CHART_KEYS.find((k) => k[0] === key)?.[1] ?? key;
  const g = /^growth-(weekly|monthly|quarterly|semester)-(\w+)$/.exec(key);
  if (g) {
    const ref = await referenceGrowthScenario(projectId);
    if (!ref || !ref.result.ok) return null;
    const gran = ({ weekly: "WEEK", monthly: "MONTH", quarterly: "QUARTER", semester: "SEMESTER" } as Record<string, Granularity>)[g[1]];
    let rows = aggregate(ref.result.days, ref.values.startDate, ref.result.endDate, gran);
    if (gran === "WEEK") rows = rows.slice(0, 12);
    const metric = g[2] as "revenue" | "purchases" | "followers" | "budget";
    return {
      title: `${title} — ${ref.scenario.name}`,
      labels: rows.map((r) => r.label),
      values: rows.map((r) => Math.round((r[metric] as number) * 100) / 100),
      format: metric === "revenue" || metric === "budget" ? "brl" : "num",
      simulated: true,
    };
  }
  if (key === "scenarios-revenue") {
    const list = await prisma.scenario.findMany({ where: { projectId, kind: "GROWTH" }, orderBy: { createdAt: "asc" } });
    const rows = list.map((s) => {
      const r = simulateGrowth(readGrowth(s.premises).values);
      return { label: s.name, value: r.ok ? r.days.reduce((a, d) => a + d.revenue, 0) : 0 };
    });
    return { title, labels: rows.map((r) => r.label), values: rows.map((r) => Math.round(r.value)), format: "brl", simulated: true };
  }
  if (key === "budget-allocation") {
    const plan = (await prisma.budgetPlan.findFirst({ where: { projectId, status: "APPROVED" } })) ?? (await prisma.budgetPlan.findFirst({ where: { projectId, status: "PROPOSED" }, orderBy: { updatedAt: "desc" } }));
    if (!plan) return null;
    const al = plan.allocations as unknown as { label: string; amount: number }[];
    return { title: `${title} — ${plan.name} (${plan.status === "APPROVED" ? "aprovada" : "proposta não aprovada"})`, labels: al.map((a) => a.label), values: al.map((a) => a.amount), format: "brl", simulated: false };
  }
  if (key === "metrics-campaigns-revenue") {
    const list = await prisma.scenario.findMany({ where: { projectId, kind: "METRICS" }, orderBy: { updatedAt: "desc" } });
    const s = list.find((x) => x.status === "APPROVED") ?? list.find((x) => x.level === "MODERATE") ?? list[0];
    if (!s) return null;
    const r = simulateMetrics(readMetrics(s.premises).values);
    if (!r.ok) return null;
    return { title: `${title} — ${s.name}`, labels: r.campaigns.map((c) => c.name), values: r.campaigns.map((c) => Math.round(c.revenue)), format: "brl", simulated: true };
  }
  return null;
}

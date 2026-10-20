/**
 * Premissas iniciais demonstrativas. TODAS as taxas de mídia/funil abaixo são
 * HIPÓTESES DA EQUIPE a validar — não são benchmarks externos nem histórico real
 * (projetos novos não têm histórico de mídia paga).
 */
import type { GrowthPremises } from "./growth";
import type { MetricsInput } from "./metrics";
import type { SourceMap } from "./origin";

export type Level = "CONSERVATIVE" | "MODERATE" | "OPTIMISTIC";

export const LEVEL_LABEL: Record<Level | "CUSTOM", string> = {
  CONSERVATIVE: "Conservador",
  MODERATE: "Moderado",
  OPTIMISTIC: "Otimista",
  CUSTOM: "Personalizado",
};

/** Data usada quando o projeto não informa a sua. */
export const PROVISIONAL_LAUNCH = "2026-11-09";

/** Valores do projeto que alimentam os padrões dos simuladores (vêm das Configurações). */
export interface ProjectDefaults {
  launch?: string | null;
  budget?: number | null;
  ticket?: number | null;
}
const TICKET_K: Record<Level, number> = { CONSERVATIVE: 0.86, MODERATE: 1, OPTIMISTIC: 1.14 };
const ticketFor = (level: Level, k: { averageTicket: number }, ctx: ProjectDefaults) =>
  ctx.ticket && ctx.ticket > 0 ? Math.round(ctx.ticket * TICKET_K[level]) : k.averageTicket;

const flat = () => new Array(12).fill(1);

interface LevelKnobs {
  cpm: number;
  ctr: number;
  addToCartRate: number;
  checkoutRate: number;
  purchaseRate: number;
  organicReachRate: number;
  followRate: number;
  averageTicket: number;
}

const KNOBS: Record<Level, LevelKnobs> = {
  CONSERVATIVE: { cpm: 32, ctr: 0.008, addToCartRate: 0.04, checkoutRate: 0.4, purchaseRate: 0.45, organicReachRate: 0.08, followRate: 0.06, averageTicket: 300 },
  MODERATE: { cpm: 25, ctr: 0.012, addToCartRate: 0.06, checkoutRate: 0.5, purchaseRate: 0.55, organicReachRate: 0.12, followRate: 0.1, averageTicket: 350 },
  OPTIMISTIC: { cpm: 18, ctr: 0.018, addToCartRate: 0.08, checkoutRate: 0.6, purchaseRate: 0.65, organicReachRate: 0.18, followRate: 0.14, averageTicket: 400 },
};

export function defaultGrowth(level: Level = "MODERATE", ctx: ProjectDefaults = {}): GrowthPremises {
  const budget = ctx.budget && ctx.budget > 0 ? ctx.budget : 10000;
  const k = KNOBS[level];
  return {
    startDate: ctx.launch || PROVISIONAL_LAUNCH,
    horizon: "YEAR",
    budgetMode: "ONE_TIME",
    oneTimeBudget: budget,
    spendDays: 90,
    spendCurve: "UNIFORM",
    monthlyBudget: Math.round(budget * 0.3),
    monthsOfInvestment: 12,
    cpm: k.cpm,
    ctr: k.ctr,
    audienceSize: 400000,
    paidEngagementRate: 0.01,
    paidProfileVisitRate: 0.004,
    videoViewRate: 0.25,
    landingRate: 0.75,
    addToCartRate: k.addToCartRate,
    checkoutRate: k.checkoutRate,
    purchaseRate: k.purchaseRate,
    averageTicket: ticketFor(level, k, ctx),
    initialFollowers: 0,
    postsPerWeek: 3,
    reelsPerWeek: 2,
    organicReachRate: k.organicReachRate,
    reelsReachMultiplier: 2.5,
    viewsPerReelReach: 1.3,
    organicEngagementRate: 0.04,
    organicProfileVisitRate: 0.03,
    followRate: k.followRate,
    bioLinkClickRate: 0.08,
    monthlyFollowerChurn: 0.01,
    saturationEnabled: true,
    saturationK: 0.15,
    monthlyCpmIncrease: 0.01,
    seasonalityEnabled: false,
    seasonalityCpm: flat(),
    seasonalityConversion: flat(),
    monthlyConversionChange: 0,
  };
}

export function defaultGrowthSources(): SourceMap {
  const h = { origin: "HYPOTHESIS" as const, note: "Hipótese inicial — validar" };
  return {
    startDate: { origin: "BRIEFING", note: "Data de lançamento informada no projeto" },
    oneTimeBudget: { origin: "BRIEFING", note: "Verba inicial informada no projeto (não aprovada)" },
    averageTicket: { origin: "BRIEFING", note: "Ticket médio informado no projeto" },
    initialFollowers: { origin: "HYPOTHESIS", note: "Perfil considerado novo; confirmar base atual" },
    cpm: h,
    ctr: h,
    audienceSize: h,
    landingRate: h,
    addToCartRate: h,
    checkoutRate: h,
    purchaseRate: h,
    organicReachRate: h,
    followRate: h,
  };
}

export function defaultMetrics(level: Level = "MODERATE", ctx: ProjectDefaults = {}): MetricsInput {
  const k = KNOBS[level];
  return {
    budgetMode: "TOTAL",
    totalBudget: ctx.budget && ctx.budget > 0 ? ctx.budget : 10000,
    dailyBudget: 111.11,
    durationDays: 90,
    media: { costBasis: "CPM", cpm: k.cpm, cpc: 2, ctr: k.ctr, frequency: 2.5 },
    funnel: {
      landingRate: 0.75,
      addToCartRate: k.addToCartRate,
      checkoutRate: k.checkoutRate,
      purchaseRate: k.purchaseRate,
      averageTicket: ticketFor(level, k, ctx),
    },
    campaigns: [
      { id: "awareness", name: "Reconhecimento/Engajamento", share: 0.3, media: { ctr: k.ctr * 0.7 } },
      { id: "conversion", name: "Conversão/Remarketing", share: 0.6 },
      { id: "tests", name: "Testes/Otimização", share: 0.1 },
    ],
  };
}

export function defaultMetricsSources(): SourceMap {
  const h = { origin: "HYPOTHESIS" as const, note: "Hipótese inicial — validar" };
  return {
    totalBudget: { origin: "BRIEFING", note: "Verba inicial informada no projeto (não aprovada)" },
    averageTicket: { origin: "BRIEFING", note: "Ticket médio informado no projeto" },
    distribution: { origin: "BRIEFING", note: "Sugestão 30/60/10 — não aprovada" },
    cpm: h,
    ctr: h,
    frequency: h,
    landingRate: h,
    addToCartRate: h,
    checkoutRate: h,
    purchaseRate: h,
  };
}

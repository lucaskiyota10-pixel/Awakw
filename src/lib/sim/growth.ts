/**
 * AWAKE GROWTH SIMULATOR — projeção temporal diária agregável em
 * semanas, meses, trimestres, semestres e anos.
 *
 * Modelo de valores esperados (médias), não de eventos discretos. Princípios:
 * - Orçamento único ≠ investimento mensal recorrente: o modo é explícito e o total
 *   investido é sempre exibido; nada é multiplicado por 12 automaticamente.
 * - Não há crescimento proporcional implícito: saturação, aumento de custos,
 *   sazonalidade e variação de conversão são ajustes opcionais e declarados.
 *   Sem eles o modelo é linear e isso é avisado.
 * - Alcance pago único só é calculado com premissa de tamanho de público
 *   (curva de alcance de Poisson: A × (1 − e^(−impressões/A))).
 * - CPA e ROAS são "combinados" (blended): toda receita (paga + orgânica) dividida
 *   pelo investimento em mídia; não há atribuição causal.
 */

import { addDays, addMonths, diffDays, monthIndex, relativeMonth } from "./dates";

export type HorizonPreset = "WEEK" | "MONTH" | "QUARTER" | "SEMESTER" | "YEAR" | "CUSTOM";
export type BudgetMode = "ONE_TIME" | "MONTHLY";
export type SpendCurve = "UNIFORM" | "FRONT_LOADED" | "BACK_LOADED";

export interface GrowthPremises {
  startDate: string;
  horizon: HorizonPreset;
  endDate?: string; // exclusivo; usado em CUSTOM

  budgetMode: BudgetMode;
  oneTimeBudget: number; // modo ONE_TIME: valor único
  spendDays: number; // modo ONE_TIME: dias de veiculação a partir do início
  spendCurve: SpendCurve;
  monthlyBudget: number; // modo MONTHLY: valor por mês
  monthsOfInvestment: number; // modo MONTHLY: quantos meses recebem verba

  cpm: number;
  ctr: number;
  audienceSize: number | null;
  paidEngagementRate: number; // interações / impressão paga
  paidProfileVisitRate: number; // visitas ao perfil / impressão paga
  videoViewRate: number; // visualizações / impressão paga

  landingRate: number; // sessões / clique
  addToCartRate: number;
  checkoutRate: number;
  purchaseRate: number;
  averageTicket: number;

  initialFollowers: number;
  postsPerWeek: number; // feed + carrossel
  reelsPerWeek: number;
  organicReachRate: number; // alcance por post / seguidores
  reelsReachMultiplier: number;
  viewsPerReelReach: number;
  organicEngagementRate: number; // interações / alcance orgânico
  organicProfileVisitRate: number; // visitas ao perfil / alcance orgânico
  followRate: number; // novos seguidores / visita ao perfil
  bioLinkClickRate: number; // visitas ao site / visita ao perfil
  monthlyFollowerChurn: number;

  // ajustes opcionais (não lineares)
  saturationEnabled: boolean;
  saturationK: number; // CTR efetivo = CTR / (1 + k × frequência média acumulada)
  monthlyCpmIncrease: number; // ex.: 0.02 = +2% ao mês (composto)
  seasonalityEnabled: boolean;
  seasonalityCpm: number[]; // 12 multiplicadores por mês do calendário (jan..dez)
  seasonalityConversion: number[]; // 12 multiplicadores
  monthlyConversionChange: number; // ex.: 0.03 = +3% ao mês (aprendizado) ou negativo
}

export interface DayPoint {
  date: string;
  budget: number;
  impressions: number;
  cpm: number;
  ctr: number;
  clicks: number;
  reachCumulative: number | null;
  reachNew: number | null;
  organicReach: number;
  views: number;
  profileVisits: number;
  newFollowers: number;
  followers: number; // fim do dia
  interactions: number;
  siteVisits: number;
  carts: number;
  checkouts: number;
  purchases: number;
  revenue: number;
}

export interface GrowthOutput {
  ok: boolean;
  errors: string[];
  warnings: string[];
  endDate: string;
  days: DayPoint[];
  totalInvestment: number;
  investmentExplanation: string;
}

export function horizonEnd(p: Pick<GrowthPremises, "startDate" | "horizon" | "endDate">): string {
  switch (p.horizon) {
    case "WEEK":
      return addDays(p.startDate, 7);
    case "MONTH":
      return addMonths(p.startDate, 1);
    case "QUARTER":
      return addMonths(p.startDate, 3);
    case "SEMESTER":
      return addMonths(p.startDate, 6);
    case "YEAR":
      return addMonths(p.startDate, 12);
    case "CUSTOM":
      return p.endDate && p.endDate > p.startDate ? p.endDate : addDays(p.startDate, 30);
  }
}

/** Distribuição diária da verba. Retorna array alinhado aos dias do horizonte. */
export function dailyBudgets(p: GrowthPremises, totalDays: number): number[] {
  const out = new Array(totalDays).fill(0);
  if (p.budgetMode === "ONE_TIME") {
    const n = Math.max(1, Math.min(totalDays, Math.round(p.spendDays)));
    // pesos: uniforme, decrescente (front) ou crescente (back), normalizados
    const w = Array.from({ length: n }, (_, i) =>
      p.spendCurve === "FRONT_LOADED" ? n - i : p.spendCurve === "BACK_LOADED" ? i + 1 : 1,
    );
    const sw = w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) out[i] = (p.oneTimeBudget * w[i]) / sw;
    return out;
  }
  // MONTHLY: cada mês relativo recebe monthlyBudget distribuído pelos seus dias
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(p.startDate, i);
    const m = relativeMonth(p.startDate, date);
    if (m >= p.monthsOfInvestment) continue;
    const monthStart = addMonths(p.startDate, m);
    const monthLen = diffDays(monthStart, addMonths(p.startDate, m + 1));
    out[i] = p.monthlyBudget / monthLen;
  }
  return out;
}

export function validateGrowth(p: GrowthPremises): string[] {
  const e: string[] = [];
  const frac = (v: number, l: string) => {
    if (!(v >= 0 && v <= 1)) e.push(`${l} deve estar entre 0% e 100%.`);
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)) e.push("Data inicial inválida.");
  if (p.horizon === "CUSTOM" && (!p.endDate || p.endDate <= p.startDate))
    e.push("No período personalizado, a data final deve ser posterior à inicial.");
  if (p.budgetMode === "ONE_TIME") {
    if (!(p.oneTimeBudget >= 0)) e.push("Orçamento único não pode ser negativo.");
    if (!(p.spendDays >= 1)) e.push("Dias de veiculação deve ser ≥ 1.");
  } else {
    if (!(p.monthlyBudget >= 0)) e.push("Investimento mensal não pode ser negativo.");
    if (!(p.monthsOfInvestment >= 0)) e.push("Meses de investimento não pode ser negativo.");
  }
  if (!(p.cpm > 0)) e.push("CPM deve ser maior que zero.");
  if (!(p.ctr > 0 && p.ctr <= 1)) e.push("CTR deve estar entre 0% e 100%.");
  if (p.audienceSize !== null && !(p.audienceSize > 0)) e.push("Tamanho do público deve ser positivo.");
  frac(p.paidEngagementRate, "Engajamento pago");
  frac(p.paidProfileVisitRate, "Visitas ao perfil (pago)");
  frac(p.videoViewRate, "Taxa de visualização de vídeo");
  frac(p.landingRate, "Chegada ao site");
  frac(p.addToCartRate, "Adição ao carrinho");
  frac(p.checkoutRate, "Início de checkout");
  frac(p.purchaseRate, "Conclusão de compra");
  frac(p.organicReachRate, "Alcance orgânico");
  frac(p.organicEngagementRate, "Engajamento orgânico");
  frac(p.organicProfileVisitRate, "Visitas ao perfil (orgânico)");
  frac(p.followRate, "Taxa de seguir");
  frac(p.bioLinkClickRate, "Cliques no link da bio");
  frac(p.monthlyFollowerChurn, "Perda mensal de seguidores");
  if (!(p.averageTicket >= 0)) e.push("Ticket médio não pode ser negativo.");
  if (!(p.initialFollowers >= 0)) e.push("Seguidores iniciais não pode ser negativo.");
  if (!(p.postsPerWeek >= 0) || !(p.reelsPerWeek >= 0)) e.push("Frequência de publicação não pode ser negativa.");
  if (p.seasonalityEnabled && (p.seasonalityCpm.length !== 12 || p.seasonalityConversion.length !== 12))
    e.push("Sazonalidade exige 12 multiplicadores mensais.");
  if (p.seasonalityEnabled && [...p.seasonalityCpm, ...p.seasonalityConversion].some((v) => !(v > 0)))
    e.push("Multiplicadores de sazonalidade devem ser positivos.");
  if (!(p.monthlyConversionChange > -1)) e.push("Variação mensal de conversão deve ser maior que -100%.");
  return e;
}

export function simulateGrowth(p: GrowthPremises): GrowthOutput {
  const errors = validateGrowth(p);
  const warnings: string[] = [];
  const endDate = errors.length ? p.startDate : horizonEnd(p);
  if (errors.length) {
    return { ok: false, errors, warnings, endDate, days: [], totalInvestment: 0, investmentExplanation: "" };
  }
  const totalDays = diffDays(p.startDate, endDate);
  const budgets = dailyBudgets(p, totalDays);

  if (p.saturationEnabled && p.audienceSize === null)
    warnings.push("Saturação requer tamanho de público; ajuste ignorado.");
  if (!p.saturationEnabled && p.monthlyCpmIncrease === 0 && !p.seasonalityEnabled && p.monthlyConversionChange === 0)
    warnings.push(
      "Sem saturação, aumento de custos, sazonalidade ou variação de conversão, a parte paga é linear (dobrar a verba dobra os resultados). Ative ajustes para uma projeção mais realista.",
    );
  if (p.audienceSize === null) warnings.push("Alcance pago único não calculado: informe o tamanho do público.");
  if (p.budgetMode === "ONE_TIME" && p.spendDays > totalDays)
    warnings.push("Dias de veiculação maiores que o período: a verba foi concentrada no período simulado.");

  const days: DayPoint[] = [];
  let followers = p.initialFollowers;
  let cumImpressions = 0;
  let prevReach = 0;
  const churnDaily = 1 - Math.pow(1 - p.monthlyFollowerChurn, 1 / 30);

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(p.startDate, i);
    const m = relativeMonth(p.startDate, date);
    const cal = monthIndex(date);
    const budget = budgets[i];

    let cpm = p.cpm * Math.pow(1 + p.monthlyCpmIncrease, m);
    let convMult = Math.pow(1 + p.monthlyConversionChange, m);
    if (p.seasonalityEnabled) {
      cpm *= p.seasonalityCpm[cal];
      convMult *= p.seasonalityConversion[cal];
    }

    const impressions = cpm > 0 ? (budget / cpm) * 1000 : 0;
    let ctr = p.ctr;
    if (p.saturationEnabled && p.audienceSize) {
      const avgFrequency = cumImpressions / p.audienceSize;
      ctr = p.ctr / (1 + p.saturationK * avgFrequency);
    }
    const clicks = impressions * ctr;
    cumImpressions += impressions;

    let reachCumulative: number | null = null;
    let reachNew: number | null = null;
    if (p.audienceSize) {
      reachCumulative = p.audienceSize * (1 - Math.exp(-cumImpressions / p.audienceSize));
      reachNew = reachCumulative - prevReach;
      prevReach = reachCumulative;
    }

    const postReach = (p.postsPerWeek / 7) * followers * p.organicReachRate;
    const reelReach = (p.reelsPerWeek / 7) * followers * p.organicReachRate * p.reelsReachMultiplier;
    const organicReach = postReach + reelReach;
    const views = reelReach * p.viewsPerReelReach + impressions * p.videoViewRate;
    const profileVisits = organicReach * p.organicProfileVisitRate + impressions * p.paidProfileVisitRate;
    const newFollowers = profileVisits * p.followRate;
    const lost = followers * churnDaily;
    followers = Math.max(0, followers + newFollowers - lost);
    const interactions = organicReach * p.organicEngagementRate + impressions * p.paidEngagementRate;

    const siteVisits = clicks * p.landingRate + profileVisits * p.bioLinkClickRate;
    const carts = siteVisits * p.addToCartRate;
    const checkouts = carts * p.checkoutRate;
    const purchases = checkouts * Math.min(1, p.purchaseRate * convMult);
    const revenue = purchases * p.averageTicket;

    days.push({
      date,
      budget,
      impressions,
      cpm,
      ctr,
      clicks,
      reachCumulative,
      reachNew,
      organicReach,
      views,
      profileVisits,
      newFollowers,
      followers,
      interactions,
      siteVisits,
      carts,
      checkouts,
      purchases,
      revenue,
    });
  }

  const totalInvestment = budgets.reduce((a, b) => a + b, 0);
  const investmentExplanation =
    p.budgetMode === "ONE_TIME"
      ? `Orçamento único de ${brl(p.oneTimeBudget)} distribuído em ${Math.min(Math.round(p.spendDays), totalDays)} dia(s) (${curveLabel(p.spendCurve)}).`
      : `Investimento mensal recorrente de ${brl(p.monthlyBudget)} por até ${p.monthsOfInvestment} mês(es) dentro do período — total ${brl(totalInvestment)} (escolha explícita, não multiplicação automática).`;

  return { ok: true, errors: [], warnings, endDate, days, totalInvestment, investmentExplanation };
}

function curveLabel(c: SpendCurve) {
  return c === "UNIFORM" ? "distribuição uniforme" : c === "FRONT_LOADED" ? "concentrada no início" : "concentrada no fim";
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

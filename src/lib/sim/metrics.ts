/**
 * Simulador de métricas e investimento (estático, para um período).
 *
 * Regras de consistência:
 * - CPM, CPC e CTR não são independentes: CPC = CPM / (1000 × CTR).
 *   O usuário escolhe a base de custo (CPM ou CPC) + CTR; a terceira é DERIVADA.
 * - Alcance só é calculado quando há premissa de frequência (alcance = impressões / frequência).
 * - Sessões só existem quando há premissa de taxa de chegada ao site (sessões / cliques).
 *   Sem ela, o funil parte dos cliques e isso é sinalizado.
 */

export type CostBasis = "CPM" | "CPC";

export interface MediaPremises {
  costBasis: CostBasis;
  cpm: number; // R$ por mil impressões (usado quando costBasis = CPM)
  cpc: number; // R$ por clique (usado quando costBasis = CPC)
  ctr: number; // fração (0.012 = 1,2%)
  frequency: number | null; // impressões por pessoa; null = sem premissa
}

export interface FunnelPremises {
  landingRate: number | null; // sessões / cliques; null = sem premissa
  addToCartRate: number; // carrinhos / sessões (ou cliques)
  checkoutRate: number; // checkouts / carrinhos
  purchaseRate: number; // compras / checkouts
  averageTicket: number; // R$
}

export interface CampaignSplit {
  id: string;
  name: string;
  share: number; // fração do orçamento (soma = 1)
  media?: Partial<MediaPremises>;
  funnel?: Partial<FunnelPremises>;
}

export interface MetricsInput {
  budgetMode: "TOTAL" | "DAILY";
  totalBudget: number;
  dailyBudget: number;
  durationDays: number;
  media: MediaPremises;
  funnel: FunnelPremises;
  campaigns: CampaignSplit[];
}

export interface MetricsResult {
  name: string;
  budget: number;
  dailyBudget: number;
  impressions: number;
  reach: number | null;
  frequency: number | null;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  sessions: number | null;
  carts: number;
  checkouts: number;
  purchases: number;
  revenue: number;
  cpa: number | null;
  roas: number | null;
  conversionRate: number; // compras / cliques
  funnelBase: "SESSIONS" | "CLICKS";
}

export interface MetricsOutput {
  ok: boolean;
  errors: string[];
  warnings: string[];
  totalBudget: number;
  dailyBudget: number;
  campaigns: MetricsResult[];
  total: MetricsResult | null;
}

const safeDiv = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function resolveBudget(input: Pick<MetricsInput, "budgetMode" | "totalBudget" | "dailyBudget" | "durationDays">) {
  const days = Math.max(0, input.durationDays);
  if (input.budgetMode === "DAILY") {
    return { total: input.dailyBudget * days, daily: input.dailyBudget };
  }
  return { total: input.totalBudget, daily: days > 0 ? input.totalBudget / days : 0 };
}

/** Deriva CPM/CPC a partir da base escolhida e do CTR. */
export function deriveCosts(media: MediaPremises): { cpm: number; cpc: number } {
  if (media.costBasis === "CPM") {
    return { cpm: media.cpm, cpc: media.ctr > 0 ? media.cpm / (1000 * media.ctr) : 0 };
  }
  return { cpc: media.cpc, cpm: media.cpc * 1000 * media.ctr };
}

export function validateMedia(media: MediaPremises, prefix = ""): string[] {
  const e: string[] = [];
  if (!(media.ctr > 0 && media.ctr <= 1)) e.push(`${prefix}CTR deve estar entre 0% e 100%.`);
  if (media.costBasis === "CPM" && !(media.cpm > 0)) e.push(`${prefix}CPM deve ser maior que zero.`);
  if (media.costBasis === "CPC" && !(media.cpc > 0)) e.push(`${prefix}CPC deve ser maior que zero.`);
  if (media.frequency !== null && !(media.frequency >= 1))
    e.push(`${prefix}Frequência deve ser ≥ 1 (ou deixe sem premissa).`);
  return e;
}

export function validateFunnel(f: FunnelPremises, prefix = ""): string[] {
  const e: string[] = [];
  const rate = (v: number | null, label: string) => {
    if (v !== null && !(v >= 0 && v <= 1)) e.push(`${prefix}${label} deve estar entre 0% e 100%.`);
  };
  rate(f.landingRate, "Taxa de chegada ao site");
  rate(f.addToCartRate, "Taxa de adição ao carrinho");
  rate(f.checkoutRate, "Taxa de início de checkout");
  rate(f.purchaseRate, "Taxa de conclusão de compra");
  if (!(f.averageTicket >= 0)) e.push(`${prefix}Ticket médio não pode ser negativo.`);
  return e;
}

export function computeOne(name: string, budget: number, days: number, media: MediaPremises, funnel: FunnelPremises): MetricsResult {
  const { cpm, cpc } = deriveCosts(media);
  const impressions = cpm > 0 ? (budget / cpm) * 1000 : 0;
  const clicks = impressions * media.ctr;
  const reach = media.frequency ? impressions / media.frequency : null;
  const sessions = funnel.landingRate !== null ? clicks * funnel.landingRate : null;
  const base = sessions ?? clicks;
  const carts = base * funnel.addToCartRate;
  const checkouts = carts * funnel.checkoutRate;
  const purchases = checkouts * funnel.purchaseRate;
  const revenue = purchases * funnel.averageTicket;
  return {
    name,
    budget,
    dailyBudget: days > 0 ? budget / days : 0,
    impressions,
    reach,
    frequency: media.frequency,
    clicks,
    ctr: media.ctr,
    cpm,
    cpc,
    sessions,
    carts,
    checkouts,
    purchases,
    revenue,
    cpa: safeDiv(budget, purchases),
    roas: safeDiv(revenue, budget),
    conversionRate: clicks > 0 ? purchases / clicks : 0,
    funnelBase: sessions === null ? "CLICKS" : "SESSIONS",
  };
}

/** Soma resultados; taxas e custos são RECALCULADOS a partir dos totais (nunca média simples). */
export function sumResults(name: string, rows: MetricsResult[], days: number): MetricsResult {
  const s = (k: keyof MetricsResult) => rows.reduce((acc, r) => acc + ((r[k] as number) ?? 0), 0);
  const budget = s("budget");
  const impressions = s("impressions");
  const clicks = s("clicks");
  const purchases = s("purchases");
  const revenue = s("revenue");
  const allSessions = rows.every((r) => r.sessions !== null);
  return {
    name,
    budget,
    dailyBudget: days > 0 ? budget / days : 0,
    impressions,
    // alcance não é somável entre campanhas (sobreposição de públicos)
    reach: null,
    frequency: null,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpm: impressions > 0 ? (budget / impressions) * 1000 : 0,
    cpc: clicks > 0 ? budget / clicks : 0,
    sessions: allSessions ? s("sessions") : null,
    carts: s("carts"),
    checkouts: s("checkouts"),
    purchases,
    revenue,
    cpa: safeDiv(budget, purchases),
    roas: safeDiv(revenue, budget),
    conversionRate: clicks > 0 ? purchases / clicks : 0,
    funnelBase: allSessions ? "SESSIONS" : "CLICKS",
  };
}

export function simulateMetrics(input: MetricsInput): MetricsOutput {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { total, daily } = resolveBudget(input);

  if (!(input.durationDays >= 1)) errors.push("Duração deve ser de pelo menos 1 dia.");
  if (!(total >= 0)) errors.push("Investimento não pode ser negativo.");
  errors.push(...validateMedia(input.media), ...validateFunnel(input.funnel));

  const campaigns = input.campaigns.length
    ? input.campaigns
    : [{ id: "all", name: "Campanha única", share: 1 }];
  const shareSum = campaigns.reduce((a, c) => a + c.share, 0);
  if (Math.abs(shareSum - 1) > 0.0005)
    errors.push(`A distribuição por campanha soma ${(shareSum * 100).toFixed(1)}% — deve somar 100%.`);
  for (const c of campaigns) {
    if (c.share < 0) errors.push(`Participação negativa em "${c.name}".`);
    const m = { ...input.media, ...c.media };
    const f = { ...input.funnel, ...c.funnel };
    errors.push(...validateMedia(m, `${c.name}: `), ...validateFunnel(f, `${c.name}: `));
  }

  if (input.media.frequency === null)
    warnings.push("Alcance não calculado: informe uma premissa de frequência.");
  if (input.funnel.landingRate === null)
    warnings.push("Sem premissa de chegada ao site: sessões não calculadas; funil calculado sobre cliques.");
  if (input.media.ctr > 0.05) warnings.push("CTR acima de 5% é incomum — revise a hipótese.");

  if (errors.length) {
    return { ok: false, errors: [...new Set(errors)], warnings, totalBudget: total, dailyBudget: daily, campaigns: [], total: null };
  }

  const rows = campaigns.map((c) =>
    computeOne(c.name, total * c.share, input.durationDays, { ...input.media, ...c.media }, { ...input.funnel, ...c.funnel }),
  );
  return {
    ok: true,
    errors: [],
    warnings,
    totalBudget: total,
    dailyBudget: daily,
    campaigns: rows,
    total: sumResults("Total", rows, input.durationDays),
  };
}

/** Comparação de hipóteses A/B (simulada): mesma verba, CTR e taxa de conversão distintos. */
export interface AbVariant {
  label: string;
  ctr: number;
  conversionRate: number; // compras / cliques
}

export function compareAb(budget: number, cpm: number, ticket: number, a: AbVariant, b: AbVariant) {
  const run = (v: AbVariant) => {
    const impressions = cpm > 0 ? (budget / cpm) * 1000 : 0;
    const clicks = impressions * v.ctr;
    const purchases = clicks * v.conversionRate;
    const revenue = purchases * ticket;
    return {
      label: v.label,
      impressions,
      clicks,
      cpc: clicks > 0 ? budget / clicks : null,
      purchases,
      revenue,
      cpa: safeDiv(budget, purchases),
      roas: safeDiv(revenue, budget),
    };
  };
  const ra = run(a);
  const rb = run(b);
  const lift = (x: number, y: number) => (x > 0 ? (y - x) / x : null);
  return {
    a: ra,
    b: rb,
    liftClicks: lift(ra.clicks, rb.clicks),
    liftPurchases: lift(ra.purchases, rb.purchases),
    winner: rb.purchases > ra.purchases ? "B" : rb.purchases < ra.purchases ? "A" : "EMPATE",
  };
}

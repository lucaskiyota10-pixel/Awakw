/**
 * Agregação da série diária em períodos relativos ao início da simulação:
 * Semana N (blocos de 7 dias), Mês N, Trimestre N, Semestre N, Ano N.
 * Fluxos são somados; estoques (seguidores) usam o valor no fim do período;
 * razões (CTR, CPM, CPA, ROAS, engajamento) são recalculadas a partir dos totais.
 */

import type { DayPoint } from "./growth";
import { addDays, addMonths } from "./dates";

export type Granularity = "WEEK" | "MONTH" | "QUARTER" | "SEMESTER" | "YEAR";

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  WEEK: "Semana",
  MONTH: "Mês",
  QUARTER: "Trimestre",
  SEMESTER: "Semestre",
  YEAR: "Ano",
};

export interface PeriodRow {
  label: string;
  start: string;
  end: string; // inclusivo
  days: number;
  complete: boolean;
  budget: number;
  impressions: number;
  reach: number | null; // novo alcance único no período
  reachCumulative: number | null;
  organicReach: number;
  views: number;
  profileVisits: number;
  newFollowers: number;
  followers: number;
  interactions: number;
  engagementRate: number | null;
  clicks: number;
  ctr: number | null;
  cpm: number | null;
  siteVisits: number;
  carts: number;
  checkouts: number;
  purchases: number;
  revenue: number;
  cpa: number | null;
  roas: number | null;
}

export const FLOW_KEYS = [
  "budget",
  "impressions",
  "organicReach",
  "views",
  "profileVisits",
  "newFollowers",
  "interactions",
  "clicks",
  "siteVisits",
  "carts",
  "checkouts",
  "purchases",
  "revenue",
] as const;

function boundaries(start: string, end: string, g: Granularity): [string, string][] {
  const out: [string, string][] = [];
  let cur = start;
  let n = 1;
  while (cur < end) {
    const next =
      g === "WEEK"
        ? addDays(start, 7 * n)
        : addMonths(start, n * (g === "MONTH" ? 1 : g === "QUARTER" ? 3 : g === "SEMESTER" ? 6 : 12));
    out.push([cur, next]);
    cur = next;
    n++;
  }
  return out;
}

export function summarize(days: DayPoint[], label: string, start: string, endExclusive: string, expectedDays?: number): PeriodRow {
  const sum = (k: (typeof FLOW_KEYS)[number]) => days.reduce((a, d) => a + d[k], 0);
  const last = days[days.length - 1];
  const first = days[0];
  const reachKnown = days.length > 0 && last.reachCumulative !== null;
  const impressions = sum("impressions");
  const clicks = sum("clicks");
  const budget = sum("budget");
  const purchases = sum("purchases");
  const revenue = sum("revenue");
  const interactions = sum("interactions");
  const organicReach = sum("organicReach");
  const prevCum = reachKnown ? (first.reachCumulative ?? 0) - (first.reachNew ?? 0) : 0;
  return {
    label,
    start,
    end: addDays(endExclusive, -1),
    days: days.length,
    complete: expectedDays === undefined ? true : days.length === expectedDays,
    budget,
    impressions,
    reach: reachKnown ? (last.reachCumulative as number) - prevCum : null,
    reachCumulative: reachKnown ? last.reachCumulative : null,
    organicReach,
    views: sum("views"),
    profileVisits: sum("profileVisits"),
    newFollowers: sum("newFollowers"),
    followers: last ? last.followers : 0,
    interactions,
    engagementRate: impressions + organicReach > 0 ? interactions / (impressions + organicReach) : null,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : null,
    cpm: impressions > 0 ? (budget / impressions) * 1000 : null,
    siteVisits: sum("siteVisits"),
    carts: sum("carts"),
    checkouts: sum("checkouts"),
    purchases,
    revenue,
    cpa: purchases > 0 ? budget / purchases : null,
    roas: budget > 0 ? revenue / budget : null,
  };
}

export function aggregate(days: DayPoint[], start: string, end: string, g: Granularity): PeriodRow[] {
  return boundaries(start, end, g).map(([s, e], i) => {
    const slice = days.filter((d) => d.date >= s && d.date < e);
    const expected = Math.round((Date.parse(e) - Date.parse(s)) / 86400000);
    const clippedEnd = e > end ? end : e;
    return summarize(slice, `${GRANULARITY_LABEL[g]} ${i + 1}`, s, clippedEnd, expected);
  });
}

export type CompareKey = (typeof FLOW_KEYS)[number] | "followers" | "reach";

export interface Variation {
  abs: number | null;
  pct: number | null;
}

export function variation(prev: number | null, cur: number | null): Variation {
  if (prev === null || cur === null) return { abs: null, pct: null };
  return { abs: cur - prev, pct: prev !== 0 ? (cur - prev) / prev : null };
}

/** Linhas acumuladas (fluxos somados até o fim de cada período). */
export function cumulative(rows: PeriodRow[]): PeriodRow[] {
  const acc: PeriodRow[] = [];
  rows.forEach((r, i) => {
    if (i === 0) {
      acc.push({ ...r, label: `Até ${r.label}` });
      return;
    }
    const p = acc[i - 1];
    const merged: PeriodRow = { ...r, label: `Até ${r.label}`, start: p.start, days: p.days + r.days };
    for (const k of FLOW_KEYS) merged[k] = p[k] + r[k];
    merged.reach = r.reachCumulative;
    merged.ctr = merged.impressions > 0 ? merged.clicks / merged.impressions : null;
    merged.cpm = merged.impressions > 0 ? (merged.budget / merged.impressions) * 1000 : null;
    merged.cpa = merged.purchases > 0 ? merged.budget / merged.purchases : null;
    merged.roas = merged.budget > 0 ? merged.revenue / merged.budget : null;
    const denom = merged.impressions + merged.organicReach;
    merged.engagementRate = denom > 0 ? merged.interactions / denom : null;
    acc.push(merged);
  });
  return acc;
}

/** Totais acumulados até uma data (inclusiva) — usado nos marcos da linha do tempo. */
export function upTo(days: DayPoint[], start: string, date: string, label = "Acumulado"): PeriodRow | null {
  const slice = days.filter((d) => d.date <= date);
  if (!slice.length) return null;
  return summarize(slice, label, start, addDays(slice[slice.length - 1].date, 1));
}

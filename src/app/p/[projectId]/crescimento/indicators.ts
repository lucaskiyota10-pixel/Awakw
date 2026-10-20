import type { PeriodRow } from "@/lib/sim/aggregate";
import { brl, num, pct } from "@/lib/format";

export type IndicatorKey = keyof Pick<
  PeriodRow,
  "budget" | "impressions" | "reach" | "organicReach" | "views" | "profileVisits" | "newFollowers" | "followers" | "interactions" | "engagementRate" | "clicks" | "ctr" | "cpm" | "siteVisits" | "carts" | "checkouts" | "purchases" | "revenue" | "cpa" | "roas"
>;

export const INDICATORS: { key: IndicatorKey; label: string; fmt: (v: number | null) => string; ratio?: boolean; stock?: boolean }[] = [
  { key: "budget", label: "Orçamento", fmt: (v) => brl(v, 0) },
  { key: "reach", label: "Alcance pago único (novo)", fmt: (v) => num(v) },
  { key: "impressions", label: "Impressões", fmt: (v) => num(v) },
  { key: "organicReach", label: "Alcance orgânico (soma por post)", fmt: (v) => num(v) },
  { key: "views", label: "Visualizações", fmt: (v) => num(v) },
  { key: "profileVisits", label: "Visitas ao perfil", fmt: (v) => num(v) },
  { key: "newFollowers", label: "Novos seguidores", fmt: (v) => num(v) },
  { key: "followers", label: "Seguidores (fim)", fmt: (v) => num(v), stock: true },
  { key: "interactions", label: "Interações", fmt: (v) => num(v) },
  { key: "engagementRate", label: "Engajamento", fmt: (v) => pct(v, 2), ratio: true },
  { key: "clicks", label: "Cliques", fmt: (v) => num(v) },
  { key: "ctr", label: "CTR", fmt: (v) => pct(v, 2), ratio: true },
  { key: "cpm", label: "CPM", fmt: (v) => brl(v), ratio: true },
  { key: "siteVisits", label: "Visitas ao site", fmt: (v) => num(v) },
  { key: "carts", label: "Carrinhos", fmt: (v) => num(v, 1) },
  { key: "checkouts", label: "Checkouts", fmt: (v) => num(v, 1) },
  { key: "purchases", label: "Compras", fmt: (v) => num(v, 1) },
  { key: "revenue", label: "Receita", fmt: (v) => brl(v, 0) },
  { key: "cpa", label: "CPA (combinado)", fmt: (v) => brl(v), ratio: true },
  { key: "roas", label: "ROAS (combinado)", fmt: (v) => num(v, 2), ratio: true },
];

export const IND = Object.fromEntries(INDICATORS.map((i) => [i.key, i])) as Record<IndicatorKey, (typeof INDICATORS)[number]>;

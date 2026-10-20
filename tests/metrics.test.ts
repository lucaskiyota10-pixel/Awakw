import { describe, expect, it } from "vitest";
import { simulateMetrics, deriveCosts, compareAb, type MetricsInput } from "@/lib/sim/metrics";
import { defaultMetrics } from "@/lib/sim/defaults";

const base = (): MetricsInput => ({
  budgetMode: "TOTAL",
  totalBudget: 10000,
  dailyBudget: 0,
  durationDays: 30,
  media: { costBasis: "CPM", cpm: 20, cpc: 0, ctr: 0.01, frequency: 2 },
  funnel: { landingRate: 0.8, addToCartRate: 0.1, checkoutRate: 0.5, purchaseRate: 0.5, averageTicket: 400 },
  campaigns: [],
});

describe("simulador de métricas", () => {
  it("calcula a cadeia impressões → cliques → funil → receita", () => {
    const r = simulateMetrics(base());
    expect(r.ok).toBe(true);
    const t = r.total!;
    expect(t.impressions).toBeCloseTo(500000);
    expect(t.clicks).toBeCloseTo(5000);
    expect(t.cpc).toBeCloseTo(2); // 20 / (1000 × 0,01)
    expect(t.sessions).toBeCloseTo(4000);
    expect(t.carts).toBeCloseTo(400);
    expect(t.checkouts).toBeCloseTo(200);
    expect(t.purchases).toBeCloseTo(100);
    expect(t.revenue).toBeCloseTo(40000);
    expect(t.cpa).toBeCloseTo(100);
    expect(t.roas).toBeCloseTo(4);
    expect(r.campaigns[0].reach).toBeCloseTo(250000);
  });

  it("CPC, CPM e CTR são consistentes nas duas bases de custo", () => {
    const a = deriveCosts({ costBasis: "CPM", cpm: 30, cpc: 999, ctr: 0.015, frequency: null });
    expect(a.cpc).toBeCloseTo(2);
    const b = deriveCosts({ costBasis: "CPC", cpm: 999, cpc: 2, ctr: 0.015, frequency: null });
    expect(b.cpm).toBeCloseTo(30);
  });

  it("não inventa alcance sem frequência nem sessões sem premissa", () => {
    const i = base();
    i.media.frequency = null;
    i.funnel.landingRate = null;
    const r = simulateMetrics(i);
    expect(r.campaigns[0].reach).toBeNull();
    expect(r.total!.sessions).toBeNull();
    expect(r.total!.funnelBase).toBe("CLICKS");
    expect(r.warnings.join(" ")).toMatch(/frequência/);
  });

  it("exige distribuição por campanha somando 100%", () => {
    const i = base();
    i.campaigns = [
      { id: "a", name: "A", share: 0.5 },
      { id: "b", name: "B", share: 0.4 },
    ];
    const r = simulateMetrics(i);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/90\.0%/);
  });

  it("totais recalculam taxas a partir das somas (não média simples)", () => {
    const r = simulateMetrics(defaultMetrics("MODERATE"));
    expect(r.ok).toBe(true);
    const t = r.total!;
    expect(t.budget).toBeCloseTo(10000);
    expect(t.ctr).toBeCloseTo(t.clicks / t.impressions);
    expect(t.cpm).toBeCloseTo((t.budget / t.impressions) * 1000);
    expect(t.reach).toBeNull(); // alcance não é somável entre campanhas
  });

  it("orçamento diário × duração", () => {
    const i = base();
    i.budgetMode = "DAILY";
    i.dailyBudget = 100;
    const r = simulateMetrics(i);
    expect(r.totalBudget).toBe(3000);
  });

  it("rejeita CTR fora do intervalo", () => {
    const i = base();
    i.media.ctr = 0;
    expect(simulateMetrics(i).ok).toBe(false);
  });

  it("A/B compara hipóteses com mesma verba", () => {
    const r = compareAb(1000, 20, 300, { label: "A", ctr: 0.01, conversionRate: 0.02 }, { label: "B", ctr: 0.015, conversionRate: 0.02 });
    expect(r.a.clicks).toBeCloseTo(500);
    expect(r.b.clicks).toBeCloseTo(750);
    expect(r.liftClicks).toBeCloseTo(0.5);
    expect(r.winner).toBe("B");
  });
});

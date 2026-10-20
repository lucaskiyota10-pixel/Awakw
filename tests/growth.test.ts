import { describe, expect, it } from "vitest";
import { simulateGrowth, dailyBudgets, horizonEnd, type GrowthPremises } from "@/lib/sim/growth";
import { aggregate, cumulative, upTo, variation } from "@/lib/sim/aggregate";
import { defaultGrowth } from "@/lib/sim/defaults";
import { addMonths, relativeMonth } from "@/lib/sim/dates";

const linear = (over: Partial<GrowthPremises> = {}): GrowthPremises => ({
  ...defaultGrowth("MODERATE"),
  saturationEnabled: false,
  monthlyCpmIncrease: 0,
  seasonalityEnabled: false,
  monthlyConversionChange: 0,
  ...over,
});

describe("datas", () => {
  it("addMonths respeita fim de mês", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2026-11-09", 12)).toBe("2027-11-09");
  });
  it("mês relativo", () => {
    expect(relativeMonth("2026-11-09", "2026-12-08")).toBe(0);
    expect(relativeMonth("2026-11-09", "2026-12-09")).toBe(1);
  });
});

describe("horizontes", () => {
  it("semana = 7 dias, ano = 12 meses", () => {
    expect(horizonEnd({ startDate: "2026-11-09", horizon: "WEEK" })).toBe("2026-11-16");
    expect(horizonEnd({ startDate: "2026-11-09", horizon: "YEAR" })).toBe("2027-11-09");
    expect(simulateGrowth(linear({ horizon: "WEEK" })).days).toHaveLength(7);
    expect(simulateGrowth(linear({ horizon: "YEAR" })).days).toHaveLength(365);
  });
});

describe("orçamento", () => {
  it("orçamento único NÃO é multiplicado por 12", () => {
    const r = simulateGrowth(linear({ budgetMode: "ONE_TIME", oneTimeBudget: 10000, spendDays: 90 }));
    expect(r.totalInvestment).toBeCloseTo(10000);
    expect(r.days.slice(90).every((d) => d.budget === 0)).toBe(true);
  });
  it("investimento mensal recorrente soma exatamente meses × valor", () => {
    const r = simulateGrowth(linear({ budgetMode: "MONTHLY", monthlyBudget: 2000, monthsOfInvestment: 12 }));
    expect(r.totalInvestment).toBeCloseTo(24000, 6);
    expect(r.investmentExplanation).toMatch(/recorrente/);
    const r6 = simulateGrowth(linear({ budgetMode: "MONTHLY", monthlyBudget: 2000, monthsOfInvestment: 6 }));
    expect(r6.totalInvestment).toBeCloseTo(12000, 6);
  });
  it("curvas de gasto preservam o total", () => {
    for (const spendCurve of ["UNIFORM", "FRONT_LOADED", "BACK_LOADED"] as const) {
      const b = dailyBudgets(linear({ oneTimeBudget: 15000, spendDays: 30, spendCurve }), 60);
      expect(b.reduce((a, x) => a + x, 0)).toBeCloseTo(15000);
    }
    const f = dailyBudgets(linear({ spendDays: 30, spendCurve: "FRONT_LOADED" }), 30);
    expect(f[0]).toBeGreaterThan(f[29]);
  });
});

describe("não proporcionalidade", () => {
  it("modelo linear sem ajustes é avisado", () => {
    const r = simulateGrowth(linear());
    expect(r.warnings.join(" ")).toMatch(/linear/);
  });
  it("com saturação, dobrar verba NÃO dobra cliques", () => {
    const sat = { saturationEnabled: true, saturationK: 0.3, audienceSize: 100000 };
    const a = simulateGrowth(linear({ ...sat, oneTimeBudget: 10000 }));
    const b = simulateGrowth(linear({ ...sat, oneTimeBudget: 20000 }));
    const clicks = (r: typeof a) => r.days.reduce((s, d) => s + d.clicks, 0);
    expect(clicks(b) / clicks(a)).toBeLessThan(1.95);
    expect(clicks(b)).toBeGreaterThan(clicks(a));
  });
  it("alcance único nunca excede o público", () => {
    const r = simulateGrowth(linear({ audienceSize: 50000, oneTimeBudget: 50000 }));
    const last = r.days[r.days.length - 1];
    expect(last.reachCumulative!).toBeLessThanOrEqual(50000);
  });
  it("sem tamanho de público não há alcance", () => {
    const r = simulateGrowth(linear({ audienceSize: null }));
    expect(r.days[0].reachCumulative).toBeNull();
  });
  it("aumento de CPM reduz impressões ao longo do tempo", () => {
    const r = simulateGrowth(linear({ monthlyCpmIncrease: 0.05, spendDays: 365 }));
    expect(r.days[300].impressions).toBeLessThan(r.days[0].impressions);
  });
});

describe("agregação", () => {
  const r = simulateGrowth(defaultGrowth("MODERATE"));
  it("somas dos períodos batem com o total diário em todas as granularidades", () => {
    const totalRevenue = r.days.reduce((s, d) => s + d.revenue, 0);
    for (const g of ["WEEK", "MONTH", "QUARTER", "SEMESTER", "YEAR"] as const) {
      const rows = aggregate(r.days, "2026-11-09", r.endDate, g);
      expect(rows.reduce((s, x) => s + x.revenue, 0)).toBeCloseTo(totalRevenue, 4);
      expect(rows.reduce((s, x) => s + x.budget, 0)).toBeCloseTo(r.totalInvestment, 4);
    }
    expect(aggregate(r.days, "2026-11-09", r.endDate, "MONTH")).toHaveLength(12);
    expect(aggregate(r.days, "2026-11-09", r.endDate, "QUARTER")).toHaveLength(4);
    expect(aggregate(r.days, "2026-11-09", r.endDate, "SEMESTER")).toHaveLength(2);
  });
  it("acumulado e alcance", () => {
    const rows = aggregate(r.days, "2026-11-09", r.endDate, "MONTH");
    const cum = cumulative(rows);
    expect(cum[11].purchases).toBeCloseTo(rows.reduce((s, x) => s + x.purchases, 0), 6);
    const reachSum = rows.reduce((s, x) => s + (x.reach ?? 0), 0);
    expect(reachSum).toBeCloseTo(r.days[r.days.length - 1].reachCumulative!, 4);
    expect(cum[11].followers).toBeCloseTo(rows[11].followers);
  });
  it("variação absoluta e percentual", () => {
    expect(variation(100, 150)).toEqual({ abs: 50, pct: 0.5 });
    expect(variation(0, 10).pct).toBeNull();
    expect(variation(null, 10).abs).toBeNull();
  });
  it("acumulado até um marco", () => {
    const m = upTo(r.days, "2026-11-09", "2026-12-08");
    expect(m!.days).toBe(30);
  });
});

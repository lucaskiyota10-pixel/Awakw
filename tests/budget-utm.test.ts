import { describe, expect, it } from "vitest";
import { SUGGESTED_ALLOCATIONS, validateAllocations, rebalance, scaleTo, percentages } from "@/lib/budget";
import { buildUtmUrl, normalizeUtmValue } from "@/lib/utm";

describe("verba", () => {
  it("sugestão 30/60/10 soma 10.000", () => {
    const v = validateAllocations(10000, SUGGESTED_ALLOCATIONS);
    expect(v.ok).toBe(true);
    expect(percentages(10000, SUGGESTED_ALLOCATIONS).map((a) => a.pct)).toEqual([0.3, 0.6, 0.1]);
  });
  it("detecta soma divergente", () => {
    const v = validateAllocations(10000, [{ key: "a", label: "A", amount: 9000 }]);
    expect(v.ok).toBe(false);
  });
  it("rebalanceia mantendo o total", () => {
    const r = rebalance(10000, SUGGESTED_ALLOCATIONS, "tests", 2000);
    expect(r.reduce((s, a) => s + a.amount, 0)).toBeCloseTo(10000);
    expect(r.find((a) => a.key === "tests")!.amount).toBe(2000);
    expect(validateAllocations(10000, r).ok).toBe(true);
  });
  it("escala para novo total mantendo percentuais", () => {
    const r = scaleTo(15000, 10000, SUGGESTED_ALLOCATIONS);
    expect(r.map((a) => a.amount)).toEqual([4500, 9000, 1500]);
  });
});

describe("UTM", () => {
  it("gera URL codificada", () => {
    const r = buildUtmUrl({ baseUrl: "https://awake.example/loja?x=1", source: "Instagram", medium: "paid social", campaign: "Lançamento Novembro", content: "reel A&B" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url).toContain("x=1");
      expect(r.url).toContain("utm_medium=paid_social");
      expect(r.url).toContain("utm_campaign=lancamento_novembro");
      expect(r.url).toContain("utm_content=reel_a%26b");
    }
  });
  it("valida obrigatórios e URL", () => {
    expect(buildUtmUrl({ baseUrl: "awake", source: "a", medium: "b", campaign: "c" }).ok).toBe(false);
    expect(buildUtmUrl({ baseUrl: "https://a.com", source: "", medium: "b", campaign: "c" }).ok).toBe(false);
    expect(normalizeUtmValue(" Ação  Verão ")).toBe("acao_verao");
  });
});

"use client";

import { useMemo, useState } from "react";
import { Chart } from "@/components/charts";
import { NumInput } from "@/components/sim-inputs";
import { simulateGrowth, type GrowthPremises } from "@/lib/sim/growth";
import { aggregate, cumulative } from "@/lib/sim/aggregate";
import { readGrowth } from "@/lib/sim/scenario";
import { LEVEL_LABEL } from "@/lib/sim/defaults";
import { brl, num, signedPct } from "@/lib/format";
import type { ScenarioLite } from "@/components/ScenarioBar";

function totals(p: GrowthPremises) {
  const r = simulateGrowth(p);
  if (!r.ok) return null;
  const rows = aggregate(r.days, p.startDate, r.endDate, "MONTH");
  const c = cumulative(rows);
  return { r, rows, cum: c, t: c[c.length - 1] };
}

/** Comparação de cenários salvos (conservador × moderado × otimista ou estratégias). */
export function CompareScenarios({ scenarios }: { scenarios: ScenarioLite[] }) {
  const [ids, setIds] = useState<string[]>(() => scenarios.slice(0, 3).map((s) => s.id));
  const [metric, setMetric] = useState<"revenue" | "followers" | "purchases" | "budget">("revenue");
  const data = useMemo(() => scenarios.filter((s) => ids.includes(s.id)).map((s) => ({ s, x: totals(readGrowth(s.premises).values) })), [scenarios, ids]);
  const maxLen = Math.max(0, ...data.map((d) => d.x?.cum.length ?? 0));
  const chart = Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, unknown> = { mes: `M${i + 1}` };
    data.forEach((d, j) => (row[`s${j}`] = d.x?.cum[i]?.[metric] ?? null));
    return row;
  });
  return (
    <section className="card space-y-4">
      <h2 className="card-title">Comparar cenários salvos</h2>
      <div className="flex flex-wrap gap-3 text-sm">
        {scenarios.map((s) => <label key={s.id} className="flex items-center gap-1"><input type="checkbox" checked={ids.includes(s.id)} onChange={(e) => setIds(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} />{s.name}</label>)}
      </div>
      <select className="input w-56" value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} aria-label="Indicador acumulado">
        <option value="revenue">Receita acumulada</option>
        <option value="purchases">Compras acumuladas</option>
        <option value="followers">Seguidores</option>
        <option value="budget">Investimento acumulado</option>
      </select>
      <Chart kind="line" data={chart} x="mes" series={data.map((d, j) => ({ key: `s${j}`, label: d.s.name }))} format={(v) => (metric === "revenue" || metric === "budget" ? brl(v, 0) : num(v))} />
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Cenário</th><th>Nível</th><th>Investimento</th><th>Impressões</th><th>Seguidores</th><th>Compras</th><th>Receita</th><th>CPA</th><th>ROAS</th><th>Receita vs 1º</th></tr></thead>
          <tbody>
            {data.map(({ s, x }) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{LEVEL_LABEL[s.level as keyof typeof LEVEL_LABEL]}</td>
                {x ? (
                  <><td>{brl(x.r.totalInvestment, 0)}</td><td>{num(x.t.impressions)}</td><td>{num(x.t.followers)}</td><td>{num(x.t.purchases, 1)}</td><td>{brl(x.t.revenue, 0)}</td><td>{brl(x.t.cpa)}</td><td>{num(x.t.roas, 2)}</td>
                  <td>{data[0].x && data[0].x.t.revenue > 0 ? signedPct((x.t.revenue - data[0].x.t.revenue) / data[0].x.t.revenue) : "—"}</td></>
                ) : <td colSpan={8} className="text-red-700">Premissas inválidas</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Mesmo cenário, orçamentos diferentes (R$ 10k, 15k, 20k ou qualquer valor). */
export function BudgetComparison({ v }: { v: GrowthPremises }) {
  const [custom, setCustom] = useState(25000);
  const key = v.budgetMode === "ONE_TIME" ? "oneTimeBudget" : "monthlyBudget";
  const values = v.budgetMode === "ONE_TIME" ? [10000, 15000, 20000, custom] : [1000, 2000, 3000, custom];
  const rows = useMemo(() => values.map((b) => ({ b, x: totals({ ...v, [key]: b }) })), [v, custom]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="card space-y-3">
      <h2 className="card-title">Comparação de orçamentos ({v.budgetMode === "ONE_TIME" ? "valor único" : "valor mensal"})</h2>
      <p className="text-sm text-carvao/70">Mesmas premissas, só o orçamento muda. A coluna “compras por R$ 1.000 adicionais” mostra o rendimento marginal — com saturação e custos crescentes ele cai, evidenciando que o crescimento não é proporcional.</p>
      <label className="flex items-center gap-2 text-sm">Valor personalizado (R$): <NumInput className="input w-32" value={custom} onChange={setCustom} /></label>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>{v.budgetMode === "ONE_TIME" ? "Valor único" : "Valor/mês"}</th><th>Total investido</th><th>Impressões</th><th>Cliques</th><th>Compras</th><th>Receita</th><th>CPA</th><th>ROAS</th><th>Seguidores</th><th>Compras por R$ 1.000 adicionais</th></tr></thead>
          <tbody>
            {rows.map(({ b, x }, i) => {
              const prev = i > 0 ? rows[i - 1] : null;
              const marginal = prev?.x && x && x.r.totalInvestment !== prev.x.r.totalInvestment ? ((x.t.purchases - prev.x.t.purchases) / (x.r.totalInvestment - prev.x.r.totalInvestment)) * 1000 : null;
              return (
                <tr key={i}>
                  <td className="font-medium">{brl(b, 0)}</td>
                  {x ? (
                    <><td>{brl(x.r.totalInvestment, 0)}</td><td>{num(x.t.impressions)}</td><td>{num(x.t.clicks)}</td><td>{num(x.t.purchases, 1)}</td><td>{brl(x.t.revenue, 0)}</td><td>{brl(x.t.cpa)}</td><td>{num(x.t.roas, 2)}</td><td>{num(x.t.followers)}</td><td>{marginal === null ? "—" : num(marginal, 2)}</td></>
                  ) : <td colSpan={9}>Premissas inválidas</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const STRATEGIES: { id: string; label: string; change: string; apply: (v: GrowthPremises) => GrowthPremises }[] = [
  { id: "reels", label: "Mais Reels", change: "+2 Reels por semana", apply: (v) => ({ ...v, reelsPerWeek: v.reelsPerWeek + 2 }) },
  { id: "freq", label: "Frequência dobrada", change: "Posts/carrosséis por semana × 2", apply: (v) => ({ ...v, postsPerWeek: v.postsPerWeek * 2 }) },
  { id: "front", label: "Verba concentrada no início", change: "Distribuição do orçamento único concentrada no início", apply: (v) => ({ ...v, spendCurve: "FRONT_LOADED" }) },
  {
    id: "spread",
    label: "Mesma verba diluída em 12 meses",
    change: "Orçamento único convertido em 12 parcelas mensais (mesmo total)",
    apply: (v) => (v.budgetMode === "ONE_TIME" ? { ...v, budgetMode: "MONTHLY", monthlyBudget: v.oneTimeBudget / 12, monthsOfInvestment: 12 } : v),
  },
  { id: "awareness", label: "Ênfase em reconhecimento", change: "Hipótese: CPM −20% e CTR −30% (mais alcance, menos cliques)", apply: (v) => ({ ...v, cpm: v.cpm * 0.8, ctr: v.ctr * 0.7 }) },
  { id: "conversion", label: "Ênfase em conversão", change: "Hipótese: CPM +25%, CTR +30% e conclusão de compra +10%", apply: (v) => ({ ...v, cpm: v.cpm * 1.25, ctr: v.ctr * 1.3, purchaseRate: Math.min(1, v.purchaseRate * 1.1) }) },
];

/** Estratégias como variações explícitas de premissas — sem atribuição causal. */
export function StrategyComparison({ v }: { v: GrowthPremises }) {
  const base = useMemo(() => totals(v), [v]);
  const rows = useMemo(() => STRATEGIES.map((s) => ({ s, x: totals(s.apply(v)) })), [v]);
  const d = (a: number, b: number) => (a > 0 ? signedPct((b - a) / a) : "—");
  if (!base) return null;
  return (
    <section className="card space-y-3">
      <h2 className="card-title">Comparação de estratégias</h2>
      <p className="text-sm text-carvao/70">Cada estratégia altera apenas as premissas descritas. As diferenças decorrem exclusivamente dessas alterações declaradas — não comprovam causalidade.</p>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Estratégia</th><th>Premissas alteradas</th><th>Investimento</th><th>Seguidores</th><th>Visualizações</th><th>Compras</th><th>Receita</th><th>CPA</th></tr></thead>
          <tbody>
            <tr className="bg-areia/40 font-medium"><td>Base (cenário atual)</td><td>—</td><td>{brl(base.r.totalInvestment, 0)}</td><td>{num(base.t.followers)}</td><td>{num(base.t.views)}</td><td>{num(base.t.purchases, 1)}</td><td>{brl(base.t.revenue, 0)}</td><td>{brl(base.t.cpa)}</td></tr>
            {rows.map(({ s, x }) => (
              <tr key={s.id}>
                <td className="font-medium">{s.label}</td><td className="text-xs">{s.change}</td>
                {x ? (
                  <><td>{brl(x.r.totalInvestment, 0)}</td><td>{num(x.t.followers)} <span className="text-xs text-carvao/60">{d(base.t.followers, x.t.followers)}</span></td><td>{num(x.t.views)} <span className="text-xs text-carvao/60">{d(base.t.views, x.t.views)}</span></td><td>{num(x.t.purchases, 1)} <span className="text-xs text-carvao/60">{d(base.t.purchases, x.t.purchases)}</span></td><td>{brl(x.t.revenue, 0)} <span className="text-xs text-carvao/60">{d(base.t.revenue, x.t.revenue)}</span></td><td>{brl(x.t.cpa)}</td></>
                ) : <td colSpan={6}>—</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

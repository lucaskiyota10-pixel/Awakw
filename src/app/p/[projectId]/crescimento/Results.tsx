"use client";

import { useMemo, useState } from "react";
import { Chart, Stat } from "@/components/charts";
import { Tabs, Term } from "@/components/ui";
import { downloadCsv } from "@/components/ScenarioBar";
import { aggregate, cumulative, variation, GRANULARITY_LABEL, type Granularity } from "@/lib/sim/aggregate";
import type { GrowthOutput, GrowthPremises } from "@/lib/sim/growth";
import { fmtBr } from "@/lib/sim/dates";
import { brl, num, signedNum, signedPct } from "@/lib/format";
import { INDICATORS, IND, type IndicatorKey } from "./indicators";

export function Results({ v, out }: { v: GrowthPremises; out: GrowthOutput }) {
  const [g, setG] = useState<Granularity>("MONTH");
  const [mode, setMode] = useState<"period" | "cumulative">("period");
  const [metric, setMetric] = useState<IndicatorKey>("revenue");
  const rows = useMemo(() => (out.ok ? aggregate(out.days, v.startDate, out.endDate, g) : []), [out, v.startDate, g]);
  const shown = mode === "period" ? rows : cumulative(rows);
  const cum = cumulative(rows);
  const total = cum[cum.length - 1];
  const ind = IND[metric];
  const chartData = rows.map((r, i) => ({ periodo: r.label.replace(GRANULARITY_LABEL[g], g === "WEEK" ? "S" : g === "MONTH" ? "M" : g === "QUARTER" ? "T" : g === "SEMESTER" ? "Sem" : "A"), valor: r[metric] ?? 0, acumulado: ind.ratio || ind.stock ? null : cum[i][metric] }));

  if (!out.ok) return null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
        <Stat tone="sim" label="Investimento total" value={brl(out.totalInvestment, 0)} hint={v.budgetMode === "ONE_TIME" ? "Orçamento único" : "Mensal recorrente"} />
        <Stat tone="sim" label="Receita hipotética" value={brl(total?.revenue ?? 0, 0)} hint={<>ROAS combinado {num(total?.roas, 2)}</>} />
        <Stat tone="sim" label="Compras hipotéticas" value={num(total?.purchases ?? 0)} hint={<>CPA combinado {brl(total?.cpa)}</>} />
        <Stat tone="sim" label="Seguidores hipotéticos" value={num(total?.followers ?? 0)} hint={`+${num(total?.newFollowers ?? 0)} no período`} />
        <Stat tone="sim" label={<Term k="Alcance">Alcance pago único</Term>} value={total?.reachCumulative === null ? "—" : num(total?.reachCumulative)} hint={total?.reachCumulative === null ? "Informe o tamanho do público" : `Impressões: ${num(total?.impressions)}`} />
        <Stat tone="sim" label="Visualizações" value={num(total?.views ?? 0)} />
        <Stat tone="sim" label="Interações" value={num(total?.interactions ?? 0)} hint={<>Engajamento {IND.engagementRate.fmt(total?.engagementRate ?? null)}</>} />
        <Stat tone="sim" label="Visitas ao site" value={num(total?.siteVisits ?? 0)} hint={<>Cliques pagos {num(total?.clicks)}</>} />
      </div>
      <p className="text-xs text-carvao/60">{out.investmentExplanation} Período: {fmtBr(v.startDate)} a {fmtBr(rows[rows.length - 1]?.end ?? v.startDate)}. CPA/ROAS “combinados” incluem vendas orgânicas e não indicam atribuição causal.</p>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={g} onChange={setG} items={(Object.keys(GRANULARITY_LABEL) as Granularity[]).map((k) => ({ value: k, label: `${GRANULARITY_LABEL[k]} a ${GRANULARITY_LABEL[k].toLowerCase()}` }))} />
          <div className="flex flex-wrap gap-2">
            <select className="input w-56" value={metric} onChange={(e) => setMetric(e.target.value as IndicatorKey)} aria-label="Indicador">{INDICATORS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select>
            <Tabs value={mode} onChange={setMode} items={[{ value: "period", label: "Por período" }, { value: "cumulative", label: "Acumulado" }]} />
          </div>
        </div>
        <Chart
          kind="composed"
          data={chartData}
          x="periodo"
          format={(x) => ind.fmt(x)}
          series={[{ key: "valor", label: `${ind.label} no período` }, ...(ind.ratio || ind.stock ? [] : [{ key: "acumulado", label: "Acumulado", type: "line" as const, axis: "right" as const }])]}
        />
        <div className="overflow-x-auto">
          <table className="table text-xs">
            <thead>
              <tr>
                <th>Período</th>
                <th>Datas</th>
                <th className="bg-areia/50">{ind.label}</th>
                <th className="bg-areia/50">Δ abs. vs anterior</th>
                <th className="bg-areia/50">Δ %</th>
                {INDICATORS.filter((i) => i.key !== metric).map((i) => <th key={i.key}>{i.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const prev = i > 0 ? shown[i - 1][metric] : null;
                const d = variation(prev, r[metric]);
                return (
                  <tr key={r.label}>
                    <td className="whitespace-nowrap font-medium">{r.label}{!r.complete && <span className="text-carvao/50"> (parcial)</span>}</td>
                    <td className="whitespace-nowrap">{fmtBr(r.start)}–{fmtBr(r.end)}</td>
                    <td className="bg-areia/30 font-medium">{ind.fmt(r[metric])}</td>
                    <td className="bg-areia/30">{i === 0 ? "—" : ind.key === "budget" || ind.key === "revenue" || ind.key === "cpa" || ind.key === "cpm" ? (d.abs === null ? "—" : `${d.abs >= 0 ? "+" : ""}${brl(d.abs, 0)}`) : signedNum(d.abs, ind.ratio ? 4 : 0)}</td>
                    <td className="bg-areia/30">{i === 0 ? "—" : signedPct(d.pct)}</td>
                    {INDICATORS.filter((x) => x.key !== metric).map((x) => <td key={x.key} className="whitespace-nowrap">{x.fmt(r[x.key])}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          className="btn-secondary btn-sm"
          onClick={() => downloadCsv(`growth-${g.toLowerCase()}-${mode}.csv`, [["SIMULAÇÃO ACADÊMICA — RESULTADOS HIPOTÉTICOS. NÃO REPRESENTAM DESEMPENHO GARANTIDO."], ["Período", "Início", "Fim", ...INDICATORS.map((i) => i.label)], ...shown.map((r) => [r.label, r.start, r.end, ...INDICATORS.map((i) => (r[i.key] === null ? null : Math.round((r[i.key] as number) * 10000) / 10000))])])}
        >
          Exportar tabela (CSV)
        </button>
      </section>
    </div>
  );
}

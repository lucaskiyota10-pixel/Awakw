"use client";

import { useMemo, useState } from "react";
import { PageHeader, SimBanner, Term, Field } from "@/components/ui";
import { NumInput, Premise, OriginTag } from "@/components/sim-inputs";
import { ScenarioBar, downloadCsv, type ScenarioLite } from "@/components/ScenarioBar";
import { Chart, Stat } from "@/components/charts";
import { useProject } from "@/components/project-context";
import { deriveCosts, simulateMetrics, type MetricsInput, type MetricsResult } from "@/lib/sim/metrics";
import { defaultMetrics, defaultMetricsSources, LEVEL_LABEL } from "@/lib/sim/defaults";
import { readMetrics } from "@/lib/sim/scenario";
import type { SourceMap } from "@/lib/sim/origin";
import { brl, num, pct } from "@/lib/format";

export function MetricsSim({ scenarios, initialId }: { scenarios: ScenarioLite[]; initialId: string | null }) {
  const p = useProject();
  const init = scenarios.find((s) => s.id === initialId);
  const [currentId, setCurrentId] = useState<string | null>(init?.id ?? null);
  const [v, setV] = useState<MetricsInput>(() => (init ? readMetrics(init.premises).values : defaultMetrics("MODERATE")));
  const [sources, setSources] = useState<SourceMap>(() => (init ? readMetrics(init.premises).sources : defaultMetricsSources()));
  const [compareIds, setCompareIds] = useState<string[]>(() => scenarios.slice(0, 3).map((s) => s.id));
  const out = useMemo(() => simulateMetrics(v), [v]);
  const ro = !p.can("edit");
  const media = (patch: Partial<MetricsInput["media"]>) => setV({ ...v, media: { ...v.media, ...patch } });
  const funnel = (patch: Partial<MetricsInput["funnel"]>) => setV({ ...v, funnel: { ...v.funnel, ...patch } });
  const shareSum = v.campaigns.reduce((s, c) => s + c.share, 0);

  const comparison = useMemo(
    () => scenarios.filter((s) => compareIds.includes(s.id)).map((s) => ({ s, r: simulateMetrics(readMetrics(s.premises).values) })),
    [scenarios, compareIds],
  );

  const rowsFor = (r: MetricsResult) => [
    r.name, r.budget, r.impressions, r.reach, r.clicks, r.ctr, r.cpm, r.cpc, r.sessions, r.carts, r.checkouts, r.purchases, r.revenue, r.cpa, r.roas,
  ];

  return (
    <div>
      <PageHeader title="Simulador de métricas e investimento" subtitle="Premissas editáveis com origem declarada. CPM, CPC e CTR são consistentes entre si: escolha a base de custo e o CTR; a terceira métrica é derivada." />
      <SimBanner className="mb-4" />
      <ScenarioBar
        kind="METRICS"
        scenarios={scenarios}
        currentId={currentId}
        values={v}
        sources={sources}
        onLoad={(s) => {
          setCurrentId(s?.id ?? null);
          if (s) {
            const r = readMetrics(s.premises);
            setV(r.values);
            setSources(r.sources);
          }
        }}
        onPreset={(l) => { setCurrentId(null); setV(defaultMetrics(l)); setSources(defaultMetricsSources()); }}
        extra={out.ok && out.total && (
          <button className="btn-secondary btn-sm" onClick={() => downloadCsv("simulacao-metricas.csv", [["SIMULAÇÃO ACADÊMICA — RESULTADOS HIPOTÉTICOS"], ["Campanha", "Investimento", "Impressões", "Alcance", "Cliques", "CTR", "CPM", "CPC", "Sessões", "Carrinhos", "Checkouts", "Compras", "Receita", "CPA", "ROAS"], ...out.campaigns.map(rowsFor), rowsFor(out.total!)])}>Exportar CSV</button>
        )}
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <fieldset disabled={ro} className="space-y-5">
          <section className="card space-y-3">
            <h2 className="card-title">Investimento</h2>
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="radio" checked={v.budgetMode === "TOTAL"} onChange={() => setV({ ...v, budgetMode: "TOTAL" })} /> Total do período</label>
              <label className="flex items-center gap-1"><input type="radio" checked={v.budgetMode === "DAILY"} onChange={() => setV({ ...v, budgetMode: "DAILY" })} /> Diário</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {v.budgetMode === "TOTAL" ? (
                <Premise k="totalBudget" label="Investimento total (R$)" sources={sources} setSources={setSources}><NumInput value={v.totalBudget} onChange={(x) => setV({ ...v, totalBudget: x })} /></Premise>
              ) : (
                <Premise k="dailyBudget" label="Investimento diário (R$)" sources={sources} setSources={setSources}><NumInput value={v.dailyBudget} onChange={(x) => setV({ ...v, dailyBudget: x })} /></Premise>
              )}
              <Premise k="durationDays" label="Duração (dias)" sources={sources} setSources={setSources}><NumInput value={v.durationDays} onChange={(x) => setV({ ...v, durationDays: Math.round(x) })} /></Premise>
            </div>
            <p className="text-xs text-carvao/60">{v.budgetMode === "TOTAL" ? `Equivale a ${brl(out.dailyBudget)} por dia (cálculo).` : `Total do período: ${brl(out.totalBudget)} (cálculo).`}</p>
          </section>
          <section className="card space-y-3">
            <h2 className="card-title">Mídia</h2>
            <div className="flex gap-3 text-sm">
              <span className="label mb-0">Base de custo:</span>
              <label className="flex items-center gap-1"><input type="radio" checked={v.media.costBasis === "CPM"} onChange={() => media({ costBasis: "CPM" })} /> CPM</label>
              <label className="flex items-center gap-1"><input type="radio" checked={v.media.costBasis === "CPC"} onChange={() => media({ costBasis: "CPC" })} /> CPC</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {v.media.costBasis === "CPM" ? (
                <Premise k="cpm" label={<Term k="CPM">CPM (R$)</Term>} sources={sources} setSources={setSources}><NumInput value={v.media.cpm} onChange={(x) => media({ cpm: x })} /></Premise>
              ) : (
                <Premise k="cpc" label={<Term k="CPC">CPC (R$)</Term>} sources={sources} setSources={setSources}><NumInput value={v.media.cpc} onChange={(x) => media({ cpc: x })} /></Premise>
              )}
              <Premise k="ctr" label={<Term k="CTR" />} sources={sources} setSources={setSources}><NumInput percent value={v.media.ctr} onChange={(x) => media({ ctr: x })} /></Premise>
              <div>
                <span className="label">{v.media.costBasis === "CPM" ? "CPC derivado" : "CPM derivado"}</span>
                <p className="input bg-areia/30">{v.media.ctr > 0 ? brl(v.media.costBasis === "CPM" ? deriveCosts(v.media).cpc : deriveCosts(v.media).cpm) : "—"} <OriginTag origin="CALCULATION" /></p>
              </div>
              <Premise k="frequency" label={<Term k="Frequência" />} sources={sources} setSources={setSources}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={v.media.frequency !== null} onChange={(e) => media({ frequency: e.target.checked ? 2 : null })} aria-label="Usar premissa de frequência" />
                  <NumInput value={v.media.frequency} disabled={v.media.frequency === null} onChange={(x) => media({ frequency: x })} />
                </div>
              </Premise>
            </div>
          </section>
          <section className="card space-y-3">
            <h2 className="card-title">Funil e receita</h2>
            <div className="grid grid-cols-2 gap-3">
              <Premise k="landingRate" label={<Term k="Sessões">Chegada ao site (sessões/cliques)</Term>} sources={sources} setSources={setSources}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={v.funnel.landingRate !== null} onChange={(e) => funnel({ landingRate: e.target.checked ? 0.75 : null })} aria-label="Usar premissa de sessões" />
                  <NumInput percent value={v.funnel.landingRate} disabled={v.funnel.landingRate === null} onChange={(x) => funnel({ landingRate: x })} />
                </div>
              </Premise>
              <Premise k="addToCartRate" label="Adição ao carrinho" sources={sources} setSources={setSources}><NumInput percent value={v.funnel.addToCartRate} onChange={(x) => funnel({ addToCartRate: x })} /></Premise>
              <Premise k="checkoutRate" label="Início de checkout" sources={sources} setSources={setSources}><NumInput percent value={v.funnel.checkoutRate} onChange={(x) => funnel({ checkoutRate: x })} /></Premise>
              <Premise k="purchaseRate" label="Conclusão de compra" sources={sources} setSources={setSources}><NumInput percent value={v.funnel.purchaseRate} onChange={(x) => funnel({ purchaseRate: x })} /></Premise>
              <Premise k="averageTicket" label="Ticket médio (R$)" sources={sources} setSources={setSources}><NumInput value={v.funnel.averageTicket} onChange={(x) => funnel({ averageTicket: x })} /></Premise>
              <div>
                <span className="label">Conversão total (compras/cliques)</span>
                <p className="input bg-areia/30">{pct(out.total?.conversionRate ?? null, 2)} <OriginTag origin="CALCULATION" /></p>
              </div>
            </div>
          </section>
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Distribuição por campanha</h2>
              <span className={`text-xs ${Math.abs(shareSum - 1) > 0.0005 ? "font-medium text-red-700" : "text-carvao/60"}`}>Soma: {pct(shareSum)}</span>
            </div>
            {v.campaigns.map((c, i) => (
              <div key={c.id} className="grid grid-cols-[1fr_80px_80px_28px] items-end gap-2">
                <Field label="Campanha"><input className="input" value={c.name} onChange={(e) => setV({ ...v, campaigns: v.campaigns.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></Field>
                <Field label="% verba"><NumInput percent value={c.share} onChange={(x) => setV({ ...v, campaigns: v.campaigns.map((y, j) => (j === i ? { ...y, share: x } : y)) })} /></Field>
                <Field label="CTR próprio"><NumInput percent value={c.media?.ctr ?? null} onChange={(x) => setV({ ...v, campaigns: v.campaigns.map((y, j) => (j === i ? { ...y, media: { ...y.media, ctr: x } } : y)) })} /></Field>
                <button type="button" className="btn-ghost btn-sm mb-1" onClick={() => setV({ ...v, campaigns: v.campaigns.filter((_, j) => j !== i) })} aria-label="Remover campanha">✕</button>
              </div>
            ))}
            <button type="button" className="btn-secondary btn-sm" onClick={() => setV({ ...v, campaigns: [...v.campaigns, { id: crypto.randomUUID(), name: "Nova campanha", share: Math.max(0, 1 - shareSum) }] })}>Adicionar campanha</button>
            <p className="text-xs text-carvao/60">CTR próprio vazio = usa o CTR geral. Deixe a lista vazia para uma campanha única.</p>
          </section>
        </fieldset>

        <div className="min-w-0 space-y-6">
          {!out.ok && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <strong>Premissas inconsistentes:</strong>
              <ul className="list-disc pl-5">{out.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {out.warnings.length > 0 && <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{out.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
          {out.ok && out.total && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat tone="sim" label="Impressões" value={num(out.total.impressions)} hint={out.campaigns.length === 1 && out.campaigns[0].reach !== null ? `Alcance: ${num(out.campaigns[0].reach)}` : "Alcance por campanha na tabela"} />
                <Stat tone="sim" label="Cliques" value={num(out.total.clicks)} hint={<>CTR {pct(out.total.ctr, 2)} · CPC {brl(out.total.cpc)}</>} />
                <Stat tone="sim" label="Compras" value={num(out.total.purchases, 1)} hint={<>CPA {brl(out.total.cpa)}</>} />
                <Stat tone="sim" label="Receita" value={brl(out.total.revenue, 0)} hint={<>ROAS {num(out.total.roas, 2)}</>} />
              </div>
              <section className="card overflow-x-auto">
                <h2 className="card-title mb-3">Resultados por campanha</h2>
                <table className="table">
                  <thead>
                    <tr><th>Campanha</th><th>Verba</th><th>Impressões</th><th><Term k="Alcance" /></th><th>Cliques</th><th><Term k="CTR" /></th><th><Term k="CPM" /></th><th><Term k="CPC" /></th><th>Sessões</th><th>Carrinhos</th><th>Checkouts</th><th>Compras</th><th>Receita</th><th><Term k="CPA" /></th><th><Term k="ROAS" /></th></tr>
                  </thead>
                  <tbody>
                    {[...out.campaigns, out.total].map((r) => (
                      <tr key={r.name} className={r === out.total ? "bg-areia/40 font-medium" : ""}>
                        <td>{r.name}</td><td>{brl(r.budget, 0)}</td><td>{num(r.impressions)}</td><td>{r.reach === null ? <span title={r === out.total ? "Não somável entre campanhas (sobreposição)" : "Sem premissa de frequência"}>—</span> : num(r.reach)}</td>
                        <td>{num(r.clicks)}</td><td>{pct(r.ctr, 2)}</td><td>{brl(r.cpm)}</td><td>{brl(r.cpc)}</td><td>{r.sessions === null ? "—" : num(r.sessions)}</td><td>{num(r.carts, 1)}</td><td>{num(r.checkouts, 1)}</td><td>{num(r.purchases, 1)}</td><td>{brl(r.revenue, 0)}</td><td>{brl(r.cpa)}</td><td>{num(r.roas, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-carvao/60">Valores fracionados são médias esperadas. Totais recalculam taxas a partir das somas. Alcance total não é somado (sobreposição de públicos).</p>
              </section>
              <section className="card">
                <h2 className="card-title mb-3">Funil</h2>
                <Chart data={[
                  { etapa: "Cliques", valor: out.total.clicks },
                  ...(out.total.sessions !== null ? [{ etapa: "Sessões", valor: out.total.sessions }] : []),
                  { etapa: "Carrinhos", valor: out.total.carts },
                  { etapa: "Checkouts", valor: out.total.checkouts },
                  { etapa: "Compras", valor: out.total.purchases },
                ]} x="etapa" series={[{ key: "valor", label: "Quantidade" }]} height={240} />
              </section>
            </>
          )}
          <section className="card">
            <h2 className="card-title mb-3">Comparar cenários salvos</h2>
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              {scenarios.map((s) => (
                <label key={s.id} className="flex items-center gap-1"><input type="checkbox" checked={compareIds.includes(s.id)} onChange={(e) => setCompareIds(e.target.checked ? [...compareIds, s.id] : compareIds.filter((x) => x !== s.id))} />{s.name}</label>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Cenário</th><th>Nível</th><th>Investimento</th><th>Impressões</th><th>Cliques</th><th>CPC</th><th>Compras</th><th>Receita</th><th>CPA</th><th>ROAS</th></tr></thead>
                <tbody>
                  {comparison.map(({ s, r }) => (
                    <tr key={s.id}>
                      <td>{s.name}</td><td>{LEVEL_LABEL[s.level as keyof typeof LEVEL_LABEL]}</td>
                      {r.ok && r.total ? (
                        <><td>{brl(r.total.budget, 0)}</td><td>{num(r.total.impressions)}</td><td>{num(r.total.clicks)}</td><td>{brl(r.total.cpc)}</td><td>{num(r.total.purchases, 1)}</td><td>{brl(r.total.revenue, 0)}</td><td>{brl(r.total.cpa)}</td><td>{num(r.total.roas, 2)}</td></>
                      ) : <td colSpan={8} className="text-red-700">Premissas inválidas</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card text-sm">
            <h2 className="card-title mb-2">Fórmulas</h2>
            <ul className="list-disc space-y-1 pl-5 text-carvao/80">
              <li>Impressões = investimento ÷ CPM × 1000 (ou, na base CPC: CPM = CPC × 1000 × CTR)</li>
              <li>Cliques = impressões × CTR · CPC = investimento ÷ cliques = CPM ÷ (1000 × CTR)</li>
              <li>Alcance = impressões ÷ frequência (somente com premissa de frequência)</li>
              <li>Sessões = cliques × taxa de chegada (somente com premissa); sem ela, o funil parte dos cliques</li>
              <li>Carrinhos = sessões × adição ao carrinho · Checkouts = carrinhos × início de checkout · Compras = checkouts × conclusão</li>
              <li>Receita = compras × ticket médio · CPA = investimento ÷ compras · ROAS = receita ÷ investimento</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Field, Term } from "@/components/ui";
import { NumInput, Premise } from "@/components/sim-inputs";
import type { GrowthPremises } from "@/lib/sim/growth";
import type { SourceMap } from "@/lib/sim/origin";
import { brl } from "@/lib/format";
import { createContext, useContext } from "react";

const SrcCtx = createContext<{ sources: SourceMap; setSources: (s: SourceMap) => void; disabled: boolean } | null>(null);

/** Premissa estável (fora do render) — evita remontar inputs e perder o foco ao digitar. */
function P({ k, label, children }: { k: string; label: React.ReactNode; children: React.ReactNode }) {
  const c = useContext(SrcCtx)!;
  return <Premise k={k} label={label} sources={c.sources} setSources={c.setSources} disabled={c.disabled}>{children}</Premise>;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function GrowthInputs({ v, set, sources, setSources, totalInvestment, disabled }: { v: GrowthPremises; set: (p: Partial<GrowthPremises>) => void; sources: SourceMap; setSources: (s: SourceMap) => void; totalInvestment: number; disabled: boolean }) {
  return (
    <SrcCtx.Provider value={{ sources, setSources, disabled }}>
    <fieldset disabled={disabled} className="space-y-5">
      <details open className="card">
        <summary className="card-title cursor-pointer">Período</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <P k="startDate" label="Início"><input type="date" className="input" value={v.startDate} onChange={(e) => set({ startDate: e.target.value })} /></P>
          <Field label="Horizonte">
            <select className="input" value={v.horizon} onChange={(e) => set({ horizon: e.target.value as GrowthPremises["horizon"] })}>
              <option value="WEEK">Semanal (7 dias)</option>
              <option value="MONTH">Mensal (1 mês)</option>
              <option value="QUARTER">Trimestral (3 meses)</option>
              <option value="SEMESTER">Semestral (6 meses)</option>
              <option value="YEAR">Anual (12 meses)</option>
              <option value="CUSTOM">Personalizado</option>
            </select>
          </Field>
          {v.horizon === "CUSTOM" && <Field label="Fim (exclusivo)"><input type="date" className="input" value={v.endDate ?? ""} onChange={(e) => set({ endDate: e.target.value })} /></Field>}
        </div>
      </details>

      <details open className="card">
        <summary className="card-title cursor-pointer">Orçamento</summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 text-sm">
            <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={v.budgetMode === "ONE_TIME"} onChange={() => set({ budgetMode: "ONE_TIME" })} /><span><strong>Orçamento inicial único</strong> — um valor distribuído em N dias de veiculação.</span></label>
            <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={v.budgetMode === "MONTHLY"} onChange={() => set({ budgetMode: "MONTHLY" })} /><span><strong>Investimento mensal recorrente</strong> — o mesmo valor a cada mês, pelo número de meses escolhido.</span></label>
          </div>
          {v.budgetMode === "ONE_TIME" ? (
            <div className="grid grid-cols-2 gap-3">
              <P k="oneTimeBudget" label="Valor único (R$)"><NumInput value={v.oneTimeBudget} onChange={(x) => set({ oneTimeBudget: x })} /></P>
              <P k="spendDays" label="Dias de veiculação"><NumInput value={v.spendDays} onChange={(x) => set({ spendDays: Math.max(1, Math.round(x)) })} /></P>
              <Field label="Distribuição">
                <select className="input" value={v.spendCurve} onChange={(e) => set({ spendCurve: e.target.value as GrowthPremises["spendCurve"] })}>
                  <option value="UNIFORM">Uniforme</option>
                  <option value="FRONT_LOADED">Concentrada no início</option>
                  <option value="BACK_LOADED">Concentrada no fim</option>
                </select>
              </Field>
              <div className="flex flex-wrap items-end gap-1">
                {[10000, 15000, 20000].map((b) => <button key={b} type="button" className={`btn-sm ${v.oneTimeBudget === b ? "btn-primary" : "btn-secondary"}`} onClick={() => set({ oneTimeBudget: b })}>{brl(b, 0)}</button>)}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <P k="monthlyBudget" label="Valor por mês (R$)"><NumInput value={v.monthlyBudget} onChange={(x) => set({ monthlyBudget: x })} /></P>
              <P k="monthsOfInvestment" label="Meses com investimento"><NumInput value={v.monthsOfInvestment} onChange={(x) => set({ monthsOfInvestment: Math.max(0, Math.round(x)) })} /></P>
            </div>
          )}
          <p className="rounded-md bg-areia/50 p-2 text-xs">Total investido no período simulado: <strong>{brl(totalInvestment, 0)}</strong>. Nunca multiplicamos automaticamente um orçamento único por 12 meses.</p>
        </div>
      </details>

      <details open className="card">
        <summary className="card-title cursor-pointer">Mídia paga</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <P k="cpm" label={<Term k="CPM">CPM inicial (R$)</Term>}><NumInput value={v.cpm} onChange={(x) => set({ cpm: x })} /></P>
          <P k="ctr" label={<Term k="CTR" />}><NumInput percent value={v.ctr} onChange={(x) => set({ ctr: x })} /></P>
          <P k="audienceSize" label={<Term k="Alcance">Tamanho do público</Term>}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={v.audienceSize !== null} onChange={(e) => set({ audienceSize: e.target.checked ? 400000 : null })} aria-label="Usar tamanho de público" />
              <NumInput value={v.audienceSize} disabled={v.audienceSize === null} onChange={(x) => set({ audienceSize: x })} />
            </div>
          </P>
          <P k="paidEngagementRate" label="Interações / impressão"><NumInput percent value={v.paidEngagementRate} onChange={(x) => set({ paidEngagementRate: x })} /></P>
          <P k="paidProfileVisitRate" label="Visitas ao perfil / impressão"><NumInput percent value={v.paidProfileVisitRate} onChange={(x) => set({ paidProfileVisitRate: x })} /></P>
          <P k="videoViewRate" label="Visualizações / impressão"><NumInput percent value={v.videoViewRate} onChange={(x) => set({ videoViewRate: x })} /></P>
        </div>
      </details>

      <details className="card">
        <summary className="card-title cursor-pointer">Funil do site</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <P k="landingRate" label="Sessões / clique"><NumInput percent value={v.landingRate} onChange={(x) => set({ landingRate: x })} /></P>
          <P k="addToCartRate" label="Adição ao carrinho"><NumInput percent value={v.addToCartRate} onChange={(x) => set({ addToCartRate: x })} /></P>
          <P k="checkoutRate" label="Início de checkout"><NumInput percent value={v.checkoutRate} onChange={(x) => set({ checkoutRate: x })} /></P>
          <P k="purchaseRate" label="Conclusão de compra"><NumInput percent value={v.purchaseRate} onChange={(x) => set({ purchaseRate: x })} /></P>
          <P k="averageTicket" label="Ticket médio (R$)"><NumInput value={v.averageTicket} onChange={(x) => set({ averageTicket: x })} /></P>
        </div>
      </details>

      <details className="card">
        <summary className="card-title cursor-pointer">Instagram orgânico</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <P k="initialFollowers" label="Seguidores iniciais"><NumInput value={v.initialFollowers} onChange={(x) => set({ initialFollowers: Math.round(x) })} /></P>
          <P k="postsPerWeek" label="Posts/carrosséis por semana"><NumInput value={v.postsPerWeek} onChange={(x) => set({ postsPerWeek: x })} /></P>
          <P k="reelsPerWeek" label="Reels por semana"><NumInput value={v.reelsPerWeek} onChange={(x) => set({ reelsPerWeek: x })} /></P>
          <P k="organicReachRate" label="Alcance por post / seguidores"><NumInput percent value={v.organicReachRate} onChange={(x) => set({ organicReachRate: x })} /></P>
          <P k="reelsReachMultiplier" label="Multiplicador de alcance de Reels"><NumInput value={v.reelsReachMultiplier} onChange={(x) => set({ reelsReachMultiplier: x })} /></P>
          <P k="viewsPerReelReach" label="Visualizações / alcance de Reels"><NumInput value={v.viewsPerReelReach} onChange={(x) => set({ viewsPerReelReach: x })} /></P>
          <P k="organicEngagementRate" label={<Term k="Engajamento">Engajamento orgânico</Term>}><NumInput percent value={v.organicEngagementRate} onChange={(x) => set({ organicEngagementRate: x })} /></P>
          <P k="organicProfileVisitRate" label="Visitas ao perfil / alcance"><NumInput percent value={v.organicProfileVisitRate} onChange={(x) => set({ organicProfileVisitRate: x })} /></P>
          <P k="followRate" label="Seguir / visita ao perfil"><NumInput percent value={v.followRate} onChange={(x) => set({ followRate: x })} /></P>
          <P k="bioLinkClickRate" label="Clique no link / visita"><NumInput percent value={v.bioLinkClickRate} onChange={(x) => set({ bioLinkClickRate: x })} /></P>
          <P k="monthlyFollowerChurn" label="Perda mensal de seguidores"><NumInput percent value={v.monthlyFollowerChurn} onChange={(x) => set({ monthlyFollowerChurn: x })} /></P>
        </div>
      </details>

      <details open className="card">
        <summary className="card-title cursor-pointer">Ajustes não lineares (opcionais)</summary>
        <div className="mt-3 space-y-3 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.saturationEnabled} onChange={(e) => set({ saturationEnabled: e.target.checked })} /> Saturação de público (CTR cai com a frequência acumulada)</label>
          {v.saturationEnabled && <P k="saturationK" label="Intensidade da saturação (k)"><NumInput value={v.saturationK} onChange={(x) => set({ saturationK: x })} /></P>}
          <P k="monthlyCpmIncrease" label="Aumento mensal de CPM"><NumInput percent value={v.monthlyCpmIncrease} onChange={(x) => set({ monthlyCpmIncrease: x })} /></P>
          <P k="monthlyConversionChange" label="Variação mensal da conversão"><NumInput percent min={-99} value={v.monthlyConversionChange} onChange={(x) => set({ monthlyConversionChange: x })} /></P>
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.seasonalityEnabled} onChange={(e) => set({ seasonalityEnabled: e.target.checked })} /> Sazonalidade mensal (multiplicadores)</label>
          {v.seasonalityEnabled && (
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead><tr><th></th>{MONTHS.map((m) => <th key={m} className="px-1">{m}</th>)}</tr></thead>
                <tbody>
                  {(["seasonalityCpm", "seasonalityConversion"] as const).map((k) => (
                    <tr key={k}>
                      <td className="pr-2">{k === "seasonalityCpm" ? "CPM ×" : "Conv. ×"}</td>
                      {v[k].map((x, i) => (
                        <td key={i} className="px-0.5"><NumInput className="w-12 rounded border border-areia px-1 py-0.5" value={x} onChange={(n) => set({ [k]: v[k].map((y, j) => (j === i ? n : y)) })} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[11px] text-carvao/60">1 = neutro. Ex.: CPM × 1,3 em novembro (Black Friday) — declare a origem dessa hipótese.</p>
            </div>
          )}
        </div>
      </details>
    </fieldset>
    </SrcCtx.Provider>
  );
}

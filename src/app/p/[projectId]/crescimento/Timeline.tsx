"use client";

import { useMemo, useState } from "react";
import { CrudTable } from "@/components/Crud";
import { OriginTag } from "@/components/sim-inputs";
import { PhoneProfile } from "@/components/instagram/PhoneProfile";
import { Stat } from "@/components/charts";
import { upTo } from "@/lib/sim/aggregate";
import { addMonths, diffDays, fmtBr, monthLabel } from "@/lib/sim/dates";
import type { GrowthOutput, GrowthPremises } from "@/lib/sim/growth";
import type { SourceMap } from "@/lib/sim/origin";
import { brl, num, pct } from "@/lib/format";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "@/components/instagram/types";

export interface MilestoneLite { id: string; title: string; date: string; kind: string; description: string | null }

/** Linha do tempo estratégica (padrão nov/2026 → nov/2027), ajustável pelos marcos cadastrados. */
export function Timeline({ v, out, sources, milestones, creative }: { v: GrowthPremises; out: GrowthOutput; sources: SourceMap; milestones: MilestoneLite[]; creative: { profile: IgProfile; highlights: IgHighlight[]; pubs: IgPub[]; files: MediaFile[] } }) {
  const start = milestones[0]?.date && milestones[0].date < v.startDate ? milestones[0].date : v.startDate;
  const end = [addMonths(v.startDate, 12), ...milestones.map((m) => m.date)].sort().at(-1)!;
  const span = Math.max(1, diffDays(start, end));
  const [sel, setSel] = useState<MilestoneLite | null>(milestones[0] ?? null);
  const files = useMemo(() => new Map(creative.files.map((f) => [f.id, f])), [creative.files]);
  const months = Array.from({ length: 13 }, (_, i) => addMonths(start, i)).filter((d) => d <= end);
  const acc = sel && out.ok ? upTo(out.days, v.startDate, sel.date, sel.title) : null;
  const beyond = sel && out.ok && sel.date >= out.endDate;
  const keyPremises: [keyof GrowthPremises, string, (x: unknown) => string][] = [
    ["budgetMode", "Modo de orçamento", (x) => (x === "ONE_TIME" ? "Único" : "Mensal recorrente")],
    [v.budgetMode === "ONE_TIME" ? "oneTimeBudget" : "monthlyBudget", "Orçamento", (x) => brl(x as number, 0)],
    ["cpm", "CPM inicial", (x) => brl(x as number)],
    ["ctr", "CTR", (x) => pct(x as number, 2)],
    ["purchaseRate", "Conclusão de compra", (x) => pct(x as number)],
    ["averageTicket", "Ticket médio", (x) => brl(x as number, 0)],
    ["reelsPerWeek", "Reels/semana", (x) => num(x as number, 1)],
    ["followRate", "Taxa de seguir", (x) => pct(x as number)],
  ];
  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="card-title mb-6">Linha do tempo estratégica · {monthLabel(start)} – {monthLabel(end)}</h2>
        <div className="relative mx-6 mb-12 mt-20 h-1 rounded bg-areia">
          {months.map((m, i) => (
            <span key={m} className={`absolute top-3 -translate-x-1/2 whitespace-nowrap text-[10px] text-carvao/50 ${i % 2 ? "hidden sm:block" : ""}`} style={{ left: `${(diffDays(start, m) / span) * 100}%` }}>{monthLabel(m).replace(/\/20(\d\d)$/, "/$1")}</span>
          ))}
          {milestones.map((m, i) => {
            const pos = Math.max(0, Math.min(100, (diffDays(start, m.date) / span) * 100));
            const align = pos < 10 ? "left-0" : pos > 90 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <button
                key={m.id}
                onClick={() => setSel(m)}
                className={`absolute -top-2 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-marfim transition ${sel?.id === m.id ? "scale-125 bg-carvao" : "bg-taupe hover:bg-carvao"}`}
                style={{ left: `${pos}%` }}
                aria-label={`${m.title} — ${fmtBr(m.date)}`}
                aria-pressed={sel?.id === m.id}
              >
                <span className={`absolute ${i % 2 ? "-top-7" : "-top-12"} ${align} whitespace-nowrap rounded bg-marfim px-1 text-[11px] font-medium text-carvao`}>{m.title}</span>
                <span className={`absolute ${i % 2 ? "-top-7" : "-top-12"} ${align} h-[calc(100%)] w-px`} />
              </button>
            );
          })}
        </div>
        {sel && (
          <div className="grid gap-6 2xl:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl">{sel.title}</h3>
                <p className="text-sm text-carvao/60">{fmtBr(sel.date)} {sel.description && `· ${sel.description}`}</p>
                {beyond && <p className="mt-1 text-xs text-amber-800">O marco está além do período simulado; os valores param no fim da simulação ({fmtBr(out.endDate)}).</p>}
                {sel.date < v.startDate && <p className="mt-1 text-xs text-amber-800">Marco anterior ao início da simulação.</p>}
              </div>
              {acc ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <Stat tone="sim" label="Investido até aqui" value={brl(acc.budget, 0)} />
                  <Stat tone="sim" label="Impressões" value={num(acc.impressions)} />
                  <Stat tone="sim" label="Alcance único" value={acc.reachCumulative === null ? "—" : num(acc.reachCumulative)} />
                  <Stat tone="sim" label="Seguidores" value={num(acc.followers)} />
                  <Stat tone="sim" label="Compras" value={num(acc.purchases, 1)} />
                  <Stat tone="sim" label="Receita" value={brl(acc.revenue, 0)} hint={<>CPA {brl(acc.cpa)} · ROAS {num(acc.roas, 2)}</>} />
                </div>
              ) : <p className="text-sm text-carvao/60">Sem projeção para esta data.</p>}
              <div>
                <h4 className="label">Premissas do cenário</h4>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {keyPremises.map(([k, l, f]) => (
                    <li key={String(k)} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1">
                      <span>{l}: <strong>{f(v[k])}</strong></span>
                      <OriginTag origin={sources[String(k)]?.origin ?? "HYPOTHESIS"} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <p className="label text-center">Evolução hipotética do perfil em {fmtBr(sel.date)}</p>
              <PhoneProfile profile={creative.profile} highlights={creative.highlights} pubs={creative.pubs.filter((p) => !p.scheduledAt || p.scheduledAt.slice(0, 10) <= sel.date)} files={files} followersOverride={Math.round(acc?.followers ?? v.initialFollowers)} />
            </div>
          </div>
        )}
      </section>
      <section className="card">
        <CrudTable entity="milestone" title="Marcos (ajustáveis)" rows={milestones as unknown as (Record<string, unknown> & { id: string })[]} />
      </section>
    </div>
  );
}

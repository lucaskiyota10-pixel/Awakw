"use client";

import { useMemo, useState } from "react";
import { useProject } from "@/components/project-context";
import { Badge, ConfirmButton, Field, PageHeader, SimBanner, useAction } from "@/components/ui";
import { NumInput } from "@/components/sim-inputs";
import { Chart, Stat } from "@/components/charts";
import { Thread } from "@/components/Thread";
import { saveBudgetPlanAction, approveBudgetPlanAction, deleteBudgetPlanAction } from "@/app/actions/scenarios";
import { requestApprovalAction } from "@/app/actions/collab";
import { percentages, rebalance, scaleTo, validateAllocations, round2, SUGGESTED_ALLOCATIONS, type Allocation } from "@/lib/budget";

const suggestedFor = (total: number) => scaleTo(total, 10000, SUGGESTED_ALLOCATIONS);
import { simulateMetrics } from "@/lib/sim/metrics";
import { readMetrics } from "@/lib/sim/scenario";
import { brl, dateTimeBr, num, pct } from "@/lib/format";

interface Plan { id: string; name: string; total: number; allocations: Allocation[]; status: string; isSuggestion: boolean; note: string | null; authorId: string; approvedById: string | null; approvedAt: string | null; createdAt: string }

const STATUS: Record<string, [string, "warn" | "ok" | "neutral"]> = { PROPOSED: ["Proposta (não aprovada)", "warn"], APPROVED: ["Aprovada", "ok"], SUPERSEDED: ["Substituída", "neutral"] };

export function Budget({ plans, scenarios }: { plans: Plan[]; scenarios: { id: string; name: string; premises: unknown; status: string }[] }) {
  const p = useProject();
  const { exec, pending } = useAction();
  const approved = plans.find((x) => x.status === "APPROVED") ?? null;
  const [selId, setSelId] = useState<string | null>(plans.find((x) => x.status === "PROPOSED")?.id ?? plans[0]?.id ?? null);
  const sel = plans.find((x) => x.id === selId) ?? null;
  const [draft, setDraft] = useState(() => (sel ? { name: sel.name, total: sel.total, allocations: sel.allocations, note: sel.note ?? "" } : { name: "Nova proposta", total: p.defaults.budget, allocations: suggestedFor(p.defaults.budget), note: "" }));
  const [scenarioId, setScenarioId] = useState(scenarios.find((s) => s.status === "APPROVED")?.id ?? scenarios.find((s) => s.name.includes("Moderado"))?.id ?? scenarios[0]?.id ?? "");
  const v = validateAllocations(draft.total, draft.allocations);
  const locked = sel?.status === "APPROVED" || sel?.status === "SUPERSEDED" || !p.can("edit");

  const load = (pl: Plan | null) => {
    setSelId(pl?.id ?? null);
    setDraft(pl ? { name: pl.name, total: pl.total, allocations: pl.allocations, note: pl.note ?? "" } : { name: "Nova proposta", total: p.defaults.budget, allocations: suggestedFor(p.defaults.budget), note: "" });
  };

  // projeções atualizadas: usa as premissas do cenário de métricas escolhido, com a distribuição desta verba
  const projection = useMemo(() => {
    const sc = scenarios.find((s) => s.id === scenarioId);
    if (!sc || !v.ok) return null;
    const base = readMetrics(sc.premises).values;
    const byKey = new Map(base.campaigns.map((c) => [c.id, c]));
    return simulateMetrics({
      ...base,
      budgetMode: "TOTAL",
      totalBudget: draft.total,
      campaigns: draft.allocations.map((a) => ({ ...(byKey.get(a.key) ?? {}), id: a.key, name: a.label, share: draft.total > 0 ? a.amount / draft.total : 0 })),
    });
  }, [scenarios, scenarioId, draft, v.ok]);

  return (
    <div>
      <PageHeader title="Planejamento de verba" subtitle={`A sugestão inicial (30/60/10 sobre ${brl(p.defaults.budget, 0)}, a verba informada nas Configurações) é carregada como proposta NÃO aprovada. Verba aprovada só por coordenadores/administradores.`} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Verba aprovada vigente" value={approved ? brl(approved.total, 0) : "Nenhuma"} hint={approved ? `${approved.name} · aprovada por ${p.memberName(approved.approvedById)}` : "Aguardando aprovação"} />
        <Stat label="Proposta selecionada" value={brl(draft.total, 0)} hint={sel ? STATUS[sel.status][0] : "Não salva"} />
        <Stat label="Soma das linhas" value={brl(v.sum, 2)} hint={v.ok ? "Confere com o total ✓" : "Diferente do total ✗"} />
        <Stat label="Propostas" value={plans.length} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <aside className="card space-y-2 p-3">
          <h2 className="card-title px-1">Versões</h2>
          {plans.map((pl) => (
            <button key={pl.id} onClick={() => load(pl)} className={`block w-full rounded-lg p-2 text-left text-sm ${pl.id === selId ? "bg-carvao text-marfim" : "hover:bg-areia"}`}>
              <span className="block font-medium">{pl.name}</span>
              <span className="block text-xs opacity-70">{brl(pl.total, 0)} · {STATUS[pl.status]?.[0]} · {dateTimeBr(pl.createdAt)}</span>
            </button>
          ))}
          {p.can("edit") && <button className="btn-secondary btn-sm w-full" onClick={() => load(null)}>Nova proposta</button>}
        </aside>
        <div className="min-w-0 space-y-6">
          <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="card-title">{sel ? sel.name : "Nova proposta"}</h2>
              {sel && <Badge tone={STATUS[sel.status][1]}>{STATUS[sel.status][0]}</Badge>}
            </div>
            {sel?.isSuggestion && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Sugestão inicial carregada do briefing — não aprovada.</p>}
            <fieldset disabled={locked} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
                <Field label="Total (R$) — ao alterar, as linhas são escaladas mantendo os %">
                  <NumInput value={draft.total} onChange={(t) => setDraft({ ...draft, total: t, allocations: scaleTo(t, draft.total, draft.allocations) })} />
                </Field>
              </div>
              <table className="table">
                <thead><tr><th>Linha</th><th>Valor (R$)</th><th>%</th><th>Redistribuir</th><th></th></tr></thead>
                <tbody>
                  {percentages(draft.total, draft.allocations).map((a, i) => (
                    <tr key={a.key}>
                      <td><input className="input" value={a.label} onChange={(e) => setDraft({ ...draft, allocations: draft.allocations.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></td>
                      <td className="w-40"><NumInput value={a.amount} onChange={(n) => setDraft({ ...draft, allocations: draft.allocations.map((x, j) => (j === i ? { ...x, amount: round2(n) } : x)) })} /></td>
                      <td className="w-20">{pct(a.pct)}</td>
                      <td className="w-56">
                        <input type="range" min={0} max={draft.total} step={50} value={a.amount} className="w-full accent-carvao" aria-label={`Redistribuir ${a.label}`} onChange={(e) => setDraft({ ...draft, allocations: rebalance(draft.total, draft.allocations, a.key, Number(e.target.value)) })} />
                      </td>
                      <td><button type="button" className="btn-ghost btn-sm" onClick={() => setDraft({ ...draft, allocations: draft.allocations.filter((_, j) => j !== i) })} aria-label="Remover linha">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-carvao/60">Digitar um valor altera só a linha (a soma precisa conferir). O controle deslizante redistribui a diferença proporcionalmente entre as demais, mantendo o total.</p>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setDraft({ ...draft, allocations: [...draft.allocations, { key: `l${Date.now()}`, label: "Nova linha", amount: 0 }] })}>Adicionar linha</button>
              <Field label="Observações"><textarea className="input" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
            </fieldset>
            {!v.ok && <ul role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800">{v.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            <div className="flex flex-wrap justify-between gap-2" data-admin>
              <div className="flex flex-wrap gap-2">
                {sel && sel.status === "PROPOSED" && p.can("edit") && <ConfirmButton onConfirm={() => exec(() => deleteBudgetPlanAction(p.projectId, sel.id), { success: "Proposta excluída.", onOk: () => load(null) })} />}
                {sel && sel.status === "PROPOSED" && p.can("edit") && <button className="btn-secondary btn-sm" onClick={() => exec(() => requestApprovalAction(p.projectId, "budget", sel.id, `${sel.name} — ${brl(sel.total, 0)}`), { success: "Aprovação solicitada." })}>Solicitar aprovação</button>}
                {sel && sel.status === "PROPOSED" && p.can("approve") && <button className="btn-primary btn-sm" onClick={() => exec(() => approveBudgetPlanAction(p.projectId, sel.id), { success: "Verba aprovada." })}>Aprovar esta verba</button>}
              </div>
              {!locked && (
                <div className="flex gap-2">
                  {sel && <button className="btn-secondary" disabled={!v.ok || pending} onClick={() => exec(() => saveBudgetPlanAction(p.projectId, null, { ...draft, name: `${draft.name} (v. ${new Date().toLocaleDateString("pt-BR")})` }), { success: "Nova versão salva." })}>Salvar como nova versão</button>}
                  <button className="btn-primary" disabled={!v.ok || pending} onClick={() => exec(() => saveBudgetPlanAction(p.projectId, sel?.id ?? null, draft), { success: "Proposta salva.", onOk: (r) => r.ok && r.data && setSelId((r.data as { id: string }).id) })}>Salvar</button>
                </div>
              )}
              {sel?.status === "APPROVED" && <p className="text-xs text-carvao/60">Aprovada em {dateTimeBr(sel.approvedAt)} por {p.memberName(sel.approvedById)}. Para alterar, crie uma nova proposta.</p>}
            </div>
          </section>
          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="card-title">Projeção com esta distribuição</h2>
              <select className="input w-72" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} aria-label="Premissas do cenário">{scenarios.map((s) => <option key={s.id} value={s.id}>Premissas: {s.name}</option>)}</select>
            </div>
            <SimBanner />
            {projection?.ok && projection.total ? (
              <>
                <Chart data={projection.campaigns.map((c) => ({ linha: c.name, verba: Math.round(c.budget), receita: Math.round(c.revenue) }))} x="linha" series={[{ key: "verba", label: "Verba (R$)" }, { key: "receita", label: "Receita hipotética (R$)" }]} format={(x) => brl(x, 0)} height={240} />
                <table className="table">
                  <thead><tr><th>Linha</th><th>Verba</th><th>Impressões</th><th>Cliques</th><th>Compras</th><th>Receita</th><th>CPA</th><th>ROAS</th></tr></thead>
                  <tbody>
                    {[...projection.campaigns, projection.total].map((c) => (
                      <tr key={c.name} className={c === projection.total ? "bg-areia/40 font-medium" : ""}><td>{c.name}</td><td>{brl(c.budget, 0)}</td><td>{num(c.impressions)}</td><td>{num(c.clicks)}</td><td>{num(c.purchases, 1)}</td><td>{brl(c.revenue, 0)}</td><td>{brl(c.cpa)}</td><td>{num(c.roas, 2)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-carvao/60">Linhas com a mesma chave das campanhas do cenário herdam suas premissas próprias (ex.: CTR de reconhecimento).</p>
              </>
            ) : <p className="text-sm text-carvao/60">{v.ok ? "Selecione um cenário de métricas válido." : "Corrija a soma para ver a projeção."}</p>}
          </section>
          {sel && <section className="card"><Thread targetType="budget" targetId={sel.id} link={`${p.base}/verba`} /></section>}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/components/project-context";
import { Badge, ConfirmButton, Empty, Field, Modal, PageHeader, SimBanner, Tabs, Term, useAction } from "@/components/ui";
import { Thread } from "@/components/Thread";
import { saveCampaignAction, deleteCampaignAction, type CampaignInput } from "@/app/actions/creative";
import { requestApprovalAction } from "@/app/actions/collab";
import { compareAb } from "@/lib/sim/metrics";
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_OBJECTIVE_LABEL, CAMPAIGN_STATUS, CAMPAIGN_STATUS_LABEL } from "@/lib/labels";
import { brl, dateBr, num, pct, signedPct } from "@/lib/format";

interface Ab {
  id: string;
  variable: "CREATIVE" | "AUDIENCE" | "MESSAGE";
  hypothesis: string;
  metric: string;
  budget: number;
  cpm: number;
  ticket: number;
  a: { label: string; ctr: number; conversionRate: number };
  b: { label: string; ctr: number; conversionRate: number };
}
export interface CampaignLite {
  id: string;
  name: string;
  objective: string;
  audience: string | null;
  segmentation: string | null;
  positioning: string | null;
  message: string | null;
  products: string | null;
  channels: string | null;
  formats: string | null;
  budget: number | null;
  startDate: string;
  endDate: string;
  kpis: string | null;
  creatives: string | null;
  responsibleIds: string[];
  status: string;
  abTests: Ab[];
  pubCount: number;
}

const VAR_LABEL = { CREATIVE: "Criativo", AUDIENCE: "Público", MESSAGE: "Mensagem" };

export function Campaigns({ campaigns, openId }: { campaigns: CampaignLite[]; openId: string | null }) {
  const p = useProject();
  const [open, setOpen] = useState<CampaignLite | "new" | null>(null);
  useEffect(() => {
    if (openId) setOpen(campaigns.find((c) => c.id === openId) ?? null);
  }, [openId, campaigns]);
  const total = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  return (
    <div>
      <PageHeader title="Campanhas" subtitle="Reconhecimento, engajamento, tráfego, contatos, conversão e remarketing — com testes A/B simulados." actions={p.can("edit") && <button className="btn-primary" onClick={() => setOpen("new")}>Nova campanha</button>} />
      {campaigns.length === 0 ? <Empty>Nenhuma campanha.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => (
            <button key={c.id} onClick={() => setOpen(c)} className="card text-left transition hover:border-taupe">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-2xl">{c.name}</h3>
                <Badge tone={c.status === "APPROVED" ? "ok" : "neutral"}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>
              </div>
              <p className="text-sm text-carvao/70">{CAMPAIGN_OBJECTIVE_LABEL[c.objective]} · {c.startDate ? `${dateBr(c.startDate)} – ${dateBr(c.endDate)}` : "sem cronograma"}</p>
              <p className="mt-2 text-sm">{c.message}</p>
              <p className="mt-2 text-xs text-carvao/60">Orçamento planejado: {brl(c.budget, 0)} · {c.pubCount} publicação(ões) · {c.abTests.length} teste(s) A/B</p>
            </button>
          ))}
        </div>
      )}
      {campaigns.length > 0 && <p className="mt-4 text-sm text-carvao/60">Soma dos orçamentos planejados: {brl(total, 0)} (não substitui a verba aprovada em “Planejamento de verba”).</p>}
      <Modal open={open !== null} onClose={() => setOpen(null)} title={open === "new" ? "Nova campanha" : "Campanha"} wide>
        {open !== null && <CampaignEditor c={open === "new" ? null : open} onDone={() => setOpen(null)} />}
      </Modal>
    </div>
  );
}

function CampaignEditor({ c, onDone }: { c: CampaignLite | null; onDone: () => void }) {
  const p = useProject();
  const { exec, pending } = useAction();
  const [tab, setTab] = useState<"dados" | "ab" | "comentarios">("dados");
  const [v, setV] = useState<CampaignInput>({
    name: c?.name ?? "",
    objective: (c?.objective ?? "AWARENESS") as CampaignInput["objective"],
    audience: c?.audience ?? "",
    segmentation: c?.segmentation ?? "",
    positioning: c?.positioning ?? "",
    message: c?.message ?? "",
    products: c?.products ?? "",
    channels: c?.channels ?? "",
    formats: c?.formats ?? "",
    budget: c?.budget ?? "",
    startDate: c?.startDate ?? "",
    endDate: c?.endDate ?? "",
    kpis: c?.kpis ?? "",
    creatives: c?.creatives ?? "",
    responsibleIds: c?.responsibleIds ?? [],
    status: (c?.status ?? "PLANNING") as CampaignInput["status"],
    abTests: c?.abTests ?? [],
  });
  const ro = !p.can("edit");
  const text = (k: keyof CampaignInput, label: string, area = false) => (
    <Field label={label}>
      {area ? <textarea className="input min-h-[70px]" value={String(v[k] ?? "")} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <input className="input" value={String(v[k] ?? "")} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
    </Field>
  );
  const tests = v.abTests as Ab[];
  const setTest = (id: string, patch: Partial<Ab>) => setV({ ...v, abTests: tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const save = () => exec(() => saveCampaignAction(p.projectId, c?.id ?? null, v), { success: "Campanha salva.", onOk: () => !c && onDone() });

  return (
    <div className="space-y-4">
      {c && <Tabs value={tab} onChange={setTab} items={[{ value: "dados", label: "Planejamento" }, { value: "ab", label: `Testes A/B (${tests.length})` }, { value: "comentarios", label: "Comentários" }]} />}
      {tab === "dados" && (
        <fieldset disabled={ro} className="grid gap-4 sm:grid-cols-2">
          {text("name", "Nome *")}
          <Field label="Objetivo"><select className="input" value={v.objective} onChange={(e) => setV({ ...v, objective: e.target.value as CampaignInput["objective"] })}>{CAMPAIGN_OBJECTIVES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          {text("audience", "Público", true)}
          {text("segmentation", "Segmentação", true)}
          {text("positioning", "Posicionamento", true)}
          {text("message", "Mensagem principal", true)}
          {text("products", "Produtos")}
          {text("channels", "Canais")}
          {text("formats", "Formatos")}
          <Field label="Orçamento planejado (R$)"><input type="number" min={0} step="0.01" className="input" value={String(v.budget ?? "")} onChange={(e) => setV({ ...v, budget: e.target.value })} /></Field>
          <Field label="Início"><input type="date" className="input" value={v.startDate ?? ""} onChange={(e) => setV({ ...v, startDate: e.target.value })} /></Field>
          <Field label="Fim"><input type="date" className="input" value={v.endDate ?? ""} onChange={(e) => setV({ ...v, endDate: e.target.value })} /></Field>
          {text("kpis", "KPIs", true)}
          {text("creatives", "Criativos (descrição/links)", true)}
          <Field label="Status"><select className="input" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as CampaignInput["status"] })}>{CAMPAIGN_STATUS.map(([k, l]) => <option key={k} value={k} disabled={k === "APPROVED" && !p.can("approve") && c?.status !== "APPROVED"}>{l}</option>)}</select></Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">Responsáveis</legend>
            <div className="grid gap-1 sm:grid-cols-3">
              {p.members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.responsibleIds.includes(m.id)} onChange={(e) => setV({ ...v, responsibleIds: e.target.checked ? [...v.responsibleIds, m.id] : v.responsibleIds.filter((x) => x !== m.id) })} />{m.name}</label>
              ))}
            </div>
          </fieldset>
        </fieldset>
      )}
      {tab === "ab" && (
        <div className="space-y-4">
          <SimBanner />
          <p className="text-sm text-carvao/70">Compare hipóteses com a mesma verba e o mesmo CPM. Os resultados indicam o que precisaria ser verdade — não preveem o vencedor real. Valide com teste real antes de concluir.</p>
          {tests.map((t) => {
            const r = compareAb(t.budget, t.cpm, t.ticket, t.a, t.b);
            return (
              <div key={t.id} className="rounded-xl border border-areia p-4">
                <fieldset disabled={ro} className="grid gap-3 sm:grid-cols-4">
                  <Field label="Variável"><select className="input" value={t.variable} onChange={(e) => setTest(t.id, { variable: e.target.value as Ab["variable"] })}>{Object.entries(VAR_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                  <Field label="Verba do teste (R$)"><input type="number" className="input" value={t.budget} onChange={(e) => setTest(t.id, { budget: Number(e.target.value) })} /></Field>
                  <Field label="CPM (R$)"><input type="number" step="0.01" className="input" value={t.cpm} onChange={(e) => setTest(t.id, { cpm: Number(e.target.value) })} /></Field>
                  <Field label="Ticket médio (R$)"><input type="number" className="input" value={t.ticket} onChange={(e) => setTest(t.id, { ticket: Number(e.target.value) })} /></Field>
                  <div className="sm:col-span-4"><Field label="Hipótese"><input className="input" value={t.hypothesis} onChange={(e) => setTest(t.id, { hypothesis: e.target.value })} /></Field></div>
                  {(["a", "b"] as const).map((k) => (
                    <div key={k} className="grid grid-cols-3 gap-2 sm:col-span-2">
                      <Field label={`Variante ${k.toUpperCase()}`}><input className="input" value={t[k].label} onChange={(e) => setTest(t.id, { [k]: { ...t[k], label: e.target.value } })} /></Field>
                      <Field label="CTR %"><input type="number" step="0.01" className="input" value={+(t[k].ctr * 100).toFixed(4)} onChange={(e) => setTest(t.id, { [k]: { ...t[k], ctr: Number(e.target.value) / 100 } })} /></Field>
                      <Field label="Conv. % (compra/clique)"><input type="number" step="0.01" className="input" value={+(t[k].conversionRate * 100).toFixed(4)} onChange={(e) => setTest(t.id, { [k]: { ...t[k], conversionRate: Number(e.target.value) / 100 } })} /></Field>
                    </div>
                  ))}
                </fieldset>
                <table className="table mt-3">
                  <thead><tr><th></th><th>Impressões</th><th>Cliques</th><th><Term k="CPC" /></th><th>Compras</th><th>Receita</th><th><Term k="CPA" /></th><th><Term k="ROAS" /></th></tr></thead>
                  <tbody>
                    {[r.a, r.b].map((x) => (
                      <tr key={x.label}><td className="font-medium">{x.label}</td><td>{num(x.impressions)}</td><td>{num(x.clicks)}</td><td>{brl(x.cpc)}</td><td>{num(x.purchases, 1)}</td><td>{brl(x.revenue, 0)}</td><td>{brl(x.cpa)}</td><td>{num(x.roas, 2)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-sm">Diferença de cliques B vs A: <strong>{signedPct(r.liftClicks)}</strong> · compras: <strong>{signedPct(r.liftPurchases)}</strong> · hipótese mais favorável: <strong>{r.winner === "EMPATE" ? "empate" : `Variante ${r.winner}`}</strong> (CTR A {pct(t.a.ctr, 2)} × B {pct(t.b.ctr, 2)})</p>
                {!ro && <button className="btn-ghost btn-sm mt-2 text-red-700" onClick={() => setV({ ...v, abTests: tests.filter((x) => x.id !== t.id) })}>Remover teste</button>}
              </div>
            );
          })}
          {!ro && (
            <button className="btn-secondary" onClick={() => setV({ ...v, abTests: [...tests, { id: crypto.randomUUID(), variable: "CREATIVE", hypothesis: "", metric: "CTR", budget: 1000, cpm: 25, ticket: 350, a: { label: "A", ctr: 0.01, conversionRate: 0.02 }, b: { label: "B", ctr: 0.012, conversionRate: 0.02 } }] })}>
              Adicionar teste A/B
            </button>
          )}
        </div>
      )}
      {tab === "comentarios" && c && <Thread targetType="campaign" targetId={c.id} link={`${p.base}/campanhas?c=${c.id}`} />}
      {!ro && tab !== "comentarios" && (
        <div className="flex flex-wrap justify-between gap-2 border-t border-areia pt-4">
          <div className="flex gap-2">
            {c && <ConfirmButton onConfirm={() => exec(() => deleteCampaignAction(p.projectId, c.id), { success: "Campanha excluída.", onOk: onDone })} />}
            {c && c.status !== "APPROVED" && <button className="btn-secondary btn-sm" onClick={() => exec(() => requestApprovalAction(p.projectId, "campaign", c.id, c.name), { success: "Aprovação solicitada." })}>Solicitar aprovação</button>}
          </div>
          <button className="btn-primary" onClick={save} disabled={pending}>{pending ? "Salvando…" : "Salvar campanha"}</button>
        </div>
      )}
    </div>
  );
}

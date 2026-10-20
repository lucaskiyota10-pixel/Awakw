"use client";

import { useMemo, useState } from "react";
import { useProject } from "@/components/project-context";
import { Badge, ConfirmButton, Field, PageHeader, SimBanner, Tabs, Term, useAction, useToast } from "@/components/ui";
import { CrudTable } from "@/components/Crud";
import { Chart, Stat } from "@/components/charts";
import { saveUtmAction, deleteUtmAction } from "@/app/actions/digital";
import { toggleChecklistAction, resetDailyChecklistAction } from "@/app/actions/crud";
import { buildUtmUrl } from "@/lib/utm";
import { DIAG_AREAS, PIXEL_STATUS } from "@/lib/crud-defs";
import { brl, dateBr, dateTimeBr, num, pct } from "@/lib/format";

type Row = Record<string, unknown> & { id: string };
type Tab = "diagnostico" | "mensuracao" | "pixel" | "utm" | "kpis" | "rotina";

interface Props {
  diagnostics: Row[];
  measurement: Row[];
  pixel: Row[];
  utms: { id: string; baseUrl: string; source: string; medium: string; campaign: string; content: string | null; term: string | null; url: string; authorId: string; createdAt: string }[];
  checklist: { id: string; list: string; text: string; done: boolean; doneById: string | null; doneAt: string | null }[];
  reports: Row[];
  entries: Row[];
  projection: { name: string | null; weekly: { label: string; start: string; end: string; budget: number; impressions: number; clicks: number; siteVisits: number; purchases: number; revenue: number }[] };
}

export function Digital(props: Props) {
  const [tab, setTab] = useState<Tab>("diagnostico");
  const pixelValidated = props.pixel.filter((p) => p.status === "VALIDATED").length;
  return (
    <div>
      <PageHeader title="Planejamento Digital — Lucas" subtitle="Diagnóstico, plano de mensuração, Meta Pixel/API de Conversões, UTMs, KPIs e rotina. Nenhuma integração é declarada ativa sem validação real com evidência." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Diagnóstico OK" value={`${props.diagnostics.filter((d) => d.status === "OK").length}/${props.diagnostics.length}`} />
        <Stat label="Eventos validados" value={`${pixelValidated}/${props.pixel.length}`} hint={pixelValidated === 0 ? "Nenhuma integração validada" : undefined} />
        <Stat label="UTMs geradas" value={props.utms.length} />
        <Stat label="Checklist de lançamento" value={`${props.checklist.filter((c) => c.list === "LAUNCH" && c.done).length}/${props.checklist.filter((c) => c.list === "LAUNCH").length}`} />
      </div>
      <div className="mb-6"><Tabs value={tab} onChange={setTab} items={[{ value: "diagnostico", label: "Diagnóstico" }, { value: "mensuracao", label: "Plano de mensuração" }, { value: "pixel", label: "Pixel / API de Conversões" }, { value: "utm", label: "Gerador de UTMs" }, { value: "kpis", label: "Dashboard de KPIs" }, { value: "rotina", label: "Rotina e checklists" }]} /></div>
      {tab === "diagnostico" && <Diagnostico rows={props.diagnostics} />}
      {tab === "mensuracao" && <div className="card"><CrudTable entity="measurement" title="Objetivos, eventos, responsáveis, status e evidências" rows={props.measurement} /></div>}
      {tab === "pixel" && <Pixel rows={props.pixel} />}
      {tab === "utm" && <Utm utms={props.utms} />}
      {tab === "kpis" && <Kpis entries={props.entries} projection={props.projection} />}
      {tab === "rotina" && <Rotina checklist={props.checklist} reports={props.reports} />}
    </div>
  );
}

function Diagnostico({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DIAG_AREAS.map(([k, l]) => {
          const items = rows.filter((r) => r.area === k);
          if (!items.length) return null;
          const ok = items.filter((r) => r.status === "OK").length;
          const issue = items.some((r) => r.status === "ISSUE");
          return (
            <div key={k} className="card p-4">
              <p className="label">{l}</p>
              <p className="font-serif text-2xl">{ok}/{items.length}</p>
              {issue && <Badge tone="danger">Problema identificado</Badge>}
            </div>
          );
        })}
      </div>
      <div className="card"><CrudTable entity="diagnostic" title="Instagram, site, e-commerce, acessos, ferramentas, operação e pendências" rows={rows} /></div>
    </div>
  );
}

function Pixel({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Status honesto:</strong> esta plataforma não se conecta ao Meta. Os eventos abaixo são o <em>planejamento</em> da implementação. Só marque “Validado” com evidência (ex.: print do Gerenciador de Eventos, ID do teste, data).
      </div>
      <div className="card"><CrudTable entity="pixel" title="Eventos padrão" rows={rows} /></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card text-sm">
          <h3 className="card-title mb-2">Consentimento (LGPD)</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Banner de cookies com opção de recusar; Pixel carrega só após aceite.</li>
            <li>API de Conversões: enviar dados pessoais apenas com base legal e hash SHA-256 (e-mail, telefone).</li>
            <li>Registrar a política de privacidade e a finalidade do uso de dados.</li>
          </ul>
        </div>
        <div className="card text-sm">
          <h3 className="card-title mb-2">Deduplicação</h3>
          <p>O mesmo <code>event_id</code> deve ser enviado pelo navegador (Pixel) e pelo servidor (API), com o mesmo <code>event_name</code>, para o Meta contar uma única vez.</p>
          <pre className="mt-2 overflow-x-auto rounded bg-carvao p-2 text-[11px] text-marfim">{`fbq('track', 'Purchase',
  { value: 349.90, currency: 'BRL' },
  { eventID: 'pedido-123' });`}</pre>
        </div>
        <div className="card text-sm">
          <h3 className="card-title mb-2">Testes</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Ferramenta “Testar eventos” do Gerenciador de Eventos.</li>
            <li>Meta Pixel Helper no navegador.</li>
            <li>Pedido de teste ponta a ponta (ViewContent → Purchase).</li>
            <li>Conferir deduplicação (“Deduplicado” no painel).</li>
            <li>Registrar evidência e data no evento.</li>
          </ol>
        </div>
      </div>
      <p className="text-xs text-carvao/60">Status disponíveis: {PIXEL_STATUS.map((s) => s[1]).join(" · ")}.</p>
    </div>
  );
}

function Utm({ utms }: { utms: Props["utms"] }) {
  const p = useProject();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [v, setV] = useState({ baseUrl: "https://", source: "instagram", medium: "paid_social", campaign: "lancamento_nov26", content: "", term: "" });
  const r = buildUtmUrl(v);
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast("Copiado."), () => toast("Não foi possível copiar.", "error"));
  return (
    <div className="space-y-6">
      <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => saveUtmAction(p.projectId, v), { success: "UTM salva no histórico." }); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3"><Field label="URL de destino *"><input className="input" value={v.baseUrl} onChange={(e) => setV({ ...v, baseUrl: e.target.value })} /></Field></div>
          <Field label="utm_source *" hint="Ex.: instagram, facebook"><input className="input" value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} /></Field>
          <Field label="utm_medium *" hint="Ex.: paid_social, organic, email"><input className="input" value={v.medium} onChange={(e) => setV({ ...v, medium: e.target.value })} /></Field>
          <Field label="utm_campaign *"><input className="input" value={v.campaign} onChange={(e) => setV({ ...v, campaign: e.target.value })} /></Field>
          <Field label="utm_content" hint="Variação do criativo"><input className="input" value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} /></Field>
          <Field label="utm_term" hint="Público/palavra-chave"><input className="input" value={v.term} onChange={(e) => setV({ ...v, term: e.target.value })} /></Field>
        </div>
        <div className="rounded-lg bg-areia/50 p-3">
          <p className="label">URL gerada (codificada)</p>
          {r.ok ? <code className="block break-all text-sm">{r.url}</code> : <p className="text-sm text-red-700">{r.error}</p>}
          <p className="mt-1 text-[11px] text-carvao/60">Valores normalizados: minúsculas, sem acentos, espaços → “_”.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={!r.ok} onClick={() => r.ok && copy(r.url)}>Copiar</button>
          {p.can("edit") && <button className="btn-primary" disabled={!r.ok || pending}>Salvar no histórico</button>}
        </div>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Data</th><th>Campanha</th><th>Source / medium</th><th>Content / term</th><th>URL</th><th>Autor</th><th></th></tr></thead>
          <tbody>
            {utms.map((u) => (
              <tr key={u.id}>
                <td className="whitespace-nowrap">{dateTimeBr(u.createdAt)}</td><td>{u.campaign}</td><td>{u.source} / {u.medium}</td><td>{u.content ?? "—"} / {u.term ?? "—"}</td>
                <td className="max-w-xs"><code className="break-all text-[11px]">{u.url}</code></td><td>{p.memberName(u.authorId)}</td>
                <td className="whitespace-nowrap"><button className="btn-ghost btn-sm" onClick={() => copy(u.url)}>Copiar</button>{p.can("edit") && <ConfirmButton onConfirm={() => exec(() => deleteUtmAction(p.projectId, u.id), { success: "Removida." })} />}</td>
              </tr>
            ))}
            {utms.length === 0 && <tr><td colSpan={7} className="text-carvao/50">Nenhuma UTM salva.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpis({ entries, projection }: { entries: Row[]; projection: Props["projection"] }) {
  const sum = (k: string) => entries.reduce((s, e) => s + (Number(e[k]) || 0), 0);
  const has = (k: string) => entries.some((e) => e[k] !== null && e[k] !== undefined);
  const t = { reach: sum("reach"), impressions: sum("impressions"), clicks: sum("clicks"), spend: sum("spend"), sessions: sum("sessions"), conversions: sum("conversions"), revenue: sum("revenue") };
  const kpi = {
    ctr: t.impressions > 0 && has("clicks") ? t.clicks / t.impressions : null,
    cpc: t.clicks > 0 && has("spend") ? t.spend / t.clicks : null,
    cpm: t.impressions > 0 && has("spend") ? (t.spend / t.impressions) * 1000 : null,
    cpa: t.conversions > 0 && has("spend") ? t.spend / t.conversions : null,
    roas: t.spend > 0 && has("revenue") ? t.revenue / t.spend : null,
  };
  // real × projetado por semana do cenário de referência
  const compare = useMemo(
    () =>
      projection.weekly.map((w) => {
        const real = entries.filter((e) => String(e.date).slice(0, 10) >= w.start && String(e.date).slice(0, 10) <= w.end);
        const rs = (k: string) => (real.length ? real.reduce((s, e) => s + (Number(e[k]) || 0), 0) : null);
        return { semana: w.label.replace("Semana ", "S"), projetado: Math.round(w.revenue), real: rs("revenue"), invProj: Math.round(w.budget), invReal: rs("spend") };
      }),
    [entries, projection.weekly],
  );
  const lastWithReal = compare.reduce((idx, c, i) => (c.real !== null ? i : idx), -1);
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">Esta aba mostra <strong>dados reais informados manualmente</strong> pela equipe (com fonte). Enquanto não houver veiculação, ela fica vazia — não inventamos desempenho.</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat tone="real" label={<Term k="Alcance" />} value={has("reach") ? num(t.reach) : "—"} hint="Soma dos registros" />
        <Stat tone="real" label="Impressões" value={has("impressions") ? num(t.impressions) : "—"} />
        <Stat tone="real" label={<Term k="CTR" />} value={pct(kpi.ctr, 2)} />
        <Stat tone="real" label={<Term k="CPC" />} value={brl(kpi.cpc)} />
        <Stat tone="real" label={<Term k="CPM" />} value={brl(kpi.cpm)} />
        <Stat tone="real" label="Sessões" value={has("sessions") ? num(t.sessions) : "—"} />
        <Stat tone="real" label="Conversões" value={has("conversions") ? num(t.conversions) : "—"} />
        <Stat tone="real" label={<Term k="CPA" />} value={brl(kpi.cpa)} />
        <Stat tone="real" label={<Term k="ROAS" />} value={kpi.roas === null ? "—" : num(kpi.roas, 2)} />
        <Stat tone="real" label="Receita" value={has("revenue") ? brl(t.revenue, 0) : "—"} hint={has("spend") ? `Investido ${brl(t.spend, 0)}` : undefined} />
      </div>
      <div className="card"><CrudTable entity="metricEntry" title="Registros reais" rows={entries} emptyText="Nenhum dado real registrado. Registre após o início da veiculação, citando a fonte." /></div>
      <section className="card space-y-3">
        <h2 className="card-title">Real × projetado (simulador temporal)</h2>
        <SimBanner />
        <p className="text-sm text-carvao/70">Projeção semanal do cenário de referência: <strong>{projection.name ?? "nenhum"}</strong>. Use para revisar premissas, não como meta garantida.</p>
        {compare.length > 0 ? (
          <Chart kind="composed" data={compare.slice(0, Math.max(12, lastWithReal + 2))} x="semana" format={(v) => brl(v, 0)} series={[{ key: "projetado", label: "Receita projetada (hipotética)" }, { key: "real", label: "Receita real informada", type: "line" }]} />
        ) : <p className="text-sm text-carvao/60">Sem cenário de crescimento.</p>}
      </section>
    </div>
  );
}

function Rotina({ checklist, reports }: { checklist: Props["checklist"]; reports: Row[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ChecklistCard list="DAILY" title="Checklist diário" checklist={checklist} />
        <ChecklistCard list="LAUNCH" title="Checklist de lançamento" checklist={checklist} />
      </div>
      <div className="card"><CrudTable entity="weeklyReport" title="Relatório semanal — hipóteses, problemas e recomendações" rows={reports} /></div>
    </div>
  );
}

function ChecklistCard({ list, title, checklist }: { list: "DAILY" | "LAUNCH"; title: string; checklist: Props["checklist"] }) {
const p = useProject();
const { exec } = useAction();
  const items = checklist.filter((c) => c.list === list);
  const done = items.filter((c) => c.done).length;
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="card-title">{title} <span className="text-base text-carvao/50">{done}/{items.length}</span></h3>
        {list === "DAILY" && p.can("edit") && <button className="btn-secondary btn-sm" onClick={() => exec(() => resetDailyChecklistAction(p.projectId), { success: "Checklist reiniciado para hoje." })}>Novo dia</button>}
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded bg-areia"><div className="h-full bg-carvao" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></div>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={c.done} disabled={!p.can("edit")} onChange={(e) => exec(() => toggleChecklistAction(p.projectId, c.id, e.target.checked))} aria-label={c.text} />
            <span className={c.done ? "text-carvao/50 line-through" : ""}>{c.text}{c.done && c.doneAt && <span className="ml-1 text-[11px] text-carvao/50">— {p.memberName(c.doneById)}, {dateBr(c.doneAt)}</span>}</span>
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-carvao/60">Gerenciar itens</summary>
        <div className="mt-2"><CrudTable entity="checklist" rows={items as unknown as Row[]} defaults={{ list }} hidden={["list", "done"]} /></div>
      </details>
    </section>
  );
}

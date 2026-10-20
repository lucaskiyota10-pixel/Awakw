"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/components/project-context";
import { Badge, Empty, Field, Modal, PageHeader, useAction } from "@/components/ui";
import { Thread } from "@/components/Thread";
import { saveDecisionAction, setDecisionStatusAction } from "@/app/actions/collab";
import { DECISION_STATUS } from "@/lib/labels";
import { dateBr, dateTimeBr } from "@/lib/format";

interface D {
  id: string;
  title: string;
  proposal: string;
  status: string;
  responsibleIds: string[];
  dueDate: string | null;
  decidedAt: string | null;
  decidedById: string | null;
  decisionNote: string | null;
  createdById: string;
  createdAt: string;
}
const TONE: Record<string, "neutral" | "info" | "ok" | "danger"> = { PROPOSED: "neutral", IN_DISCUSSION: "info", APPROVED: "ok", REJECTED: "danger" };

export function Decisions({ decisions, openId }: { decisions: D[]; openId: string | null }) {
  const p = useProject();
  const [open, setOpen] = useState<D | "new" | null>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    if (openId) setOpen(decisions.find((d) => d.id === openId) ?? null);
  }, [openId, decisions]);
  const list = decisions.filter((d) => !filter || d.status === filter);
  return (
    <div>
      <PageHeader title="Central de Decisões" subtitle="Propostas, responsáveis, discussão e trilha de auditoria. Aprovação final restrita a coordenadores/administradores." actions={p.can("edit") && <button className="btn-primary" onClick={() => setOpen("new")}>Nova proposta</button>} />
      <div className="mb-4 flex gap-2">
        <select className="input w-48" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar status">
          <option value="">Todos os status</option>
          {Object.entries(DECISION_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {list.length === 0 ? <Empty>Nenhuma decisão registrada.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((d) => (
            <button key={d.id} onClick={() => setOpen(d)} className="card text-left transition hover:border-taupe">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl">{d.title}</h3>
                <Badge tone={TONE[d.status]}>{DECISION_STATUS[d.status]}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-carvao/70">{d.proposal}</p>
              <p className="mt-2 text-xs text-carvao/50">Responsáveis: {d.responsibleIds.map(p.memberName).join(", ") || "—"} · criada em {dateBr(d.createdAt)}{d.dueDate ? ` · prazo ${dateBr(d.dueDate)}` : ""}</p>
            </button>
          ))}
        </div>
      )}
      <Modal open={open !== null} onClose={() => setOpen(null)} title={open === "new" ? "Nova proposta" : "Decisão"} wide>
        {open !== null && <DecisionDetail d={open === "new" ? null : open} onDone={() => setOpen(null)} />}
      </Modal>
    </div>
  );
}

function DecisionDetail({ d, onDone }: { d: D | null; onDone: () => void }) {
  const p = useProject();
  const { exec, pending } = useAction();
  const closed = d?.status === "APPROVED" || d?.status === "REJECTED";
  const [v, setV] = useState({ title: d?.title ?? "", proposal: d?.proposal ?? "", responsibleIds: d?.responsibleIds ?? [], dueDate: d?.dueDate ?? "" });
  const [note, setNote] = useState("");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => saveDecisionAction(p.projectId, d?.id ?? null, v), { success: "Decisão salva.", onOk: () => !d && onDone() }); }}>
          <fieldset disabled={closed || !p.can("edit")} className="space-y-4">
            <Field label="Título"><input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required /></Field>
            <Field label="Proposta"><textarea className="input min-h-[120px]" value={v.proposal} onChange={(e) => setV({ ...v, proposal: e.target.value })} required /></Field>
            <Field label="Prazo para decidir"><input type="date" className="input" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} /></Field>
            <fieldset>
              <legend className="label">Responsáveis</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {p.members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={v.responsibleIds.includes(m.id)} onChange={(e) => setV({ ...v, responsibleIds: e.target.checked ? [...v.responsibleIds, m.id] : v.responsibleIds.filter((x) => x !== m.id) })} />
                    {m.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </fieldset>
          {!closed && p.can("edit") && <div className="flex justify-end"><button className="btn-primary" disabled={pending}>Salvar</button></div>}
        </form>
        {d && (
          <div className="rounded-xl border border-areia p-4">
            <p className="text-sm">Status: <strong>{DECISION_STATUS[d.status]}</strong>{d.decidedAt && ` — por ${p.memberName(d.decidedById)} em ${dateTimeBr(d.decidedAt)}`}</p>
            {d.decisionNote && <p className="mt-1 text-sm text-carvao/70">Justificativa: {d.decisionNote}</p>}
            {!closed && (
              <div className="mt-3 space-y-2" data-admin>
                <input className="input" placeholder="Justificativa / observação" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {p.can("edit") && d.status === "PROPOSED" && <button className="btn-secondary btn-sm" onClick={() => exec(() => setDecisionStatusAction(p.projectId, d.id, "IN_DISCUSSION", note), { success: "Em discussão." })}>Abrir discussão</button>}
                  {p.can("approve") ? (
                    <>
                      <button className="btn-primary btn-sm" onClick={() => exec(() => setDecisionStatusAction(p.projectId, d.id, "APPROVED", note), { success: "Decisão aprovada.", onOk: onDone })}>Aprovar</button>
                      <button className="btn-danger btn-sm" onClick={() => exec(() => setDecisionStatusAction(p.projectId, d.id, "REJECTED", note), { success: "Decisão rejeitada.", onOk: onDone })}>Rejeitar</button>
                    </>
                  ) : (
                    <span className="text-xs text-carvao/60">Aprovação final: coordenadores e administradores.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {d && <aside className="border-t border-areia pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><Thread targetType="decision" targetId={d.id} link={`${p.base}/decisoes?d=${d.id}`} /></aside>}
    </div>
  );
}

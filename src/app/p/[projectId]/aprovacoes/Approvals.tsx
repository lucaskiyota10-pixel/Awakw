"use client";

import Link from "next/link";
import { useState } from "react";
import { useProject } from "@/components/project-context";
import { Badge, Empty, PageHeader, useAction } from "@/components/ui";
import { decideApprovalAction } from "@/app/actions/collab";
import { APPROVAL_STATUS, TARGET_LABEL } from "@/lib/labels";
import { dateTimeBr } from "@/lib/format";

interface A { id: string; targetType: string; targetId: string; targetLabel: string; status: string; requestedById: string; decidedById: string | null; note: string | null; createdAt: string; decidedAt: string | null }
const TONE: Record<string, "warn" | "ok" | "danger" | "info"> = { PENDING: "warn", APPROVED: "ok", REJECTED: "danger", CHANGES_REQUESTED: "info" };

export function Approvals({ items }: { items: A[] }) {
  const p = useProject();
  const { exec } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const href = (a: A) =>
    ({ task: `${p.base}/tarefas?t=${a.targetId}`, decision: `${p.base}/decisoes?d=${a.targetId}`, publication: `${p.base}/editorial?p=${a.targetId}`, scenario: `${p.base}/crescimento?s=${a.targetId}`, document: `${p.base}/documentos/${a.targetId}`, campaign: `${p.base}/campanhas?c=${a.targetId}`, budget: `${p.base}/verba` })[a.targetType] ?? p.base;
  const pending = items.filter((a) => a.status === "PENDING");
  const done = items.filter((a) => a.status !== "PENDING");
  return (
    <div className="space-y-8">
      <PageHeader title="Aprovações" subtitle="Solicitações de aprovação de tarefas, publicações, cenários, documentos, campanhas e verba. Somente coordenadores e administradores decidem." />
      <section>
        <h2 className="mb-3 text-2xl">Pendentes ({pending.length})</h2>
        {pending.length === 0 ? <Empty>Nenhuma aprovação pendente.</Empty> : (
          <ul className="space-y-3">
            {pending.map((a) => (
              <li key={a.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-carvao/50">{TARGET_LABEL[a.targetType]}</p>
                    <Link href={href(a)} className="font-serif text-xl hover:underline">{a.targetLabel}</Link>
                    <p className="text-xs text-carvao/60">Solicitado por {p.memberName(a.requestedById)} em {dateTimeBr(a.createdAt)}</p>
                  </div>
                  <Badge tone="warn">Pendente</Badge>
                </div>
                {p.can("approve") ? (
                  <div className="mt-3 flex flex-wrap gap-2" data-admin>
                    <input className="input flex-1" placeholder="Observação (opcional)" value={notes[a.id] ?? ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} />
                    <button className="btn-primary btn-sm" onClick={() => exec(() => decideApprovalAction(p.projectId, a.id, "APPROVED", notes[a.id] ?? ""), { success: "Aprovado." })}>Aprovar</button>
                    <button className="btn-secondary btn-sm" onClick={() => exec(() => decideApprovalAction(p.projectId, a.id, "CHANGES_REQUESTED", notes[a.id] ?? ""), { success: "Ajustes solicitados." })}>Pedir ajustes</button>
                    <button className="btn-danger btn-sm" onClick={() => exec(() => decideApprovalAction(p.projectId, a.id, "REJECTED", notes[a.id] ?? ""), { success: "Reprovado." })}>Reprovar</button>
                  </div>
                ) : <p className="mt-2 text-xs text-carvao/60">Aguardando coordenação.</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-2xl">Histórico</h2>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>Item</th><th>Status</th><th>Solicitante</th><th>Decisão</th><th>Observação</th></tr></thead>
            <tbody>
              {done.map((a) => (
                <tr key={a.id}>
                  <td><span className="text-xs text-carvao/50">{TARGET_LABEL[a.targetType]}</span><br /><Link className="hover:underline" href={href(a)}>{a.targetLabel}</Link></td>
                  <td><Badge tone={TONE[a.status]}>{APPROVAL_STATUS[a.status]}</Badge></td>
                  <td>{p.memberName(a.requestedById)}</td>
                  <td>{p.memberName(a.decidedById)}<br /><span className="text-xs text-carvao/50">{dateTimeBr(a.decidedAt)}</span></td>
                  <td>{a.note ?? "—"}</td>
                </tr>
              ))}
              {done.length === 0 && <tr><td colSpan={5} className="text-carvao/50">Sem histórico.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

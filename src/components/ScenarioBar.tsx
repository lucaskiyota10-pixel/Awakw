"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "./project-context";
import { Badge, ConfirmButton, Field, Modal, useAction } from "./ui";
import { Thread } from "./Thread";
import { saveScenarioAction, duplicateScenarioAction, deleteScenarioAction } from "@/app/actions/scenarios";
import { requestApprovalAction } from "@/app/actions/collab";
import { LEVEL_LABEL } from "@/lib/sim/defaults";
import { REVIEW_STATUS } from "@/lib/labels";
import { dateTimeBr } from "@/lib/format";
import type { SourceMap } from "@/lib/sim/origin";

export interface ScenarioLite {
  id: string;
  name: string;
  level: string;
  status: string;
  authorId: string;
  approvedById: string | null;
  createdAt: string;
  updatedAt: string;
  premises: unknown;
}

/** Barra de cenários: carregar, salvar, duplicar, comentar, solicitar aprovação, excluir. */
export function ScenarioBar({
  kind,
  scenarios,
  currentId,
  onLoad,
  onPreset,
  values,
  sources,
  extra,
}: {
  kind: "METRICS" | "GROWTH";
  scenarios: ScenarioLite[];
  currentId: string | null;
  onLoad: (s: ScenarioLite | null) => void;
  onPreset: (level: "CONSERVATIVE" | "MODERATE" | "OPTIMISTIC") => void;
  values: unknown;
  sources: SourceMap;
  extra?: React.ReactNode;
}) {
  const p = useProject();
  const router = useRouter();
  const { exec, pending } = useAction();
  const cur = scenarios.find((s) => s.id === currentId) ?? null;
  const [saveAs, setSaveAs] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("CUSTOM");
  const [comments, setComments] = useState(false);
  const goto = (id: string) => router.replace(`?s=${id}`, { scroll: false });

  return (
    <div className="card mb-6 flex flex-wrap items-end gap-3" data-admin>
      <Field label="Cenário salvo">
        <select className="input w-72" value={currentId ?? ""} onChange={(e) => onLoad(scenarios.find((s) => s.id === e.target.value) ?? null)}>
          <option value="">— não salvo —</option>
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name} · {REVIEW_STATUS[s.status]}</option>)}
        </select>
      </Field>
      <Field label="Carregar padrão">
        <div className="flex gap-1">
          {(["CONSERVATIVE", "MODERATE", "OPTIMISTIC"] as const).map((l) => <button key={l} type="button" className="btn-secondary btn-sm" onClick={() => onPreset(l)}>{LEVEL_LABEL[l]}</button>)}
        </div>
      </Field>
      {cur && (
        <div className="text-xs text-carvao/70">
          <Badge tone={cur.status === "APPROVED" ? "ok" : cur.status === "IN_REVIEW" ? "warn" : "neutral"}>{REVIEW_STATUS[cur.status]}</Badge> {LEVEL_LABEL[cur.level as keyof typeof LEVEL_LABEL]}
          <br />Autor: {p.memberName(cur.authorId)} · criado {dateTimeBr(cur.createdAt)} · atualizado {dateTimeBr(cur.updatedAt)}
          {cur.approvedById && <><br />Aprovado por {p.memberName(cur.approvedById)}</>}
        </div>
      )}
      <div className="ml-auto flex flex-wrap gap-2">
        {extra}
        {p.can("edit") && cur && cur.status !== "APPROVED" && (
          <button className="btn-primary btn-sm" disabled={pending} onClick={() => exec(() => saveScenarioAction(p.projectId, cur.id, { kind, name: cur.name, level: cur.level, values, sources }), { success: "Cenário atualizado." })}>Salvar alterações</button>
        )}
        {p.can("edit") && <button className="btn-secondary btn-sm" onClick={() => { setName(cur ? `${cur.name} (nova versão)` : ""); setLevel(cur?.level ?? "CUSTOM"); setSaveAs(true); }}>Salvar como novo</button>}
        {p.can("edit") && cur && <button className="btn-secondary btn-sm" onClick={() => exec(() => duplicateScenarioAction(p.projectId, cur.id), { success: "Cenário duplicado.", onOk: (r) => r.ok && r.data && goto((r.data as { id: string }).id) })}>Duplicar</button>}
        {cur && <button className="btn-secondary btn-sm" onClick={() => setComments(true)}>Comentários</button>}
        {p.can("edit") && cur && cur.status === "DRAFT" && <button className="btn-secondary btn-sm" onClick={() => exec(() => requestApprovalAction(p.projectId, "scenario", cur.id, cur.name), { success: "Aprovação solicitada." })}>Solicitar aprovação</button>}
        {p.can("edit") && cur && <ConfirmButton onConfirm={() => exec(() => deleteScenarioAction(p.projectId, cur.id), { success: "Cenário excluído.", onOk: () => onLoad(null) })} />}
      </div>
      <Modal open={saveAs} onClose={() => setSaveAs(false)} title="Salvar cenário">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => saveScenarioAction(p.projectId, null, { kind, name, level, values, sources }), { success: "Cenário salvo.", onOk: (r) => { setSaveAs(false); if (r.ok && r.data) goto((r.data as { id: string }).id); } }); }}>
          <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Nível"><select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>{Object.entries(LEVEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <p className="text-xs text-carvao/60">Autor, data e premissas (com origem de cada número) ficam registrados.</p>
          <div className="flex justify-end"><button className="btn-primary" disabled={pending}>Salvar</button></div>
        </form>
      </Modal>
      <Modal open={comments} onClose={() => setComments(false)} title={`Comentários — ${cur?.name ?? ""}`}>
        {cur && <Thread targetType="scenario" targetId={cur.id} link={`${p.base}/${kind === "GROWTH" ? "crescimento" : "simulador"}?s=${cur.id}`} />}
      </Modal>
    </div>
  );
}

export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/project-context";
import { Badge, ConfirmButton, Modal, PageHeader, Tabs, useAction } from "@/components/ui";
import { CrudTable, EntityForm } from "@/components/Crud";
import { UploadButton } from "@/components/Upload";
import { deleteEntityAction } from "@/app/actions/crud";
import { toTaskAction } from "@/app/actions/digital";

type Row = Record<string, unknown> & { id: string };
const Q: Record<string, { title: string; hint: string; tone: string }> = {
  S: { title: "Forças", hint: "Interno · positivo", tone: "border-emerald-300" },
  W: { title: "Fraquezas", hint: "Interno · negativo", tone: "border-red-300" },
  O: { title: "Oportunidades", hint: "Externo · positivo", tone: "border-sky-300" },
  T: { title: "Ameaças", hint: "Externo · negativo", tone: "border-amber-300" },
};

export function Research({ competitors, swot, files, references }: { competitors: Row[]; swot: Row[]; files: { id: string; name: string }[]; references: Row[] }) {
  const p = useProject();
  const router = useRouter();
  const { exec } = useAction();
  const [tab, setTab] = useState<"swot" | "concorrentes" | "referencias">("swot");
  const [edit, setEdit] = useState<Row | { quadrant: string } | null>(null);
  const toTask = (kind: "swot" | "competitor", id: string) => exec(() => toTaskAction(p.projectId, kind, id), { success: "Tarefa criada no Kanban." });

  return (
    <div>
      <PageHeader title="Pesquisa de mercado & SWOT" subtitle="Registre apenas dados observados, com fonte e data. Separe evidências de hipóteses. Nunca invente dados externos." />
      <div className="mb-6"><Tabs value={tab} onChange={setTab} items={[{ value: "swot", label: "Matriz SWOT" }, { value: "concorrentes", label: `Concorrentes (${competitors.length})` }, { value: "referencias", label: `Referências (${references.length})` }]} /></div>
      {tab === "swot" && (
        <div>
          <div className="mb-2 grid grid-cols-[auto_1fr_1fr] gap-3">
            <span />
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-carvao/50">Positivo</p>
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-carvao/50">Negativo</p>
          </div>
          {[["Interno", ["S", "W"]], ["Externo", ["O", "T"]]].map(([label, qs]) => (
            <div key={label as string} className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr_1fr]">
              <p className="hidden self-center text-xs font-semibold uppercase tracking-widest text-carvao/50 [writing-mode:vertical-rl] md:block">{label as string}</p>
              {(qs as string[]).map((q) => (
                <section key={q} className={`card border-t-4 ${Q[q].tone}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div><h3 className="card-title">{Q[q].title}</h3><p className="text-xs text-carvao/50">{Q[q].hint}</p></div>
                    {p.can("edit") && <button className="btn-secondary btn-sm" onClick={() => setEdit({ quadrant: q })} data-admin>Adicionar</button>}
                  </div>
                  <ul className="space-y-3">
                    {swot.filter((s) => s.quadrant === q).map((s) => (
                      <li key={s.id} className="rounded-lg bg-marfim p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{String(s.text)}</p>
                          <Badge tone={s.basis === "EVIDENCE" ? "ok" : "warn"}>{s.basis === "EVIDENCE" ? "Evidência" : "Hipótese"}</Badge>
                        </div>
                        {s.evidence ? <p className="mt-1 text-xs text-carvao/70">Evidência: {String(s.evidence)}</p> : null}
                        {s.source ? <p className="text-xs text-carvao/50">Fonte: {String(s.source)}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-1" data-admin>
                          {s.taskId ? <Link href={`${p.base}/tarefas?t=${s.taskId}`} className="btn-ghost btn-sm">Ver tarefa →</Link> : p.can("edit") && <button className="btn-ghost btn-sm" onClick={() => toTask("swot", s.id)}>Transformar em tarefa</button>}
                          {p.can("edit") && <button className="btn-ghost btn-sm" onClick={() => setEdit(s)}>Editar</button>}
                          {p.can("edit") && <ConfirmButton onConfirm={() => exec(() => deleteEntityAction(p.projectId, "swot", s.id), { success: "Excluído." })} />}
                        </div>
                      </li>
                    ))}
                    {!swot.some((s) => s.quadrant === q) && <li className="text-sm text-carvao/50">Vazio.</li>}
                  </ul>
                </section>
              ))}
            </div>
          ))}
          <Modal open={edit !== null} onClose={() => setEdit(null)} title="Item SWOT" wide>
            {edit && <EntityForm entity="swot" row={"id" in edit ? (edit as Row) : null} defaults={"id" in edit ? undefined : { quadrant: edit.quadrant, basis: "HYPOTHESIS" }} onDone={() => setEdit(null)} />}
          </Modal>
        </div>
      )}
      {tab === "concorrentes" && (
        <div className="space-y-4">
          <div className="card"><CrudTable entity="competitor" title="Concorrentes" rows={competitors} emptyText="Nenhum concorrente cadastrado. Cadastre somente o que foi observado, com fonte e data." extraActions={(r) => p.can("edit") && <button className="btn-ghost btn-sm" onClick={() => toTask("competitor", r.id)}>→ Tarefa</button>} /></div>
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="card-title">Anexos (prints, catálogos)</h3>
              {p.can("edit") && <UploadButton projectId={p.projectId} folder="concorrentes" onUploaded={() => router.refresh()} />}
            </div>
            <ul className="text-sm">{files.map((f) => <li key={f.id}><a className="underline" href={`/api/files/${f.id}?download`}>{f.name}</a></li>)}{files.length === 0 && <li className="text-carvao/50">Nenhum anexo.</li>}</ul>
          </div>
        </div>
      )}
      {tab === "referencias" && <div className="card"><CrudTable entity="reference" title="Referências bibliográficas (usadas nos documentos ABNT)" rows={references} emptyText="Nenhuma referência. Cadastre apenas obras e fontes efetivamente consultadas." /></div>}
    </div>
  );
}

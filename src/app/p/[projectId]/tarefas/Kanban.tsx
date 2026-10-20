"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProject, MemberSelect } from "@/components/project-context";
import { Avatar, Badge, ConfirmButton, Field, Modal, PageHeader, useAction } from "@/components/ui";
import { Thread } from "@/components/Thread";
import { UploadButton, FileThumb } from "@/components/Upload";
import { moveTaskAction, saveTaskAction, deleteTaskAction, requestApprovalAction, type TaskInput } from "@/app/actions/collab";
import { PRIORITY, PRIORITY_LABEL, SECTORS, TASK_STATUS, TASK_STATUS_LABEL } from "@/lib/labels";
import { dateBr } from "@/lib/format";

export interface TaskLite {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  sector: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  checklist: { id: string; text: string; done: boolean }[];
  dependsOn: string[];
  order: number;
  createdById: string;
  files: { id: string; name: string; mime: string }[];
}

const PRIO_TONE: Record<string, "neutral" | "info" | "warn" | "danger"> = { LOW: "neutral", MEDIUM: "info", HIGH: "warn", URGENT: "danger" };

export function Kanban({ tasks, openId }: { tasks: TaskLite[]; openId: string | null }) {
  const p = useProject();
  const router = useRouter();
  const { exec } = useAction();
  const [filter, setFilter] = useState({ sector: "", assignee: "", q: "" });
  const [open, setOpen] = useState<TaskLite | "new" | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  useEffect(() => {
    if (openId) {
      const t = tasks.find((x) => x.id === openId);
      if (t) setOpen(t);
    }
  }, [openId, tasks]);
  useEffect(() => setOptimistic({}), [tasks]);

  const shown = useMemo(
    () =>
      tasks
        .map((t) => (optimistic[t.id] ? { ...t, status: optimistic[t.id] } : t))
        .filter((t) => (!filter.sector || t.sector === filter.sector) && (!filter.assignee || t.assigneeId === filter.assignee) && (!filter.q || t.title.toLowerCase().includes(filter.q.toLowerCase()))),
    [tasks, filter, optimistic],
  );

  const move = (t: TaskLite, status: string) => {
    if (!p.can("edit") || t.status === status) return;
    setOptimistic((o) => ({ ...o, [t.id]: status }));
    exec(() => moveTaskAction(p.projectId, t.id, status as TaskInput["status"], Date.now()), { success: `Movida para "${TASK_STATUS_LABEL[status]}".` }).then((r) => {
      if (!r?.ok) setOptimistic((o) => ({ ...o, [t.id]: t.status }));
    });
  };

  const drop = (status: string) => {
    const t = tasks.find((x) => x.id === drag);
    setDrag(null);
    if (t) move(t, status);
  };

  const close = () => {
    setOpen(null);
    if (openId) router.replace(`${p.base}/tarefas`);
  };

  return (
    <div>
      <PageHeader title="Tarefas" subtitle="Arraste os cartões entre as colunas. Aprovação final restrita a coordenadores e administradores." actions={p.can("edit") && <button className="btn-primary" onClick={() => setOpen("new")}>Nova tarefa</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input w-56" placeholder="Buscar tarefa…" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} aria-label="Buscar" />
        <select className="input w-40" value={filter.sector} onChange={(e) => setFilter({ ...filter, sector: e.target.value })} aria-label="Setor">
          <option value="">Todos os setores</option>
          {SECTORS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <MemberSelect className="input w-48" value={filter.assignee} onChange={(v) => setFilter({ ...filter, assignee: v ?? "" })} />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {TASK_STATUS.map(([status, label]) => {
          const col = shown.filter((t) => t.status === status).sort((a, b) => a.order - b.order);
          return (
            <section
              key={status}
              aria-label={label}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-areia/40 p-2 ${drag ? "border-taupe border-dashed" : "border-transparent"}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(status)}
            >
              <h2 className="flex items-center justify-between px-2 py-1 font-sans text-sm font-medium">
                {label} <span className="text-xs text-carvao/50">{col.length}</span>
              </h2>
              <div className="flex min-h-[120px] flex-col gap-2">
                {col.map((t) => {
                  const done = t.checklist.filter((c) => c.done).length;
                  const late = t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && !["DONE", "APPROVED"].includes(t.status);
                  const blocked = t.dependsOn.some((d) => tasks.find((x) => x.id === d)?.status !== "DONE");
                  return (
                    <article
                      key={t.id}
                      draggable={p.can("edit")}
                      onDragStart={() => setDrag(t.id)}
                      onDragEnd={() => setDrag(null)}
                      onClick={() => setOpen(t)}
                      onKeyDown={(e) => e.key === "Enter" && setOpen(t)}
                      tabIndex={0}
                      className="cursor-pointer rounded-lg border border-areia bg-white p-3 text-sm shadow-sm hover:border-taupe focus:outline-none focus:ring-2 focus:ring-taupe"
                    >
                      <p className="font-medium">{t.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Badge tone={PRIO_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                        {t.sector && <Badge>{t.sector}</Badge>}
                        {blocked && <Badge tone="warn">Bloqueada</Badge>}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-carvao/60">
                        <span className={late ? "font-medium text-red-700" : ""}>{t.dueDate ? dateBr(t.dueDate) : "sem prazo"}</span>
                        <span className="flex items-center gap-2">
                          {t.checklist.length > 0 && <span>☑ {done}/{t.checklist.length}</span>}
                          {t.files.length > 0 && <span>📎 {t.files.length}</span>}
                          {t.assigneeId && <Avatar name={p.memberName(t.assigneeId)} size={22} />}
                        </span>
                      </div>
                      {/* alternativa acessível ao arrastar */}
                      {p.can("edit") && (
                        <select
                          className="mt-2 w-full rounded border border-areia bg-marfim px-1 py-0.5 text-xs"
                          value={t.status}
                          aria-label="Mover para"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => move(t, e.target.value)}
                        >
                          {TASK_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <Modal open={open !== null} onClose={close} title={open === "new" ? "Nova tarefa" : "Tarefa"} wide>
        {open !== null && <TaskForm task={open === "new" ? null : open} all={tasks} onDone={close} />}
      </Modal>
    </div>
  );
}

function TaskForm({ task, all, onDone }: { task: TaskLite | null; all: TaskLite[]; onDone: () => void }) {
  const p = useProject();
  const { exec, pending } = useAction();
  const [v, setV] = useState<TaskInput>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: (task?.status ?? "TODO") as TaskInput["status"],
    priority: (task?.priority ?? "MEDIUM") as TaskInput["priority"],
    sector: task?.sector ?? "",
    assigneeId: task?.assigneeId ?? null,
    dueDate: task?.dueDate ?? "",
    checklist: task?.checklist ?? [],
    dependsOn: task?.dependsOn ?? [],
  });
  const [newItem, setNewItem] = useState("");
  const readOnly = !p.can("edit");
  const save = () => exec(() => saveTaskAction(p.projectId, task?.id ?? null, v), { success: "Tarefa salva.", onOk: () => !task && onDone() });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset disabled={readOnly} className="space-y-4">
          <Field label="Título *"><input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required /></Field>
          <Field label="Descrição"><textarea className="input min-h-[90px]" value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <select className="input" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as TaskInput["status"] })}>
                {TASK_STATUS.map(([k, l]) => <option key={k} value={k} disabled={k === "APPROVED" && !p.can("approve") && task?.status !== "APPROVED"}>{l}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select className="input" value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as TaskInput["priority"] })}>
                {PRIORITY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Responsável"><MemberSelect value={v.assigneeId} onChange={(x) => setV({ ...v, assigneeId: x })} /></Field>
            <Field label="Setor">
              <select className="input" value={v.sector ?? ""} onChange={(e) => setV({ ...v, sector: e.target.value })}>
                <option value="">—</option>
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Prazo"><input type="date" className="input" value={v.dueDate ?? ""} onChange={(e) => setV({ ...v, dueDate: e.target.value })} /></Field>
            <Field label="Depende de" hint="Não pode ser aprovada/concluída antes das dependências.">
              <select
                multiple
                className="input h-24"
                value={v.dependsOn}
                onChange={(e) => setV({ ...v, dependsOn: Array.from(e.target.selectedOptions).map((o) => o.value) })}
              >
                {all.filter((t) => t.id !== task?.id).map((t) => <option key={t.id} value={t.id}>{t.title} ({TASK_STATUS_LABEL[t.status]})</option>)}
              </select>
            </Field>
          </div>
          <div>
            <span className="label">Checklist</span>
            <ul className="space-y-1">
              {v.checklist.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.done} onChange={(e) => setV({ ...v, checklist: v.checklist.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)) })} aria-label={c.text} />
                  <span className={c.done ? "line-through text-carvao/50" : ""}>{c.text}</span>
                  <button type="button" className="ml-auto text-xs text-carvao/50 hover:text-red-700" onClick={() => setV({ ...v, checklist: v.checklist.filter((x) => x.id !== c.id) })} aria-label="Remover item">✕</button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input className="input" placeholder="Novo item" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newItem.trim()) { setV({ ...v, checklist: [...v.checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }] }); setNewItem(""); }
                }
              }} />
              <button type="button" className="btn-secondary" onClick={() => { if (newItem.trim()) { setV({ ...v, checklist: [...v.checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }] }); setNewItem(""); } }}>Adicionar</button>
            </div>
          </div>
        </fieldset>
        {!readOnly && (
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              {task && (
                <ConfirmButton onConfirm={() => exec(() => deleteTaskAction(p.projectId, task.id), { success: "Tarefa excluída.", onOk: onDone })}>Excluir</ConfirmButton>
              )}
              {task && task.status !== "APPROVED" && (
                <button type="button" className="btn-secondary btn-sm" onClick={() => exec(() => requestApprovalAction(p.projectId, "task", task.id, task.title), { success: "Aprovação solicitada." })}>
                  Solicitar aprovação
                </button>
              )}
            </div>
            <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
          </div>
        )}
      </form>
      {task ? (
        <aside className="space-y-5 border-t border-areia pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div>
            <span className="label">Anexos</span>
            <ul className="mb-2 space-y-1 text-sm">
              {task.files.map((f) => <li key={f.id}><a className="underline" href={`/api/files/${f.id}?download`}>{f.name}</a></li>)}
              {task.files.length === 0 && <li className="text-carvao/50">Nenhum anexo.</li>}
            </ul>
            {p.can("edit") && <UploadButton projectId={p.projectId} folder={`task:${task.id}`} onUploaded={() => {}} />}
            {task.files.filter((f) => f.mime.startsWith("image/")).length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-1">
                {task.files.filter((f) => f.mime.startsWith("image/")).map((f) => <div key={f.id} className="aspect-square overflow-hidden rounded"><FileThumb id={f.id} mime={f.mime} name={f.name} /></div>)}
              </div>
            )}
          </div>
          <Thread targetType="task" targetId={task.id} link={`${p.base}/tarefas?t=${task.id}`} />
        </aside>
      ) : (
        <p className="text-sm text-carvao/50">Salve a tarefa para anexar arquivos e comentar.</p>
      )}
    </div>
  );
}

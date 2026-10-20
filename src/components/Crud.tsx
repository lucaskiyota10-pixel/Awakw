"use client";

import { useState, type ReactNode } from "react";
import { ENTITIES, type EntityKey, type FieldDef } from "@/lib/crud-defs";
import { saveEntityAction, deleteEntityAction } from "@/app/actions/crud";
import { ConfirmButton, Empty, Field, Modal, useAction } from "./ui";
import { useProject } from "./project-context";
import { dateBr, isoDay, num, brl } from "@/lib/format";

type Row = Record<string, unknown> & { id: string };

function toForm(fields: FieldDef[], row?: Row | null, defaults?: Record<string, unknown>) {
  const v: Record<string, unknown> = {};
  for (const f of fields) {
    const x = row ? row[f.name] : defaults?.[f.name];
    v[f.name] = f.type === "date" ? (x ? isoDay(x as string) : "") : f.type === "bool" ? Boolean(x) : (x ?? (f.type === "select" ? f.options![0][0] : ""));
  }
  return v;
}

export function display(f: FieldDef, v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-carvao/30">—</span>;
  if (f.type === "date") return dateBr(v as string);
  if (f.type === "bool") return v ? "Sim" : "Não";
  if (f.type === "select") return f.options!.find((o) => o[0] === v)?.[1] ?? String(v);
  if (f.type === "number") return f.label.includes("R$") ? brl(v as number) : num(v as number, 2);
  if (f.type === "int") return num(v as number);
  if (f.type === "url")
    return (
      <a href={String(v)} target="_blank" rel="noopener noreferrer" className="break-all underline">
        {String(v).replace(/^https?:\/\//, "").slice(0, 40)}
      </a>
    );
  return <span className="whitespace-pre-wrap">{String(v)}</span>;
}

export function EntityForm({
  entity,
  row,
  defaults,
  onDone,
  hidden = [],
}: {
  entity: EntityKey;
  row?: Row | null;
  defaults?: Record<string, unknown>;
  onDone: () => void;
  hidden?: string[];
}) {
  const def = ENTITIES[entity];
  const fields = def.fields as readonly FieldDef[] as FieldDef[];
  const { projectId } = useProject();
  const [v, setV] = useState(() => toForm(fields, row, defaults));
  const { exec, pending } = useAction();
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => saveEntityAction(projectId, entity, row?.id ?? null, v), { success: "Salvo.", onOk: onDone });
      }}
    >
      {fields
        .filter((f) => !hidden.includes(f.name))
        .map((f) => (
          <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <Field label={`${f.label}${f.required ? " *" : ""}`} hint={f.hint}>
              {f.type === "textarea" ? (
                <textarea className="input min-h-[80px]" value={String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
              ) : f.type === "select" ? (
                <select className="input" value={String(v[f.name])} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                  {f.options!.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              ) : f.type === "bool" ? (
                <input type="checkbox" className="h-5 w-5" checked={Boolean(v[f.name])} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} />
              ) : (
                <input
                  className="input"
                  type={f.type === "date" ? "date" : f.type === "number" || f.type === "int" ? "number" : f.type === "url" ? "url" : "text"}
                  step={f.type === "number" ? "0.01" : undefined}
                  value={String(v[f.name] ?? "")}
                  onChange={(e) => setV({ ...v, [f.name]: e.target.value })}
                />
              )}
            </Field>
          </div>
        ))}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-secondary" onClick={onDone}>Cancelar</button>
        <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  );
}

/** Tabela CRUD genérica com modal de edição e exclusão confirmada. */
export function CrudTable({
  entity,
  rows,
  title,
  defaults,
  hidden,
  emptyText = "Nenhum registro ainda.",
  extraActions,
}: {
  entity: EntityKey;
  rows: Row[];
  title?: string;
  defaults?: Record<string, unknown>;
  hidden?: string[];
  emptyText?: string;
  extraActions?: (r: Row) => ReactNode;
}) {
  const def = ENTITIES[entity];
  const fields = (def.fields as readonly FieldDef[] as FieldDef[]).filter((f) => !hidden?.includes(f.name));
  const cols = fields.filter((f) => f.table).length ? fields.filter((f) => f.table) : fields.slice(0, 4);
  const [editing, setEditing] = useState<Row | null | "new">(null);
  const p = useProject();
  const { exec } = useAction();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {title && <h3 className="card-title">{title}</h3>}
        {p.can("edit") && (
          <button className="btn-primary btn-sm" onClick={() => setEditing("new")} data-admin>
            Adicionar
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.name}>{c.label}</th>
                ))}
                <th className="w-0" data-admin></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {cols.map((c) => (
                    <td key={c.name} className="max-w-xs">{display(c, r[c.name])}</td>
                  ))}
                  <td className="whitespace-nowrap" data-admin>
                    <div className="flex gap-1">
                      {extraActions?.(r)}
                      {p.can("edit") && (
                        <button className="btn-ghost btn-sm" onClick={() => setEditing(r)}>Editar</button>
                      )}
                      {p.can("edit") && (
                        <ConfirmButton onConfirm={() => exec(() => deleteEntityAction(p.projectId, entity, r.id), { success: "Excluído." })} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={`${editing === "new" ? "Novo" : "Editar"}: ${def.label}`} wide>
        {editing !== null && (
          <EntityForm entity={entity} row={editing === "new" ? null : editing} defaults={defaults} hidden={hidden} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/db";
import { actionContext } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { run, UserError } from "@/lib/server/action";
import { ENTITIES, schemaFor, type EntityKey } from "@/lib/crud-defs";
import { canDelete } from "@/lib/permissions";

type Delegate = {
  findFirst: (a: unknown) => Promise<Record<string, unknown> | null>;
  create: (a: unknown) => Promise<{ id: string }>;
  update: (a: unknown) => Promise<{ id: string }>;
  delete: (a: unknown) => Promise<unknown>;
};

function delegate(key: EntityKey): Delegate {
  const def = ENTITIES[key];
  if (!def) throw new UserError("Entidade inválida.");
  return (prisma as unknown as Record<string, Delegate>)[def.model];
}

function businessRules(key: EntityKey, data: Record<string, unknown>) {
  if (key === "pixel" && data.status === "VALIDATED" && !String(data.evidence ?? "").trim())
    throw new UserError("Para marcar como validado, registre a evidência do teste (não declaramos integração sem validação real).");
  if (key === "measurement" && data.status === "VALIDATED" && !String(data.evidence ?? "").trim())
    throw new UserError("Registre a evidência para marcar como validado.");
  if (key === "highlight" && data.coverColor && !/^#[0-9a-fA-F]{6}$/.test(String(data.coverColor)))
    throw new UserError("Cor da capa deve estar no formato #RRGGBB.");
}

export async function saveEntityAction(projectId: string, key: EntityKey, id: string | null, raw: Record<string, unknown>) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const def = ENTITIES[key];
    const data = schemaFor(def).parse(raw) as Record<string, unknown>;
    businessRules(key, data);
    if (key === "checklist") {
      data.doneById = data.done ? ctx.user.id : null;
      data.doneAt = data.done ? new Date() : null;
    }
    const d = delegate(key);
    let rec: { id: string };
    if (id) {
      const existing = await d.findFirst({ where: { id, projectId } });
      if (!existing) throw new UserError("Registro não encontrado.");
      rec = await d.update({ where: { id }, data });
    } else {
      const owner = "ownerField" in def && def.ownerField ? { [def.ownerField]: ctx.user.id } : {};
      rec = await d.create({ data: { ...data, ...owner, projectId } });
    }
    await audit({ projectId, userId: ctx.user.id, action: id ? "update" : "create", entity: key, entityId: rec.id, data: JSON.parse(JSON.stringify(data)) });
    revalidatePath(`/p/${projectId}`, "layout");
    return { id: rec.id };
  });
}

export async function toggleChecklistAction(projectId: string, id: string, done: boolean) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const it = await prisma.checklistItem.findFirst({ where: { id, projectId } });
    if (!it) throw new UserError("Item não encontrado.");
    await prisma.checklistItem.update({ where: { id }, data: { done, doneById: done ? ctx.user.id : null, doneAt: done ? new Date() : null } });
    await audit({ projectId, userId: ctx.user.id, action: done ? "check" : "uncheck", entity: "checklist", entityId: id });
    revalidatePath(`/p/${projectId}/digital`);
  });
}

export async function resetDailyChecklistAction(projectId: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    await prisma.checklistItem.updateMany({ where: { projectId, list: "DAILY" }, data: { done: false, doneAt: null, doneById: null } });
    await audit({ projectId, userId: ctx.user.id, action: "reset", entity: "checklist" });
    revalidatePath(`/p/${projectId}/digital`);
  });
}

export async function deleteEntityAction(projectId: string, key: EntityKey, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const def = ENTITIES[key];
    const d = delegate(key);
    const existing = await d.findFirst({ where: { id, projectId } });
    if (!existing) throw new UserError("Registro não encontrado.");
    const ownerField = "ownerField" in def ? def.ownerField : undefined;
    const isOwner = ownerField ? existing[ownerField] === ctx.user.id : false;
    if (!canDelete(ctx.role, isOwner)) throw new UserError("Apenas o autor ou coordenadores podem excluir.");
    await d.delete({ where: { id } });
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: key, entityId: id, data: JSON.parse(JSON.stringify(existing)) });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

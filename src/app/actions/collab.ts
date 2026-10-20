"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { actionContext, projectMembers } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { run, UserError } from "@/lib/server/action";
import { notify } from "@/lib/server/notify";
import { publish } from "@/lib/server/realtime";
import { parseMentions } from "@/lib/mentions";
import { can, canDelete } from "@/lib/permissions";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "AWAITING_APPROVAL", "APPROVED", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const taskSchema = z.object({
  title: z.string().trim().min(2, "Título muito curto.").max(200),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(STATUSES),
  priority: z.enum(PRIORITIES),
  sector: z.string().max(60).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  checklist: z.array(z.object({ id: z.string(), text: z.string().max(300), done: z.boolean() })).max(100),
  dependsOn: z.array(z.string()).max(50),
});
export type TaskInput = z.infer<typeof taskSchema>;

async function assertMember(projectId: string, userId: string | null | undefined) {
  if (!userId) return;
  const ms = await projectMembers(projectId);
  if (!ms.some((m) => m.id === userId)) throw new UserError("Responsável não pertence à equipe.");
}

async function assertDepsDone(projectId: string, dependsOn: string[], status: string) {
  if (!["APPROVED", "DONE"].includes(status) || !dependsOn.length) return;
  const open = await prisma.task.findMany({ where: { projectId, id: { in: dependsOn }, status: { not: "DONE" } }, select: { title: true } });
  if (open.length) throw new UserError(`Dependências pendentes: ${open.map((t) => t.title).join(", ")}.`);
}

function assertStatusAllowed(role: Parameters<typeof can>[0], status: string, prev?: string) {
  if (status === "APPROVED" && prev !== "APPROVED" && !can(role, "approve"))
    throw new UserError("Apenas coordenadores/administradores aprovam tarefas. Mova para 'Aguardando aprovação'.");
}

export async function saveTaskAction(projectId: string, id: string | null, input: TaskInput) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const d = taskSchema.parse(input);
    await assertMember(projectId, d.assigneeId);
    if (id && d.dependsOn.includes(id)) throw new UserError("Uma tarefa não pode depender de si mesma.");
    const validDeps = await prisma.task.count({ where: { projectId, id: { in: d.dependsOn } } });
    if (validDeps !== d.dependsOn.length) throw new UserError("Dependência inválida.");
    const prev = id ? await prisma.task.findFirst({ where: { id, projectId } }) : null;
    if (id && !prev) throw new UserError("Tarefa não encontrada.");
    assertStatusAllowed(ctx.role, d.status, prev?.status);
    await assertDepsDone(projectId, d.dependsOn, d.status);
    const data = {
      ...d,
      description: d.description || null,
      sector: d.sector || null,
      assigneeId: d.assigneeId || null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      checklist: d.checklist as Prisma.InputJsonValue,
    };
    const task = prev
      ? await prisma.task.update({ where: { id: prev.id }, data })
      : await prisma.task.create({ data: { ...data, projectId, createdById: ctx.user.id, order: Date.now() } });
    const changes: Record<string, unknown> = {};
    if (prev) for (const k of ["title", "status", "priority", "assigneeId", "dueDate", "sector"] as const) {
      const a = prev[k] instanceof Date ? (prev[k] as Date).toISOString().slice(0, 10) : prev[k];
      const b = data[k] instanceof Date ? (data[k] as Date).toISOString().slice(0, 10) : data[k];
      if (a !== b) changes[k] = { de: a, para: b };
    }
    await audit({ projectId, userId: ctx.user.id, action: prev ? "update" : "create", entity: "task", entityId: task.id, data: (prev ? changes : { title: d.title }) as Prisma.InputJsonValue });
    if (task.assigneeId && task.assigneeId !== prev?.assigneeId)
      await notify(projectId, [task.assigneeId], { type: "task", title: "Nova tarefa atribuída a você", body: task.title, link: `/p/${projectId}/tarefas?t=${task.id}` }, ctx.user.id);
    if (task.status === "AWAITING_APPROVAL" && prev?.status !== "AWAITING_APPROVAL") {
      const approvers = (await projectMembers(projectId)).filter((m) => can(m.role, "approve")).map((m) => m.id);
      await notify(projectId, approvers, { type: "approval", title: "Tarefa aguardando aprovação", body: task.title, link: `/p/${projectId}/tarefas?t=${task.id}` }, ctx.user.id);
    }
    publish({ type: "task", projectId });
    revalidatePath(`/p/${projectId}/tarefas`);
    return { id: task.id };
  });
}

export async function moveTaskAction(projectId: string, id: string, status: (typeof STATUSES)[number], order: number) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const t = await prisma.task.findFirst({ where: { id, projectId } });
    if (!t) throw new UserError("Tarefa não encontrada.");
    z.enum(STATUSES).parse(status);
    assertStatusAllowed(ctx.role, status, t.status);
    await assertDepsDone(projectId, t.dependsOn, status);
    await prisma.task.update({ where: { id }, data: { status, order } });
    if (t.status !== status) {
      await audit({ projectId, userId: ctx.user.id, action: "move", entity: "task", entityId: id, data: { status: { de: t.status, para: status } } });
      if (status === "AWAITING_APPROVAL") {
        const approvers = (await projectMembers(projectId)).filter((m) => can(m.role, "approve")).map((m) => m.id);
        await notify(projectId, approvers, { type: "approval", title: "Tarefa aguardando aprovação", body: t.title, link: `/p/${projectId}/tarefas?t=${id}` }, ctx.user.id);
      }
    }
    publish({ type: "task", projectId });
    revalidatePath(`/p/${projectId}/tarefas`);
  });
}

export async function deleteTaskAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const t = await prisma.task.findFirst({ where: { id, projectId } });
    if (!t) throw new UserError("Tarefa não encontrada.");
    if (!canDelete(ctx.role, t.createdById === ctx.user.id)) throw new UserError("Apenas o autor ou coordenadores podem excluir.");
    await prisma.task.delete({ where: { id } });
    // remove a dependência de outras tarefas
    const dependents = await prisma.task.findMany({ where: { projectId, dependsOn: { has: id } } });
    for (const d of dependents) await prisma.task.update({ where: { id: d.id }, data: { dependsOn: d.dependsOn.filter((x) => x !== id) } });
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: "task", entityId: id, data: { title: t.title } });
    publish({ type: "task", projectId });
    revalidatePath(`/p/${projectId}/tarefas`);
  });
}

/* ---------------- Comentários + histórico ---------------- */

const TARGETS = ["task", "decision", "publication", "scenario", "document", "campaign", "budget"] as const;

export async function getThreadAction(projectId: string, targetType: (typeof TARGETS)[number], targetId: string) {
  return run(async () => {
    await actionContext(projectId, "view");
    z.enum(TARGETS).parse(targetType);
    const [comments, history] = await Promise.all([
      prisma.comment.findMany({ where: { projectId, targetType, targetId }, orderBy: { createdAt: "asc" } }),
      prisma.auditLog.findMany({ where: { projectId, entity: targetType, entityId: targetId }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return {
      comments: comments.map((c) => ({ id: c.id, authorId: c.authorId, body: c.body, createdAt: c.createdAt.toISOString() })),
      history: history.map((h) => ({ id: h.id, userId: h.userId, action: h.action, data: h.data, createdAt: h.createdAt.toISOString() })),
    };
  });
}

export async function addCommentAction(projectId: string, targetType: (typeof TARGETS)[number], targetId: string, body: string, link?: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "view"); // visualizadores podem comentar (ex.: professor/cliente)
    z.enum(TARGETS).parse(targetType);
    const text = z.string().trim().min(1, "Comentário vazio.").max(5000).parse(body);
    const c = await prisma.comment.create({ data: { projectId, authorId: ctx.user.id, targetType, targetId, body: text } });
    const members = await projectMembers(projectId);
    const mentioned = parseMentions(text, members);
    if (mentioned.length)
      await notify(projectId, mentioned, { type: "mention", title: `${ctx.user.name} mencionou você`, body: text.slice(0, 140), link: link ?? `/p/${projectId}` }, ctx.user.id);
    await audit({ projectId, userId: ctx.user.id, action: "comment", entity: targetType, entityId: targetId });
    publish({ type: "task", projectId });
    return { id: c.id };
  });
}

/* ---------------- Aprovações ---------------- */

export async function requestApprovalAction(projectId: string, targetType: (typeof TARGETS)[number], targetId: string, targetLabel: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    z.enum(TARGETS).parse(targetType);
    const pending = await prisma.approval.findFirst({ where: { projectId, targetType, targetId, status: "PENDING" } });
    if (pending) throw new UserError("Já existe uma solicitação pendente para este item.");
    const a = await prisma.approval.create({
      data: { projectId, targetType, targetId, targetLabel: targetLabel.slice(0, 200), requestedById: ctx.user.id },
    });
    await setTargetStatus(projectId, targetType, targetId, "IN_REVIEW");
    const approvers = (await projectMembers(projectId)).filter((m) => can(m.role, "approve")).map((m) => m.id);
    await notify(projectId, approvers, { type: "approval", title: "Nova solicitação de aprovação", body: targetLabel, link: `/p/${projectId}/aprovacoes` }, ctx.user.id);
    await audit({ projectId, userId: ctx.user.id, action: "request_approval", entity: targetType, entityId: targetId });
    revalidatePath(`/p/${projectId}`, "layout");
    return { id: a.id };
  });
}

async function setTargetStatus(projectId: string, type: string, id: string, status: "IN_REVIEW" | "APPROVED" | "REJECTED", userId?: string) {
  const now = new Date();
  switch (type) {
    case "document": {
      const doc = await prisma.document.findFirst({ where: { id, projectId } });
      if (!doc) return;
      await prisma.document.update({
        where: { id },
        data:
          status === "APPROVED"
            ? { status: "APPROVED", approvedVersion: doc.version, approvedById: userId, approvedAt: now }
            : { status: status === "REJECTED" ? "DRAFT" : "IN_REVIEW" },
      });
      return;
    }
    case "scenario":
      await prisma.scenario.updateMany({
        where: { id, projectId },
        data: status === "APPROVED" ? { status: "APPROVED", approvedById: userId, approvedAt: now } : { status: status === "REJECTED" ? "DRAFT" : "IN_REVIEW" },
      });
      return;
    case "publication":
      await prisma.publication.updateMany({ where: { id, projectId }, data: { status: status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "WRITING" : "ACCOUNT_REVIEW" } });
      return;
    case "budget":
      if (status === "APPROVED") await prisma.budgetPlan.updateMany({ where: { id, projectId }, data: { status: "APPROVED", approvedById: userId, approvedAt: now } });
      return;
    case "task":
      await prisma.task.updateMany({ where: { id, projectId }, data: { status: status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "IN_PROGRESS" : "AWAITING_APPROVAL" } });
      return;
    case "campaign":
      await prisma.campaign.updateMany({ where: { id, projectId }, data: { status: status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "PLANNING" : "IN_REVIEW" } });
      return;
  }
}

export async function decideApprovalAction(projectId: string, approvalId: string, decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED", note: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "approve");
    const a = await prisma.approval.findFirst({ where: { id: approvalId, projectId } });
    if (!a) throw new UserError("Solicitação não encontrada.");
    if (a.status !== "PENDING") throw new UserError("Esta solicitação já foi decidida.");
    z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]).parse(decision);
    await prisma.approval.update({ where: { id: a.id }, data: { status: decision, note: note.slice(0, 2000) || null, decidedById: ctx.user.id, decidedAt: new Date() } });
    await setTargetStatus(projectId, a.targetType, a.targetId, decision === "APPROVED" ? "APPROVED" : "REJECTED", ctx.user.id);
    const label = decision === "APPROVED" ? "aprovado" : decision === "REJECTED" ? "reprovado" : "com ajustes solicitados";
    await notify(projectId, [a.requestedById], { type: "approval", title: `Item ${label}`, body: a.targetLabel, link: `/p/${projectId}/aprovacoes` }, ctx.user.id);
    await audit({ projectId, userId: ctx.user.id, action: `approval_${decision.toLowerCase()}`, entity: a.targetType, entityId: a.targetId, data: { note } });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

/* ---------------- Decisões ---------------- */

const decisionSchema = z.object({
  title: z.string().trim().min(2).max(200),
  proposal: z.string().trim().min(2, "Descreva a proposta.").max(10000),
  responsibleIds: z.array(z.string()).max(20),
  dueDate: z.string().optional().nullable(),
});

export async function saveDecisionAction(projectId: string, id: string | null, input: z.infer<typeof decisionSchema>) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const d = decisionSchema.parse(input);
    for (const r of d.responsibleIds) await assertMember(projectId, r);
    const data = { ...d, dueDate: d.dueDate ? new Date(d.dueDate) : null };
    let rec;
    if (id) {
      const prev = await prisma.decision.findFirst({ where: { id, projectId } });
      if (!prev) throw new UserError("Decisão não encontrada.");
      if (prev.status === "APPROVED" || prev.status === "REJECTED") throw new UserError("Decisões encerradas não podem ser editadas; registre uma nova.");
      rec = await prisma.decision.update({ where: { id }, data });
    } else {
      rec = await prisma.decision.create({ data: { ...data, projectId, createdById: ctx.user.id } });
      await notify(projectId, d.responsibleIds, { type: "decision", title: "Nova decisão em pauta", body: d.title, link: `/p/${projectId}/decisoes?d=${rec.id}` }, ctx.user.id);
    }
    await audit({ projectId, userId: ctx.user.id, action: id ? "update" : "create", entity: "decision", entityId: rec.id, data: { title: d.title } });
    publish({ type: "decision", projectId });
    revalidatePath(`/p/${projectId}/decisoes`);
    return { id: rec.id };
  });
}

export async function setDecisionStatusAction(projectId: string, id: string, status: "PROPOSED" | "IN_DISCUSSION" | "APPROVED" | "REJECTED", note: string) {
  return run(async () => {
    const final = status === "APPROVED" || status === "REJECTED";
    const ctx = await actionContext(projectId, final ? "approve" : "edit");
    const prev = await prisma.decision.findFirst({ where: { id, projectId } });
    if (!prev) throw new UserError("Decisão não encontrada.");
    await prisma.decision.update({
      where: { id },
      data: { status, ...(final ? { decidedAt: new Date(), decidedById: ctx.user.id, decisionNote: note.slice(0, 2000) || null } : {}) },
    });
    await audit({ projectId, userId: ctx.user.id, action: "status", entity: "decision", entityId: id, data: { de: prev.status, para: status, note } });
    await notify(projectId, [...prev.responsibleIds, prev.createdById], { type: "decision", title: `Decisão: ${status === "APPROVED" ? "aprovada" : status === "REJECTED" ? "rejeitada" : "em discussão"}`, body: prev.title, link: `/p/${projectId}/decisoes?d=${id}` }, ctx.user.id);
    publish({ type: "decision", projectId });
    revalidatePath(`/p/${projectId}/decisoes`);
  });
}

/* ---------------- Chat ---------------- */

async function channelAccess(projectId: string, channelId: string, userId: string) {
  const ch = await prisma.channel.findFirst({ where: { id: channelId, projectId } });
  if (!ch) throw new UserError("Canal não encontrado.");
  if ((ch.type === "GROUP" || ch.type === "DIRECT") && !ch.memberIds.includes(userId)) throw new UserError("Você não participa deste canal.");
  return ch;
}

export async function sendMessageAction(
  projectId: string,
  channelId: string,
  input: { body: string; parentId?: string | null; fileIds?: string[]; linkType?: string | null; linkId?: string | null },
) {
  return run(async () => {
    const ctx = await actionContext(projectId, "view");
    const ch = await channelAccess(projectId, channelId, ctx.user.id);
    const body = z.string().trim().max(5000).parse(input.body ?? "");
    const fileIds = z.array(z.string()).max(10).parse(input.fileIds ?? []);
    if (!body && !fileIds.length) throw new UserError("Mensagem vazia.");
    if (fileIds.length && (await prisma.fileAsset.count({ where: { projectId, id: { in: fileIds } } })) !== fileIds.length)
      throw new UserError("Anexo inválido.");
    if (input.parentId && !(await prisma.message.findFirst({ where: { id: input.parentId, channelId } }))) throw new UserError("Mensagem original não encontrada.");
    const linkType = input.linkType && ["task", "document", "decision"].includes(input.linkType) ? input.linkType : null;
    const members = await projectMembers(projectId);
    const scope = ch.type === "GROUP" || ch.type === "DIRECT" ? members.filter((m) => ch.memberIds.includes(m.id)) : members;
    const mentions = parseMentions(body, scope);
    const msg = await prisma.message.create({
      data: { channelId, authorId: ctx.user.id, body, parentId: input.parentId || null, fileIds, linkType, linkId: linkType ? input.linkId : null, mentions },
    });
    const chanLabel = ch.type === "DIRECT" ? "mensagem privada" : `#${ch.name}`;
    if (mentions.length)
      await notify(projectId, mentions, { type: "mention", title: `${ctx.user.name} mencionou você em ${chanLabel}`, body: body.slice(0, 140), link: `/p/${projectId}/chat?c=${channelId}` }, ctx.user.id);
    if (ch.type === "DIRECT")
      await notify(projectId, ch.memberIds.filter((m) => !mentions.includes(m)), { type: "dm", title: `Mensagem de ${ctx.user.name}`, body: body.slice(0, 140), link: `/p/${projectId}/chat?c=${channelId}` }, ctx.user.id);
    publish({ type: "message", projectId, payload: { channelId } });
    return { id: msg.id };
  });
}

export async function createChannelAction(projectId: string, input: { name: string; type: "GROUP" | "DIRECT" | "SECTOR"; memberIds: string[] }) {
  return run(async () => {
    const ctx = await actionContext(projectId, input.type === "SECTOR" ? "approve" : "view");
    const type = z.enum(["GROUP", "DIRECT", "SECTOR"]).parse(input.type);
    const ids = [...new Set([...input.memberIds, ctx.user.id])];
    for (const id of ids) await assertMember(projectId, id);
    if (type === "DIRECT") {
      if (ids.length !== 2) throw new UserError("Mensagem privada é entre duas pessoas.");
      const existing = await prisma.channel.findFirst({ where: { projectId, type: "DIRECT", memberIds: { hasEvery: ids } } });
      if (existing) return { id: existing.id };
    }
    const name = type === "DIRECT" ? "privado" : z.string().trim().min(2, "Nome do canal muito curto.").max(60).parse(input.name).toLowerCase().replace(/\s+/g, "-");
    const ch = await prisma.channel.create({ data: { projectId, name, type, memberIds: type === "SECTOR" ? [] : ids } });
    await audit({ projectId, userId: ctx.user.id, action: "create", entity: "channel", entityId: ch.id, data: { name, type } });
    revalidatePath(`/p/${projectId}/chat`);
    return { id: ch.id };
  });
}

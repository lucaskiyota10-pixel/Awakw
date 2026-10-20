"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { actionContext, projectMembers } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { run, UserError } from "@/lib/server/action";
import { publish } from "@/lib/server/realtime";
import { notify } from "@/lib/server/notify";
import { generateDocument, DOC_KINDS } from "@/lib/server/docgen";
import { changeStats } from "@/lib/diff";
import { canDelete } from "@/lib/permissions";

const MAX = 400_000;
const COALESCE_MS = 10 * 60 * 1000;

export async function createDocumentAction(projectId: string, input: { kind: string; title?: string; memberId?: string }) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const kind = z.enum(DOC_KINDS.map((k) => k[0]) as [string, ...string[]]).parse(input.kind);
    if (input.memberId && !(await projectMembers(projectId)).some((m) => m.id === input.memberId)) throw new UserError("Integrante inválido.");
    const gen = await generateDocument(projectId, kind, { memberId: input.memberId });
    const title = input.title?.trim() || gen.title;
    const doc = await prisma.document.create({
      data: {
        projectId,
        title: title.slice(0, 200),
        kind,
        content: gen.content,
        createdById: ctx.user.id,
        updatedById: ctx.user.id,
        versions: { create: { version: 1, content: gen.content, authorId: ctx.user.id, charsAdded: gen.content.length, note: "Gerado a partir dos dados do projeto" } },
      },
    });
    await audit({ projectId, userId: ctx.user.id, action: "create", entity: "document", entityId: doc.id, data: { kind, title } });
    revalidatePath(`/p/${projectId}/documentos`);
    return { id: doc.id };
  });
}

export type SaveResult =
  | { status: "saved"; version: number }
  | { status: "conflict"; serverVersion: number; serverContent: string; serverAuthor: string; serverUpdatedAt: string };

/** Autosave com controle otimista de concorrência: só grava se baseVersion == versão atual (ou force). */
export async function saveDocumentAction(projectId: string, id: string, input: { content: string; baseVersion: number; force?: boolean; note?: string }) {
  return run<SaveResult>(async () => {
    const ctx = await actionContext(projectId, "edit");
    const content = z.string().max(MAX, "Documento muito grande.").parse(input.content);
    const doc = await prisma.document.findFirst({ where: { id, projectId } });
    if (!doc) throw new UserError("Documento não encontrado.");
    if (doc.status === "APPROVED") throw new UserError("Documento aprovado está bloqueado. Reabra para edição (coordenação) ou duplique.");
    if (doc.version !== input.baseVersion && !input.force) {
      return { status: "conflict", serverVersion: doc.version, serverContent: doc.content, serverAuthor: doc.updatedById, serverUpdatedAt: doc.updatedAt.toISOString() };
    }
    if (content === doc.content) return { status: "saved", version: doc.version };
    const newVersion = doc.version + 1;
    const updated = await prisma.document.updateMany({ where: { id, version: doc.version }, data: { content, version: newVersion, updatedById: ctx.user.id } });
    if (updated.count === 0) {
      const fresh = await prisma.document.findUniqueOrThrow({ where: { id } });
      return { status: "conflict", serverVersion: fresh.version, serverContent: fresh.content, serverAuthor: fresh.updatedById, serverUpdatedAt: fresh.updatedAt.toISOString() };
    }
    // Versões: agrupa salvamentos consecutivos do mesmo autor em até 10 min num único snapshot
    const last = await prisma.documentVersion.findFirst({ where: { documentId: id }, orderBy: { version: "desc" } });
    const prevSnapshot = last && last.authorId === ctx.user.id && Date.now() - last.createdAt.getTime() < COALESCE_MS && !input.note ? last : null;
    if (prevSnapshot) {
      const base = await prisma.documentVersion.findFirst({ where: { documentId: id, version: { lt: prevSnapshot.version } }, orderBy: { version: "desc" } });
      const s = changeStats(base?.content ?? "", content);
      await prisma.documentVersion.update({ where: { id: prevSnapshot.id }, data: { content, version: newVersion, charsAdded: s.added, charsRemoved: s.removed } });
    } else {
      const s = changeStats(doc.content, content);
      await prisma.documentVersion.create({ data: { documentId: id, version: newVersion, content, authorId: ctx.user.id, charsAdded: s.added, charsRemoved: s.removed, note: input.note ?? (input.force ? "Gravado sobre versão concorrente" : null) } });
    }
    await audit({ projectId, userId: ctx.user.id, action: "update", entity: "document", entityId: id, data: { version: newVersion, force: !!input.force } });
    publish({ type: "document", projectId, userId: ctx.user.id, payload: { documentId: id, version: newVersion } });
    return { status: "saved", version: newVersion };
  });
}

export async function renameDocumentAction(projectId: string, id: string, title: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const t = z.string().trim().min(2).max(200).parse(title);
    const r = await prisma.document.updateMany({ where: { id, projectId }, data: { title: t } });
    if (!r.count) throw new UserError("Documento não encontrado.");
    await audit({ projectId, userId: ctx.user.id, action: "update", entity: "document", entityId: id, data: { title: t } });
    revalidatePath(`/p/${projectId}/documentos`);
  });
}

export async function getVersionsAction(projectId: string, id: string) {
  return run(async () => {
    await actionContext(projectId, "view");
    const vs = await prisma.documentVersion.findMany({ where: { documentId: id, document: { projectId } }, orderBy: { version: "desc" } });
    return vs.map((v) => ({ id: v.id, version: v.version, content: v.content, authorId: v.authorId, charsAdded: v.charsAdded, charsRemoved: v.charsRemoved, note: v.note, createdAt: v.createdAt.toISOString() }));
  });
}

export async function restoreVersionAction(projectId: string, id: string, versionId: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const doc = await prisma.document.findFirst({ where: { id, projectId } });
    const v = await prisma.documentVersion.findFirst({ where: { id: versionId, documentId: id } });
    if (!doc || !v) throw new UserError("Versão não encontrada.");
    if (doc.status === "APPROVED") throw new UserError("Documento aprovado está bloqueado.");
    const newVersion = doc.version + 1;
    const s = changeStats(doc.content, v.content);
    await prisma.$transaction([
      prisma.document.update({ where: { id }, data: { content: v.content, version: newVersion, updatedById: ctx.user.id } }),
      prisma.documentVersion.create({ data: { documentId: id, version: newVersion, content: v.content, authorId: ctx.user.id, charsAdded: s.added, charsRemoved: s.removed, note: `Restaurada a partir da versão ${v.version}` } }),
    ]);
    await audit({ projectId, userId: ctx.user.id, action: "restore", entity: "document", entityId: id, data: { from: v.version, to: newVersion } });
    publish({ type: "document", projectId, userId: ctx.user.id, payload: { documentId: id, version: newVersion } });
    revalidatePath(`/p/${projectId}/documentos/${id}`);
    return { version: newVersion };
  });
}

export async function regenerateDocumentAction(projectId: string, id: string, memberId?: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const doc = await prisma.document.findFirst({ where: { id, projectId } });
    if (!doc) throw new UserError("Documento não encontrado.");
    if (doc.status === "APPROVED") throw new UserError("Documento aprovado está bloqueado.");
    const gen = await generateDocument(projectId, doc.kind, { memberId });
    const newVersion = doc.version + 1;
    const s = changeStats(doc.content, gen.content);
    await prisma.$transaction([
      prisma.document.update({ where: { id }, data: { content: gen.content, version: newVersion, updatedById: ctx.user.id } }),
      prisma.documentVersion.create({ data: { documentId: id, version: newVersion, content: gen.content, authorId: ctx.user.id, charsAdded: s.added, charsRemoved: s.removed, note: "Regenerado com os dados atuais do projeto" } }),
    ]);
    await audit({ projectId, userId: ctx.user.id, action: "update", entity: "document", entityId: id, data: { regenerated: true } });
    publish({ type: "document", projectId, userId: ctx.user.id, payload: { documentId: id, version: newVersion } });
    revalidatePath(`/p/${projectId}/documentos/${id}`);
  });
}

export async function deleteDocumentAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const doc = await prisma.document.findFirst({ where: { id, projectId } });
    if (!doc) throw new UserError("Documento não encontrado.");
    if (!canDelete(ctx.role, doc.createdById === ctx.user.id)) throw new UserError("Apenas o autor ou coordenadores podem excluir.");
    await prisma.document.delete({ where: { id } });
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: "document", entityId: id, data: { title: doc.title } });
    revalidatePath(`/p/${projectId}/documentos`);
  });
}

export async function reopenDocumentAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "approve");
    const r = await prisma.document.updateMany({ where: { id, projectId, status: "APPROVED" }, data: { status: "DRAFT" } });
    if (!r.count) throw new UserError("Documento não está aprovado.");
    await audit({ projectId, userId: ctx.user.id, action: "status", entity: "document", entityId: id, data: { para: "DRAFT", note: "Reaberto (versão aprovada preservada)" } });
    revalidatePath(`/p/${projectId}/documentos/${id}`);
  });
}

/* ---------- Sugestões ---------- */

export async function suggestAction(projectId: string, id: string, input: { original: string; replacement: string; note?: string }) {
  return run(async () => {
    const ctx = await actionContext(projectId, "view");
    const original = z.string().min(1, "Selecione o trecho a alterar.").max(5000).parse(input.original);
    const replacement = z.string().max(5000).parse(input.replacement);
    const doc = await prisma.document.findFirst({ where: { id, projectId } });
    if (!doc) throw new UserError("Documento não encontrado.");
    if (!doc.content.includes(original)) throw new UserError("O trecho selecionado não existe mais no documento.");
    const s = await prisma.documentSuggestion.create({ data: { documentId: id, authorId: ctx.user.id, original, replacement, note: input.note?.slice(0, 500) || null } });
    await notify(projectId, [doc.createdById, doc.updatedById], { type: "suggestion", title: `${ctx.user.name} sugeriu uma alteração`, body: doc.title, link: `/p/${projectId}/documentos/${id}` }, ctx.user.id);
    await audit({ projectId, userId: ctx.user.id, action: "create", entity: "suggestion", entityId: s.id, data: { documentId: id } });
    publish({ type: "document", projectId, userId: ctx.user.id, payload: { documentId: id } });
    revalidatePath(`/p/${projectId}/documentos/${id}`);
    return { id: s.id };
  });
}

export async function resolveSuggestionAction(projectId: string, suggestionId: string, accept: boolean) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const s = await prisma.documentSuggestion.findFirst({ where: { id: suggestionId, document: { projectId } }, include: { document: true } });
    if (!s) throw new UserError("Sugestão não encontrada.");
    if (s.status !== "OPEN") throw new UserError("Sugestão já resolvida.");
    if (accept) {
      const doc = s.document;
      if (doc.status === "APPROVED") throw new UserError("Documento aprovado está bloqueado.");
      const idx = doc.content.indexOf(s.original);
      if (idx < 0) throw new UserError("O trecho original não existe mais; rejeite ou edite manualmente.");
      const content = doc.content.slice(0, idx) + s.replacement + doc.content.slice(idx + s.original.length);
      const newVersion = doc.version + 1;
      const st = changeStats(doc.content, content);
      await prisma.$transaction([
        prisma.document.update({ where: { id: doc.id }, data: { content, version: newVersion, updatedById: ctx.user.id } }),
        // a autoria da versão é de quem sugeriu (contribuição individual)
        prisma.documentVersion.create({ data: { documentId: doc.id, version: newVersion, content, authorId: s.authorId, charsAdded: st.added, charsRemoved: st.removed, note: `Sugestão aceita por ${ctx.user.name}` } }),
      ]);
    }
    await prisma.documentSuggestion.update({ where: { id: s.id }, data: { status: accept ? "ACCEPTED" : "REJECTED", resolvedById: ctx.user.id } });
    await notify(projectId, [s.authorId], { type: "suggestion", title: `Sua sugestão foi ${accept ? "aceita" : "rejeitada"}`, body: s.document.title, link: `/p/${projectId}/documentos/${s.documentId}` }, ctx.user.id);
    await audit({ projectId, userId: ctx.user.id, action: accept ? "accept" : "reject", entity: "suggestion", entityId: s.id });
    publish({ type: "document", projectId, userId: ctx.user.id, payload: { documentId: s.documentId } });
    revalidatePath(`/p/${projectId}/documentos/${s.documentId}`);
  });
}

/** Presença: avisa quem está com o documento aberto (sem persistência). */
export async function presenceAction(projectId: string, id: string) {
  const ctx = await actionContext(projectId, "view").catch(() => null);
  if (!ctx) return;
  publish({ type: "presence", projectId, userId: ctx.user.id, payload: { documentId: id, at: Date.now() } });
}

export async function approveDocumentAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "approve");
    const doc = await prisma.document.findFirst({ where: { id, projectId } });
    if (!doc) throw new UserError("Documento não encontrado.");
    await prisma.$transaction([
      prisma.document.update({ where: { id }, data: { status: "APPROVED", approvedVersion: doc.version, approvedById: ctx.user.id, approvedAt: new Date() } }),
      prisma.approval.updateMany({ where: { projectId, targetType: "document", targetId: id, status: "PENDING" }, data: { status: "APPROVED", decidedById: ctx.user.id, decidedAt: new Date() } }),
    ]);
    await audit({ projectId, userId: ctx.user.id, action: "approval_approved", entity: "document", entityId: id, data: { version: doc.version } });
    publish({ type: "document", projectId, userId: ctx.user.id, payload: { documentId: id } });
    revalidatePath(`/p/${projectId}/documentos/${id}`);
  });
}

export async function chartDataAction(projectId: string, key: string) {
  return run(async () => {
    await actionContext(projectId, "view");
    const { resolveChart } = await import("@/lib/server/charts");
    return await resolveChart(projectId, z.string().max(60).parse(key));
  });
}

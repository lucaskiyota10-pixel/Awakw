"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { actionContext, projectMembers } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { run, UserError } from "@/lib/server/action";
import { notify } from "@/lib/server/notify";
import { PUB_FLOW } from "@/lib/labels";
import { publish } from "@/lib/server/realtime";
import { can, canDelete } from "@/lib/permissions";

const optInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().min(0).nullable());

export async function saveProfileAction(projectId: string, input: Record<string, unknown>) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const d = z
      .object({
        displayName: z.string().trim().min(1).max(60),
        username: z.string().trim().regex(/^[a-z0-9._]{1,30}$/i, "Usuário: até 30 caracteres (letras, números, ponto e _)."),
        category: z.string().max(60).nullable().optional(),
        bio: z.string().max(150, "A bio do Instagram tem até 150 caracteres.").nullable().optional(),
        link: z.string().max(200).nullable().optional(),
        avatarFileId: z.string().nullable().optional(),
        avatarFit: z.enum(["cover", "contain"]).default("cover"),
        followersMode: z.enum(["manual", "scenario"]).default("manual"),
        followersMonths: z.coerce.number().int().refine((m) => [0, 1, 3, 6, 12].includes(m), "Marco inválido.").default(1),
        hypotheticalFollowers: z.coerce.number().int().min(0),
        hypotheticalFollowing: z.coerce.number().int().min(0),
      })
      .parse(input);
    if (d.avatarFileId && !(await prisma.fileAsset.findFirst({ where: { id: d.avatarFileId, projectId, mime: { startsWith: "image/" } } })))
      throw new UserError("Foto de perfil inválida.");
    await prisma.instagramProfile.upsert({ where: { projectId }, update: d, create: { ...d, projectId } });
    await audit({ projectId, userId: ctx.user.id, action: "update", entity: "igProfile", entityId: projectId });
    revalidatePath(`/p/${projectId}/instagram`);
  });
}

const FLOW_SECTOR: Record<string, string | null> = { WRITING: "Redação", CREATIVE: "Criação", PLANNING_REVIEW: "Planejamento", ACCOUNT_REVIEW: "Atendimento" };

const pubSchema = z.object({
  type: z.enum(["FEED", "CAROUSEL", "REEL", "STORY"]),
  title: z.string().trim().min(1, "Informe um título interno.").max(120),
  caption: z.string().max(2200, "Legendas do Instagram têm até 2.200 caracteres.").nullable().optional(),
  hashtags: z.string().max(1000).nullable().optional(),
  cta: z.string().max(200).nullable().optional(),
  mediaFileIds: z.array(z.string()).max(10, "Carrosséis têm até 10 mídias."),
  coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  objective: z.string().max(100).nullable().optional(),
  journeyStage: z.string().max(60).nullable().optional(),
  product: z.string().max(200).nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  isAd: z.boolean().default(false),
  adCta: z.string().max(40).nullable().optional(),
  highlightId: z.string().nullable().optional(),
  status: z.enum(PUB_FLOW),
  hypotheticalLikes: optInt,
  hypotheticalComments: optInt,
  hypotheticalViews: optInt,
  versionNote: z.string().max(300).optional(),
});
type HypoKeys = "hypotheticalLikes" | "hypotheticalComments" | "hypotheticalViews";
export type PubInput = Omit<z.input<typeof pubSchema>, HypoKeys> & Record<HypoKeys, number | null>;

export async function savePublicationAction(projectId: string, id: string | null, input: PubInput) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const { versionNote, ...d } = pubSchema.parse(input);
    const hashtagCount = (d.hashtags?.match(/#/g) ?? []).length;
    if (hashtagCount > 30) throw new UserError("O Instagram permite até 30 hashtags.");
    if (d.mediaFileIds.length && (await prisma.fileAsset.count({ where: { projectId, id: { in: d.mediaFileIds } } })) !== d.mediaFileIds.length)
      throw new UserError("Mídia inválida.");
    if (d.campaignId && !(await prisma.campaign.findFirst({ where: { id: d.campaignId, projectId } }))) throw new UserError("Campanha inválida.");
    if (d.highlightId && !(await prisma.highlight.findFirst({ where: { id: d.highlightId, projectId } }))) throw new UserError("Destaque inválido.");
    if (d.responsibleId && !(await projectMembers(projectId)).some((m) => m.id === d.responsibleId)) throw new UserError("Responsável inválido.");
    const prev = id ? await prisma.publication.findFirst({ where: { id, projectId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } }) : null;
    if (id && !prev) throw new UserError("Publicação não encontrada.");
    if ((d.status === "APPROVED" || d.status === "SCHEDULED") && prev?.status !== d.status && !can(ctx.role, "approve"))
      throw new UserError("Aprovação de peças é restrita a coordenadores/administradores. Use 'Solicitar aprovação'.");
    const data = { ...d, scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null, responsibleId: d.responsibleId || null, campaignId: d.campaignId || null, highlightId: d.type === "STORY" ? d.highlightId || null : null, location: d.location || null, adCta: d.isAd ? d.adCta || "Saiba mais" : null };
    const pub = prev
      ? await prisma.publication.update({ where: { id: prev.id }, data })
      : await prisma.publication.create({ data: { ...data, projectId, createdById: ctx.user.id, feedOrder: -Date.now() } });
    const contentChanged =
      !prev || prev.caption !== d.caption || prev.hashtags !== d.hashtags || prev.cta !== d.cta || prev.mediaFileIds.join() !== d.mediaFileIds.join();
    if (contentChanged) {
      await prisma.publicationVersion.create({
        data: {
          publicationId: pub.id,
          version: (prev?.versions[0]?.version ?? 0) + 1,
          caption: d.caption,
          hashtags: d.hashtags,
          cta: d.cta,
          mediaFileIds: d.mediaFileIds,
          note: versionNote || null,
          authorId: ctx.user.id,
        },
      });
    }
    if (prev && prev.status !== d.status) await notifyFlow(projectId, ctx.user.id, pub.title, pub.id, d.status);
    await audit({ projectId, userId: ctx.user.id, action: prev ? "update" : "create", entity: "publication", entityId: pub.id, data: prev && prev.status !== d.status ? { status: { de: prev.status, para: d.status } } : { title: d.title } });
    publish({ type: "publication", projectId });
    revalidatePath(`/p/${projectId}`, "layout");
    return { id: pub.id };
  });
}

async function notifyFlow(projectId: string, by: string, title: string, id: string, status: string) {
  const sector = FLOW_SECTOR[status];
  if (!sector) return;
  const targets = (await projectMembers(projectId)).filter((m) => m.sector === sector).map((m) => m.id);
  await notify(projectId, targets, { type: "review", title: `Peça para ${sector}`, body: title, link: `/p/${projectId}/editorial?p=${id}` }, by);
}

export async function setPublicationStatusAction(projectId: string, id: string, status: (typeof PUB_FLOW)[number]) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    z.enum(PUB_FLOW).parse(status);
    const prev = await prisma.publication.findFirst({ where: { id, projectId } });
    if (!prev) throw new UserError("Publicação não encontrada.");
    if ((status === "APPROVED" || status === "SCHEDULED") && !can(ctx.role, "approve")) throw new UserError("Aprovação restrita a coordenadores/administradores.");
    await prisma.publication.update({ where: { id }, data: { status } });
    await notifyFlow(projectId, ctx.user.id, prev.title, id, status);
    await audit({ projectId, userId: ctx.user.id, action: "status", entity: "publication", entityId: id, data: { de: prev.status, para: status } });
    publish({ type: "publication", projectId });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

export async function reorderFeedAction(projectId: string, ids: string[]) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const owned = await prisma.publication.count({ where: { projectId, id: { in: ids } } });
    if (owned !== ids.length) throw new UserError("Lista inválida.");
    await prisma.$transaction(ids.map((id, i) => prisma.publication.update({ where: { id }, data: { feedOrder: i } })));
    await audit({ projectId, userId: ctx.user.id, action: "reorder", entity: "feed" });
    publish({ type: "publication", projectId });
    revalidatePath(`/p/${projectId}/instagram`);
  });
}

export async function deletePublicationAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const p = await prisma.publication.findFirst({ where: { id, projectId } });
    if (!p) throw new UserError("Publicação não encontrada.");
    if (!canDelete(ctx.role, p.createdById === ctx.user.id)) throw new UserError("Apenas o autor ou coordenadores podem excluir.");
    await prisma.publication.delete({ where: { id } });
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: "publication", entityId: id, data: { title: p.title } });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

export async function getPublicationVersionsAction(projectId: string, id: string) {
  return run(async () => {
    await actionContext(projectId, "view");
    const versions = await prisma.publicationVersion.findMany({ where: { publicationId: id, publication: { projectId } }, orderBy: { version: "desc" } });
    return versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }));
  });
}

/* ---------------- Campanhas ---------------- */

const abSchema = z.object({
  id: z.string(),
  variable: z.enum(["CREATIVE", "AUDIENCE", "MESSAGE"]),
  hypothesis: z.string().max(500),
  metric: z.string().max(60),
  a: z.object({ label: z.string().max(100), ctr: z.number().gt(0).max(1), conversionRate: z.number().min(0).max(1) }),
  b: z.object({ label: z.string().max(100), ctr: z.number().gt(0).max(1), conversionRate: z.number().min(0).max(1) }),
  budget: z.number().min(0),
  cpm: z.number().gt(0),
  ticket: z.number().min(0),
});

const campaignSchema = z.object({
  name: z.string().trim().min(2).max(160),
  objective: z.enum(["AWARENESS", "ENGAGEMENT", "TRAFFIC", "LEADS", "CONVERSION", "REMARKETING"]),
  audience: z.string().max(2000).nullable().optional(),
  segmentation: z.string().max(2000).nullable().optional(),
  positioning: z.string().max(2000).nullable().optional(),
  message: z.string().max(2000).nullable().optional(),
  products: z.string().max(2000).nullable().optional(),
  channels: z.string().max(500).nullable().optional(),
  formats: z.string().max(500).nullable().optional(),
  budget: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().min(0).nullable()),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  kpis: z.string().max(1000).nullable().optional(),
  creatives: z.string().max(2000).nullable().optional(),
  responsibleIds: z.array(z.string()).max(20),
  status: z.enum(["PLANNING", "IN_REVIEW", "APPROVED", "RUNNING_SIM", "FINISHED"]),
  abTests: z.array(abSchema).max(20),
});
export type CampaignInput = z.input<typeof campaignSchema>;

export async function saveCampaignAction(projectId: string, id: string | null, input: CampaignInput) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const d = campaignSchema.parse(input);
    if (d.startDate && d.endDate && d.endDate < d.startDate) throw new UserError("A data final deve ser posterior à inicial.");
    const prev = id ? await prisma.campaign.findFirst({ where: { id, projectId } }) : null;
    if (id && !prev) throw new UserError("Campanha não encontrada.");
    if (d.status === "APPROVED" && prev?.status !== "APPROVED" && !can(ctx.role, "approve")) throw new UserError("Aprovação restrita a coordenadores/administradores.");
    const data = { ...d, startDate: d.startDate ? new Date(d.startDate) : null, endDate: d.endDate ? new Date(d.endDate) : null, abTests: d.abTests as Prisma.InputJsonValue };
    const c = prev ? await prisma.campaign.update({ where: { id: prev.id }, data }) : await prisma.campaign.create({ data: { ...data, projectId, createdById: ctx.user.id } });
    await audit({ projectId, userId: ctx.user.id, action: prev ? "update" : "create", entity: "campaign", entityId: c.id, data: { name: d.name, status: d.status } });
    revalidatePath(`/p/${projectId}/campanhas`);
    return { id: c.id };
  });
}

export async function deleteCampaignAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const c = await prisma.campaign.findFirst({ where: { id, projectId } });
    if (!c) throw new UserError("Campanha não encontrada.");
    if (!canDelete(ctx.role, c.createdById === ctx.user.id)) throw new UserError("Apenas o autor ou coordenadores podem excluir.");
    await prisma.publication.updateMany({ where: { projectId, campaignId: id }, data: { campaignId: null } });
    await prisma.campaign.delete({ where: { id } });
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: "campaign", entityId: id, data: { name: c.name } });
    revalidatePath(`/p/${projectId}/campanhas`);
  });
}

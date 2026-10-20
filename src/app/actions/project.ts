"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { requireUser, newToken, sha256 } from "@/lib/server/auth";
import { actionContext } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { run, UserError } from "@/lib/server/action";
import { bootstrapProject, DEFAULT_BRAND } from "@/lib/server/bootstrap";
import { appUrl, sendMail } from "@/lib/server/mailer";
import { canAssignRole, type RoleName } from "@/lib/permissions";

export async function createProjectAction(input: { agencyId: string; name: string; segment?: string; launchDate?: string }) {
  return run(async () => {
    const user = await requireUser();
    const m = await prisma.membership.findUnique({ where: { userId_agencyId: { userId: user.id, agencyId: input.agencyId } } });
    if (!m || !["ADMIN", "COORDINATOR"].includes(m.role)) throw new UserError("Apenas administradores e coordenadores criam projetos.");
    const name = z.string().trim().min(2, "Nome muito curto.").max(120).parse(input.name);
    const launch = input.launchDate && /^\d{4}-\d{2}-\d{2}$/.test(input.launchDate) ? input.launchDate : undefined;
    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          agencyId: input.agencyId,
          name,
          segment: input.segment?.trim() || null,
          launchDate: launch ? new Date(launch) : null,
          brand: { ...DEFAULT_BRAND, displayName: name } as Prisma.InputJsonValue,
        },
      });
      await bootstrapProject(tx, p.id, user.id, { launch });
      return p;
    });
    await audit({ projectId: project.id, userId: user.id, action: "create", entity: "project", entityId: project.id });
    revalidatePath("/projetos");
    return { id: project.id };
  });
}

const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  alternateName: z.string().trim().max(120).optional().nullable(),
  officialNameConfirmed: z.boolean(),
  segment: z.string().trim().max(300).optional().nullable(),
  launchDate: z.string().optional().nullable(),
  launchDateConfirmed: z.boolean(),
  briefing: z.record(z.string(), z.string().max(4000)),
});

export async function updateProjectAction(projectId: string, input: z.infer<typeof projectSchema>) {
  return run(async () => {
    const ctx = await actionContext(projectId, "manage");
    const d = projectSchema.parse(input);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        ...d,
        launchDate: d.launchDate ? new Date(d.launchDate) : null,
        briefing: d.briefing as Prisma.InputJsonValue,
      },
    });
    await audit({ projectId, userId: ctx.user.id, action: "update", entity: "project", entityId: projectId, data: { name: d.name, launchDate: d.launchDate } });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB).");
const brandSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  colors: z.object({ carvao: hex, taupe: hex, areia: hex, marfim: hex, destaque: hex }),
  roseOption: z.boolean(),
  roseColor: hex,
  fontSerif: z.enum(["Cormorant Garamond", "Playfair Display", "Libre Baskerville", "DM Serif Display"]),
  fontSans: z.enum(["Inter", "Manrope", "Work Sans", "Lato"]),
  logoFileId: z.string().nullable(),
});

export async function updateBrandAction(projectId: string, input: z.infer<typeof brandSchema>) {
  return run(async () => {
    const ctx = await actionContext(projectId, "manage");
    const d = brandSchema.parse(input);
    if (d.logoFileId) {
      const f = await prisma.fileAsset.findFirst({ where: { id: d.logoFileId, projectId, mime: { startsWith: "image/" } } });
      if (!f) throw new UserError("Logo deve ser uma imagem enviada a este projeto.");
    }
    await prisma.project.update({ where: { id: projectId }, data: { brand: d as Prisma.InputJsonValue } });
    await audit({ projectId, userId: ctx.user.id, action: "update", entity: "brand", entityId: projectId, data: d as Prisma.InputJsonValue });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

export async function updateAcademicAction(projectId: string, input: Record<string, string>) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const d = z.record(z.string(), z.string().max(2000)).parse(input);
    await prisma.project.update({ where: { id: projectId }, data: { academic: d as Prisma.InputJsonValue } });
    await audit({ projectId, userId: ctx.user.id, action: "update", entity: "academic", entityId: projectId });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

const roleEnum = z.enum(["ADMIN", "COORDINATOR", "MEMBER", "VIEWER"]);

export async function inviteAction(projectId: string, input: { email: string; name?: string; role: RoleName; sector?: string; responsibilities?: string }) {
  return run(async () => {
    const ctx = await actionContext(projectId, "invite");
    const email = z.string().trim().toLowerCase().email("E-mail inválido.").parse(input.email);
    const role = roleEnum.parse(input.role);
    if (!canAssignRole(ctx.role, role)) throw new UserError("Você não pode convidar com este papel.");
    const already = await prisma.membership.findFirst({ where: { agencyId: ctx.agencyId, user: { email } } });
    if (already) throw new UserError("Esta pessoa já faz parte da equipe.");
    const token = newToken();
    const inv = await prisma.invite.create({
      data: {
        agencyId: ctx.agencyId,
        email,
        name: input.name?.trim() || null,
        role,
        sector: input.sector?.trim() || null,
        responsibilities: input.responsibilities?.trim() || null,
        tokenHash: sha256(token),
        invitedById: ctx.user.id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    const link = `${appUrl()}/convite/${token}`;
    const { sent } = await sendMail(email, "Convite — Awake Campaign Lab", `${ctx.user.name} convidou você para colaborar.\nAceite em até 7 dias: ${link}`);
    await audit({ projectId, userId: ctx.user.id, action: "invite", entity: "invite", entityId: inv.id, data: { email, role } });
    revalidatePath(`/p/${projectId}/configuracoes`);
    return { link, sent };
  });
}

export async function revokeInviteAction(projectId: string, inviteId: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "invite");
    await prisma.invite.deleteMany({ where: { id: inviteId, agencyId: ctx.agencyId, acceptedAt: null } });
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: "invite", entityId: inviteId });
    revalidatePath(`/p/${projectId}/configuracoes`);
  });
}

export async function updateMemberAction(projectId: string, userId: string, input: { role: RoleName; sector?: string; responsibilities?: string }) {
  return run(async () => {
    const ctx = await actionContext(projectId, "manage");
    const role = roleEnum.parse(input.role);
    const m = await prisma.membership.findUnique({ where: { userId_agencyId: { userId, agencyId: ctx.agencyId } } });
    if (!m) throw new UserError("Integrante não encontrado.");
    if (m.role === "ADMIN" && role !== "ADMIN") {
      const admins = await prisma.membership.count({ where: { agencyId: ctx.agencyId, role: "ADMIN" } });
      if (admins <= 1) throw new UserError("É necessário manter ao menos um administrador.");
    }
    await prisma.membership.update({
      where: { id: m.id },
      data: { role, sector: input.sector?.trim() || null, responsibilities: input.responsibilities?.trim() || null },
    });
    await audit({ projectId, userId: ctx.user.id, action: "update", entity: "membership", entityId: m.id, data: { role } });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

export async function removeMemberAction(projectId: string, userId: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "manage");
    if (userId === ctx.user.id) throw new UserError("Você não pode remover a si mesmo.");
    const m = await prisma.membership.findUnique({ where: { userId_agencyId: { userId, agencyId: ctx.agencyId } } });
    if (!m) throw new UserError("Integrante não encontrado.");
    if (m.role === "ADMIN" && (await prisma.membership.count({ where: { agencyId: ctx.agencyId, role: "ADMIN" } })) <= 1)
      throw new UserError("É necessário manter ao menos um administrador.");
    await prisma.membership.delete({ where: { id: m.id } });
    await prisma.session.deleteMany({ where: { userId } });
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: "membership", entityId: m.id });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

export async function markNotificationsReadAction(projectId: string, ids?: string[]) {
  return run(async () => {
    const ctx = await actionContext(projectId, "view");
    await prisma.notification.updateMany({
      where: { userId: ctx.user.id, projectId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
  });
}

export async function deleteProjectAction(projectId: string, confirmName: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "manage");
    if (confirmName.trim() !== ctx.projectName) throw new UserError("Digite o nome exato do projeto para confirmar.");
    await prisma.project.delete({ where: { id: projectId } });
    await audit({ userId: ctx.user.id, action: "delete", entity: "project", entityId: projectId, data: { name: ctx.projectName } });
    revalidatePath("/projetos");
  });
}

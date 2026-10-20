import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "./db";
import { getCurrentUser, type CurrentUser } from "./auth";
import { can, type Action, type RoleName } from "../permissions";

export class AccessError extends Error {}

export interface ProjectContext {
  user: CurrentUser;
  role: RoleName;
  projectId: string;
  agencyId: string;
  projectName: string;
}

/** Carrega o contexto (usuário + papel na agência do projeto). Isolamento de dados. */
export const loadProjectContext = cache(async (projectId: string): Promise<ProjectContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, agencyId: true, name: true } });
  if (!project) return null;
  const m = await prisma.membership.findUnique({
    where: { userId_agencyId: { userId: user.id, agencyId: project.agencyId } },
  });
  if (!m) return null;
  return { user, role: m.role as RoleName, projectId: project.id, agencyId: project.agencyId, projectName: project.name };
});

/** Para páginas: redireciona/404 se sem acesso. */
export async function pageContext(projectId: string, action: Action = "view"): Promise<ProjectContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await loadProjectContext(projectId);
  if (!ctx || !can(ctx.role, action)) notFound();
  return ctx;
}

/** Para server actions e rotas: lança AccessError. */
export async function actionContext(projectId: string, action: Action): Promise<ProjectContext> {
  if (typeof projectId !== "string" || !projectId) throw new AccessError("Projeto inválido.");
  const ctx = await loadProjectContext(projectId);
  if (!ctx) throw new AccessError("Sessão expirada ou sem acesso a este projeto.");
  if (!can(ctx.role, action)) throw new AccessError("Seu papel não permite esta ação.");
  return ctx;
}

export async function projectMembers(projectId: string) {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { agencyId: true } });
  if (!p) return [];
  const ms = await prisma.membership.findMany({
    where: { agencyId: p.agencyId },
    include: { user: { select: { id: true, name: true, nickname: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return ms.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    nickname: m.user.nickname,
    email: m.user.email,
    role: m.role as RoleName,
    sector: m.sector,
    responsibilities: m.responsibilities,
  }));
}
export type Member = Awaited<ReturnType<typeof projectMembers>>[number];

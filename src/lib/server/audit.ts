import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function audit(e: {
  projectId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  data?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({ data: { ...e, projectId: e.projectId ?? null } });
  } catch (err) {
    console.error("[audit] falha ao registrar", err);
  }
}

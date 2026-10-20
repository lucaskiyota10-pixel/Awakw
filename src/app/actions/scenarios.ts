"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { actionContext } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { run, UserError } from "@/lib/server/action";
import { canDelete } from "@/lib/permissions";
import { validateSources, type SourceMap } from "@/lib/sim/origin";
import { simulateMetrics, type MetricsInput } from "@/lib/sim/metrics";
import { simulateGrowth, type GrowthPremises } from "@/lib/sim/growth";

const levelEnum = z.enum(["CONSERVATIVE", "MODERATE", "OPTIMISTIC", "CUSTOM"]);
const kindEnum = z.enum(["METRICS", "GROWTH"]);

export async function saveScenarioAction(
  projectId: string,
  id: string | null,
  input: { kind: "METRICS" | "GROWTH"; name: string; level: string; values: unknown; sources: SourceMap },
) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const kind = kindEnum.parse(input.kind);
    const level = levelEnum.parse(input.level);
    const name = z.string().trim().min(2, "Dê um nome ao cenário.").max(120).parse(input.name);
    const srcErrors = validateSources(input.sources ?? {});
    if (srcErrors.length) throw new UserError(srcErrors.join(" "));
    // valida premissas executando o motor de cálculo no servidor
    const result = kind === "METRICS" ? simulateMetrics(input.values as MetricsInput) : simulateGrowth(input.values as GrowthPremises);
    if (!result.ok) throw new UserError(`Premissas inválidas: ${result.errors.join(" ")}`);
    const premises = JSON.parse(JSON.stringify({ values: input.values, sources: input.sources })) as Prisma.InputJsonValue;
    let s;
    if (id) {
      const prev = await prisma.scenario.findFirst({ where: { id, projectId } });
      if (!prev) throw new UserError("Cenário não encontrado.");
      if (prev.status === "APPROVED") throw new UserError("Cenário aprovado não pode ser alterado. Duplique-o para criar uma nova versão.");
      s = await prisma.scenario.update({ where: { id }, data: { name, level, premises, status: "DRAFT" } });
    } else {
      s = await prisma.scenario.create({ data: { projectId, kind, level, name, premises, authorId: ctx.user.id } });
    }
    await audit({ projectId, userId: ctx.user.id, action: id ? "update" : "create", entity: "scenario", entityId: s.id, data: { name, kind, level } });
    revalidatePath(`/p/${projectId}`, "layout");
    return { id: s.id };
  });
}

export async function duplicateScenarioAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const prev = await prisma.scenario.findFirst({ where: { id, projectId } });
    if (!prev) throw new UserError("Cenário não encontrado.");
    const s = await prisma.scenario.create({
      data: { projectId, kind: prev.kind, level: prev.level, name: `${prev.name} (cópia)`, premises: prev.premises as Prisma.InputJsonValue, authorId: ctx.user.id, duplicatedFromId: prev.id },
    });
    await audit({ projectId, userId: ctx.user.id, action: "duplicate", entity: "scenario", entityId: s.id, data: { from: prev.id } });
    revalidatePath(`/p/${projectId}`, "layout");
    return { id: s.id };
  });
}

export async function deleteScenarioAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const prev = await prisma.scenario.findFirst({ where: { id, projectId } });
    if (!prev) throw new UserError("Cenário não encontrado.");
    if (!canDelete(ctx.role, prev.authorId === ctx.user.id)) throw new UserError("Apenas o autor ou coordenadores podem excluir.");
    await prisma.scenario.delete({ where: { id } });
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: "scenario", entityId: id, data: { name: prev.name } });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

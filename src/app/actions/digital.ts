"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/db";
import { actionContext } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { run, UserError } from "@/lib/server/action";
import { buildUtmUrl, type UtmParams } from "@/lib/utm";
import { canDelete } from "@/lib/permissions";

export async function saveUtmAction(projectId: string, input: UtmParams) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const r = buildUtmUrl(input);
    if (!r.ok) throw new UserError(r.error);
    const u = new URL(r.url);
    const rec = await prisma.utmLink.create({
      data: {
        projectId,
        baseUrl: input.baseUrl.trim(),
        source: u.searchParams.get("utm_source")!,
        medium: u.searchParams.get("utm_medium")!,
        campaign: u.searchParams.get("utm_campaign")!,
        content: u.searchParams.get("utm_content"),
        term: u.searchParams.get("utm_term"),
        url: r.url,
        authorId: ctx.user.id,
      },
    });
    await audit({ projectId, userId: ctx.user.id, action: "create", entity: "utm", entityId: rec.id, data: { url: r.url } });
    revalidatePath(`/p/${projectId}/digital`);
    return { id: rec.id, url: r.url };
  });
}

export async function deleteUtmAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const u = await prisma.utmLink.findFirst({ where: { id, projectId } });
    if (!u) throw new UserError("Link não encontrado.");
    if (!canDelete(ctx.role, u.authorId === ctx.user.id)) throw new UserError("Apenas o autor ou coordenadores podem excluir.");
    await prisma.utmLink.delete({ where: { id } });
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: "utm", entityId: id });
    revalidatePath(`/p/${projectId}/digital`);
  });
}

/** Transforma um item SWOT ou observação de concorrente em tarefa. */
export async function toTaskAction(projectId: string, kind: "swot" | "competitor", id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    let title: string;
    let description: string;
    if (kind === "swot") {
      const s = await prisma.swotItem.findFirst({ where: { id, projectId } });
      if (!s) throw new UserError("Item não encontrado.");
      if (s.taskId && (await prisma.task.findFirst({ where: { id: s.taskId, projectId } }))) throw new UserError("Este item já gerou uma tarefa.");
      const q = { S: "Explorar força", W: "Mitigar fraqueza", O: "Aproveitar oportunidade", T: "Responder à ameaça" }[s.quadrant] ?? "Ação";
      title = `${q}: ${s.text}`.slice(0, 200);
      description = `Origem: SWOT (${s.basis === "EVIDENCE" ? "evidência" : "hipótese"}).\n${s.evidence ? `Evidência: ${s.evidence}\n` : ""}${s.source ? `Fonte: ${s.source}` : ""}`;
    } else {
      const c = await prisma.competitor.findFirst({ where: { id, projectId } });
      if (!c) throw new UserError("Concorrente não encontrado.");
      title = `Analisar concorrente: ${c.name}`.slice(0, 200);
      description = `Posicionamento: ${c.positioning ?? "—"}\nPreços observados: ${c.observedPrices ?? "—"}\nFontes: ${c.sources ?? "—"}`;
    }
    const task = await prisma.task.create({ data: { projectId, title, description, sector: "Planejamento", createdById: ctx.user.id, order: Date.now(), checklist: [] } });
    if (kind === "swot") await prisma.swotItem.update({ where: { id }, data: { taskId: task.id } });
    await audit({ projectId, userId: ctx.user.id, action: "create", entity: "task", entityId: task.id, data: { from: kind, id } });
    revalidatePath(`/p/${projectId}`, "layout");
    return { id: task.id };
  });
}

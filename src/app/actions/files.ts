"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/db";
import { actionContext } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { run, UserError } from "@/lib/server/action";
import { deleteStored } from "@/lib/server/files";
import { canDelete } from "@/lib/permissions";

export async function deleteFileAction(projectId: string, id: string) {
  return run(async () => {
    const ctx = await actionContext(projectId, "edit");
    const f = await prisma.fileAsset.findFirst({ where: { id, projectId } });
    if (!f) throw new UserError("Arquivo não encontrado.");
    if (!canDelete(ctx.role, f.uploaderId === ctx.user.id)) throw new UserError("Apenas quem enviou ou coordenadores podem excluir.");
    await prisma.fileAsset.delete({ where: { id } });
    await deleteStored(f.storageKey);
    await audit({ projectId, userId: ctx.user.id, action: "delete", entity: "file", entityId: id, data: { name: f.name } });
    revalidatePath(`/p/${projectId}`, "layout");
  });
}

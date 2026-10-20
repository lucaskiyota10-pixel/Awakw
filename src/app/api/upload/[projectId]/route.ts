import path from "node:path";
import { prisma } from "@/lib/server/db";
import { loadProjectContext } from "@/lib/server/access";
import { can } from "@/lib/permissions";
import { safeFileName, storeFile, validateUpload } from "@/lib/server/files";
import { audit } from "@/lib/server/audit";

/** Upload protegido (multipart). Verifica origem, permissão, tipo, extensão, tamanho e assinatura. */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return Response.json({ error: "Origem inválida." }, { status: 403 });
  const ctx = await loadProjectContext(projectId);
  if (!ctx || !can(ctx.role, "edit")) return Response.json({ error: "Sem permissão para enviar arquivos." }, { status: 403 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }
  const folder = String(form.get("folder") ?? "geral").slice(0, 60);
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "Nenhum arquivo." }, { status: 400 });
  const out = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const name = safeFileName(f.name);
    const err = validateUpload(name, f.type, buf);
    if (err) return Response.json({ error: `${f.name}: ${err}` }, { status: 400 });
    const stored = await storeFile(projectId, buf, path.extname(name).toLowerCase());
    const rec = await prisma.fileAsset.create({
      data: { projectId, uploaderId: ctx.user.id, name, mime: f.type, size: buf.length, storageKey: stored.key, data: stored.data, folder },
    });
    await audit({ projectId, userId: ctx.user.id, action: "upload", entity: "file", entityId: rec.id, data: { name, size: buf.length } });
    out.push({ id: rec.id, name: rec.name, mime: rec.mime, size: rec.size });
  }
  return Response.json({ files: out });
}

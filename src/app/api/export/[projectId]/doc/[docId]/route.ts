import { prisma } from "@/lib/server/db";
import { loadProjectContext } from "@/lib/server/access";
import { docMeta, resolveAssets } from "@/lib/server/export";
import { renderDocx } from "@/lib/docs/docx";
import { renderPdf } from "@/lib/docs/pdf";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

/** Exporta um documento em DOCX ou PDF (versão atual ou versão aprovada). */
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string; docId: string }> }) {
  const { projectId, docId } = await params;
  const ctx = await loadProjectContext(projectId);
  if (!ctx) return new Response("Não autorizado", { status: 401 });
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "docx";
  const approvedOnly = url.searchParams.get("versao") === "aprovada";
  const doc = await prisma.document.findFirst({ where: { id: docId, projectId } });
  if (!doc) return new Response("Documento não encontrado", { status: 404 });
  let content = doc.content;
  let label = `Versão ${doc.version} — ${doc.status === "APPROVED" ? "aprovada" : "rascunho"}`;
  if (approvedOnly) {
    if (!doc.approvedVersion) return new Response("Este documento ainda não possui versão aprovada.", { status: 409 });
    const v = await prisma.documentVersion.findFirst({ where: { documentId: docId, version: { lte: doc.approvedVersion } }, orderBy: { version: "desc" } });
    if (!v) return new Response("Versão aprovada não encontrada.", { status: 404 });
    content = v.content;
    label = `Versão aprovada ${doc.approvedVersion}${doc.approvedAt ? ` em ${doc.approvedAt.toLocaleDateString("pt-BR")}` : ""}`;
  }
  try {
    const meta = await docMeta(projectId, doc.title, label, url.searchParams.get("nome") ?? undefined);
    const assets = await resolveAssets(projectId, content);
    const buf = format === "pdf" ? await renderPdf(content, meta, assets) : await renderDocx(content, meta, assets);
    await audit({ projectId, userId: ctx.user.id, action: "export", entity: "document", entityId: docId, data: { format, approvedOnly } });
    const fname = `${doc.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "documento"}.${format}`;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[export]", e);
    return new Response("Falha ao gerar o arquivo.", { status: 500 });
  }
}

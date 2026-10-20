import { prisma } from "@/lib/server/db";
import { loadProjectContext } from "@/lib/server/access";
import { readStored } from "@/lib/server/files";

/** Download protegido: só membros da agência do projeto do arquivo. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.fileAsset.findUnique({ where: { id }, omit: { data: false } });
  if (!file) return new Response("Não encontrado", { status: 404 });
  const ctx = await loadProjectContext(file.projectId);
  if (!ctx) return new Response("Não encontrado", { status: 404 });
  let buf: Buffer;
  try {
    buf = await readStored(file);
  } catch {
    return new Response("Arquivo indisponível", { status: 410 });
  }
  const inline = file.mime.startsWith("image/") || file.mime === "video/mp4" || file.mime === "application/pdf";
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${inline && !download ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
    },
  });
}

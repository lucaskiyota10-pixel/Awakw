import { loadProjectContext } from "@/lib/server/access";
import { presentationData } from "@/lib/server/presentation";
import { renderPptx, renderSlidesPdf } from "@/lib/docs/slides";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await loadProjectContext(projectId);
  if (!ctx) return new Response("Não autorizado", { status: 401 });
  const format = new URL(req.url).searchParams.get("format") === "pptx" ? "pptx" : "pdf";
  try {
    const data = await presentationData(projectId);
    const buf = format === "pptx" ? await renderPptx(data) : await renderSlidesPdf(data);
    await audit({ projectId, userId: ctx.user.id, action: "export", entity: "presentation", data: { format } });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": format === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "application/pdf",
        "Content-Disposition": `attachment; filename="apresentacao.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[export presentation]", e);
    return new Response("Falha ao gerar a apresentação.", { status: 500 });
  }
}

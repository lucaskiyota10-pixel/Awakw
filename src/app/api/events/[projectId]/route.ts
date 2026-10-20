import { loadProjectContext } from "@/lib/server/access";
import { subscribe } from "@/lib/server/realtime";

export const dynamic = "force-dynamic";

/** Server-Sent Events: transmite eventos do projeto para membros autenticados. */
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await loadProjectContext(projectId);
  if (!ctx) return new Response("Não autorizado", { status: 401 });
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send({ type: "hello" });
      const unsub = subscribe(projectId, (e) => {
        // notificações pessoais só vão para o destinatário
        if (e.type === "notification" && e.userId !== ctx.user.id) return;
        send(e);
      });
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 25000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

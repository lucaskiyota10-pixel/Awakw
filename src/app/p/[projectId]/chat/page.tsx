import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { ChatView } from "./ChatView";

export default async function ChatPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ c?: string; q?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const ctx = await pageContext(projectId);
  const channels = (await prisma.channel.findMany({ where: { projectId }, orderBy: [{ type: "asc" }, { name: "asc" }] })).filter(
    (c) => c.type === "GENERAL" || c.type === "SECTOR" || c.memberIds.includes(ctx.user.id),
  );
  const active = channels.find((c) => c.id === sp.c) ?? channels[0];
  const q = sp.q?.trim();
  const [messages, results, tasks, docs, decisions] = await Promise.all([
    active ? prisma.message.findMany({ where: { channelId: active.id }, orderBy: { createdAt: "desc" }, take: 200 }) : [],
    q
      ? prisma.message.findMany({ where: { channelId: { in: channels.map((c) => c.id) }, body: { contains: q, mode: "insensitive" } }, orderBy: { createdAt: "desc" }, take: 50 })
      : [],
    prisma.task.findMany({ where: { projectId }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
    prisma.document.findMany({ where: { projectId }, select: { id: true, title: true } }),
    prisma.decision.findMany({ where: { projectId }, select: { id: true, title: true } }),
  ]);
  const fileIds = [...new Set(messages.flatMap((m) => m.fileIds))];
  const files = fileIds.length ? await prisma.fileAsset.findMany({ where: { id: { in: fileIds }, projectId }, select: { id: true, name: true, mime: true } }) : [];
  return (
    <ChatView
      channels={channels.map((c) => ({ id: c.id, name: c.name, type: c.type, memberIds: c.memberIds }))}
      activeId={active?.id ?? null}
      messages={messages.reverse().map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), editedAt: null }))}
      files={files}
      query={q ?? ""}
      results={results.map((m) => ({ id: m.id, channelId: m.channelId, authorId: m.authorId, body: m.body, createdAt: m.createdAt.toISOString() }))}
      links={{ task: tasks, document: docs, decision: decisions }}
    />
  );
}

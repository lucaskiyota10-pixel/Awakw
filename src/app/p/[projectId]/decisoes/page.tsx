import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { Decisions } from "./Decisions";

export default async function DecisionsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ d?: string }> }) {
  const { projectId } = await params;
  const { d } = await searchParams;
  await pageContext(projectId);
  const list = await prisma.decision.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  return (
    <Decisions
      openId={d ?? null}
      decisions={list.map((x) => ({
        ...x,
        dueDate: x.dueDate?.toISOString().slice(0, 10) ?? null,
        decidedAt: x.decidedAt?.toISOString() ?? null,
        createdAt: x.createdAt.toISOString(),
        updatedAt: x.updatedAt.toISOString(),
      }))}
    />
  );
}

import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { Approvals } from "./Approvals";

export default async function ApprovalsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await pageContext(projectId);
  const list = await prisma.approval.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 200 });
  return <Approvals items={list.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), decidedAt: a.decidedAt?.toISOString() ?? null }))} />;
}

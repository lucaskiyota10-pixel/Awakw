import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { MetricsSim } from "./MetricsSim";

export default async function MetricsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ s?: string }> }) {
  const { projectId } = await params;
  const { s } = await searchParams;
  await pageContext(projectId);
  const list = await prisma.scenario.findMany({ where: { projectId, kind: "METRICS" }, orderBy: { createdAt: "asc" } });
  return (
    <MetricsSim
      key={s ?? "none"}
      initialId={s ?? list.find((x) => x.level === "MODERATE")?.id ?? list[0]?.id ?? null}
      scenarios={list.map((x) => ({ id: x.id, name: x.name, level: x.level, status: x.status, authorId: x.authorId, approvedById: x.approvedById, createdAt: x.createdAt.toISOString(), updatedAt: x.updatedAt.toISOString(), premises: x.premises }))}
    />
  );
}

import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { loadCreative } from "@/lib/server/creative-data";
import { GrowthSim } from "./GrowthSim";

export default async function GrowthPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ s?: string; tab?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  await pageContext(projectId);
  const [list, milestones, creative] = await Promise.all([
    prisma.scenario.findMany({ where: { projectId, kind: "GROWTH" }, orderBy: { createdAt: "asc" } }),
    prisma.milestone.findMany({ where: { projectId }, orderBy: { date: "asc" } }),
    loadCreative(projectId),
  ]);
  const approved = list.find((x) => x.status === "APPROVED");
  return (
    <GrowthSim
      key={sp.s ?? "none"}
      initialTab={sp.tab === "timeline" ? "timeline" : "results"}
      initialId={sp.s ?? approved?.id ?? list.find((x) => x.level === "MODERATE")?.id ?? list[0]?.id ?? null}
      scenarios={list.map((x) => ({ id: x.id, name: x.name, level: x.level, status: x.status, authorId: x.authorId, approvedById: x.approvedById, createdAt: x.createdAt.toISOString(), updatedAt: x.updatedAt.toISOString(), premises: x.premises }))}
      milestones={milestones.map((m) => ({ id: m.id, title: m.title, date: m.date.toISOString().slice(0, 10), kind: m.kind, description: m.description }))}
      creative={creative}
    />
  );
}

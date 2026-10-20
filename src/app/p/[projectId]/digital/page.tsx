import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { referenceGrowthScenario } from "@/lib/server/scenarios";
import { aggregate } from "@/lib/sim/aggregate";
import { Digital } from "./Digital";

export default async function DigitalPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await pageContext(projectId);
  const [diagnostics, measurement, pixel, utms, checklist, reports, entries, ref] = await Promise.all([
    prisma.diagnosticItem.findMany({ where: { projectId }, orderBy: [{ area: "asc" }] }),
    prisma.measurementItem.findMany({ where: { projectId } }),
    prisma.pixelEvent.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.utmLink.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.checklistItem.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.weeklyReport.findMany({ where: { projectId }, orderBy: { weekStart: "desc" } }),
    prisma.metricEntry.findMany({ where: { projectId }, orderBy: { date: "asc" } }),
    referenceGrowthScenario(projectId),
  ]);
  const weekly = ref?.result.ok
    ? aggregate(ref.result.days, ref.values.startDate, ref.result.endDate, "WEEK").map((r) => ({ label: r.label, start: r.start, end: r.end, budget: r.budget, impressions: r.impressions, clicks: r.clicks, siteVisits: r.siteVisits, purchases: r.purchases, revenue: r.revenue }))
    : [];
  const ser = <T extends Record<string, unknown>>(rows: T[]) => JSON.parse(JSON.stringify(rows)) as (Record<string, unknown> & { id: string })[];
  return (
    <Digital
      diagnostics={ser(diagnostics)}
      measurement={ser(measurement)}
      pixel={ser(pixel)}
      utms={utms.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      checklist={checklist.map((c) => ({ id: c.id, list: c.list, text: c.text, done: c.done, doneById: c.doneById, doneAt: c.doneAt?.toISOString() ?? null }))}
      reports={ser(reports)}
      entries={ser(entries)}
      projection={{ name: ref ? `${ref.scenario.name}${ref.scenario.status === "APPROVED" ? " (aprovado)" : " (não aprovado)"}` : null, weekly }}
    />
  );
}

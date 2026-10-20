import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { Campaigns, type CampaignLite } from "./Campaigns";

export default async function CampaignsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ c?: string }> }) {
  const { projectId } = await params;
  const { c } = await searchParams;
  await pageContext(projectId);
  const [list, pubCounts] = await Promise.all([
    prisma.campaign.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.publication.groupBy({ by: ["campaignId"], where: { projectId }, _count: true }),
  ]);
  const camps: CampaignLite[] = list.map((x) => ({
    ...x,
    startDate: x.startDate?.toISOString().slice(0, 10) ?? "",
    endDate: x.endDate?.toISOString().slice(0, 10) ?? "",
    abTests: ((x.abTests ?? []) as unknown as Partial<CampaignLite["abTests"][number]>[]).map((t) => ({ budget: 1000, cpm: 25, ticket: 350, metric: "CTR", ...t }) as CampaignLite["abTests"][number]),
    createdAt: x.createdAt.toISOString(),
    updatedAt: x.updatedAt.toISOString(),
    pubCount: pubCounts.find((p) => p.campaignId === x.id)?._count ?? 0,
  }));
  return <Campaigns campaigns={camps} openId={c ?? null} />;
}

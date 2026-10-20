import "server-only";
import { prisma } from "./db";
import { referenceGrowthScenario } from "./scenarios";
import { aggregate } from "../sim/aggregate";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "@/components/instagram/types";

export async function loadCreative(projectId: string) {
  const [profile, highlights, pubs, files, campaigns] = await Promise.all([
    prisma.instagramProfile.findUnique({ where: { projectId } }),
    prisma.highlight.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.publication.findMany({ where: { projectId }, orderBy: { feedOrder: "asc" } }),
    prisma.fileAsset.findMany({ where: { projectId, OR: [{ mime: { startsWith: "image/" } }, { mime: "video/mp4" }] }, select: { id: true, name: true, mime: true }, orderBy: { createdAt: "desc" } }),
    prisma.campaign.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);
  const p = profile ?? { displayName: "Nova marca", username: "nova.marca", category: null, bio: null, link: null, avatarFileId: null, avatarFit: "cover", followersMode: "manual", followersMonths: 1, hypotheticalFollowers: 0, hypotheticalFollowing: 0 };
  // seguidores hipotéticos do cenário de referência nos marcos (0 = lançamento)
  const ref = await referenceGrowthScenario(projectId);
  const followersByMonth: Record<number, number> = { 0: ref?.values.initialFollowers ?? 0 };
  if (ref?.result.ok) {
    const months = aggregate(ref.result.days, ref.values.startDate, ref.result.endDate, "MONTH");
    for (const m of [1, 3, 6, 12]) followersByMonth[m] = Math.round(months[Math.min(m, months.length) - 1]?.followers ?? 0);
  }
  return {
    profile: {
      displayName: p.displayName,
      username: p.username,
      category: p.category,
      bio: p.bio,
      link: p.link,
      avatarFileId: p.avatarFileId,
      avatarFit: p.avatarFit === "contain" ? "contain" : "cover",
      followersMode: p.followersMode === "scenario" ? "scenario" : "manual",
      followersMonths: p.followersMonths,
      hypotheticalFollowers: p.hypotheticalFollowers,
      hypotheticalFollowing: p.hypotheticalFollowing,
    } as IgProfile,
    highlights: highlights.map((h) => ({ id: h.id, title: h.title, coverFileId: h.coverFileId, coverColor: h.coverColor, order: h.order })) as IgHighlight[],
    pubs: pubs.map((x) => ({
      id: x.id,
      type: x.type,
      title: x.title,
      caption: x.caption,
      hashtags: x.hashtags,
      cta: x.cta,
      mediaFileIds: x.mediaFileIds,
      coverColor: x.coverColor,
      scheduledAt: x.scheduledAt?.toISOString() ?? null,
      objective: x.objective,
      journeyStage: x.journeyStage,
      product: x.product,
      responsibleId: x.responsibleId,
      campaignId: x.campaignId,
      location: x.location,
      isAd: x.isAd,
      adCta: x.adCta,
      highlightId: x.highlightId,
      status: x.status,
      feedOrder: x.feedOrder,
      hypotheticalLikes: x.hypotheticalLikes,
      hypotheticalComments: x.hypotheticalComments,
      hypotheticalViews: x.hypotheticalViews,
      createdById: x.createdById,
    })) as IgPub[],
    files: files as MediaFile[],
    campaigns,
    followersByMonth,
  };
}

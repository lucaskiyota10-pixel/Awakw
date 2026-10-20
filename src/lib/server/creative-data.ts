import "server-only";
import { prisma } from "./db";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "@/components/instagram/types";

export async function loadCreative(projectId: string) {
  const [profile, highlights, pubs, files, campaigns] = await Promise.all([
    prisma.instagramProfile.findUnique({ where: { projectId } }),
    prisma.highlight.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.publication.findMany({ where: { projectId }, orderBy: { feedOrder: "asc" } }),
    prisma.fileAsset.findMany({ where: { projectId, OR: [{ mime: { startsWith: "image/" } }, { mime: "video/mp4" }] }, select: { id: true, name: true, mime: true }, orderBy: { createdAt: "desc" } }),
    prisma.campaign.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);
  const p: IgProfile = profile ?? { displayName: "Perfil fictício", username: "perfil.ficticio", category: null, bio: null, link: null, avatarFileId: null, hypotheticalFollowers: 0, hypotheticalFollowing: 0 };
  return {
    profile: {
      displayName: p.displayName,
      username: p.username,
      category: p.category,
      bio: p.bio,
      link: p.link,
      avatarFileId: p.avatarFileId,
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
      status: x.status,
      feedOrder: x.feedOrder,
      hypotheticalLikes: x.hypotheticalLikes,
      hypotheticalComments: x.hypotheticalComments,
      hypotheticalViews: x.hypotheticalViews,
      createdById: x.createdById,
    })) as IgPub[],
    files: files as MediaFile[],
    campaigns,
  };
}

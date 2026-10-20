export interface IgProfile {
  displayName: string;
  username: string;
  category: string | null;
  bio: string | null;
  link: string | null;
  avatarFileId: string | null;
  avatarFit: "cover" | "contain";
  followersMode: "manual" | "scenario";
  followersMonths: number;
  hypotheticalFollowers: number;
  hypotheticalFollowing: number;
}
export interface IgHighlight {
  id: string;
  title: string;
  coverFileId: string | null;
  coverColor: string | null;
  order: number;
}
export interface IgPub {
  id: string;
  type: "FEED" | "CAROUSEL" | "REEL" | "STORY";
  title: string;
  caption: string | null;
  hashtags: string | null;
  cta: string | null;
  mediaFileIds: string[];
  coverColor: string | null;
  scheduledAt: string | null;
  objective: string | null;
  journeyStage: string | null;
  product: string | null;
  responsibleId: string | null;
  campaignId: string | null;
  location: string | null;
  isAd: boolean;
  adCta: string | null;
  highlightId: string | null;
  status: string;
  feedOrder: number;
  hypotheticalLikes: number | null;
  hypotheticalComments: number | null;
  hypotheticalViews: number | null;
  createdById: string;
}
export interface MediaFile {
  id: string;
  name: string;
  mime: string;
}

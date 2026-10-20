import { prisma } from "@/lib/server/db";
import { pageContext, projectMembers } from "@/lib/server/access";
import { brandOf } from "@/lib/brand";
import { Settings } from "./Settings";

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await pageContext(projectId);
  const [project, members, invites, images] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    projectMembers(projectId),
    prisma.invite.findMany({ where: { agencyId: ctx.agencyId, acceptedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.fileAsset.findMany({ where: { projectId, mime: { startsWith: "image/" } }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <Settings
      project={{
        name: project.name,
        alternateName: project.alternateName,
        officialNameConfirmed: project.officialNameConfirmed,
        segment: project.segment,
        launchDate: project.launchDate?.toISOString().slice(0, 10) ?? "",
        launchDateConfirmed: project.launchDateConfirmed,
        briefing: (project.briefing ?? {}) as Record<string, string>,
        academic: (project.academic ?? {}) as Record<string, string>,
      }}
      brand={brandOf(project.brand)}
      members={members}
      invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, sector: i.sector, expiresAt: i.expiresAt.toISOString() }))}
      images={images}
    />
  );
}

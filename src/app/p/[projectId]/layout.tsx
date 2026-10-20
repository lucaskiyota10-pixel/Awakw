import { prisma } from "@/lib/server/db";
import { pageContext, projectMembers } from "@/lib/server/access";
import { brandOf, brandStyle, fontHref } from "@/lib/brand";
import { ProjectProvider } from "@/components/project-context";
import { Shell } from "@/components/Shell";
import { ToastProvider } from "@/components/ui";
import { ensureDeadlineAlerts } from "@/lib/server/alerts";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await pageContext(projectId);
  await ensureDeadlineAlerts(projectId, ctx.user.id);
  const [project, members, notifications] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { brand: true, name: true } }),
    projectMembers(projectId),
    prisma.notification.findMany({ where: { userId: ctx.user.id, projectId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const brand = brandOf(project.brand);
  return (
    <div style={brandStyle(brand) as React.CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={fontHref(brand)} />
      <ToastProvider>
        <ProjectProvider
          value={{
            projectId,
            projectName: project.name,
            userId: ctx.user.id,
            userName: ctx.user.name,
            role: ctx.role,
            members: members.map(({ email: _e, ...m }) => m),
          }}
        >
          <Shell
            brandName={brand.displayName || project.name}
            logoUrl={brand.logoFileId ? `/api/files/${brand.logoFileId}` : null}
            notifications={notifications.map((n) => ({
              id: n.id,
              title: n.title,
              body: n.body,
              link: n.link,
              readAt: n.readAt?.toISOString() ?? null,
              createdAt: n.createdAt.toISOString(),
            }))}
          >
            {children}
          </Shell>
        </ProjectProvider>
      </ToastProvider>
    </div>
  );
}

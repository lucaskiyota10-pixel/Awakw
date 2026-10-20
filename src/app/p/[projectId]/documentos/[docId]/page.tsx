import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { CHART_KEYS } from "@/lib/server/charts";
import { DocEditor } from "./DocEditor";

export default async function DocPage({ params }: { params: Promise<{ projectId: string; docId: string }> }) {
  const { projectId, docId } = await params;
  await pageContext(projectId);
  const [doc, project, images, suggestions] = await Promise.all([
    prisma.document.findFirst({ where: { id: docId, projectId } }),
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true, alternateName: true, officialNameConfirmed: true } }),
    prisma.fileAsset.findMany({ where: { projectId, mime: { in: ["image/png", "image/jpeg", "image/gif"] } }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    prisma.documentSuggestion.findMany({ where: { documentId: docId }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!doc) notFound();
  return (
    <DocEditor
      doc={{ id: doc.id, title: doc.title, kind: doc.kind, content: doc.content, version: doc.version, status: doc.status, approvedVersion: doc.approvedVersion, approvedById: doc.approvedById, approvedAt: doc.approvedAt?.toISOString() ?? null, updatedById: doc.updatedById, updatedAt: doc.updatedAt.toISOString() }}
      project={project}
      images={images}
      chartKeys={CHART_KEYS}
      suggestions={suggestions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
    />
  );
}

import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { Files } from "./Files";

export default async function FilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await pageContext(projectId);
  const files = await prisma.fileAsset.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  return <Files files={files.map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: f.size, folder: f.folder, uploaderId: f.uploaderId, createdAt: f.createdAt.toISOString() }))} />;
}

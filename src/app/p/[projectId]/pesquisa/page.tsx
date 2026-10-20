import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { Research } from "./Research";

export default async function ResearchPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await pageContext(projectId);
  const [competitors, swot, files, references] = await Promise.all([
    prisma.competitor.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    prisma.swotItem.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.fileAsset.findMany({ where: { projectId, folder: "concorrentes" }, select: { id: true, name: true } }),
    prisma.reference.findMany({ where: { projectId }, orderBy: { abnt: "asc" } }),
  ]);
  const ser = <T,>(x: T) => JSON.parse(JSON.stringify(x));
  return <Research competitors={ser(competitors)} swot={ser(swot)} files={files} references={ser(references)} />;
}

import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { Kanban, type TaskLite } from "./Kanban";

export default async function TasksPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ t?: string }> }) {
  const { projectId } = await params;
  const { t } = await searchParams;
  await pageContext(projectId);
  const [tasks, files] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, orderBy: [{ order: "asc" }] }),
    prisma.fileAsset.findMany({ where: { projectId, folder: { startsWith: "task:" } }, select: { id: true, name: true, mime: true, folder: true } }),
  ]);
  const lite: TaskLite[] = tasks.map((x) => ({
    id: x.id,
    title: x.title,
    description: x.description,
    status: x.status,
    priority: x.priority,
    sector: x.sector,
    assigneeId: x.assigneeId,
    dueDate: x.dueDate?.toISOString().slice(0, 10) ?? null,
    checklist: (x.checklist as TaskLite["checklist"]) ?? [],
    dependsOn: x.dependsOn,
    order: x.order,
    createdById: x.createdById,
    files: files.filter((f) => f.folder === `task:${x.id}`).map((f) => ({ id: f.id, name: f.name, mime: f.mime })),
  }));
  return <Kanban tasks={lite} openId={t ?? null} />;
}

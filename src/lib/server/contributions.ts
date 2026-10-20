import "server-only";
import { prisma } from "./db";
import { projectMembers } from "./access";

/** Contribuições individuais (base para o relatório de contribuições e o relatório individual). */
export async function contributions(projectId: string) {
  const members = await projectMembers(projectId);
  const [versions, suggestions, comments, messages, tasks, decisions, audits, pubs] = await Promise.all([
    prisma.documentVersion.groupBy({ by: ["authorId"], where: { document: { projectId } }, _count: true, _sum: { charsAdded: true, charsRemoved: true } }),
    prisma.documentSuggestion.findMany({ where: { document: { projectId } }, select: { authorId: true, status: true } }),
    prisma.comment.groupBy({ by: ["authorId"], where: { projectId }, _count: true }),
    prisma.message.groupBy({ by: ["authorId"], where: { channel: { projectId } }, _count: true }),
    prisma.task.findMany({ where: { projectId }, select: { assigneeId: true, status: true } }),
    prisma.decision.groupBy({ by: ["createdById"], where: { projectId }, _count: true }),
    prisma.auditLog.groupBy({ by: ["userId"], where: { projectId }, _count: true }),
    prisma.publication.groupBy({ by: ["createdById"], where: { projectId }, _count: true }),
  ]);
  return members.map((m) => {
    const v = versions.find((x) => x.authorId === m.id);
    const myTasks = tasks.filter((t) => t.assigneeId === m.id);
    return {
      id: m.id,
      name: m.name,
      sector: m.sector,
      responsibilities: m.responsibilities,
      role: m.role,
      docVersions: v?._count ?? 0,
      charsAdded: v?._sum.charsAdded ?? 0,
      charsRemoved: v?._sum.charsRemoved ?? 0,
      suggestions: suggestions.filter((s) => s.authorId === m.id).length,
      suggestionsAccepted: suggestions.filter((s) => s.authorId === m.id && s.status === "ACCEPTED").length,
      comments: comments.find((x) => x.authorId === m.id)?._count ?? 0,
      messages: messages.find((x) => x.authorId === m.id)?._count ?? 0,
      tasksAssigned: myTasks.length,
      tasksDone: myTasks.filter((t) => t.status === "DONE" || t.status === "APPROVED").length,
      decisions: decisions.find((x) => x.createdById === m.id)?._count ?? 0,
      publications: pubs.find((x) => x.createdById === m.id)?._count ?? 0,
      actions: audits.find((x) => x.userId === m.id)?._count ?? 0,
    };
  });
}
export type Contribution = Awaited<ReturnType<typeof contributions>>[number];

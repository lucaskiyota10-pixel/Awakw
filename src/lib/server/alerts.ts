import "server-only";
import { prisma } from "./db";
import { notify } from "./notify";

/** Gera alertas de prazo (vencidas ou vencendo em 48h) para o usuário, sem duplicar. */
export async function ensureDeadlineAlerts(projectId: string, userId: string) {
  const soon = new Date(Date.now() + 48 * 3600000);
  const tasks = await prisma.task.findMany({
    where: { projectId, assigneeId: userId, status: { notIn: ["DONE", "APPROVED"] }, dueDate: { lte: soon } },
    select: { id: true, title: true, dueDate: true },
    take: 30,
  });
  for (const t of tasks) {
    const overdue = t.dueDate! < new Date();
    await notify(projectId, [userId], {
      type: "deadline",
      title: overdue ? "Tarefa atrasada" : "Prazo em até 48h",
      body: `${t.title} — ${t.dueDate!.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`,
      link: `/p/${projectId}/tarefas?t=${t.id}`,
      dedupeKey: `due:${t.id}:${overdue ? "late" : "soon"}:${t.dueDate!.toISOString().slice(0, 10)}`,
    });
  }
}

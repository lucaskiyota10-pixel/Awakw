import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { CalendarView, type CalEvent } from "@/components/CalendarView";
import { PageHeader } from "@/components/ui";
import { PUB_TYPE_LABEL } from "@/lib/labels";

export default async function CalendarPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await pageContext(projectId);
  const [tasks, pubs, milestones, decisions] = await Promise.all([
    prisma.task.findMany({ where: { projectId, dueDate: { not: null } } }),
    prisma.publication.findMany({ where: { projectId, scheduledAt: { not: null } } }),
    prisma.milestone.findMany({ where: { projectId } }),
    prisma.decision.findMany({ where: { projectId, dueDate: { not: null } } }),
  ]);
  const base = `/p/${projectId}`;
  const now = new Date().toISOString().slice(0, 10);
  const events: CalEvent[] = [
    ...tasks.map((t) => ({
      id: t.id,
      date: t.dueDate!.toISOString(),
      title: t.title,
      kind: "task" as const,
      href: `${base}/tarefas?t=${t.id}`,
      alert: t.dueDate!.toISOString().slice(0, 10) < now && !["DONE", "APPROVED"].includes(t.status),
      mine: t.assigneeId === ctx.user.id,
      allDay: true,
    })),
    ...pubs.map((p) => ({ id: p.id, date: p.scheduledAt!.toISOString(), title: `${PUB_TYPE_LABEL[p.type]}: ${p.title}`, kind: "publication" as const, href: `${base}/editorial?p=${p.id}`, allDay: false })),
    ...milestones.map((m) => ({ id: m.id, date: m.date.toISOString(), title: m.title, kind: "milestone" as const, href: `${base}/crescimento?tab=timeline`, allDay: true })),
    ...decisions.map((d) => ({ id: d.id, date: d.dueDate!.toISOString(), title: `Decisão: ${d.title}`, kind: "decision" as const, href: `${base}/decisoes?d=${d.id}`, allDay: true })),
  ];
  return (
    <div>
      <PageHeader title="Calendário" subtitle="Prazos de tarefas, publicações, marcos e decisões. Itens em vermelho estão atrasados." />
      <CalendarView events={events} />
    </div>
  );
}

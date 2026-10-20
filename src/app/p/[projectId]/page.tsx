import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { pageContext, projectMembers } from "@/lib/server/access";
import { referenceGrowthScenario } from "@/lib/server/scenarios";
import { aggregate } from "@/lib/sim/aggregate";
import { brl, dateBr, dateTimeBr, num } from "@/lib/format";
import { SECTORS, TASK_STATUS, TASK_STATUS_LABEL, DECISION_STATUS, TARGET_LABEL } from "@/lib/labels";
import { Stat } from "@/components/charts";
import { SimBanner } from "@/components/ui";
import { DashboardCharts } from "./DashboardCharts";
import type { Prisma } from "@prisma/client";

export default async function Dashboard({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  const ctx = await pageContext(projectId);
  const members = await projectMembers(projectId);
  const from = sp.de ? new Date(sp.de) : null;
  const to = sp.ate ? new Date(sp.ate) : null;

  const taskWhere: Prisma.TaskWhereInput = {
    projectId,
    ...(sp.setor ? { sector: sp.setor } : {}),
    ...(sp.resp ? { assigneeId: sp.resp } : {}),
    ...(from || to ? { dueDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const [project, tasks, decisions, approvals, docs, budgets, lastMessages, myTasks] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    prisma.task.findMany({ where: taskWhere, select: { id: true, title: true, status: true, dueDate: true, assigneeId: true, sector: true } }),
    prisma.decision.findMany({ where: { projectId, status: { in: ["PROPOSED", "IN_DISCUSSION"] } }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.approval.findMany({ where: { projectId, status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.document.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, status: true, updatedAt: true, version: true } }),
    prisma.budgetPlan.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } }),
    prisma.message.findMany({ where: { channel: { projectId, type: { in: ["GENERAL", "SECTOR"] } } }, orderBy: { createdAt: "desc" }, take: 5, include: { channel: { select: { name: true } } } }),
    prisma.task.findMany({ where: { projectId, assigneeId: ctx.user.id, status: { notIn: ["DONE", "APPROVED"] } }, orderBy: { dueDate: "asc" }, take: 6 }),
  ]);
  const ref = await referenceGrowthScenario(projectId);

  const done = tasks.filter((t) => t.status === "DONE" || t.status === "APPROVED").length;
  const progress = tasks.length ? done / tasks.length : 0;
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < new Date() && t.status !== "DONE" && t.status !== "APPROVED");
  const launch = project.launchDate;
  const daysToLaunch = launch ? Math.ceil((launch.getTime() - Date.now()) / 86400000) : null;
  const approvedBudget = budgets.find((b) => b.status === "APPROVED");
  const proposedBudget = budgets.find((b) => b.status !== "APPROVED");
  const name = (id: string | null) => members.find((m) => m.id === id)?.name ?? "—";

  const byStatus = TASK_STATUS.map(([k, l]) => ({ status: l, tarefas: tasks.filter((t) => t.status === k).length }));
  const bySector = SECTORS.map((s) => {
    const ts = tasks.filter((t) => t.sector === s);
    return { setor: s, concluidas: ts.filter((t) => t.status === "DONE" || t.status === "APPROVED").length, abertas: ts.filter((t) => t.status !== "DONE" && t.status !== "APPROVED").length };
  });
  const monthly =
    ref && ref.result.ok
      ? aggregate(ref.result.days, ref.values.startDate, ref.result.endDate, "MONTH").map((r) => ({ periodo: r.label.replace("Mês ", "M"), receita: Math.round(r.revenue), investimento: Math.round(r.budget), seguidores: Math.round(r.followers) }))
      : [];
  const totals = ref?.result.ok
    ? ref.result.days.reduce((a, d) => ({ revenue: a.revenue + d.revenue, purchases: a.purchases + d.purchases }), { revenue: 0, purchases: 0 })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-taupe">Dashboard</p>
          <h1 className="text-4xl">{project.name}</h1>
          <p className="muted text-sm">
            {project.alternateName && !project.officialNameConfirmed && (
              <span className="mr-2 badge bg-amber-100 text-amber-900">Nome oficial pendente: {project.name} × {project.alternateName}</span>
            )}
            {project.isDemo && <span className="badge bg-amber-100 text-amber-900">Projeto com dados demonstrativos</span>}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm" method="get">
          <label><span className="label">Setor</span>
            <select name="setor" defaultValue={sp.setor ?? ""} className="input w-36"><option value="">Todos</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          <label><span className="label">Responsável</span>
            <select name="resp" defaultValue={sp.resp ?? ""} className="input w-40"><option value="">Todos</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </label>
          <label><span className="label">Prazo de</span><input type="date" name="de" defaultValue={sp.de ?? ""} className="input w-36" /></label>
          <label><span className="label">até</span><input type="date" name="ate" defaultValue={sp.ate ?? ""} className="input w-36" /></label>
          <button className="btn-secondary">Filtrar</button>
          {(sp.setor || sp.resp || sp.de || sp.ate) && <Link href={`/p/${projectId}`} className="btn-ghost">Limpar</Link>}
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lançamento" value={launch ? (daysToLaunch! >= 0 ? `${daysToLaunch} dias` : "Lançado") : "A definir"} hint={launch ? `${dateBr(launch)} ${project.launchDateConfirmed ? "(confirmado)" : "(provisório)"}` : undefined} />
        <Stat label="Progresso das tarefas" value={`${Math.round(progress * 100)}%`} hint={`${done} de ${tasks.length} concluídas/aprovadas`} />
        <Stat label="Atrasadas" value={overdue.length} hint="Tarefas com prazo vencido" />
        <Stat label="Aprovações pendentes" value={approvals.length} hint={`${decisions.length} decisões abertas`} />
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-areia" aria-label="Progresso">
        <div className="h-full bg-carvao" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="card-title mb-3">Tarefas por etapa e setor</h2>
          <DashboardCharts byStatus={byStatus} bySector={bySector} />
        </section>
        <section className="card">
          <h2 className="card-title mb-3">Minhas tarefas</h2>
          <ul className="space-y-2 text-sm">
            {myTasks.length === 0 && <li className="muted">Nenhuma tarefa aberta atribuída a você.</li>}
            {myTasks.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <Link className="hover:underline" href={`/p/${projectId}/tarefas?t=${t.id}`}>{t.title}</Link>
                <span className={`shrink-0 text-xs ${t.dueDate && t.dueDate < new Date() ? "text-red-700" : "text-carvao/60"}`}>{dateBr(t.dueDate)}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 mb-2 font-serif text-lg">Atrasadas</h3>
          <ul className="space-y-1 text-sm">
            {overdue.length === 0 && <li className="muted">Nenhuma.</li>}
            {overdue.slice(0, 5).map((t) => (
              <li key={t.id} className="flex justify-between gap-2"><span>{t.title}</span><span className="shrink-0 text-xs text-red-700">{name(t.assigneeId)}</span></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">Projeção de referência {ref && <span className="text-base text-carvao/60">— {ref.scenario.name} {ref.scenario.status === "APPROVED" ? "(aprovado)" : "(não aprovado)"}</span>}</h2>
          <Link href={`/p/${projectId}/crescimento`} className="btn-secondary btn-sm">Abrir Growth Simulator</Link>
        </div>
        <SimBanner />
        {ref && ref.result.ok && totals ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat tone="sim" label="Investimento no período" value={brl(ref.result.totalInvestment, 0)} hint={ref.values.budgetMode === "ONE_TIME" ? "Orçamento único" : "Mensal recorrente"} />
              <Stat tone="sim" label="Receita projetada" value={brl(totals.revenue, 0)} />
              <Stat tone="sim" label="Compras projetadas" value={num(totals.purchases)} />
              <Stat tone="sim" label="Seguidores hipotéticos (fim)" value={num(ref.result.days.at(-1)?.followers ?? 0)} />
            </div>
            <DashboardCharts monthly={monthly} />
          </>
        ) : (
          <p className="muted text-sm">Nenhum cenário de crescimento salvo.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card">
          <h2 className="card-title mb-3">Verba</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Proposta</dt><dd>{proposedBudget ? brl(proposedBudget.total, 0) : "—"}</dd></div>
            <div className="flex justify-between"><dt>Aprovada</dt><dd>{approvedBudget ? brl(approvedBudget.total, 0) : <span className="text-amber-800">Nenhuma aprovada</span>}</dd></div>
          </dl>
          <Link href={`/p/${projectId}/verba`} className="mt-3 inline-block text-sm underline">Planejamento de verba</Link>
        </section>
        <section className="card">
          <h2 className="card-title mb-3">Decisões abertas</h2>
          <ul className="space-y-2 text-sm">
            {decisions.length === 0 && <li className="muted">Nenhuma.</li>}
            {decisions.map((d) => (
              <li key={d.id}><Link href={`/p/${projectId}/decisoes?d=${d.id}`} className="hover:underline">{d.title}</Link> <span className="badge bg-areia">{DECISION_STATUS[d.status]}</span></li>
            ))}
          </ul>
          <h3 className="mt-4 mb-2 font-serif text-lg">Aprovações</h3>
          <ul className="space-y-1 text-sm">
            {approvals.length === 0 && <li className="muted">Nenhuma pendente.</li>}
            {approvals.map((a) => <li key={a.id}>{TARGET_LABEL[a.targetType]}: {a.targetLabel}</li>)}
          </ul>
        </section>
        <section className="card">
          <h2 className="card-title mb-3">Mensagens recentes</h2>
          <ul className="space-y-2 text-sm">
            {lastMessages.length === 0 && <li className="muted">Sem mensagens.</li>}
            {lastMessages.map((m) => (
              <li key={m.id}><span className="text-xs text-carvao/50">#{m.channel.name} · {name(m.authorId)} · {dateTimeBr(m.createdAt)}</span><br />{m.body.slice(0, 100)}</li>
            ))}
          </ul>
          <h3 className="mt-4 mb-2 font-serif text-lg">Documentos</h3>
          <ul className="space-y-1 text-sm">
            {docs.length === 0 && <li className="muted">Nenhum documento.</li>}
            {docs.map((d) => <li key={d.id}><Link className="hover:underline" href={`/p/${projectId}/documentos/${d.id}`}>{d.title}</Link> <span className="text-xs text-carvao/50">v{d.version}</span></li>)}
          </ul>
        </section>
      </div>
      <p className="text-xs text-carvao/50">Status das tarefas: {TASK_STATUS.map(([k]) => `${TASK_STATUS_LABEL[k]}`).join(" → ")}</p>
    </div>
  );
}

import { prisma } from "@/lib/server/db";
import { pageContext, projectMembers } from "@/lib/server/access";
import { PageHeader } from "@/components/ui";
import { ACTION_LABEL } from "@/lib/labels";
import { dateTimeBr } from "@/lib/format";

export default async function AuditPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ entidade?: string; pagina?: string }> }) {
  const { projectId } = await params;
  const sp = await searchParams;
  await pageContext(projectId, "approve");
  const page = Math.max(1, Number(sp.pagina) || 1);
  const where = { projectId, ...(sp.entidade ? { entity: sp.entidade } : {}) };
  const [logs, members, entities] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, skip: (page - 1) * 100 }),
    projectMembers(projectId),
    prisma.auditLog.findMany({ where: { projectId }, distinct: ["entity"], select: { entity: true } }),
  ]);
  const name = (id: string | null) => members.find((m) => m.id === id)?.name ?? "—";
  return (
    <div>
      <PageHeader title="Auditoria" subtitle="Registro de autoria, data e alterações. Visível para coordenadores e administradores." />
      <form className="mb-4 flex gap-2" method="get">
        <select name="entidade" defaultValue={sp.entidade ?? ""} className="input w-56"><option value="">Todas as entidades</option>{entities.map((e) => <option key={e.entity}>{e.entity}</option>)}</select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Data</th><th>Autor</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{dateTimeBr(l.createdAt)}</td>
                <td>{name(l.userId)}</td>
                <td>{ACTION_LABEL[l.action] ?? l.action}</td>
                <td>{l.entity}<br /><span className="text-[10px] text-carvao/40">{l.entityId}</span></td>
                <td className="max-w-md"><code className="break-all text-[11px]">{l.data ? JSON.stringify(l.data).slice(0, 300) : ""}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-2">
        {page > 1 && <a className="btn-secondary btn-sm" href={`?pagina=${page - 1}${sp.entidade ? `&entidade=${sp.entidade}` : ""}`}>Anterior</a>}
        {logs.length === 100 && <a className="btn-secondary btn-sm" href={`?pagina=${page + 1}${sp.entidade ? `&entidade=${sp.entidade}` : ""}`}>Próxima</a>}
      </div>
    </div>
  );
}

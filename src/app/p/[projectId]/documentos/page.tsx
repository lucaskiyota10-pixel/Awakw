import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { PageHeader } from "@/components/ui";
import { DOC_KINDS } from "@/lib/server/docgen";
import { REVIEW_STATUS } from "@/lib/labels";
import { dateTimeBr } from "@/lib/format";
import { NewDocument } from "./NewDocument";
import { MemberNameCell } from "./MemberNameCell";

export default async function DocumentsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await pageContext(projectId);
  const docs = await prisma.document.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { versions: true, suggestions: { where: { status: "OPEN" } } } } } });
  const kindLabel = Object.fromEntries(DOC_KINDS);
  return (
    <div>
      <PageHeader
        title="Documentos"
        subtitle="Documentos acadêmicos gerados a partir dos dados do projeto, com edição colaborativa, versões, sugestões, aprovação e exportação DOCX/PDF (modelo ABNT)."
        actions={<><Link href={`/p/${projectId}/documentos/contribuicoes`} className="btn-secondary">Relatório de contribuições</Link>{ctx.role !== "VIEWER" && <NewDocument kinds={DOC_KINDS} />}</>}
      />
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Documento</th><th>Tipo</th><th>Status</th><th>Versão</th><th>Atualizado</th><th>Sugestões abertas</th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td><Link className="font-medium hover:underline" href={`/p/${projectId}/documentos/${d.id}`}>{d.title}</Link></td>
                <td>{kindLabel[d.kind] ?? d.kind}</td>
                <td><span className={`badge ${d.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : d.status === "IN_REVIEW" ? "bg-amber-100 text-amber-900" : "bg-areia"}`}>{REVIEW_STATUS[d.status]}</span>{d.approvedVersion ? <span className="ml-1 text-xs text-carvao/50">aprovada v{d.approvedVersion}</span> : null}</td>
                <td>v{d.version} <span className="text-xs text-carvao/50">({d._count.versions} snapshots)</span></td>
                <td className="whitespace-nowrap">{dateTimeBr(d.updatedAt)} · <MemberNameCell id={d.updatedById} /></td>
                <td>{d._count.suggestions}</td>
              </tr>
            ))}
            {docs.length === 0 && <tr><td colSpan={6} className="text-carvao/50">Nenhum documento. Use “Novo documento” para gerar a partir dos dados do projeto.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

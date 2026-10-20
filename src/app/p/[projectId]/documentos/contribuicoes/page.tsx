import { pageContext } from "@/lib/server/access";
import { contributions } from "@/lib/server/contributions";
import { PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/permissions";
import { num } from "@/lib/format";
import { ContribChart } from "./ContribChart";

export default async function ContributionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await pageContext(projectId);
  const rows = await contributions(projectId);
  return (
    <div className="space-y-6">
      <PageHeader title="Relatório de contribuições" subtitle="Contagem objetiva das contribuições registradas na plataforma (autoria de versões, sugestões, comentários, mensagens, tarefas). Não mede qualidade — use como apoio ao relatório individual." />
      <div className="card"><ContribChart rows={rows.map((r) => ({ nome: r.name, versoes: r.docVersions, comentarios: r.comments, mensagens: r.messages, tarefas: r.tasksDone }))} /></div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Integrante</th><th>Papel / setor</th><th>Versões de docs</th><th>+ / − caracteres</th><th>Sugestões (aceitas)</th><th>Comentários</th><th>Mensagens</th><th>Tarefas concluídas</th><th>Publicações</th><th>Decisões</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td><td>{ROLE_LABEL[r.role]}<br /><span className="text-xs text-carvao/50">{r.sector ?? "—"}</span></td>
                <td>{r.docVersions}</td><td>{num(r.charsAdded)} / {num(r.charsRemoved)}</td><td>{r.suggestions} ({r.suggestionsAccepted})</td><td>{r.comments}</td><td>{r.messages}</td><td>{r.tasksDone}/{r.tasksAssigned}</td><td>{r.publications}</td><td>{r.decisions}</td><td>{r.actions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

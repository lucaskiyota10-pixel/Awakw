"use client";
import { Chart } from "@/components/charts";
export function ContribChart({ rows }: { rows: Record<string, unknown>[] }) {
  return <Chart data={rows} x="nome" stacked series={[{ key: "versoes", label: "Versões" }, { key: "comentarios", label: "Comentários" }, { key: "mensagens", label: "Mensagens" }, { key: "tarefas", label: "Tarefas concluídas" }]} />;
}

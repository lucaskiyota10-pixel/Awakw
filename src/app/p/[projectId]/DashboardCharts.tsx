"use client";

import { Chart } from "@/components/charts";
import { brl, num } from "@/lib/format";

export function DashboardCharts({
  byStatus,
  bySector,
  monthly,
}: {
  byStatus?: { status: string; tarefas: number }[];
  bySector?: { setor: string; concluidas: number; abertas: number }[];
  monthly?: { periodo: string; receita: number; investimento: number; seguidores: number }[];
}) {
  if (monthly)
    return (
      <Chart
        kind="composed"
        data={monthly}
        x="periodo"
        format={(v) => (v > 5000 ? brl(v, 0) : num(v))}
        series={[
          { key: "investimento", label: "Investimento (R$)" },
          { key: "receita", label: "Receita hipotética (R$)" },
          { key: "seguidores", label: "Seguidores hipotéticos", type: "line", axis: "right" },
        ]}
      />
    );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Chart data={byStatus ?? []} x="status" series={[{ key: "tarefas", label: "Tarefas" }]} height={240} />
      <Chart data={bySector ?? []} x="setor" stacked series={[{ key: "concluidas", label: "Concluídas" }, { key: "abertas", label: "Abertas" }]} height={240} />
    </div>
  );
}

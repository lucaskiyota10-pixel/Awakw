import { prisma } from "@/lib/server/db";
import { pageContext } from "@/lib/server/access";
import { Budget } from "./Budget";

export default async function BudgetPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await pageContext(projectId);
  const [plans, metricScenarios] = await Promise.all([
    prisma.budgetPlan.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.scenario.findMany({ where: { projectId, kind: "METRICS" }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <Budget
      plans={plans.map((x) => ({ ...x, allocations: x.allocations as unknown as { key: string; label: string; amount: number }[], approvedAt: x.approvedAt?.toISOString() ?? null, createdAt: x.createdAt.toISOString(), updatedAt: x.updatedAt.toISOString() }))}
      scenarios={metricScenarios.map((s) => ({ id: s.id, name: s.name, premises: s.premises, status: s.status }))}
    />
  );
}

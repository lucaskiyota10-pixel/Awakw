import "server-only";
import { prisma } from "./db";
import { readGrowth } from "../sim/scenario";
import { simulateGrowth } from "../sim/growth";

/** Cenário de referência: o aprovado mais recente; senão o moderado; senão o mais recente. */
export async function referenceGrowthScenario(projectId: string) {
  const list = await prisma.scenario.findMany({ where: { projectId, kind: "GROWTH" }, orderBy: { updatedAt: "desc" } });
  const s = list.find((x) => x.status === "APPROVED") ?? list.find((x) => x.level === "MODERATE") ?? list[0];
  if (!s) return null;
  const { values, sources } = readGrowth(s.premises);
  return { scenario: s, values, sources, result: simulateGrowth(values) };
}

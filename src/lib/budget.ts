export interface Allocation {
  key: string;
  label: string;
  amount: number;
}

export const SUGGESTED_ALLOCATIONS: Allocation[] = [
  { key: "awareness", label: "Reconhecimento/Engajamento", amount: 3000 },
  { key: "conversion", label: "Conversão/Remarketing", amount: 6000 },
  { key: "tests", label: "Testes/Otimização", amount: 1000 },
];

export function validateAllocations(total: number, allocations: Allocation[]) {
  const errors: string[] = [];
  if (!(total > 0)) errors.push("O total deve ser maior que zero.");
  if (!allocations.length) errors.push("Inclua ao menos uma linha de verba.");
  const keys = new Set<string>();
  for (const a of allocations) {
    if (!a.label.trim()) errors.push("Toda linha precisa de um nome.");
    if (!(a.amount >= 0)) errors.push(`Valor inválido em "${a.label}".`);
    if (keys.has(a.key)) errors.push(`Chave duplicada: ${a.key}.`);
    keys.add(a.key);
  }
  const sum = round2(allocations.reduce((s, a) => s + a.amount, 0));
  if (Math.abs(sum - round2(total)) > 0.009)
    errors.push(`A soma das linhas (${sum.toFixed(2)}) difere do total (${total.toFixed(2)}).`);
  return { ok: errors.length === 0, errors, sum };
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

export function percentages(total: number, allocations: Allocation[]) {
  return allocations.map((a) => ({ ...a, pct: total > 0 ? a.amount / total : 0 }));
}

/**
 * Altera o valor de uma linha e redistribui a diferença proporcionalmente entre
 * as demais, mantendo a soma igual ao total (centavos ajustados na última linha).
 */
export function rebalance(total: number, allocations: Allocation[], key: string, newAmount: number): Allocation[] {
  const target = Math.min(Math.max(0, newAmount), total);
  const others = allocations.filter((a) => a.key !== key);
  const othersSum = others.reduce((s, a) => s + a.amount, 0);
  const remaining = total - target;
  const out = allocations.map((a) => {
    if (a.key === key) return { ...a, amount: round2(target) };
    const share = othersSum > 0 ? a.amount / othersSum : 1 / others.length;
    return { ...a, amount: round2(remaining * share) };
  });
  const diff = round2(total - out.reduce((s, a) => s + a.amount, 0));
  if (diff !== 0) {
    const idx = out.findIndex((a) => a.key !== key);
    if (idx >= 0) out[idx] = { ...out[idx], amount: round2(out[idx].amount + diff) };
  }
  return out;
}

/** Escala todas as linhas para um novo total mantendo os percentuais. */
export function scaleTo(newTotal: number, total: number, allocations: Allocation[]): Allocation[] {
  if (!(total > 0)) return allocations;
  const out = allocations.map((a) => ({ ...a, amount: round2((a.amount / total) * newTotal) }));
  const diff = round2(newTotal - out.reduce((s, a) => s + a.amount, 0));
  if (diff !== 0 && out.length) out[out.length - 1].amount = round2(out[out.length - 1].amount + diff);
  return out;
}

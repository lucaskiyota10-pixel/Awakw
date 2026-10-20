/** Origem de cada número exibido/gravado. Toda premissa deve declarar uma destas. */
export const ORIGINS = {
  BRIEFING: "Briefing confirmado",
  EXTERNAL: "Fonte externa documentada",
  HYPOTHESIS: "Hipótese da equipe",
  CALCULATION: "Cálculo",
  REAL: "Dado real informado",
} as const;

export type Origin = keyof typeof ORIGINS;

export interface PremiseSource {
  origin: Origin;
  note?: string;
}

export type SourceMap = Record<string, PremiseSource>;

export const SIM_DISCLAIMER =
  "SIMULAÇÃO ACADÊMICA — RESULTADOS HIPOTÉTICOS. NÃO REPRESENTAM DESEMPENHO GARANTIDO.";

/** Fontes externas exigem nota (referência); demais origens aceitam nota opcional. */
export function validateSources(sources: SourceMap): string[] {
  const errors: string[] = [];
  for (const [key, s] of Object.entries(sources)) {
    if (!(s.origin in ORIGINS)) errors.push(`Origem inválida para "${key}".`);
    if (s.origin === "EXTERNAL" && !s.note?.trim())
      errors.push(`"${key}" marcada como fonte externa precisa da referência documentada.`);
  }
  return errors;
}

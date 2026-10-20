export interface DocMeta {
  projectName: string;
  officialNameConfirmed: boolean;
  title: string;
  subtitle?: string;
  academic: Record<string, string>;
  references: string[];
  versionLabel: string;
}

export const ACADEMIC_PENDING = "[Pendente de preenchimento/validação]";

export function ac(meta: DocMeta, k: string) {
  return meta.academic[k]?.trim() || ACADEMIC_PENDING;
}

export function natureText(meta: DocMeta) {
  const d = meta.academic.disciplina?.trim();
  const c = meta.academic.curso?.trim();
  const p = meta.academic.professor?.trim();
  const f = meta.academic.faculdade?.trim();
  return `Trabalho apresentado à disciplina ${d || ACADEMIC_PENDING}, do curso de ${c || ACADEMIC_PENDING}${f ? ` da ${f}` : ""}, como requisito parcial de avaliação, sob orientação de ${p || ACADEMIC_PENDING}.`;
}

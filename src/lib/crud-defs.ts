/**
 * Definições declarativas de entidades simples (CRUD). Usadas no cliente (formulários/tabelas)
 * e no servidor (validação com zod gerada a partir daqui).
 */
import { z } from "zod";

export type FieldType = "text" | "textarea" | "number" | "int" | "date" | "select" | "bool" | "url";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: [string, string][];
  table?: boolean; // exibir como coluna
  hint?: string;
}

export interface EntityDef {
  model: string; // delegate do Prisma
  label: string;
  fields: FieldDef[];
  orderBy?: Record<string, "asc" | "desc">[];
  ownerField?: string; // campo com id do autor (preenchido automaticamente)
}

export const DIAG_AREAS: [string, string][] = [
  ["INSTAGRAM", "Instagram"],
  ["SITE", "Site"],
  ["ECOMMERCE", "E-commerce"],
  ["ACCESS", "Acessos"],
  ["TOOLS", "Ferramentas"],
  ["OPERATION", "Operação"],
  ["PENDING", "Pendências"],
];

export const STATUS_DIAG: [string, string][] = [
  ["PENDING", "Pendente"],
  ["IN_PROGRESS", "Em levantamento"],
  ["OK", "OK / confirmado"],
  ["ISSUE", "Problema identificado"],
];

export const PIXEL_STATUS: [string, string][] = [
  ["PLANNED", "Planejado"],
  ["IMPLEMENTED_UNVALIDATED", "Implementado — não validado"],
  ["VALIDATED", "Validado (com evidência)"],
];

export const ENTITIES = {
  competitor: {
    model: "competitor",
    label: "Concorrente",
    orderBy: [{ name: "asc" }],
    fields: [
      { name: "name", label: "Nome", type: "text", required: true, table: true },
      { name: "website", label: "Site", type: "url", table: true },
      { name: "socials", label: "Redes sociais", type: "text" },
      { name: "positioning", label: "Posicionamento", type: "textarea", table: true },
      { name: "products", label: "Produtos", type: "textarea" },
      { name: "observedPrices", label: "Preços observados", type: "textarea", table: true, hint: "Informe preço, produto e onde foi observado." },
      { name: "differentials", label: "Diferenciais", type: "textarea" },
      { name: "sources", label: "Fontes (URL/print)", type: "textarea", table: true, hint: "Obrigatório para dados externos — não invente." },
      { name: "observedAt", label: "Data da observação", type: "date", table: true },
      { name: "notes", label: "Observações", type: "textarea" },
    ],
  },
  swot: {
    model: "swotItem",
    label: "Item SWOT",
    orderBy: [{ createdAt: "asc" }],
    fields: [
      { name: "quadrant", label: "Quadrante", type: "select", required: true, options: [["S", "Força (interno)"], ["W", "Fraqueza (interno)"], ["O", "Oportunidade (externo)"], ["T", "Ameaça (externo)"]] },
      { name: "text", label: "Descrição", type: "textarea", required: true },
      { name: "basis", label: "Base", type: "select", required: true, options: [["EVIDENCE", "Evidência"], ["HYPOTHESIS", "Hipótese"]] },
      { name: "evidence", label: "Evidência", type: "textarea" },
      { name: "source", label: "Fonte", type: "text" },
    ],
  },
  diagnostic: {
    model: "diagnosticItem",
    label: "Item de diagnóstico",
    orderBy: [{ area: "asc" }],
    fields: [
      { name: "area", label: "Área", type: "select", required: true, options: DIAG_AREAS, table: true },
      { name: "item", label: "Item", type: "text", required: true, table: true },
      { name: "status", label: "Status", type: "select", required: true, options: STATUS_DIAG, table: true },
      { name: "notes", label: "Notas", type: "textarea", table: true },
    ],
  },
  measurement: {
    model: "measurementItem",
    label: "Item do plano de mensuração",
    fields: [
      { name: "objective", label: "Objetivo", type: "text", required: true, table: true },
      { name: "event", label: "Evento / métrica", type: "text", required: true, table: true },
      { name: "responsible", label: "Responsável", type: "text", table: true },
      { name: "status", label: "Status", type: "select", required: true, options: [["PLANNED", "Planejado"], ["IN_PROGRESS", "Em implementação"], ["VALIDATED", "Validado"]], table: true },
      { name: "evidence", label: "Evidência", type: "textarea", table: true },
    ],
  },
  pixel: {
    model: "pixelEvent",
    label: "Evento Pixel/API",
    orderBy: [{ order: "asc" }],
    fields: [
      { name: "name", label: "Evento", type: "text", required: true, table: true },
      { name: "trigger", label: "Gatilho", type: "text", table: true },
      { name: "parameters", label: "Parâmetros", type: "text", table: true },
      { name: "consent", label: "Consentimento", type: "text" },
      { name: "dedup", label: "Deduplicação", type: "text" },
      { name: "testPlan", label: "Plano de teste", type: "text" },
      { name: "status", label: "Status", type: "select", required: true, options: PIXEL_STATUS, table: true },
      { name: "evidence", label: "Evidência de validação", type: "textarea", table: true, hint: "Obrigatória para marcar como validado." },
      { name: "order", label: "Ordem", type: "int" },
    ],
  },
  checklist: {
    model: "checklistItem",
    label: "Item de checklist",
    orderBy: [{ order: "asc" }],
    fields: [
      { name: "list", label: "Lista", type: "select", required: true, options: [["DAILY", "Diário"], ["LAUNCH", "Lançamento"]] },
      { name: "text", label: "Item", type: "text", required: true },
      { name: "done", label: "Concluído", type: "bool" },
      { name: "order", label: "Ordem", type: "int" },
    ],
  },
  weeklyReport: {
    model: "weeklyReport",
    label: "Relatório semanal",
    ownerField: "authorId",
    orderBy: [{ weekStart: "desc" }],
    fields: [
      { name: "weekStart", label: "Semana (início)", type: "date", required: true, table: true },
      { name: "hypotheses", label: "Hipóteses", type: "textarea", table: true },
      { name: "problems", label: "Problemas", type: "textarea", table: true },
      { name: "recommendations", label: "Recomendações", type: "textarea", table: true },
    ],
  },
  metricEntry: {
    model: "metricEntry",
    label: "Registro de dado real",
    ownerField: "authorId",
    orderBy: [{ date: "asc" }],
    fields: [
      { name: "date", label: "Data", type: "date", required: true, table: true },
      { name: "channel", label: "Canal", type: "text", required: true, table: true },
      { name: "reach", label: "Alcance", type: "int", table: true },
      { name: "impressions", label: "Impressões", type: "int", table: true },
      { name: "clicks", label: "Cliques", type: "int", table: true },
      { name: "spend", label: "Investimento (R$)", type: "number", table: true },
      { name: "sessions", label: "Sessões", type: "int", table: true },
      { name: "conversions", label: "Conversões", type: "int", table: true },
      { name: "revenue", label: "Receita (R$)", type: "number", table: true },
      { name: "source", label: "Fonte do dado", type: "text", required: true, table: true, hint: "Ex.: Gerenciador de Anúncios, export de DD/MM" },
    ],
  },
  milestone: {
    model: "milestone",
    label: "Marco",
    orderBy: [{ date: "asc" }],
    fields: [
      { name: "title", label: "Título", type: "text", required: true, table: true },
      { name: "date", label: "Data", type: "date", required: true, table: true },
      { name: "kind", label: "Tipo", type: "select", required: true, options: [["LAUNCH", "Lançamento"], ["MONTH1", "Primeiro mês"], ["QUARTER", "Trimestre"], ["SEMESTER", "Semestre"], ["YEAR", "Ano"], ["CUSTOM", "Outro"]], table: true },
      { name: "description", label: "Descrição", type: "textarea", table: true },
    ],
  },
  reference: {
    model: "reference",
    label: "Referência bibliográfica",
    orderBy: [{ abnt: "asc" }],
    fields: [
      { name: "abnt", label: "Referência (formato ABNT)", type: "textarea", required: true, table: true, hint: "Cadastre apenas obras realmente consultadas." },
      { name: "url", label: "URL", type: "url", table: true },
      { name: "accessedAt", label: "Acesso em", type: "date", table: true },
    ],
  },
  highlight: {
    model: "highlight",
    label: "Destaque",
    orderBy: [{ order: "asc" }],
    fields: [
      { name: "title", label: "Título", type: "text", required: true },
      { name: "coverColor", label: "Cor da capa (#hex)", type: "text" },
      { name: "coverFileId", label: "Imagem de capa (id)", type: "text" },
      { name: "order", label: "Ordem", type: "int" },
    ],
  },
} satisfies Record<string, EntityDef>;

export type EntityKey = keyof typeof ENTITIES;

export function schemaFor(def: EntityDef) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of def.fields) {
    let s: z.ZodTypeAny;
    switch (f.type) {
      case "number":
        s = z.coerce.number({ invalid_type_error: `${f.label}: número inválido.` }).finite();
        break;
      case "int":
        s = z.coerce.number().int(`${f.label}: use número inteiro.`).min(0, `${f.label} não pode ser negativo.`);
        break;
      case "date":
        s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${f.label}: data inválida.`).transform((v) => new Date(v));
        break;
      case "bool":
        s = z.boolean();
        break;
      case "select":
        s = z.enum(f.options!.map((o) => o[0]) as [string, ...string[]], { message: `${f.label}: opção inválida.` });
        break;
      case "url":
        s = z.string().trim().url(`${f.label}: URL inválida.`).max(500);
        break;
      default:
        s = z.string().trim().max(f.type === "textarea" ? 8000 : 500);
    }
    if (f.required) {
      if (f.type === "text" || f.type === "textarea") s = (s as z.ZodString).min(1, `${f.label} é obrigatório.`);
      shape[f.name] = s;
    } else {
      // vazio → null
      shape[f.name] = z.preprocess((v) => (v === "" || v === undefined ? null : v), s.nullable());
    }
  }
  return z.object(shape);
}

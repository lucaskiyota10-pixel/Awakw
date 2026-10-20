export const brl = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const num = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const signedPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${pct(v)}`);
export const signedNum = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${num(v, d)}`);

export const dateBr = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
export const dateTimeBr = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—";

export const isoDay = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/** Glossário educativo para tooltips. */
export const GLOSSARY: Record<string, string> = {
  CTR: "Click-Through Rate: cliques ÷ impressões. Mede quanto o anúncio atrai cliques.",
  CPC: "Custo por clique: investimento ÷ cliques. Derivado de CPM e CTR (CPC = CPM ÷ (1000 × CTR)).",
  CPM: "Custo por mil impressões: investimento ÷ impressões × 1000.",
  CPA: "Custo por aquisição: investimento ÷ compras. Aqui é 'combinado' quando inclui vendas orgânicas.",
  ROAS: "Return on Ad Spend: receita ÷ investimento em mídia. ROAS 3 = R$ 3 de receita por R$ 1 investido.",
  Frequência: "Média de vezes que cada pessoa viu o anúncio. Alcance = impressões ÷ frequência.",
  Alcance: "Pessoas únicas impactadas. Só é calculado com premissa de frequência ou tamanho de público.",
  Engajamento: "Interações (curtidas, comentários, salvamentos, compartilhamentos) ÷ alcance/impressões.",
  Sessões: "Visitas ao site. Exige premissa de taxa de chegada (nem todo clique vira sessão).",
};

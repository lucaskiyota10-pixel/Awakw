export interface UtmParams {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

/** Normaliza valores de UTM: minúsculas, sem acentos, espaços → "_". */
export function normalizeUtmValue(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function buildUtmUrl(p: UtmParams, normalize = true): { ok: true; url: string } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(p.baseUrl.trim());
  } catch {
    return { ok: false, error: "URL base inválida. Inclua https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "Use uma URL http(s)." };
  const req: [string, string][] = [
    ["utm_source", p.source],
    ["utm_medium", p.medium],
    ["utm_campaign", p.campaign],
  ];
  for (const [k, v] of req) if (!v?.trim()) return { ok: false, error: `${k} é obrigatório.` };
  const all: [string, string | undefined][] = [...req, ["utm_content", p.content], ["utm_term", p.term]];
  for (const [k, v] of all) {
    url.searchParams.delete(k);
    if (v && v.trim()) url.searchParams.set(k, normalize ? normalizeUtmValue(v) : v.trim());
  }
  return { ok: true, url: url.toString() };
}

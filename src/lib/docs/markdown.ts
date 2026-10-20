/**
 * Subconjunto de Markdown usado nos documentos colaborativos.
 *   # / ## / ###      títulos (seções numeradas no ABNT)
 *   - item / 1. item  listas
 *   | a | b |         tabelas (2ª linha |---|)
 *   ![legenda](file:ID)      imagem enviada ao projeto
 *   ![legenda](chart:CHAVE)  gráfico gerado a partir dos dados do projeto
 *   **negrito**, *itálico*
 *   [[quebra]]        quebra de página
 *   > texto           nota/citação
 */

export type Inline = { text: string; bold?: boolean; italic?: boolean };
export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; runs: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "image"; fileId: string; caption: string }
  | { type: "chart"; key: string; caption: string }
  | { type: "quote"; runs: Inline[] }
  | { type: "pagebreak" };

export const PENDING = "Pendente de preenchimento/validação";

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) out.push({ text: m[2], bold: true });
    else out.push({ text: m[3], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text: "" }];
}

const splitRow = (l: string) =>
  l
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim().replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|\s)\*([^*]+)\*/g, "$1$2"));

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: "paragraph", runs: parseInline(para.join(" ").trim()) });
      para = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    if (t === "[[quebra]]") {
      flush();
      blocks.push({ type: "pagebreak" });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      flush();
      blocks.push({ type: "heading", level: h[1].length as 1 | 2 | 3, text: h[2].trim() });
      continue;
    }
    const img = /^!\[([^\]]*)\]\((file|chart):([\w-]+)\)$/.exec(t);
    if (img) {
      flush();
      blocks.push(img[2] === "file" ? { type: "image", fileId: img[3], caption: img[1] } : { type: "chart", key: img[3], caption: img[1] });
      continue;
    }
    if (t.startsWith("|") && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      flush();
      const header = splitRow(t);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = splitRow(lines[i]);
        rows.push(header.map((_, j) => r[j] ?? ""));
        i++;
      }
      i--;
      blocks.push({ type: "table", header, rows });
      continue;
    }
    const li = /^([-*]|\d+[.)])\s+(.*)$/.exec(t);
    if (li) {
      flush();
      const ordered = /\d/.test(li[1]);
      const items: Inline[][] = [parseInline(li[2])];
      while (i + 1 < lines.length) {
        const n = /^([-*]|\d+[.)])\s+(.*)$/.exec(lines[i + 1].trim());
        if (!n || /\d/.test(n[1]) !== ordered) break;
        items.push(parseInline(n[2]));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    if (t.startsWith(">")) {
      flush();
      blocks.push({ type: "quote", runs: parseInline(t.replace(/^>\s?/, "")) });
      continue;
    }
    para.push(t);
  }
  flush();
  return blocks;
}

/** Numeração progressiva de seções (ABNT NBR 6024): 1, 1.1, 1.1.1. Seções sem número: REFERÊNCIAS, ANEXOS, APÊNDICES. */
export function numberHeadings(blocks: Block[]): (Block & { number?: string })[] {
  const c = [0, 0, 0];
  return blocks.map((b) => {
    if (b.type !== "heading") return b;
    if (/^(refer[eê]ncias|anexos?|ap[eê]ndices?|gloss[aá]rio)$/i.test(b.text.trim())) return b;
    c[b.level - 1]++;
    for (let k = b.level; k < 3; k++) c[k] = 0;
    return { ...b, number: c.slice(0, b.level).join(".") };
  });
}

export const plain = (runs: Inline[]) => runs.map((r) => r.text).join("");

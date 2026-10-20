import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { numberHeadings, parseMarkdown, type Inline, PENDING } from "./markdown";
import { ac, natureText, type DocMeta } from "./meta";
import type { ResolvedAssets } from "./docx";
import { SIM_DISCLAIMER } from "../sim/origin";

const MM = 72 / 25.4;
const W = 210 * MM;
const H = 297 * MM;
const ML = 30 * MM;
const MR = 20 * MM;
const MT = 30 * MM;
const MB = 20 * MM;
const CW = W - ML - MR;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);
const TAUPE = rgb(182 / 255, 161 / 255, 139 / 255);
const CARVAO = rgb(37 / 255, 37 / 255, 33 / 255);

type Fonts = { r: PDFFont; b: PDFFont; i: PDFFont; bi: PDFFont };

/** Substitui caracteres fora do WinAnsi (fontes padrão do PDF). */
export function makeSanitizer(font: PDFFont) {
  const cache = new Map<string, boolean>();
  const map: Record<string, string> = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "×": "x", "Δ": "Delta ", "✓": "OK", "✗": "X", "⚠": "!", "…": "...", " ": " ", "−": "-", "≈": "~" };
  return (s: string) =>
    [...s]
      .map((ch) => {
        if (map[ch]) return map[ch];
        if (ch === "\n") return ch;
        if (!cache.has(ch)) {
          try {
            font.encodeText(ch);
            cache.set(ch, true);
          } catch {
            cache.set(ch, false);
          }
        }
        return cache.get(ch) ? ch : "?";
      })
      .join("");
}

class Writer {
  page!: PDFPage;
  y = 0;
  bodyStart = -1;
  constructor(public pdf: PDFDocument, public f: Fonts, public clean: (s: string) => string) {}
  newPage() {
    this.page = this.pdf.addPage([W, H]);
    this.y = H - MT;
  }
  ensure(h: number) {
    if (this.y - h < MB + 14) this.newPage();
  }
  font(r: Inline) {
    return r.bold && r.italic ? this.f.bi : r.bold ? this.f.b : r.italic ? this.f.i : this.f.r;
  }
  /** Quebra e desenha runs; justify = alinhamento justificado (exceto última linha). */
  text(runs: Inline[], o: { size?: number; indent?: number; firstLine?: number; justify?: boolean; align?: "left" | "center" | "right"; lineHeight?: number; color?: ReturnType<typeof rgb>; width?: number } = {}) {
    const size = o.size ?? 12;
    const lh = (o.lineHeight ?? 1.5) * size;
    const left = ML + (o.indent ?? 0);
    const width = o.width ?? CW - (o.indent ?? 0);
    const words: { t: string; font: PDFFont; hl: boolean }[] = [];
    for (const r of runs)
      for (const t of this.clean(r.text).split(/(\s+)/).filter((x) => x && !/^\s+$/.test(x)))
        words.push({ t, font: this.font(r), hl: r.text.includes(PENDING) });
    const space = this.f.r.widthOfTextAtSize(" ", size);
    let i = 0;
    let first = true;
    while (i < words.length) {
      const avail = width - (first ? (o.firstLine ?? 0) : 0);
      const line: typeof words = [];
      let w = 0;
      while (i < words.length) {
        const ww = words[i].font.widthOfTextAtSize(words[i].t, size);
        if (line.length && w + space + ww > avail) break;
        w += (line.length ? space : 0) + ww;
        line.push(words[i++]);
      }
      this.ensure(lh);
      const last = i >= words.length;
      let x = left + (first ? (o.firstLine ?? 0) : 0);
      if (o.align === "center") x = left + (width - w) / 2;
      if (o.align === "right") x = left + width - w;
      const gap = o.justify && !last && line.length > 1 ? space + (avail - w) / (line.length - 1) : space;
      for (const wd of line) {
        const ww = wd.font.widthOfTextAtSize(wd.t, size);
        if (wd.hl) this.page.drawRectangle({ x: x - 1, y: this.y - lh + size * 0.15 + (lh - size) / 2 - 1, width: ww + 2, height: size + 2, color: rgb(1, 0.95, 0.6) });
        this.page.drawText(wd.t, { x, y: this.y - size - (lh - size) / 2, size, font: wd.font, color: o.color ?? INK });
        x += ww + gap;
      }
      this.y -= lh;
      first = false;
    }
    if (!words.length) this.y -= lh;
  }
  gap(h: number) {
    this.y -= h;
  }
}

const fmtVal = (v: number, f: "brl" | "num") => (f === "brl" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

function drawTable(w: Writer, header: string[], rows: string[][], size = 9) {
  const n = header.length;
  const colW = CW / n;
  const pad = 3;
  const lines = (t: string, font: PDFFont) => {
    const out: string[] = [];
    let cur = "";
    for (const word of w.clean(t).split(/\s+/).filter(Boolean)) {
      const test = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > colW - 2 * pad && cur) {
        out.push(cur);
        cur = word;
      } else cur = test;
    }
    out.push(cur);
    // corta palavras muito longas
    return out.map((l) => {
      let s = l;
      while (s.length > 1 && font.widthOfTextAtSize(s, size) > colW - 2 * pad) s = s.slice(0, -2) + ".";
      return s;
    });
  };
  const drawRow = (cells: string[], bold: boolean) => {
    const font = bold ? w.f.b : w.f.r;
    const ls = cells.map((c) => lines(c, font));
    const h = Math.max(...ls.map((l) => l.length)) * size * 1.25 + 2 * pad;
    return { ls, h, font };
  };
  const head = drawRow(header, true);
  const paint = (r: ReturnType<typeof drawRow>, bold: boolean) => {
    r.ls.forEach((l, j) => l.forEach((t, k) => w.page.drawText(t, { x: ML + j * colW + pad, y: w.y - pad - size - k * size * 1.25, size, font: r.font, color: INK })));
    w.y -= r.h;
    w.page.drawLine({ start: { x: ML, y: w.y }, end: { x: ML + CW, y: w.y }, thickness: bold ? 0.8 : 0.3, color: bold ? CARVAO : TAUPE });
  };
  w.ensure(head.h * 2);
  w.page.drawLine({ start: { x: ML, y: w.y }, end: { x: ML + CW, y: w.y }, thickness: 0.8, color: CARVAO });
  paint(head, true);
  for (const r of rows) {
    const row = drawRow(r, false);
    if (w.y - row.h < MB + 14) {
      w.newPage();
      w.page.drawLine({ start: { x: ML, y: w.y }, end: { x: ML + CW, y: w.y }, thickness: 0.8, color: CARVAO });
      paint(head, true);
    }
    paint(row, false);
  }
  w.page.drawLine({ start: { x: ML, y: w.y }, end: { x: ML + CW, y: w.y }, thickness: 0.8, color: CARVAO });
}

function drawBarChart(w: Writer, labels: string[], values: number[], format: "brl" | "num") {
  const h = 170;
  w.ensure(h + 30);
  const top = w.y;
  const base = top - h;
  const max = Math.max(...values, 1);
  for (let g = 0; g <= 4; g++) {
    const y = base + ((h - 20) * g) / 4;
    w.page.drawLine({ start: { x: ML + 40, y }, end: { x: ML + CW, y }, thickness: 0.3, color: rgb(0.91, 0.89, 0.85) });
    w.page.drawText(w.clean(fmtVal((max * g) / 4, format)), { x: ML, y: y - 3, size: 6, font: w.f.r, color: MUTED });
  }
  const slot = (CW - 45) / Math.max(values.length, 1);
  const bw = Math.max(2, slot * 0.65);
  values.forEach((v, i) => {
    const bh = ((h - 20) * Math.max(0, v)) / max;
    const x = ML + 45 + i * slot + (slot - bw) / 2;
    w.page.drawRectangle({ x, y: base, width: bw, height: bh, color: CARVAO });
    const lab = w.clean(labels[i]).replace(/^(Semana|Mês|Trimestre|Semestre|Ano) /, (m) => m[0]);
    const size = 6;
    const tw = w.f.r.widthOfTextAtSize(lab, size);
    if (tw < slot + 6 || values.length <= 12) w.page.drawText(lab.length > 18 ? lab.slice(0, 17) + "." : lab, { x: x + bw / 2 - Math.min(tw, slot) / 2, y: base - 9, size, font: w.f.r, color: MUTED });
  });
  w.y = base - 16;
}

export async function renderPdf(markdown: string, meta: DocMeta, assets: ResolvedAssets): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.title);
  pdf.setCreator("Campaign Forge");
  const f: Fonts = {
    r: await pdf.embedFont(StandardFonts.Helvetica),
    b: await pdf.embedFont(StandardFonts.HelveticaBold),
    i: await pdf.embedFont(StandardFonts.HelveticaOblique),
    bi: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const w = new Writer(pdf, f, makeSanitizer(f.r));
  const blocks = numberHeadings(parseMarkdown(markdown));
  const integrantes = (meta.academic.integrantes ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const C = (t: string, o: { bold?: boolean; size?: number } = {}) => w.text([{ text: t, bold: o.bold }], { align: "center", size: o.size ?? 12 });

  // Capa
  w.newPage();
  C(ac(meta, "faculdade").toUpperCase(), { bold: true });
  C(ac(meta, "curso").toUpperCase());
  w.gap(40);
  (integrantes.length ? integrantes : ["[Integrantes — pendente de preenchimento/validação]"]).forEach((n) => C(n.toUpperCase()));
  w.y = H / 2 + 30;
  C(meta.title.toUpperCase(), { bold: true });
  if (meta.subtitle) C(meta.subtitle);
  if (!meta.officialNameConfirmed) {
    w.gap(10);
    w.text([{ text: `Cliente: ${meta.projectName} (nome oficial pendente de confirmação)` }], { align: "center", size: 9, color: MUTED });
  }
  w.y = MB + 60;
  C(ac(meta, "cidade"));
  C(ac(meta, "ano"));

  // Folha de rosto
  w.newPage();
  (integrantes.length ? integrantes : ["[Integrantes]"]).forEach((n) => C(n.toUpperCase()));
  w.y = H / 2 + 80;
  C(meta.title.toUpperCase(), { bold: true });
  if (meta.subtitle) C(meta.subtitle);
  w.gap(40);
  w.text([{ text: natureText(meta) }], { indent: 80 * MM, size: 10, lineHeight: 1.2, justify: true });
  w.y = MB + 60;
  C(ac(meta, "cidade"));
  C(ac(meta, "ano"));

  // Sumário: reserva páginas e preenche depois
  const headings = blocks.filter((b) => b.type === "heading") as { type: "heading"; level: number; text: string; number?: string }[];
  const tocLines = headings.length + (meta.references.length ? 1 : 0);
  const perPage = Math.floor((H - MT - MB - 40) / 18);
  const tocPages = Math.max(1, Math.ceil(tocLines / perPage));
  const tocStart = pdf.getPageCount();
  for (let i = 0; i < tocPages; i++) pdf.addPage([W, H]);

  // Corpo
  const headingPages: number[] = [];
  const imgCache = new Map<string, PDFImage | null>();
  let fig = 0;
  w.newPage();
  w.bodyStart = pdf.getPageCount() - 1;
  let firstHeading = true;
  for (const b of blocks) {
    switch (b.type) {
      case "heading": {
        if (b.level === 1 && !firstHeading) w.newPage();
        else w.ensure(60);
        firstHeading = false;
        headingPages.push(pdf.getPageCount() - 1);
        const label = `${"number" in b && b.number ? `${b.number} ` : ""}${b.level === 1 ? b.text.toUpperCase() : b.text}`;
        if (b.level > 1) w.gap(8);
        w.text([{ text: label, bold: b.level < 3, italic: b.level === 3 }], { size: 12 });
        w.gap(6);
        break;
      }
      case "paragraph":
        w.text(b.runs, { justify: true, firstLine: 12.5 * MM });
        w.gap(3);
        break;
      case "quote":
        w.text(b.runs, { indent: 40 * MM, size: 10, lineHeight: 1.15, justify: true });
        w.gap(8);
        break;
      case "list":
        b.items.forEach((it, i) => {
          const bullet = b.ordered ? `${i + 1}.` : "•";
          w.ensure(18);
          w.page.drawText(bullet, { x: ML + 10, y: w.y - 12 - 3, size: 12, font: f.r, color: INK });
          w.text(it, { indent: 26 });
        });
        w.gap(4);
        break;
      case "table":
        drawTable(w, b.header, b.rows);
        w.text([{ text: "Fonte: elaborado pela equipe a partir dos dados do projeto." }], { size: 9, lineHeight: 1.2 });
        w.gap(10);
        break;
      case "image": {
        fig++;
        const a = assets.images.get(b.fileId);
        let img: PDFImage | null = imgCache.get(b.fileId) ?? null;
        if (!imgCache.has(b.fileId) && a) {
          try {
            img = a.type === "png" ? await pdf.embedPng(a.data) : a.type === "jpg" ? await pdf.embedJpg(a.data) : null;
          } catch {
            img = null;
          }
          imgCache.set(b.fileId, img);
        }
        w.text([{ text: `Figura ${fig} – ${b.caption}` }], { align: "center", size: 10, lineHeight: 1.2 });
        if (img) {
          const iw = Math.min(CW * 0.8, img.width);
          const ih = (img.height / img.width) * iw;
          const fit = Math.min(1, (H - MT - MB - 60) / ih);
          w.ensure(ih * fit + 10);
          w.page.drawImage(img, { x: ML + (CW - iw * fit) / 2, y: w.y - ih * fit, width: iw * fit, height: ih * fit });
          w.y -= ih * fit + 4;
          w.text([{ text: "Fonte: acervo da equipe." }], { size: 9, lineHeight: 1.2 });
        } else w.text([{ text: "[imagem indisponível neste formato]" }], { size: 9, color: MUTED });
        w.gap(8);
        break;
      }
      case "chart": {
        fig++;
        const ch = assets.charts.get(b.key);
        w.text([{ text: `Gráfico ${fig} – ${b.caption || ch?.title || b.key}` }], { align: "center", size: 10, lineHeight: 1.2 });
        if (ch && ch.values.length) {
          drawBarChart(w, ch.labels, ch.values, ch.format);
          drawTable(w, ["Período/item", "Valor"], ch.labels.map((l, i) => [l, fmtVal(ch.values[i], ch.format)]));
          w.text([{ text: ch.simulated ? "Fonte: simulação acadêmica da equipe — resultados hipotéticos, não garantidos." : "Fonte: planejamento da equipe." }], { size: 9, lineHeight: 1.2 });
        } else w.text([{ text: "[Dados do gráfico indisponíveis — pendente de preenchimento/validação]" }], { size: 9, color: MUTED });
        w.gap(10);
        break;
      }
      case "pagebreak":
        w.newPage();
        break;
    }
  }
  let refPage = -1;
  if (meta.references.length) {
    w.newPage();
    refPage = pdf.getPageCount() - 1;
    C("REFERÊNCIAS", { bold: true });
    w.gap(10);
    [...meta.references].sort((a, b) => a.localeCompare(b, "pt-BR")).forEach((r) => {
      w.text([{ text: r }], { lineHeight: 1.0 });
      w.gap(12);
    });
  }

  // Sumário com páginas reais (numeração ABNT: conta a partir da folha de rosto)
  const pages = pdf.getPages();
  const tw = new Writer(pdf, f, w.clean);
  let tp = tocStart;
  tw.page = pages[tp];
  tw.y = H - MT;
  tw.text([{ text: "SUMÁRIO", bold: true }], { align: "center" });
  tw.gap(10);
  const entries = headings.map((h, i) => ({ label: `${h.number ? `${h.number} ` : ""}${h.level === 1 ? h.text.toUpperCase() : h.text}`, level: h.level, page: headingPages[i] }));
  if (refPage >= 0) entries.push({ label: "REFERÊNCIAS", level: 1, page: refPage });
  for (const e of entries) {
    if (tw.y < MB + 20) {
      tp++;
      tw.page = pages[tp];
      tw.y = H - MT;
    }
    const font = e.level === 1 ? f.b : e.level === 3 ? f.i : f.r;
    const label = w.clean(e.label);
    const num = String(e.page);
    const x0 = ML + (e.level - 1) * 12;
    let lab = label;
    while (font.widthOfTextAtSize(lab, 11) > CW - 60 - (x0 - ML) && lab.length > 4) lab = lab.slice(0, -4) + "...";
    tw.page.drawText(lab, { x: x0, y: tw.y - 11, size: 11, font, color: INK });
    const lw = font.widthOfTextAtSize(lab, 11);
    const nw = f.r.widthOfTextAtSize(num, 11);
    const dots = Math.max(0, Math.floor((ML + CW - nw - 4 - (x0 + lw + 4)) / f.r.widthOfTextAtSize(".", 11)));
    tw.page.drawText(".".repeat(dots), { x: x0 + lw + 4, y: tw.y - 11, size: 11, font: f.r, color: MUTED });
    tw.page.drawText(num, { x: ML + CW - nw, y: tw.y - 11, size: 11, font: f.r, color: INK });
    tw.y -= 18;
  }

  // Numeração no canto superior direito (a partir do corpo) e aviso de simulação no rodapé
  pages.forEach((pg, idx) => {
    if (idx < w.bodyStart) return;
    const n = String(idx);
    pg.drawText(n, { x: W - MR - f.r.widthOfTextAtSize(n, 10), y: H - 20 * MM, size: 10, font: f.r, color: INK });
    const foot = w.clean(`${SIM_DISCLAIMER} · ${meta.versionLabel}`);
    const fs = 6.5;
    pg.drawText(foot, { x: ML + (CW - f.r.widthOfTextAtSize(foot, fs)) / 2, y: MB / 2, size: fs, font: f.r, color: MUTED });
  });
  return Buffer.from(await pdf.save());
}

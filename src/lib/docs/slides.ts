import PptxGenJS from "pptxgenjs";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { PresentationData } from "../server/presentation";
import { SIM_DISCLAIMER } from "../sim/origin";
import { makeSanitizer } from "./pdf";

const hex = (h: string) => h.replace("#", "").toUpperCase();
const fmt = (v: number, f: "brl" | "num") => (f === "brl" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));

/** PPTX editável (textos, tabelas e gráficos nativos do PowerPoint). */
export async function renderPptx(data: PresentationData): Promise<Buffer> {
  const c = data.brand.colors;
  const accent = data.brand.roseOption ? data.brand.roseColor : c.taupe;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = data.projectName;
  const serif = data.brand.fontSerif;
  const sans = data.brand.fontSans;
  const total = data.slides.length;
  data.slides.forEach((s, idx) => {
    const sl = pptx.addSlide();
    sl.background = { color: hex(s.kind === "cover" ? c.carvao : c.marfim) };
    const ink = hex(s.kind === "cover" ? c.marfim : c.carvao);
    sl.addText(`${idx + 1}/${total}`, { x: 12.3, y: 7.05, w: 0.9, h: 0.3, fontSize: 9, color: hex(accent), align: "right", fontFace: sans });
    if ("sim" in s && s.sim) sl.addText(SIM_DISCLAIMER, { x: 0.5, y: 7.05, w: 11.5, h: 0.3, fontSize: 9, bold: true, color: hex(c.carvao), fill: { color: hex(c.areia) }, fontFace: sans });
    if (s.kind === "cover") {
      sl.addText("CAMPAIGN LAB", { x: 0.8, y: 1.2, w: 11, h: 0.4, fontSize: 12, color: hex(accent), charSpacing: 6, fontFace: sans });
      sl.addText(s.title, { x: 0.8, y: 1.8, w: 11.5, h: 1.6, fontSize: 54, color: ink, fontFace: serif });
      sl.addText(s.subtitle, { x: 0.8, y: 3.5, w: 11.5, h: 0.7, fontSize: 24, color: hex(accent), fontFace: serif });
      sl.addText(s.lines.join("\n"), { x: 0.8, y: 4.6, w: 11.5, h: 2, fontSize: 14, color: ink, fontFace: sans, valign: "top" });
      return;
    }
    sl.addText(s.title, { x: 0.5, y: 0.35, w: 12.3, h: 0.8, fontSize: 34, color: ink, fontFace: serif });
    sl.addShape(pptx.ShapeType.line, { x: 0.5, y: 1.15, w: 1.2, h: 0, line: { color: hex(accent), width: 2 } });
    switch (s.kind) {
      case "bullets":
        sl.addTable(
          s.bullets.map(([k, v]) => [
            { text: k, options: { bold: true, color: hex(accent), fontSize: 14, fontFace: sans } },
            { text: v, options: { fontSize: 14, color: ink, fontFace: sans } },
          ]),
          { x: 0.5, y: 1.5, w: 12.3, colW: [2.6, 9.7], border: { type: "none" }, valign: "top" },
        );
        break;
      case "swot":
        s.quadrants.forEach((q, i) => {
          const x = 0.5 + (i % 2) * 6.2;
          const y = 1.45 + Math.floor(i / 2) * 2.8;
          sl.addShape(pptx.ShapeType.rect, { x, y, w: 6, h: 2.65, fill: { color: "FFFFFF" }, line: { color: hex(c.areia) } });
          sl.addText(q.label, { x: x + 0.2, y: y + 0.1, w: 5.6, h: 0.45, fontSize: 18, color: hex(accent), fontFace: serif, bold: true });
          sl.addText(q.items.length ? q.items.map((t) => ({ text: t, options: { bullet: true } })) : [{ text: "Pendente de preenchimento/validação" }], { x: x + 0.2, y: y + 0.6, w: 5.6, h: 1.95, fontSize: 12, color: ink, fontFace: sans, valign: "top" });
        });
        break;
      case "table":
        sl.addTable(
          [s.header.map((h) => ({ text: h, options: { bold: true, color: hex(c.marfim), fill: { color: hex(c.carvao) } } })), ...(s.rows.length ? s.rows : [s.header.map(() => "—")]).map((r) => r.map((x) => ({ text: x })))],
          { x: 0.5, y: 1.5, w: 12.3, fontSize: 11, fontFace: sans, color: ink, border: { type: "solid", color: hex(c.areia), pt: 0.5 }, autoPage: false },
        );
        if (s.note) sl.addText(s.note, { x: 0.5, y: 6.5, w: 12.3, h: 0.4, fontSize: 11, italic: true, color: ink, fontFace: sans });
        break;
      case "chart":
        sl.addChart(
          pptx.ChartType.bar,
          s.series.map((se) => ({ name: se.name, labels: s.labels, values: se.values })),
          { x: 0.5, y: 1.4, w: 12.3, h: 5.0, chartColors: [hex(c.carvao), hex(accent), hex(c.areia)], showLegend: s.series.length > 1, legendPos: "b", valAxisLabelFormatCode: s.format === "brl" ? '"R$" #,##0' : "#,##0", catAxisLabelFontSize: 10, valAxisLabelFontSize: 10 },
        );
        if (s.note) sl.addText(s.note, { x: 0.5, y: 6.45, w: 12.3, h: 0.5, fontSize: 10, italic: true, color: ink, fontFace: sans });
        break;
      case "instagram":
        sl.addText("Perfil fictício simulado no Instagram Studio. Abra a apresentação na plataforma para ver o perfil e as publicações; números de seguidores, curtidas e visualizações são hipotéticos.", { x: 0.5, y: 1.6, w: 12.3, h: 1.2, fontSize: 16, color: ink, fontFace: sans });
        break;
      case "timeline": {
        const n = Math.max(s.items.length, 1);
        sl.addShape(pptx.ShapeType.line, { x: 0.8, y: 3.6, w: 11.7, h: 0, line: { color: hex(accent), width: 2 } });
        s.items.forEach((it, i) => {
          const x = 0.8 + (11.7 * i) / Math.max(n - 1, 1);
          sl.addShape(pptx.ShapeType.ellipse, { x: x - 0.12, y: 3.48, w: 0.24, h: 0.24, fill: { color: hex(c.carvao) } });
          sl.addText(`${it.title}\n${it.date}`, { x: x - 1.1, y: i % 2 ? 3.9 : 2.3, w: 2.2, h: 1.1, fontSize: 11, align: "center", color: ink, fontFace: sans });
        });
        break;
      }
      case "text":
        sl.addText(s.paragraphs.join("\n\n"), { x: 0.5, y: 1.5, w: 12.3, h: 5.3, fontSize: 16, color: ink, fontFace: sans, valign: "top" });
        break;
    }
  });
  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return Buffer.from(out);
}

/** PDF da apresentação (paisagem 16:9). */
export async function renderSlidesPdf(data: PresentationData): Promise<Buffer> {
  const W = 960;
  const H = 540;
  const pdf = await PDFDocument.create();
  pdf.setTitle(data.projectName);
  const r = await pdf.embedFont(StandardFonts.Helvetica);
  const b = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const clean = makeSanitizer(r);
  const c = data.brand.colors;
  const col = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
  const accent = col(data.brand.roseOption ? data.brand.roseColor : c.taupe);
  const wrap = (t: string, font: PDFFont, size: number, width: number) => {
    const out: string[] = [];
    for (const para of clean(t).split("\n")) {
      let cur = "";
      for (const w of para.split(/\s+/)) {
        const test = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > width && cur) {
          out.push(cur);
          cur = w;
        } else cur = test;
      }
      out.push(cur);
    }
    return out;
  };
  const total = data.slides.length;
  data.slides.forEach((s, idx) => {
    const pg = pdf.addPage([W, H]);
    const dark = s.kind === "cover";
    pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: col(dark ? c.carvao : c.marfim) });
    const ink = col(dark ? c.marfim : c.carvao);
    const text = (t: string, x: number, y: number, size: number, font = r, color = ink, width = W - 80) => {
      let yy = y;
      for (const l of wrap(t, font, size, width)) {
        pg.drawText(l, { x, y: yy, size, font, color });
        yy -= size * 1.3;
      }
      return yy;
    };
    pg.drawText(`${idx + 1}/${total}`, { x: W - 60, y: 16, size: 9, font: r, color: accent });
    if ("sim" in s && s.sim) {
      pg.drawRectangle({ x: 36, y: 10, width: W - 120, height: 18, color: col(c.areia) });
      pg.drawText(clean(SIM_DISCLAIMER), { x: 44, y: 15, size: 8, font: b, color: col(c.carvao) });
    }
    if (s.kind === "cover") {
      pg.drawText("CAMPAIGN LAB", { x: 60, y: 420, size: 11, font: r, color: accent });
      text(s.title, 60, 360, 44, serif);
      text(s.subtitle, 60, 300, 20, serif, accent);
      text(s.lines.join("\n"), 60, 240, 12);
      return;
    }
    text(s.title, 40, H - 60, 28, serif);
    pg.drawLine({ start: { x: 40, y: H - 74 }, end: { x: 120, y: H - 74 }, thickness: 2, color: accent });
    let y = H - 110;
    switch (s.kind) {
      case "bullets":
        for (const [k, v] of s.bullets) {
          pg.drawText(clean(k), { x: 40, y, size: 12, font: b, color: accent });
          y = text(v, 220, y, 12, r, ink, W - 270) - 10;
        }
        break;
      case "swot":
        s.quadrants.forEach((q, i) => {
          const x = 40 + (i % 2) * 445;
          const top = H - 100 - Math.floor(i / 2) * 205;
          pg.drawRectangle({ x, y: top - 195, width: 435, height: 195, color: rgb(1, 1, 1), borderColor: col(c.areia), borderWidth: 1 });
          pg.drawText(q.label, { x: x + 12, y: top - 22, size: 14, font: b, color: accent });
          let yy = top - 42;
          for (const it of (q.items.length ? q.items : ["Pendente de preenchimento/validação"]).slice(0, 7)) yy = text(`• ${it}`, x + 12, yy, 10, r, ink, 410) - 2;
        });
        break;
      case "table": {
        const n = s.header.length;
        const cw = (W - 80) / n;
        const row = (cells: string[], bold: boolean) => {
          const lines = cells.map((x) => wrap(x, bold ? b : r, 9, cw - 8).slice(0, 3));
          const h = Math.max(...lines.map((l) => l.length)) * 12 + 8;
          if (bold) pg.drawRectangle({ x: 40, y: y - h + 4, width: W - 80, height: h, color: col(c.carvao) });
          lines.forEach((ls, j) => ls.forEach((l, k) => pg.drawText(l, { x: 44 + j * cw, y: y - 8 - k * 12, size: 9, font: bold ? b : r, color: bold ? col(c.marfim) : ink })));
          y -= h;
          pg.drawLine({ start: { x: 40, y: y + 4 }, end: { x: W - 40, y: y + 4 }, thickness: 0.4, color: col(c.areia) });
        };
        row(s.header, true);
        for (const rr of s.rows) if (y > 70) row(rr, false);
        if (s.note) text(s.note, 40, 50, 10, r);
        break;
      }
      case "chart": {
        const top = H - 110;
        const base = 90;
        const all = s.series.flatMap((x) => x.values);
        const max = Math.max(...all, 1);
        const slot = (W - 140) / Math.max(s.labels.length, 1);
        const bw = (slot * 0.7) / s.series.length;
        for (let g = 0; g <= 4; g++) {
          const gy = base + ((top - base) * g) / 4;
          pg.drawLine({ start: { x: 100, y: gy }, end: { x: W - 40, y: gy }, thickness: 0.3, color: col(c.areia) });
          pg.drawText(clean(fmt((max * g) / 4, s.format)), { x: 36, y: gy - 3, size: 7, font: r, color: ink });
        }
        const colors = [col(c.carvao), accent, col(c.areia)];
        s.labels.forEach((l, i) => {
          s.series.forEach((se, k) => {
            const h = ((top - base) * Math.max(0, se.values[i])) / max;
            pg.drawRectangle({ x: 100 + i * slot + slot * 0.15 + k * bw, y: base, width: bw - 1, height: h, color: colors[k % 3] });
          });
          pg.drawText(clean(l).slice(0, 14), { x: 100 + i * slot + slot * 0.15, y: base - 12, size: 7, font: r, color: ink });
        });
        s.series.forEach((se, k) => {
          pg.drawRectangle({ x: 100 + k * 220, y: 52, width: 10, height: 10, color: colors[k % 3] });
          pg.drawText(clean(se.name), { x: 114 + k * 220, y: 53, size: 9, font: r, color: ink });
        });
        if (s.note) text(s.note, 40, 36, 8, r);
        break;
      }
      case "instagram":
        text("Perfil fictício simulado no Instagram Studio — números de seguidores, curtidas e visualizações são hipotéticos. Veja o perfil interativo na plataforma.", 40, y, 14);
        break;
      case "timeline": {
        const n = Math.max(s.items.length, 1);
        pg.drawLine({ start: { x: 60, y: 270 }, end: { x: W - 60, y: 270 }, thickness: 2, color: accent });
        s.items.forEach((it, i) => {
          const x = 60 + ((W - 120) * i) / Math.max(n - 1, 1);
          pg.drawCircle({ x, y: 270, size: 6, color: col(c.carvao) });
          const ty = i % 2 ? 240 : 310;
          const t1 = clean(it.title);
          pg.drawText(t1, { x: x - b.widthOfTextAtSize(t1, 10) / 2, y: ty, size: 10, font: b, color: ink });
          pg.drawText(it.date, { x: x - r.widthOfTextAtSize(it.date, 9) / 2, y: ty - 13, size: 9, font: r, color: ink });
        });
        break;
      }
      case "text":
        for (const para of s.paragraphs) y = text(para, 40, y, 13) - 8;
        break;
    }
  });
  return Buffer.from(await pdf.save());
}

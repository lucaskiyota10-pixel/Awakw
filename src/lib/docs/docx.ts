import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
  type ISectionOptions,
} from "docx";
import { numberHeadings, parseMarkdown, type Inline, PENDING } from "./markdown";
import { barChartPng } from "./png";
import { ac, natureText, type DocMeta } from "./meta";
import { SIM_DISCLAIMER } from "../sim/origin";

export interface ResolvedAssets {
  images: Map<string, { data: Buffer; type: "png" | "jpg" | "gif"; width: number; height: number }>;
  charts: Map<string, { title: string; labels: string[]; values: number[]; format: "brl" | "num"; simulated: boolean }>;
}

const FONT = "Arial";
const SIZE = 24; // 12 pt (meio-pontos)

const runsOf = (inl: Inline[], extra: { size?: number } = {}) =>
  inl.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        font: FONT,
        size: extra.size ?? SIZE,
        highlight: r.text.includes(PENDING) ? "yellow" : undefined,
      }),
  );

const centered = (text: string, opts: { bold?: boolean; caps?: boolean; before?: number; after?: number; size?: number } = {}) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 0, line: 360 },
    children: [new TextRun({ text: opts.caps ? text.toUpperCase() : text, bold: opts.bold, font: FONT, size: opts.size ?? SIZE })],
  });

const fmtVal = (v: number, f: "brl" | "num") => (f === "brl" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

function cell(text: string, header = false) {
  return new TableCell({
    children: [new Paragraph({ spacing: { line: 240 }, children: [new TextRun({ text, bold: header, font: FONT, size: 20, highlight: text.includes(PENDING) ? "yellow" : undefined })] })],
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
  });
}

function table(header: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: "252521" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "252521" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "B6A18B" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [new TableRow({ tableHeader: true, children: header.map((h) => cell(h, true)) }), ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) }))],
  });
}

const source = (text: string) =>
  new Paragraph({ spacing: { before: 60, after: 240, line: 240 }, children: [new TextRun({ text, font: FONT, size: 20 })] });

export async function renderDocx(markdown: string, meta: DocMeta, assets: ResolvedAssets): Promise<Buffer> {
  const blocks = numberHeadings(parseMarkdown(markdown));
  const integrantes = (meta.academic.integrantes ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const cidade = ac(meta, "cidade");
  const ano = ac(meta, "ano");

  // ---- Capa ----
  const cover: Paragraph[] = [
    centered(ac(meta, "faculdade"), { bold: true, caps: true }),
    centered(ac(meta, "curso"), { caps: true, after: 600 }),
    ...(integrantes.length ? integrantes : ["[Integrantes — pendente de preenchimento/validação]"]).map((n) => centered(n, { caps: true })),
    centered(meta.title, { bold: true, caps: true, before: 2400 }),
    ...(meta.subtitle ? [centered(meta.subtitle, { after: 0 })] : []),
    ...(!meta.officialNameConfirmed ? [centered(`Cliente: ${meta.projectName} (nome oficial pendente de confirmação)`, { size: 20, before: 240 })] : []),
    centered(cidade, { before: 3600 }),
    centered(ano),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  // ---- Folha de rosto ----
  const rosto: Paragraph[] = [
    ...(integrantes.length ? integrantes : ["[Integrantes]"]).map((n) => centered(n, { caps: true })),
    centered(meta.title, { bold: true, caps: true, before: 2400 }),
    ...(meta.subtitle ? [centered(meta.subtitle)] : []),
    new Paragraph({
      indent: { left: convertMillimetersToTwip(80) },
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 1200, line: 240 },
      children: [new TextRun({ text: natureText(meta), font: FONT, size: 20 })],
    }),
    centered(cidade, { before: 3000 }),
    centered(ano),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  const sumario = [
    centered("SUMÁRIO", { bold: true, after: 240 }),
    new TableOfContents("Sumário", { hyperlink: true, headingStyleRange: "1-3" }),
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "(Se o sumário aparecer vazio, atualize os campos: Word → clique direito → Atualizar campo.)", font: FONT, size: 16, color: "888888" })] }),
  ];

  // ---- Corpo ----
  const body: (Paragraph | Table)[] = [];
  let fig = 0;
  let listInstance = 0;
  for (const b of blocks) {
    switch (b.type) {
      case "heading": {
        const text = `${"number" in b && b.number ? `${b.number} ` : ""}${b.level === 1 ? b.text.toUpperCase() : b.text}`;
        body.push(
          new Paragraph({
            heading: b.level === 1 ? HeadingLevel.HEADING_1 : b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            pageBreakBefore: b.level === 1 && body.length > 0,
            spacing: { before: b.level === 1 ? 0 : 360, after: 240, line: 360 },
            children: [new TextRun({ text, bold: b.level < 3, italics: b.level === 3, font: FONT, size: SIZE })],
          }),
        );
        break;
      }
      case "paragraph":
        body.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: convertMillimetersToTwip(12.5) }, spacing: { line: 360, after: 120 }, children: runsOf(b.runs) }));
        break;
      case "quote":
        body.push(new Paragraph({ indent: { left: convertMillimetersToTwip(40) }, alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: 240 }, children: runsOf(b.runs, { size: 20 }) }));
        break;
      case "list": {
        const instance = ++listInstance; // reinicia a numeração a cada lista
        b.items.forEach((it) =>
          body.push(new Paragraph({ numbering: { reference: b.ordered ? "num" : "bullet", level: 0, instance }, spacing: { line: 360 }, children: runsOf(it) })),
        );
        break;
      }
      case "table":
        body.push(table(b.header, b.rows));
        body.push(source("Fonte: elaborado pela equipe a partir dos dados do projeto."));
        break;
      case "image": {
        const img = assets.images.get(b.fileId);
        fig++;
        if (img) {
          const maxW = 450;
          const w = Math.min(maxW, img.width);
          const h = Math.round((img.height / img.width) * w);
          body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: `Figura ${fig} – ${b.caption}`, font: FONT, size: 20 })] }));
          body.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: img.data, type: img.type, transformation: { width: w, height: h } })] }));
          body.push(source("Fonte: acervo da equipe."));
        } else body.push(source(`[Figura ${fig} – imagem indisponível: ${b.caption}]`));
        break;
      }
      case "chart": {
        const ch = assets.charts.get(b.key);
        fig++;
        const caption = b.caption || ch?.title || b.key;
        body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: `Gráfico ${fig} – ${caption}`, font: FONT, size: 20 })] }));
        if (ch && ch.values.length) {
          body.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: barChartPng(ch.values), type: "png", transformation: { width: 450, height: 202 } })] }));
          body.push(table(["Período/item", "Valor"], ch.labels.map((l, i) => [l, fmtVal(ch.values[i], ch.format)])));
          body.push(source(ch.simulated ? `Fonte: simulação acadêmica da equipe — resultados hipotéticos, não garantidos.` : "Fonte: planejamento da equipe."));
        } else body.push(source("[Dados do gráfico indisponíveis — pendente de preenchimento/validação]"));
        break;
      }
      case "pagebreak":
        body.push(new Paragraph({ children: [new PageBreak()] }));
        break;
    }
  }
  if (meta.references.length) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: "REFERÊNCIAS", bold: true, font: FONT, size: SIZE })] }));
    [...meta.references].sort((a, b) => a.localeCompare(b, "pt-BR")).forEach((r) => body.push(new Paragraph({ spacing: { line: 240, after: 240 }, children: runsOf([{ text: r }]) })));
  }

  const page = { size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) }, margin: { top: convertMillimetersToTwip(30), left: convertMillimetersToTwip(30), bottom: convertMillimetersToTwip(20), right: convertMillimetersToTwip(20) } };
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${SIM_DISCLAIMER} · ${meta.versionLabel}`, font: FONT, size: 14, color: "777777" })] })] });
  const sections: ISectionOptions[] = [
    { properties: { page }, children: [...cover, ...rosto, ...sumario] },
    {
      properties: { page },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) },
      footers: { default: footer },
      children: body,
    },
  ];
  const doc = new Document({
    creator: "Campaign Forge",
    title: meta.title,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: SIZE } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { font: FONT, size: SIZE, bold: true, color: "000000" } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { font: FONT, size: SIZE, bold: true, color: "000000" } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", run: { font: FONT, size: SIZE, italics: true, color: "000000" } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullet", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections,
  });
  return Packer.toBuffer(doc);
}

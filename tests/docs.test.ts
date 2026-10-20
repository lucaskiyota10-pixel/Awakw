import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { parseMarkdown, numberHeadings, PENDING } from "@/lib/docs/markdown";
import { renderDocx } from "@/lib/docs/docx";
import { renderPdf } from "@/lib/docs/pdf";
import { barChartPng } from "@/lib/docs/png";
import type { DocMeta } from "@/lib/docs/meta";

const md = `# Introdução

Texto com **negrito**, *itálico* e acentuação: ação, coração, decoração — R$ 1.000,00 → teste ≥ 2.

**${PENDING}**

## Objetivos
- Vendas
- Reconhecimento

1. Primeiro
2. Segundo

| Campanha | Verba |
| --- | --- |
| Conversão | R$ 6.000 |
| Testes | R$ 1.000 |

![Receita por mês](chart:growth-monthly-revenue)

> Citação longa de exemplo.

[[quebra]]

# Conclusão
Fim.
`;

const meta: DocMeta = {
  projectName: "Awake Home Decor",
  officialNameConfirmed: false,
  title: "Planejamento estratégico",
  academic: { faculdade: "Faculdade Exemplo", curso: "Publicidade e Propaganda", integrantes: "Ana\nBruno", cidade: "São Paulo", ano: "2026" },
  references: ["SOBRENOME, Nome. Título da obra. Cidade: Editora, 2020."],
  versionLabel: "Versão 3 — rascunho",
};
const assets = {
  images: new Map(),
  charts: new Map([["growth-monthly-revenue", { title: "Receita", labels: ["Mês 1", "Mês 2", "Mês 3"], values: [1000, 2500, 1800], format: "brl" as const, simulated: true }]]),
};

describe("markdown", () => {
  it("interpreta blocos", () => {
    const b = parseMarkdown(md);
    expect(b.map((x) => x.type)).toEqual(["heading", "paragraph", "paragraph", "heading", "list", "list", "table", "chart", "quote", "pagebreak", "heading", "paragraph"]);
    const t = b.find((x) => x.type === "table");
    expect(t && t.type === "table" && t.rows.length).toBe(2);
  });
  it("numera seções (ABNT) sem numerar Referências", () => {
    const n = numberHeadings(parseMarkdown("# A\n## B\n## C\n# D\n### E\n# Referências"));
    expect(n.map((x) => ("number" in x ? x.number : undefined))).toEqual(["1", "1.1", "1.2", "2", "2.0.1", undefined]);
  });
});

describe("exportação", () => {
  it("gera DOCX válido com capa, conteúdo, tabela, gráfico e referências", async () => {
    const buf = await renderDocx(md, meta, assets);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("FACULDADE EXEMPLO");
    expect(xml).toContain("1 INTRODUÇÃO");
    expect(xml).toContain("1.1 Objetivos");
    expect(xml).toContain("Conversão");
    expect(xml).toContain("Gráfico 1");
    expect(xml).toContain("REFERÊNCIAS");
    expect(xml).toContain("nome oficial pendente");
    expect(Object.keys(zip.files).some((f) => f.startsWith("word/media/"))).toBe(true);
  });
  it("gera PDF válido com várias páginas e caracteres especiais saneados", async () => {
    const buf = await renderPdf(md, meta, assets);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    const pdf = await PDFDocument.load(buf);
    // capa + rosto + sumário + corpo (2 seções com quebra) + referências
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(6);
  });
  it("PNG de gráfico tem assinatura válida", () => {
    const png = barChartPng([1, 2, 3]);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });
});

describe("células de tabela", () => {
  it("removem marcadores de ênfase", () => {
    const b = parseMarkdown("| A |\n| --- |\n| **Pendente** e *nota* |");
    expect(b[0].type === "table" && b[0].rows[0][0]).toBe("Pendente e nota");
  });
});

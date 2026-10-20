"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { numberHeadings, parseMarkdown, PENDING, type Inline } from "@/lib/docs/markdown";
import { chartDataAction } from "@/app/actions/documents";
import { Chart } from "./charts";
import { brl, num } from "@/lib/format";

type ChartData = { title: string; labels: string[]; values: number[]; format: "brl" | "num"; simulated: boolean };
const cache = new Map<string, Promise<ChartData | null>>();

function useChart(projectId: string, key: string) {
  const [d, setD] = useState<ChartData | null | undefined>(undefined);
  useEffect(() => {
    const k = `${projectId}:${key}`;
    if (!cache.has(k)) cache.set(k, chartDataAction(projectId, key).then((r) => (r.ok ? ((r.data as ChartData) ?? null) : null)));
    cache.get(k)!.then(setD);
  }, [projectId, key]);
  return d;
}

function Runs({ runs }: { runs: Inline[] }) {
  return (
    <>
      {runs.map((r, i) => {
        const cls = r.text.includes(PENDING) ? "bg-yellow-100" : "";
        if (r.bold) return <strong key={i} className={cls}>{r.text}</strong>;
        if (r.italic) return <em key={i} className={cls}>{r.text}</em>;
        return <Fragment key={i}>{r.text}</Fragment>;
      })}
    </>
  );
}

function ChartBlock({ projectId, k, caption, n }: { projectId: string; k: string; caption: string; n: number }) {
  const d = useChart(projectId, k);
  return (
    <figure className="my-4">
      <figcaption className="mb-1 text-center text-sm">Gráfico {n} – {caption || d?.title || k}</figcaption>
      {d === undefined ? <p className="text-center text-xs text-carvao/50">Carregando…</p> : d ? (
        <>
          <Chart data={d.labels.map((l, i) => ({ l, v: d.values[i] }))} x="l" series={[{ key: "v", label: caption || d.title }]} format={(v) => (d.format === "brl" ? brl(v, 0) : num(v))} height={220} />
          <p className="text-xs text-carvao/60">Fonte: {d.simulated ? "simulação acadêmica — resultados hipotéticos." : "planejamento da equipe."}</p>
        </>
      ) : <p className="bg-yellow-100 text-xs">Dados indisponíveis — {PENDING}</p>}
    </figure>
  );
}

/** Pré-visualização fiel ao exportado (mesmo parser do DOCX/PDF). */
export function DocPreview({ projectId, content }: { projectId: string; content: string }) {
  const blocks = useMemo(() => numberHeadings(parseMarkdown(content)), [content]);
  let fig = 0;
  return (
    <article className="mx-auto max-w-[720px] bg-white px-8 py-10 font-sans text-[15px] leading-relaxed text-black shadow-sm">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const label = `${"number" in b && b.number ? `${b.number} ` : ""}${b.level === 1 ? b.text.toUpperCase() : b.text}`;
            return b.level === 1 ? <h2 key={i} className="mb-3 mt-8 font-sans text-base font-bold">{label}</h2> : b.level === 2 ? <h3 key={i} className="mb-2 mt-5 font-sans text-base font-bold">{label}</h3> : <h4 key={i} className="mb-2 mt-4 italic">{label}</h4>;
          }
          case "paragraph":
            return <p key={i} className="mb-2 indent-8 text-justify"><Runs runs={b.runs} /></p>;
          case "quote":
            return <blockquote key={i} className="mb-3 ml-[30%] text-justify text-sm"><Runs runs={b.runs} /></blockquote>;
          case "list": {
            const L = b.ordered ? "ol" : "ul";
            return <L key={i} className={`mb-3 ml-6 ${b.ordered ? "list-decimal" : "list-disc"}`}>{b.items.map((it, j) => <li key={j}><Runs runs={it} /></li>)}</L>;
          }
          case "table":
            return (
              <div key={i} className="my-3 overflow-x-auto">
                <table className="w-full border-y-2 border-black text-left text-xs">
                  <thead><tr>{b.header.map((h, j) => <th key={j} className="border-b border-black px-2 py-1">{h}</th>)}</tr></thead>
                  <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className={`border-b border-neutral-300 px-2 py-1 ${c.includes(PENDING) ? "bg-yellow-100" : ""}`}>{c}</td>)}</tr>)}</tbody>
                </table>
                <p className="mt-1 text-xs">Fonte: elaborado pela equipe a partir dos dados do projeto.</p>
              </div>
            );
          case "image":
            fig++;
            return (
              <figure key={i} className="my-4 text-center">
                <figcaption className="mb-1 text-sm">Figura {fig} – {b.caption}</figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${b.fileId}`} alt={b.caption} className="mx-auto max-h-80" />
              </figure>
            );
          case "chart":
            fig++;
            return <ChartBlock key={i} projectId={projectId} k={b.key} caption={b.caption} n={fig} />;
          case "pagebreak":
            return <hr key={i} className="my-6 border-dashed border-neutral-400" title="Quebra de página" />;
        }
      })}
    </article>
  );
}

"use client";

import { APP_NAME } from "@/lib/app";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Chart } from "./charts";
import { PhoneProfile } from "./instagram/PhoneProfile";
import type { Slide } from "@/lib/server/presentation";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "./instagram/types";
import { brl, num } from "@/lib/format";
import { SIM_DISCLAIMER } from "@/lib/sim/origin";
import { PENDING } from "@/lib/docs/markdown";

export function SlideView({ s, creative }: { s: Slide; creative: { profile: IgProfile; highlights: IgHighlight[]; pubs: IgPub[]; files: MediaFile[] } }) {
  const files = useMemo(() => new Map(creative.files.map((f) => [f.id, f])), [creative.files]);
  const mark = (t: string) => (t.includes(PENDING) ? <span className="bg-yellow-100 text-carvao">{t}</span> : t);
  if (s.kind === "cover")
    return (
      <div className="flex h-full flex-col justify-center bg-carvao px-[8%] text-marfim">
        <p className="text-sm uppercase tracking-[0.4em] text-taupe">{APP_NAME}</p>
        <h1 className="mt-4 font-serif text-5xl sm:text-7xl">{s.title}</h1>
        <p className="mt-3 font-serif text-2xl text-taupe sm:text-3xl">{s.subtitle}</p>
        <div className="mt-10 space-y-1 text-sm opacity-80">{s.lines.map((l) => <p key={l}>{l}</p>)}</div>
      </div>
    );
  return (
    <div className="flex h-full flex-col bg-marfim px-[5%] py-[3%] text-carvao">
      <h2 className="font-serif text-4xl">{s.title}</h2>
      <div className="mb-6 mt-2 h-0.5 w-24 bg-destaque" />
      <div className="min-h-0 flex-1 overflow-auto">
        {s.kind === "bullets" && (
          <dl className="grid grid-cols-[180px_1fr] gap-x-6 gap-y-4 text-lg">
            {s.bullets.map(([k, v]) => <Fragment key={k}><dt className="font-medium text-taupe">{k}</dt><dd>{mark(v)}</dd></Fragment>)}
          </dl>
        )}
        {s.kind === "swot" && (
          <div className="grid h-full grid-cols-2 gap-4">
            {s.quadrants.map((q) => (
              <section key={q.label} className="rounded-xl border border-areia bg-white p-4">
                <h3 className="font-serif text-2xl text-taupe">{q.label}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">{q.items.length ? q.items.map((i) => <li key={i}>{i}</li>) : <li className="bg-yellow-100">{PENDING}</li>}</ul>
              </section>
            ))}
          </div>
        )}
        {s.kind === "table" && (
          <>
            <table className="w-full text-left">
              <thead><tr>{s.header.map((h) => <th key={h} className="bg-carvao px-3 py-2 text-sm font-medium text-marfim">{h}</th>)}</tr></thead>
              <tbody>{s.rows.map((r, i) => <tr key={i} className="border-b border-areia">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}</tbody>
            </table>
            {s.note && <p className="mt-4 italic">{mark(s.note)}</p>}
          </>
        )}
        {s.kind === "chart" && (
          <>
            <Chart data={s.labels.map((l, i) => Object.fromEntries([["l", l], ...s.series.map((se, k) => [`s${k}`, se.values[i]])]))} x="l" series={s.series.map((se, k) => ({ key: `s${k}`, label: se.name }))} format={(v) => (s.format === "brl" ? brl(v, 0) : num(v))} height={360} />
            {s.note && <p className="mt-2 text-sm italic">{s.note}</p>}
          </>
        )}
        {s.kind === "instagram" && (
          <div className="flex items-start justify-center gap-10">
            <div className="origin-top scale-[0.8]"><PhoneProfile profile={creative.profile} highlights={creative.highlights} pubs={creative.pubs} files={files} /></div>
            <p className="max-w-sm text-lg">Perfil fictício para demonstração do posicionamento visual e do feed planejado. Seguidores, curtidas e visualizações são hipotéticos.</p>
          </div>
        )}
        {s.kind === "timeline" && (
          <div className="relative mx-6 mt-28 h-1 bg-destaque">
            {s.items.map((it, i) => (
              <div key={i} className="absolute -top-2 -translate-x-1/2 text-center" style={{ left: `${(i / Math.max(s.items.length - 1, 1)) * 100}%` }}>
                <span className="mx-auto block h-5 w-5 rounded-full bg-carvao" />
                <div className={`absolute left-1/2 w-40 -translate-x-1/2 ${i % 2 ? "top-8" : "-top-20"}`}><p className="font-medium">{it.title}</p><p className="text-sm text-carvao/70">{it.date}</p></div>
              </div>
            ))}
          </div>
        )}
        {s.kind === "text" && <div className="max-w-4xl space-y-4 text-xl leading-relaxed">{s.paragraphs.map((p, i) => <p key={i}>{mark(p)}</p>)}</div>}
      </div>
      {"sim" in s && s.sim && <p className="sim-banner mt-4">{SIM_DISCLAIMER}</p>}
    </div>
  );
}

/** Deck em tela cheia: setas/espaço navegam, F alterna tela cheia, Esc sai. Sem controles administrativos. */
export function SlideDeck({ slides, creative, backHref, exportBase }: { slides: Slide[]; creative: Parameters<typeof SlideView>[0]["creative"]; backHref: string; exportBase: string }) {
  const [i, setI] = useState(0);
  const [chrome, setChrome] = useState(true);
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(slides.length - 1, x + d))), [slides.length]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) go(-1);
      if (e.key === "Home") setI(0);
      if (e.key === "End") setI(slides.length - 1);
      if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go, slides.length]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const show = () => { setChrome(true); clearTimeout(t); t = setTimeout(() => setChrome(false), 2500); };
    window.addEventListener("mousemove", show);
    show();
    return () => { window.removeEventListener("mousemove", show); clearTimeout(t); };
  }, []);
  return (
    <div className="presenting fixed inset-0 bg-carvao">
      <div className="absolute inset-0 m-auto aspect-video max-h-full max-w-full overflow-hidden" role="region" aria-roledescription="slide" aria-label={`Slide ${i + 1} de ${slides.length}`}>
        <SlideView s={slides[i]} creative={creative} />
      </div>
      <div className={`fixed inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-carvao/80 px-4 py-2 text-xs text-marfim transition-opacity ${chrome ? "opacity-100" : "opacity-0"}`}>
        <a href={backHref} className="underline">Sair</a>
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} className="rounded px-2 py-1 hover:bg-white/10" aria-label="Anterior">‹</button>
          <span>{i + 1} / {slides.length}</span>
          <button onClick={() => go(1)} className="rounded px-2 py-1 hover:bg-white/10" aria-label="Próximo">›</button>
        </div>
        <div className="flex gap-3">
          <a href={`${exportBase}?format=pdf`} className="underline">PDF</a>
          <a href={`${exportBase}?format=pptx`} className="underline">PPTX</a>
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="underline">Tela cheia (F)</button>
        </div>
      </div>
      <div className="fixed left-0 top-0 h-0.5 bg-taupe transition-all" style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
    </div>
  );
}

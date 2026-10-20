"use client";

import { useEffect, useState } from "react";
import { ORIGINS, type Origin, type PremiseSource, type SourceMap } from "@/lib/sim/origin";

/** Campo numérico que aceita vírgula e exibe percentuais como %. */
export function NumInput({
  value,
  onChange,
  percent,
  step,
  min = 0,
  disabled,
  id,
  className = "input",
}: {
  value: number | null;
  onChange: (v: number) => void;
  percent?: boolean;
  step?: number;
  min?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const toText = (v: number | null) => (v === null || !Number.isFinite(v) ? "" : String(+(percent ? v * 100 : v).toFixed(6)).replace(".", ","));
  const [text, setText] = useState(toText(value));
  useEffect(() => setText((t) => (parse(t) === value ? t : toText(value))), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  function parse(t: string) {
    const n = Number(t.replace(/\./g, "").replace(",", "."));
    return t.trim() === "" || !Number.isFinite(n) ? null : percent ? n / 100 : n;
  }
  return (
    <div className="relative">
      <input
        id={id}
        className={`${className} ${percent ? "pr-7" : ""}`}
        inputMode="decimal"
        disabled={disabled}
        value={text}
        step={step}
        min={min}
        onChange={(e) => {
          setText(e.target.value);
          const n = parse(e.target.value);
          if (n !== null) onChange(n);
        }}
      />
      {percent && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-carvao/50">%</span>}
    </div>
  );
}

const ORIGIN_TONE: Record<Origin, string> = {
  BRIEFING: "bg-sky-100 text-sky-900",
  EXTERNAL: "bg-violet-100 text-violet-900",
  HYPOTHESIS: "bg-amber-100 text-amber-900",
  CALCULATION: "bg-emerald-100 text-emerald-800",
  REAL: "bg-emerald-200 text-emerald-900",
};

export function OriginTag({ origin }: { origin: Origin }) {
  return <span className={`badge ${ORIGIN_TONE[origin]}`}>{ORIGINS[origin]}</span>;
}

/** Premissa com rótulo, valor e declaração de origem (briefing / fonte externa / hipótese). */
export function Premise({
  k,
  label,
  sources,
  setSources,
  children,
  disabled,
}: {
  k: string;
  label: React.ReactNode;
  sources: SourceMap;
  setSources: (s: SourceMap) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const s: PremiseSource = sources[k] ?? { origin: "HYPOTHESIS" };
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      <button type="button" className="mt-1 block text-left" onClick={() => setOpen(!open)} aria-label="Origem da premissa" aria-expanded={open} title={s.note ?? "Clique para declarar a origem"}>
        <OriginTag origin={s.origin} />
      </button>
      {open && (
        <div className="mt-1 space-y-1 rounded-md bg-areia/50 p-2">
          <select className="input py-1 text-xs" value={s.origin} disabled={disabled} onChange={(e) => setSources({ ...sources, [k]: { ...s, origin: e.target.value as Origin } })}>
            {(["BRIEFING", "EXTERNAL", "HYPOTHESIS"] as Origin[]).map((o) => <option key={o} value={o}>{ORIGINS[o]}</option>)}
          </select>
          <input className="input py-1 text-xs" disabled={disabled} placeholder={s.origin === "EXTERNAL" ? "Referência obrigatória (autor, título, URL, data)" : "Nota (opcional)"} value={s.note ?? ""} onChange={(e) => setSources({ ...sources, [k]: { ...s, note: e.target.value } })} />
        </div>
      )}
    </div>
  );
}

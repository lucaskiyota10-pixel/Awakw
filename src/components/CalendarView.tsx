"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Tabs } from "./ui";

export interface CalEvent {
  id: string;
  date: string; // ISO
  title: string;
  kind: "task" | "publication" | "milestone" | "decision";
  href: string;
  alert?: boolean;
  mine?: boolean;
  allDay?: boolean;
  color?: string;
}

const KIND_STYLE: Record<CalEvent["kind"], string> = {
  task: "bg-white border-l-4 border-carvao",
  publication: "bg-areia border-l-4 border-taupe",
  milestone: "bg-carvao text-marfim",
  decision: "bg-amber-50 border-l-4 border-amber-500",
};
const KIND_LABEL: Record<CalEvent["kind"], string> = { task: "Tarefa", publication: "Publicação", milestone: "Marco", decision: "Decisão" };

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

export function CalendarView({ events, initialView = "month" }: { events: CalEvent[]; initialView?: "month" | "week" | "day" }) {
  const [view, setView] = useState<"month" | "week" | "day">(initialView);
  const today = new Date();
  const [cursor, setCursor] = useState(() => utc(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const [kinds, setKinds] = useState<Record<string, boolean>>({ task: true, publication: true, milestone: true, decision: true });
  const [onlyMine, setOnlyMine] = useState(false);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!kinds[e.kind] || (onlyMine && e.kind === "task" && !e.mine)) continue;
      const k = e.allDay ? e.date.slice(0, 10) : dayKey(new Date(new Date(e.date).getTime() - 3 * 3600000)); // horário de Brasília
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [events, kinds, onlyMine]);

  const days: Date[] = useMemo(() => {
    const y = cursor.getUTCFullYear();
    const mo = cursor.getUTCMonth();
    if (view === "day") return [cursor];
    if (view === "week") {
      const start = utc(y, mo, cursor.getUTCDate() - cursor.getUTCDay());
      return Array.from({ length: 7 }, (_, i) => utc(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
    }
    const first = utc(y, mo, 1);
    const start = utc(y, mo, 1 - first.getUTCDay());
    return Array.from({ length: 42 }, (_, i) => utc(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
  }, [cursor, view]);

  const shift = (dir: number) => {
    const y = cursor.getUTCFullYear(), m = cursor.getUTCMonth(), d = cursor.getUTCDate();
    setCursor(view === "month" ? utc(y, m + dir, 1) : view === "week" ? utc(y, m, d + 7 * dir) : utc(y, m, d + dir));
  };
  const title =
    view === "month"
      ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
      : view === "week"
        ? `${days[0].toLocaleDateString("pt-BR", { timeZone: "UTC" })} – ${days[6].toLocaleDateString("pt-BR", { timeZone: "UTC" })}`
        : cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const todayKey = dayKey(utc(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const fmtTime = (e: CalEvent) => (e.allDay ? "" : new Date(e.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) + " ");

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm" onClick={() => shift(-1)} aria-label="Anterior">‹</button>
          <button className="btn-secondary btn-sm" onClick={() => setCursor(utc(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))}>Hoje</button>
          <button className="btn-secondary btn-sm" onClick={() => shift(1)} aria-label="Próximo">›</button>
          <h2 className="ml-2 text-2xl capitalize">{title}</h2>
        </div>
        <Tabs value={view} onChange={setView} items={[{ value: "month", label: "Mês" }, { value: "week", label: "Semana" }, { value: "day", label: "Dia" }]} />
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {(Object.keys(KIND_LABEL) as CalEvent["kind"][]).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} />
            <span className={`inline-block h-3 w-3 rounded-sm ${KIND_STYLE[k]}`} /> {KIND_LABEL[k]}
          </label>
        ))}
        <label className="flex items-center gap-1"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Só minhas tarefas</label>
      </div>
      {view === "day" ? (
        <ul className="space-y-2">
          {(byDay.get(dayKey(cursor)) ?? []).map((e) => (
            <li key={e.kind + e.id}><Link href={e.href} className={`block rounded-md p-3 text-sm ${KIND_STYLE[e.kind]} ${e.alert ? "ring-2 ring-red-500" : ""}`}>{fmtTime(e)}{KIND_LABEL[e.kind]} — {e.title}</Link></li>
          ))}
          {!(byDay.get(dayKey(cursor)) ?? []).length && <li className="text-sm text-carvao/50">Nada agendado.</li>}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-lg bg-areia">
            {WEEKDAYS.map((w) => <div key={w} className="bg-marfim p-2 text-center text-xs uppercase text-carvao/60">{w}</div>)}
            {days.map((d) => {
              const k = dayKey(d);
              const evs = byDay.get(k) ?? [];
              const out = view === "month" && d.getUTCMonth() !== cursor.getUTCMonth();
              return (
                <div key={k} className={`bg-white p-1.5 ${view === "week" ? "min-h-[260px]" : "min-h-[110px]"} ${out ? "opacity-40" : ""}`}>
                  <button className={`mb-1 rounded px-1 text-xs ${k === todayKey ? "bg-carvao text-marfim" : "text-carvao/70"}`} onClick={() => { setCursor(d); setView("day"); }}>{d.getUTCDate()}</button>
                  <ul className="space-y-1">
                    {evs.slice(0, view === "week" ? 12 : 3).map((e) => (
                      <li key={e.kind + e.id}>
                        <Link href={e.href} title={e.title} className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${KIND_STYLE[e.kind]} ${e.alert ? "text-red-700 ring-1 ring-red-400" : ""}`}>{fmtTime(e)}{e.title}</Link>
                      </li>
                    ))}
                    {evs.length > (view === "week" ? 12 : 3) && <li className="text-[10px] text-carvao/60">+{evs.length - 3} itens</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

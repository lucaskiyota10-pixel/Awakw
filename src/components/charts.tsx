"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import { num } from "@/lib/format";

export const SERIES_COLORS = ["#252521", "#B6A18B", "#8C7A66", "#C9B8A6", "#5E5A50", "#D8A7A7"];

export interface Series {
  key: string;
  label: string;
  color?: string;
  type?: "bar" | "line";
  axis?: "left" | "right";
}

const fmtAxis = (v: number) => (Math.abs(v) >= 1000 ? `${num(v / 1000, 0)}k` : num(v, Number.isInteger(v) ? 0 : 1));

export function Chart({
  data,
  x,
  series,
  kind = "bar",
  height = 280,
  format = (v: number) => num(v, 0),
  stacked = false,
}: {
  data: Record<string, unknown>[];
  x: string;
  series: Series[];
  kind?: "bar" | "line" | "area" | "composed";
  height?: number;
  format?: (v: number) => string;
  stacked?: boolean;
}) {
  const common = (
    <>
      <CartesianGrid stroke="#E9E2D8" vertical={false} />
      <XAxis dataKey={x} tick={{ fontSize: 11, fill: "#5E5A50" }} tickLine={false} axisLine={{ stroke: "#E9E2D8" }} interval="preserveStartEnd" />
      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#5E5A50" }} tickFormatter={fmtAxis} tickLine={false} axisLine={false} width={48} />
      {series.some((s) => s.axis === "right") && (
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#5E5A50" }} tickFormatter={fmtAxis} tickLine={false} axisLine={false} width={48} />
      )}
      <Tooltip formatter={(v: number) => format(v)} contentStyle={{ borderRadius: 8, borderColor: "#E9E2D8", fontSize: 12 }} />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
    </>
  );
  const color = (s: Series, i: number) => s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
  return (
    <div style={{ width: "100%", height }} role="img" aria-label={`Gráfico: ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer>
        {kind === "line" ? (
          <LineChart data={data}>
            {common}
            {series.map((s, i) => (
              <Line key={s.key} yAxisId={s.axis ?? "left"} type="monotone" dataKey={s.key} name={s.label} stroke={color(s, i)} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : kind === "area" ? (
          <AreaChart data={data}>
            {common}
            {series.map((s, i) => (
              <Area key={s.key} yAxisId={s.axis ?? "left"} type="monotone" dataKey={s.key} name={s.label} stroke={color(s, i)} fill={color(s, i)} fillOpacity={0.15} stackId={stacked ? "a" : undefined} />
            ))}
          </AreaChart>
        ) : kind === "composed" ? (
          <ComposedChart data={data}>
            {common}
            {series.map((s, i) =>
              s.type === "line" ? (
                <Line key={s.key} yAxisId={s.axis ?? "left"} type="monotone" dataKey={s.key} name={s.label} stroke={color(s, i)} strokeWidth={2} dot={false} />
              ) : (
                <Bar key={s.key} yAxisId={s.axis ?? "left"} dataKey={s.key} name={s.label} fill={color(s, i)} radius={[3, 3, 0, 0]} />
              ),
            )}
          </ComposedChart>
        ) : (
          <BarChart data={data}>
            {common}
            {series.map((s, i) => (
              <Bar key={s.key} yAxisId={s.axis ?? "left"} dataKey={s.key} name={s.label} fill={color(s, i)} radius={[3, 3, 0, 0]} stackId={stacked ? "a" : undefined} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; tone?: "sim" | "real" }) {
  return (
    <div className="rounded-xl border border-areia bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <p className="text-[11px] uppercase tracking-wide text-carvao/60">{label}</p>
        {tone === "sim" && <span className="badge bg-areia text-carvao">hipotético</span>}
        {tone === "real" && <span className="badge bg-emerald-100 text-emerald-800">real</span>}
      </div>
      <p className="mt-1 break-words font-serif text-2xl leading-tight sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-carvao/60">{hint}</p>}
    </div>
  );
}

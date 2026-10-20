import type { GrowthPremises } from "./growth";
import type { MetricsInput } from "./metrics";
import type { SourceMap } from "./origin";
import { defaultGrowth, defaultMetrics } from "./defaults";

/** Lê premissas salvas (JSON) completando campos ausentes com padrões — tolera versões antigas. */
export function readGrowth(raw: unknown): { values: GrowthPremises; sources: SourceMap } {
  const r = (raw ?? {}) as { values?: Partial<GrowthPremises>; sources?: SourceMap };
  return { values: { ...defaultGrowth("MODERATE"), ...(r.values ?? {}) }, sources: r.sources ?? {} };
}

export function readMetrics(raw: unknown): { values: MetricsInput; sources: SourceMap } {
  const r = (raw ?? {}) as { values?: Partial<MetricsInput>; sources?: SourceMap };
  const d = defaultMetrics("MODERATE");
  const v = r.values ?? {};
  return {
    values: { ...d, ...v, media: { ...d.media, ...(v.media ?? {}) }, funnel: { ...d.funnel, ...(v.funnel ?? {}) }, campaigns: v.campaigns ?? d.campaigns },
    sources: r.sources ?? {},
  };
}

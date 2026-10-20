"use client";

import { useMemo, useState } from "react";
import { PageHeader, SimBanner, Tabs } from "@/components/ui";
import { ScenarioBar, type ScenarioLite } from "@/components/ScenarioBar";
import { useProject } from "@/components/project-context";
import { simulateGrowth, type GrowthPremises } from "@/lib/sim/growth";
import { defaultGrowth, defaultGrowthSources } from "@/lib/sim/defaults";
import { readGrowth } from "@/lib/sim/scenario";
import type { SourceMap } from "@/lib/sim/origin";
import { GrowthInputs } from "./Inputs";
import { Results } from "./Results";
import { BudgetComparison, CompareScenarios, StrategyComparison } from "./Compare";
import { Timeline, type MilestoneLite } from "./Timeline";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "@/components/instagram/types";

type Tab = "results" | "compare" | "timeline";

export function GrowthSim({
  scenarios,
  initialId,
  initialTab,
  milestones,
  creative,
}: {
  scenarios: ScenarioLite[];
  initialId: string | null;
  initialTab: Tab;
  milestones: MilestoneLite[];
  creative: { profile: IgProfile; highlights: IgHighlight[]; pubs: IgPub[]; files: MediaFile[] };
}) {
  const p = useProject();
  const init = scenarios.find((s) => s.id === initialId);
  const [currentId, setCurrentId] = useState<string | null>(init?.id ?? null);
  const [v, setV] = useState<GrowthPremises>(() => (init ? readGrowth(init.premises).values : defaultGrowth("MODERATE", p.defaults)));
  const [sources, setSources] = useState<SourceMap>(() => (init ? readGrowth(init.premises).sources : defaultGrowthSources()));
  const [tab, setTab] = useState<Tab>(initialTab);
  const out = useMemo(() => simulateGrowth(v), [v]);
  const set = (patch: Partial<GrowthPremises>) => setV((x) => ({ ...x, ...patch }));

  return (
    <div>
      <PageHeader title="Growth Simulator" subtitle="Projeções semanais, mensais, trimestrais, semestrais e anuais. Recalcula instantaneamente; nada cresce proporcionalmente sem premissas declaradas." />
      <SimBanner className="mb-4" />
      <ScenarioBar
        kind="GROWTH"
        scenarios={scenarios}
        currentId={currentId}
        values={v}
        sources={sources}
        onLoad={(s) => {
          setCurrentId(s?.id ?? null);
          if (s) {
            const r = readGrowth(s.premises);
            setV(r.values);
            setSources(r.sources);
          }
        }}
        onPreset={(l) => { setCurrentId(null); setV(defaultGrowth(l, p.defaults)); setSources(defaultGrowthSources()); }}
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-100px)] xl:overflow-y-auto xl:pr-1">
          <GrowthInputs v={v} set={set} sources={sources} setSources={setSources} totalInvestment={out.totalInvestment} disabled={!p.can("edit")} />
        </div>
        <div className="min-w-0 space-y-6">
          {!out.ok && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <strong>Premissas inválidas:</strong>
              <ul className="list-disc pl-5">{out.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {out.warnings.length > 0 && <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{out.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
          <Tabs value={tab} onChange={setTab} items={[{ value: "results", label: "Projeção" }, { value: "compare", label: "Cenários, orçamentos e estratégias" }, { value: "timeline", label: "Linha do tempo" }]} />
          {tab === "results" && <Results v={v} out={out} />}
          {tab === "compare" && (
            <>
              <CompareScenarios scenarios={scenarios} />
              {out.ok && <BudgetComparison v={v} />}
              {out.ok && <StrategyComparison v={v} />}
            </>
          )}
          {tab === "timeline" && <Timeline v={v} out={out} sources={sources} milestones={milestones} creative={creative} />}
          <section className="card text-sm">
            <h2 className="card-title mb-2">Como o modelo calcula</h2>
            <ul className="list-disc space-y-1 pl-5 text-carvao/80">
              <li>Simulação diária, agregada em semanas (blocos de 7 dias), meses, trimestres, semestres e anos relativos ao início.</li>
              <li>Impressões = verba do dia ÷ CPM × 1000; CPM do mês = CPM inicial × (1 + aumento mensal)^mês × sazonalidade.</li>
              <li>Alcance único = público × (1 − e^(−impressões acumuladas ÷ público)); só com tamanho de público declarado.</li>
              <li>Saturação: CTR efetivo = CTR ÷ (1 + k × frequência média acumulada).</li>
              <li>Orgânico: alcance diário = (posts/7 + Reels/7 × multiplicador) × seguidores × taxa de alcance; seguidores crescem com visitas ao perfil × taxa de seguir, menos a perda mensal.</li>
              <li>Visitas ao site = cliques pagos × chegada + visitas ao perfil × clique no link; funil → compras → receita.</li>
              <li>CPA e ROAS combinados = investimento e receita totais (paga + orgânica), sem atribuição causal.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

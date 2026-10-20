"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/project-context";
import { Badge, Modal, PageHeader, Tabs, useAction } from "@/components/ui";
import { CalendarView } from "@/components/CalendarView";
import { PublicationEditor } from "@/components/instagram/PublicationEditor";
import { PhoneSim } from "@/components/instagram/PhoneSim";
import { setPublicationStatusAction } from "@/app/actions/creative";
import { PUB_FLOW, PUB_STATUS, PUB_STATUS_LABEL, PUB_TYPE_LABEL } from "@/lib/labels";
import { dateTimeBr } from "@/lib/format";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "@/components/instagram/types";

export function Editorial({ profile, highlights, pubs, files, campaigns, openId, followersByMonth }: { profile: IgProfile; highlights: IgHighlight[]; pubs: IgPub[]; files: MediaFile[]; campaigns: { id: string; name: string }[]; openId: string | null; followersByMonth?: Record<number, number> }) {
  const p = useProject();
  const router = useRouter();
  const { exec } = useAction();
  const [view, setView] = useState<"calendar" | "flow" | "feed" | "list">("calendar");
  const [open, setOpen] = useState<IgPub | "new" | null>(null);
  const fileMap = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  useEffect(() => {
    if (openId) setOpen(pubs.find((x) => x.id === openId) ?? null);
  }, [openId, pubs]);
  const close = () => {
    setOpen(null);
    if (openId) router.replace(`${p.base}/editorial`);
  };
  const events = pubs.filter((x) => x.scheduledAt).map((x) => ({ id: x.id, date: x.scheduledAt!, title: `${PUB_TYPE_LABEL[x.type]}: ${x.title}`, kind: "publication" as const, href: `${p.base}/editorial?p=${x.id}`, allDay: false }));
  const next = (s: string) => PUB_FLOW[Math.min(PUB_FLOW.indexOf(s as (typeof PUB_FLOW)[number]) + 1, PUB_FLOW.length - 1)];

  return (
    <div>
      <PageHeader title="Calendário editorial" subtitle="Data, horário, formato, objetivo, jornada, produto, legenda, mídia, responsável, campanha e status. Fluxo: Redação → Criação → Planejamento → Atendimento." actions={p.can("edit") && <button className="btn-primary" onClick={() => setOpen("new")}>Nova publicação</button>} />
      <div className="mb-4"><Tabs value={view} onChange={setView} items={[{ value: "calendar", label: "Calendário" }, { value: "flow", label: "Fluxo de revisão" }, { value: "feed", label: "Feed" }, { value: "list", label: "Lista" }]} /></div>
      {view === "calendar" && <CalendarView events={events} />}
      {view === "flow" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PUB_STATUS.map(([k, l]) => (
            <section key={k} className="w-64 shrink-0 rounded-xl bg-areia/40 p-2">
              <h2 className="px-2 py-1 font-sans text-sm font-medium">{l}</h2>
              <div className="space-y-2">
                {pubs.filter((x) => x.status === k).map((x) => (
                  <article key={x.id} className="rounded-lg border border-areia bg-white p-3 text-sm">
                    <button className="text-left font-medium hover:underline" onClick={() => setOpen(x)}>{x.title}</button>
                    <p className="text-xs text-carvao/60">{PUB_TYPE_LABEL[x.type]} · {x.scheduledAt ? dateTimeBr(x.scheduledAt) : "sem data"}</p>
                    <p className="text-xs text-carvao/60">{p.memberName(x.responsibleId)}</p>
                    {p.can("edit") && k !== "SCHEDULED" && !((next(k) === "APPROVED" || next(k) === "SCHEDULED") && !p.can("approve")) && (
                      <button className="btn-secondary btn-sm mt-2" onClick={() => exec(() => setPublicationStatusAction(p.projectId, x.id, next(k)), { success: `Enviada para ${PUB_STATUS_LABEL[next(k)]}.` })}>
                        Avançar → {PUB_STATUS_LABEL[next(k)]}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {view === "feed" && <div className="flex justify-center"><PhoneSim profile={profile} highlights={highlights} pubs={pubs} files={fileMap} followersByMonth={followersByMonth} onOpen={setOpen} /></div>}
      {view === "list" && (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>Data/hora</th><th>Formato</th><th>Título</th><th>Objetivo</th><th>Jornada</th><th>Produto</th><th>Campanha</th><th>Responsável</th><th>Status</th></tr></thead>
            <tbody>
              {[...pubs].sort((a, b) => (a.scheduledAt ?? "9").localeCompare(b.scheduledAt ?? "9")).map((x) => (
                <tr key={x.id} className="cursor-pointer hover:bg-areia/30" onClick={() => setOpen(x)}>
                  <td className="whitespace-nowrap">{x.scheduledAt ? dateTimeBr(x.scheduledAt) : "—"}</td>
                  <td>{PUB_TYPE_LABEL[x.type]}</td>
                  <td className="font-medium">{x.title}</td>
                  <td>{x.objective ?? "—"}</td>
                  <td>{x.journeyStage ?? "—"}</td>
                  <td>{x.product ?? "—"}</td>
                  <td>{campaigns.find((c) => c.id === x.campaignId)?.name ?? "—"}</td>
                  <td>{p.memberName(x.responsibleId)}</td>
                  <td><Badge>{PUB_STATUS_LABEL[x.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open !== null} onClose={close} title={open === "new" ? "Nova publicação" : "Publicação"} wide>
        {open !== null && <PublicationEditor pub={open === "new" ? null : open} profile={profile} files={files} campaigns={campaigns} highlights={highlights} pubs={pubs} followersByMonth={followersByMonth} onDone={close} />}
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProject, MemberSelect } from "@/components/project-context";
import { ConfirmButton, Field, Tabs, useAction, Badge } from "@/components/ui";
import { Thread } from "@/components/Thread";
import { UploadButton } from "@/components/Upload";
import { savePublicationAction, deletePublicationAction, getPublicationVersionsAction, type PubInput } from "@/app/actions/creative";
import { requestApprovalAction } from "@/app/actions/collab";
import { JOURNEY, PUB_STATUS, PUB_STATUS_LABEL, PUB_TYPE } from "@/lib/labels";
import { diffWords } from "@/lib/diff";
import { dateTimeBr } from "@/lib/format";
import { Media } from "./PhoneProfile";
import { PhoneSim } from "./PhoneSim";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "./types";

const AD_CTAS = ["Saiba mais", "Comprar agora", "Enviar mensagem", "Ver coleção", "Fale conosco"];

type Version = { id: string; version: number; caption: string | null; hashtags: string | null; cta: string | null; mediaFileIds: string[]; note: string | null; authorId: string; createdAt: string };

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3600000); // Brasília (UTC−3)
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v + ":00-03:00").toISOString() : null);

export function PublicationEditor({
  pub,
  profile,
  files,
  campaigns,
  defaults,
  onDone,
  highlights = [],
  pubs = [],
  followersByMonth,
  onDraft,
  inlinePreview = true,
}: {
  pub: IgPub | null;
  profile: IgProfile;
  files: MediaFile[];
  campaigns: { id: string; name: string }[];
  defaults?: Partial<IgPub>;
  onDone: () => void;
  highlights?: IgHighlight[];
  pubs?: IgPub[];
  followersByMonth?: Record<number, number>;
  /** recebe o rascunho a cada alteração (prévia ao vivo em outro celular) */
  onDraft?: (p: IgPub | null) => void;
  /** mostra o celular com a prévia ao lado do formulário */
  inlinePreview?: boolean;
}) {
  const p = useProject();
  const router = useRouter();
  const { exec, pending } = useAction();
  const fileMap = new Map(files.map((f) => [f.id, f]));
  const [tab, setTab] = useState<"edit" | "versions" | "comments">("edit");
  const [v, setV] = useState<PubInput>({
    type: pub?.type ?? defaults?.type ?? "FEED",
    title: pub?.title ?? "",
    caption: pub?.caption ?? "",
    hashtags: pub?.hashtags ?? "",
    cta: pub?.cta ?? "",
    mediaFileIds: pub?.mediaFileIds ?? [],
    coverColor: pub?.coverColor ?? "#E9E2D8",
    scheduledAt: pub?.scheduledAt ?? defaults?.scheduledAt ?? null,
    objective: pub?.objective ?? "",
    journeyStage: pub?.journeyStage ?? "",
    product: pub?.product ?? "",
    responsibleId: pub?.responsibleId ?? null,
    campaignId: pub?.campaignId ?? null,
    location: pub?.location ?? "",
    isAd: pub?.isAd ?? false,
    adCta: pub?.adCta ?? "Saiba mais",
    highlightId: pub?.highlightId ?? null,
    status: (pub?.status ?? "DRAFT") as PubInput["status"],
    hypotheticalLikes: pub?.hypotheticalLikes ?? null,
    hypotheticalComments: pub?.hypotheticalComments ?? null,
    hypotheticalViews: pub?.hypotheticalViews ?? null,
    versionNote: "",
  });
  const readOnly = !p.can("edit");
  const set = <K extends keyof PubInput>(k: K, val: PubInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const media = files.filter((f) => f.mime.startsWith("image/") || f.mime === "video/mp4");
  const captionLen = (v.caption ?? "").length;
  const tags = ((v.hashtags ?? "").match(/#/g) ?? []).length;
  const [draftId] = useState(() => pub?.id ?? `novo-${Math.random().toString(36).slice(2)}`);
  const draftKey = JSON.stringify(v);
  const draft = useMemo<IgPub>(() => ({
    id: draftId,
    type: v.type,
    title: v.title || "Nova publicação",
    caption: v.caption ?? null,
    hashtags: v.hashtags ?? null,
    cta: v.cta ?? null,
    mediaFileIds: v.mediaFileIds,
    coverColor: v.coverColor ?? null,
    scheduledAt: v.scheduledAt ?? null,
    objective: v.objective ?? null,
    journeyStage: v.journeyStage ?? null,
    product: v.product ?? null,
    responsibleId: v.responsibleId ?? null,
    campaignId: v.campaignId ?? null,
    location: v.location ?? null,
    isAd: !!v.isAd,
    adCta: v.adCta ?? null,
    highlightId: v.highlightId ?? null,
    status: v.status,
    feedOrder: pub?.feedOrder ?? -1e12,
    hypotheticalLikes: v.hypotheticalLikes,
    hypotheticalComments: v.hypotheticalComments,
    hypotheticalViews: v.hypotheticalViews,
    createdById: pub?.createdById ?? p.userId,
  }), [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onDraft?.(draft);
  }, [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDraft?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`grid gap-6 ${inlinePreview ? "xl:grid-cols-[1fr_380px]" : ""}`}>
      <div className="min-w-0 space-y-4">
        {pub && <Tabs value={tab} onChange={setTab} items={[{ value: "edit", label: "Conteúdo" }, { value: "versions", label: "Versões" }, { value: "comments", label: "Comentários e histórico" }]} />}
        {tab === "edit" && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => savePublicationAction(p.projectId, pub?.id ?? null, v), { success: "Publicação salva.", onOk: () => { set("versionNote", ""); if (!pub) onDone(); } }); }}>
            <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
              <Field label="Formato"><select className="input" value={v.type} onChange={(e) => set("type", e.target.value as PubInput["type"])}>{PUB_TYPE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="Título interno *"><input className="input" value={v.title} onChange={(e) => set("title", e.target.value)} required /></Field>
              <div className="sm:col-span-2"><Field label={`Legenda (${captionLen}/2200)`}><textarea className="input min-h-[110px]" value={v.caption ?? ""} onChange={(e) => set("caption", e.target.value)} /></Field></div>
              <Field label={`Hashtags (${tags}/30)`}><input className="input" value={v.hashtags ?? ""} onChange={(e) => set("hashtags", e.target.value)} placeholder="#marca #campanha" /></Field>
              <Field label="CTA"><input className="input" value={v.cta ?? ""} onChange={(e) => set("cta", e.target.value)} placeholder="Saiba mais" /></Field>
              <div className="sm:col-span-2">
                <span className="label">Mídias ({v.mediaFileIds.length}/10) — clique para adicionar/remover; ordem = ordem do carrossel</span>
                <div className="flex flex-wrap gap-2">
                  {v.mediaFileIds.map((id, i) => (
                    <button type="button" key={id} className="relative h-16 w-16 overflow-hidden rounded ring-2 ring-carvao" onClick={() => set("mediaFileIds", v.mediaFileIds.filter((x) => x !== id))} aria-label="Remover mídia">
                      <Media id={id} files={fileMap} /><span className="absolute left-0 top-0 bg-carvao px-1 text-[10px] text-white">{i + 1}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto rounded border border-areia p-1">
                  {media.filter((f) => !v.mediaFileIds.includes(f.id)).map((f) => (
                    <button type="button" key={f.id} className="h-12 w-12 overflow-hidden rounded opacity-80 hover:opacity-100" onClick={() => set("mediaFileIds", [...v.mediaFileIds, f.id])} title={f.name}><Media id={f.id} files={fileMap} /></button>
                  ))}
                  {media.length === 0 && <span className="p-2 text-xs text-carvao/50">Biblioteca vazia — envie imagens ou vídeos MP4.</span>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <UploadButton projectId={p.projectId} folder="instagram" accept="image/png,image/jpeg,image/webp,video/mp4" label="Enviar mídia" onUploaded={(fs) => { set("mediaFileIds", [...v.mediaFileIds, ...fs.map((f) => f.id)].slice(0, 10)); router.refresh(); }} />
                  <label className="flex items-center gap-1 text-xs">Cor de capa (sem mídia) <input type="color" value={v.coverColor ?? "#E9E2D8"} onChange={(e) => set("coverColor", e.target.value.toUpperCase())} /></label>
                </div>
              </div>
              <Field label="Data e hora (Brasília)"><input type="datetime-local" className="input" value={toLocalInput(v.scheduledAt ?? null)} onChange={(e) => set("scheduledAt", fromLocalInput(e.target.value))} /></Field>
              <Field label="Status / etapa do fluxo">
                <select className="input" value={v.status} onChange={(e) => set("status", e.target.value as PubInput["status"])}>
                  {PUB_STATUS.map(([k, l]) => <option key={k} value={k} disabled={(k === "APPROVED" || k === "SCHEDULED") && !p.can("approve") && pub?.status !== k}>{l}</option>)}
                </select>
              </Field>
              <Field label="Objetivo"><input className="input" value={v.objective ?? ""} onChange={(e) => set("objective", e.target.value)} /></Field>
              <Field label="Etapa da jornada"><select className="input" value={v.journeyStage ?? ""} onChange={(e) => set("journeyStage", e.target.value)}><option value="">—</option>{JOURNEY.map((j) => <option key={j}>{j}</option>)}</select></Field>
              <Field label="Produto"><input className="input" value={v.product ?? ""} onChange={(e) => set("product", e.target.value)} /></Field>
              <Field label="Responsável"><MemberSelect value={v.responsibleId} onChange={(x) => set("responsibleId", x)} /></Field>
              <Field label="Campanha"><select className="input" value={v.campaignId ?? ""} onChange={(e) => set("campaignId", e.target.value || null)}><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              {v.type === "STORY" ? (
                <Field label="Destaque do perfil"><select className="input" value={v.highlightId ?? ""} onChange={(e) => set("highlightId", e.target.value || null)}><option value="">— nenhum —</option>{highlights.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}</select></Field>
              ) : (
                <Field label="Localização"><input className="input" value={v.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="Ex.: São Paulo" /></Field>
              )}
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-areia bg-areia/30 p-3 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.isAd} onChange={(e) => set("isAd", e.target.checked)} /> <strong>Simular como anúncio</strong> — mostra “Patrocinado” e o botão do anúncio</label>
                {v.isAd && <Field label="Botão do anúncio"><select className="input" value={v.adCta ?? "Saiba mais"} onChange={(e) => set("adCta", e.target.value)}>{AD_CTAS.map((c) => <option key={c}>{c}</option>)}</select></Field>}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                <Field label="Curtidas (hipotético)"><input type="number" min={0} className="input" value={v.hypotheticalLikes ?? ""} onChange={(e) => set("hypotheticalLikes", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Comentários (hipotético)"><input type="number" min={0} className="input" value={v.hypotheticalComments ?? ""} onChange={(e) => set("hypotheticalComments", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Visualizações (hipotético)"><input type="number" min={0} className="input" value={v.hypotheticalViews ?? ""} onChange={(e) => set("hypotheticalViews", e.target.value === "" ? null : Number(e.target.value))} /></Field>
              </div>
              <div className="sm:col-span-2"><Field label="Nota da versão (opcional)"><input className="input" value={v.versionNote ?? ""} onChange={(e) => set("versionNote", e.target.value)} placeholder="Ex.: ajuste de CTA pedido pelo Atendimento" /></Field></div>
            </fieldset>
            {!readOnly && (
              <div className="flex flex-wrap justify-between gap-2">
                <div className="flex gap-2">
                  {pub && <ConfirmButton onConfirm={() => exec(() => deletePublicationAction(p.projectId, pub.id), { success: "Excluída.", onOk: onDone })} />}
                  {pub && pub.status !== "APPROVED" && <button type="button" className="btn-secondary btn-sm" onClick={() => exec(() => requestApprovalAction(p.projectId, "publication", pub.id, pub.title), { success: "Aprovação solicitada." })}>Solicitar aprovação</button>}
                </div>
                <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
              </div>
            )}
            <p className="text-xs text-carvao/50">Fluxo de revisão: Redação → Criação → Revisão Planejamento → Revisão Atendimento → Aprovado. Cada etapa notifica o setor responsável. Nada é publicado no Instagram real.</p>
          </form>
        )}
        {tab === "versions" && pub && <Versions pubId={pub.id} files={fileMap} />}
        {tab === "comments" && pub && <Thread targetType="publication" targetId={pub.id} link={`${p.base}/editorial?p=${pub.id}`} />}
      </div>
      {inlinePreview && (
        <div>
          <p className="label mb-2 text-center">Prévia no app {pub && <Badge>{PUB_STATUS_LABEL[pub.status]}</Badge>}</p>
          <PhoneSim profile={profile} highlights={highlights} pubs={pubs} files={fileMap} followersByMonth={followersByMonth} focus={draft} />
        </div>
      )}
    </div>
  );
}

function Versions({ pubId, files }: { pubId: string; files: Map<string, MediaFile> }) {
  const p = useProject();
  const [versions, setVersions] = useState<Version[]>([]);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  useEffect(() => {
    getPublicationVersionsAction(p.projectId, pubId).then((r) => {
      if (r.ok && r.data) {
        const vs = r.data as Version[];
        setVersions(vs);
        setB(vs[0]?.version ?? null);
        setA(vs[1]?.version ?? vs[0]?.version ?? null);
      }
    });
  }, [p.projectId, pubId]);
  const va = versions.find((x) => x.version === a);
  const vb = versions.find((x) => x.version === b);
  const text = (x?: Version) => (x ? `${x.caption ?? ""}\n${x.hashtags ?? ""}\nCTA: ${x.cta ?? ""}` : "");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Field label="Versão A"><select className="input" value={a ?? ""} onChange={(e) => setA(Number(e.target.value))}>{versions.map((x) => <option key={x.id} value={x.version}>v{x.version} — {p.memberName(x.authorId)} — {dateTimeBr(x.createdAt)}</option>)}</select></Field>
        <Field label="Versão B"><select className="input" value={b ?? ""} onChange={(e) => setB(Number(e.target.value))}>{versions.map((x) => <option key={x.id} value={x.version}>v{x.version} — {p.memberName(x.authorId)} — {dateTimeBr(x.createdAt)}</option>)}</select></Field>
      </div>
      {va && vb && (
        <>
          <div className="rounded-lg border border-areia bg-white p-3 text-sm whitespace-pre-wrap">
            {diffWords(text(va), text(vb)).map((d, i) => <span key={i} className={d.type === "add" ? "bg-emerald-100" : d.type === "del" ? "bg-red-100 line-through" : ""}>{d.text}</span>)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[va, vb].map((x) => (
              <div key={x.id}>
                <p className="label">v{x.version} {x.note && `— ${x.note}`}</p>
                <div className="flex flex-wrap gap-1">{x.mediaFileIds.map((id) => <div key={id} className="h-14 w-14 overflow-hidden rounded"><Media id={id} files={files} /></div>)}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {versions.length === 0 && <p className="text-sm text-carvao/50">Sem versões.</p>}
    </div>
  );
}

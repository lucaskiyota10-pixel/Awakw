"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/project-context";
import { Badge, ConfirmButton, Field, PageHeader, SimBanner, Tabs, useAction } from "@/components/ui";
import { UploadButton } from "@/components/Upload";
import { Media } from "@/components/instagram/PhoneProfile";
import { PhoneSim } from "@/components/instagram/PhoneSim";
import { PublicationEditor } from "@/components/instagram/PublicationEditor";
import { reorderFeedAction, saveProfileAction } from "@/app/actions/creative";
import { saveEntityAction, deleteEntityAction } from "@/app/actions/crud";
import { PUB_STATUS_LABEL, PUB_TYPE, PUB_TYPE_LABEL } from "@/lib/labels";
import { dateTimeBr, num } from "@/lib/format";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "@/components/instagram/types";

type Editing = { pub: IgPub | null; type: IgPub["type"] } | null;

export function Studio({
  profile,
  highlights,
  pubs,
  files,
  campaigns,
  followersByMonth,
}: {
  profile: IgProfile;
  highlights: IgHighlight[];
  pubs: IgPub[];
  files: MediaFile[];
  campaigns: { id: string; name: string }[];
  followersByMonth: Record<number, number>;
}) {
  const p = useProject();
  const router = useRouter();
  const { exec } = useAction();
  const fileMap = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const [tab, setTab] = useState<"posts" | "perfil" | "destaques">("posts");
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<IgPub | null>(null);
  const [profileDraft, setProfileDraft] = useState<IgProfile | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const shownProfile = profileDraft ?? profile;
  const shownPubs = useMemo(() => (order ? pubs.map((x) => (order.includes(x.id) ? { ...x, feedOrder: order.indexOf(x.id) } : x)) : pubs), [pubs, order]);
  const feed = shownPubs.filter((x) => x.type !== "STORY").sort((a, b) => a.feedOrder - b.feedOrder);
  const stories = shownPubs.filter((x) => x.type === "STORY");

  const edit = (pub: IgPub | null, type: IgPub["type"] = pub?.type ?? "FEED") => {
    setTab("posts");
    setEditing({ pub, type });
  };
  const close = () => {
    setEditing(null);
    setDraft(null);
  };

  const Item = ({ x }: { x: IgPub }) => (
    <button className="flex w-full items-center gap-3 rounded-xl border border-areia bg-white p-2 text-left transition hover:border-taupe" onClick={() => edit(x)}>
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg"><Media id={x.mediaFileIds[0]} files={fileMap} color={x.coverColor} label={PUB_TYPE_LABEL[x.type]} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{x.title}</span>
        <span className="block text-xs text-carvao/60">{PUB_TYPE_LABEL[x.type]}{x.isAd ? " · anúncio" : ""} · {x.scheduledAt ? dateTimeBr(x.scheduledAt) : "sem data"} · {p.memberName(x.responsibleId)}</span>
      </span>
      <Badge tone={x.status === "APPROVED" || x.status === "SCHEDULED" ? "ok" : "neutral"}>{PUB_STATUS_LABEL[x.status]}</Badge>
    </button>
  );

  return (
    <div>
      <PageHeader title="Instagram Studio" subtitle="Simulador do perfil da marca, independente de conta real. Envie a logo, monte o feed com imagens, carrosséis, Reels e stories, e veja a campanha como apareceria no app — inclusive como anúncio." />
      <SimBanner className="mb-6" />
      <div className="grid gap-8 xl:grid-cols-[380px_1fr]">
        <div className="xl:sticky xl:top-20 xl:self-start">
          <PhoneSim
            profile={shownProfile}
            highlights={highlights}
            pubs={shownPubs}
            files={fileMap}
            followersByMonth={followersByMonth}
            focus={draft}
            editable={p.can("edit") && !editing}
            onOpen={p.can("edit") ? (x) => edit(x) : undefined}
            onReorder={(ids) => {
              setOrder(ids);
              exec(() => reorderFeedAction(p.projectId, ids), { success: "Feed reorganizado para a equipe.", onOk: () => setOrder(null) });
            }}
          />
        </div>
        <section className="card min-w-0">
          <div className="mb-4">
            <Tabs value={tab} onChange={(t) => { close(); setProfileDraft(null); setTab(t); }} items={[{ value: "posts", label: `Publicações (${pubs.length})` }, { value: "perfil", label: "Perfil" }, { value: "destaques", label: `Destaques (${highlights.length})` }]} />
          </div>
          {tab === "posts" && editing && (
            <div className="space-y-3">
              <button className="btn-secondary btn-sm" onClick={close}>← Voltar à lista</button>
              <PublicationEditor
                key={editing.pub?.id ?? `novo-${editing.type}`}
                pub={editing.pub}
                defaults={{ type: editing.type, scheduledAt: p.defaults.launch ? `${p.defaults.launch}T22:00:00.000Z` : null }}
                profile={shownProfile}
                files={files}
                campaigns={campaigns}
                highlights={highlights}
                inlinePreview={false}
                onDraft={setDraft}
                onDone={close}
              />
            </div>
          )}
          {tab === "posts" && !editing && (
            <div className="space-y-5">
              {p.can("edit") && (
                <div className="flex flex-wrap gap-2">
                  {PUB_TYPE.map(([k, l], i) => <button key={k} className={`${i === 0 ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => edit(null, k as IgPub["type"])}>+ {l}</button>)}
                </div>
              )}
              <div>
                <p className="label">Feed ({feed.length}) — arraste as miniaturas no celular para reorganizar</p>
                <div className="space-y-2">{feed.length ? feed.map((x) => <Item key={x.id} x={x} />) : <p className="rounded-xl border border-dashed border-taupe/50 p-6 text-center text-sm text-carvao/60">Nenhuma publicação no feed.</p>}</div>
              </div>
              <div>
                <p className="label">Stories ({stories.length})</p>
                <div className="space-y-2">{stories.length ? stories.map((x) => <Item key={x.id} x={x} />) : <p className="rounded-xl border border-dashed border-taupe/50 p-6 text-center text-sm text-carvao/60">Nenhum story. Use “+ Story”.</p>}</div>
              </div>
              <p className="rounded-lg bg-areia/50 p-3 text-xs text-carvao/70">Fluxo: Redação → Criação → Revisão Planejamento → Revisão Atendimento → Aprovado. Curtidas, comentários e visualizações são números hipotéticos informados pela equipe; nada é publicado no Instagram real.</p>
            </div>
          )}
          {tab === "perfil" && (
            <ProfileForm
              profile={profile}
              files={files}
              followersByMonth={followersByMonth}
              onChange={setProfileDraft}
              onSaved={() => { setProfileDraft(null); router.refresh(); }}
            />
          )}
          {tab === "destaques" && <HighlightsEditor highlights={highlights} stories={stories} />}
        </section>
      </div>
    </div>
  );
}

function ProfileForm({
  profile,
  files,
  followersByMonth,
  onChange,
  onSaved,
}: {
  profile: IgProfile;
  files: MediaFile[];
  followersByMonth: Record<number, number>;
  onChange: (p: IgProfile | null) => void;
  onSaved: () => void;
}) {
  const p = useProject();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [v, setV] = useState(profile);
  const upd = (patch: Partial<IgProfile>) => {
    const n = { ...v, ...patch };
    setV(n);
    onChange(n);
  };
  const ro = !p.can("edit");
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); exec(() => saveProfileAction(p.projectId, v as unknown as Record<string, unknown>), { success: "Perfil salvo.", onOk: onSaved }); }}>
      <fieldset disabled={ro} className="space-y-5">
        <div className="flex flex-wrap items-center gap-5">
          <span className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-carvao font-serif text-4xl text-marfim ${v.avatarFit === "contain" ? "bg-white" : ""}`}>
            {v.avatarFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${v.avatarFileId}`} alt="Foto de perfil" className={`h-full w-full ${v.avatarFit === "contain" ? "object-contain p-3" : "object-cover"}`} />
            ) : (v.displayName || "A")[0]}
          </span>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <UploadButton projectId={p.projectId} folder="instagram" accept="image/png,image/jpeg,image/webp" multiple={false} label={v.avatarFileId ? "Trocar foto/logo" : "Enviar foto ou logo"} className="btn-primary btn-sm" onUploaded={(f) => { upd({ avatarFileId: f[0].id }); router.refresh(); }} />
              {v.avatarFileId && <button type="button" className="btn-secondary btn-sm" onClick={() => upd({ avatarFileId: null })}>Remover</button>}
            </div>
            <Tabs value={v.avatarFit} onChange={(fit) => upd({ avatarFit: fit })} items={[{ value: "cover", label: "Preencher círculo" }, { value: "contain", label: "Logo inteira" }]} />
            <p className="text-xs text-carvao/60">“Logo inteira” mostra a marca completa sobre fundo branco, sem cortar.</p>
            {files.filter((f) => f.mime.startsWith("image/")).length > 0 && (
              <select className="input text-xs" value="" onChange={(e) => e.target.value && upd({ avatarFileId: e.target.value })} aria-label="Escolher imagem já enviada">
                <option value="">Ou escolha uma imagem já enviada…</option>
                {files.filter((f) => f.mime.startsWith("image/")).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome exibido"><input className="input" value={v.displayName} onChange={(e) => upd({ displayName: e.target.value })} /></Field>
          <Field label="Nome de usuário"><input className="input" value={v.username} onChange={(e) => upd({ username: e.target.value })} /></Field>
          <Field label="Categoria"><input className="input" value={v.category ?? ""} onChange={(e) => upd({ category: e.target.value })} /></Field>
          <Field label="Link"><input className="input" value={v.link ?? ""} onChange={(e) => upd({ link: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label={`Bio (${(v.bio ?? "").length}/150)`}><textarea className="input" value={v.bio ?? ""} onChange={(e) => upd({ bio: e.target.value })} /></Field></div>
        </div>
        <div className="space-y-3 rounded-lg border border-areia bg-areia/30 p-4 text-sm">
          <p className="font-medium">Seguidores exibidos (hipotéticos)</p>
          <label className="flex flex-wrap items-center gap-2">
            <input type="radio" checked={v.followersMode === "scenario"} onChange={() => upd({ followersMode: "scenario" })} /> Do cenário de referência do Growth Simulator, no marco:
            <select className="input w-auto" value={v.followersMonths} onChange={(e) => upd({ followersMode: "scenario", followersMonths: Number(e.target.value) })}>
              {[[0, "lançamento"], [1, "1 mês"], [3, "3 meses"], [6, "6 meses"], [12, "12 meses"]].map(([m, l]) => <option key={m} value={m}>{l} ({num(followersByMonth[m as number] ?? 0)})</option>)}
            </select>
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <input type="radio" checked={v.followersMode === "manual"} onChange={() => upd({ followersMode: "manual" })} /> Número informado:
            <input type="number" min={0} className="input w-32" value={v.hypotheticalFollowers} onChange={(e) => upd({ followersMode: "manual", hypotheticalFollowers: Number(e.target.value) })} />
          </label>
          <Field label="Seguindo"><input type="number" min={0} className="input w-32" value={v.hypotheticalFollowing} onChange={(e) => upd({ hypotheticalFollowing: Number(e.target.value) })} /></Field>
        </div>
      </fieldset>
      {!ro && (
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => { setV(profile); onChange(null); }}>Descartar</button>
          <button className="btn-primary" disabled={pending}>Salvar perfil</button>
        </div>
      )}
    </form>
  );
}

function HighlightsEditor({ highlights, stories }: { highlights: IgHighlight[]; stories: IgPub[] }) {
  const p = useProject();
  const { exec } = useAction();
  const save = (h: IgHighlight, patch: Partial<IgHighlight>) => {
    const n = { ...h, ...patch };
    exec(() => saveEntityAction(p.projectId, "highlight", h.id, { title: n.title, coverColor: n.coverColor ?? "", coverFileId: n.coverFileId ?? "", order: n.order }), { success: "Destaque atualizado." });
  };
  const sorted = [...highlights].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-4">
      <p className="text-sm text-carvao/70">Os destaques aparecem abaixo da bio. No celular, toque em um destaque para ver os stories ligados a ele (escolha o destaque ao editar cada story).</p>
      {sorted.map((h, i) => (
        <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-areia bg-white p-3">
          <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-areia" style={h.coverFileId ? { background: `url('/api/files/${h.coverFileId}') center/cover` } : { background: h.coverColor ?? "#E9E2D8" }} />
          <div className="min-w-0 flex-1 space-y-2">
            <input className="input" defaultValue={h.title} disabled={!p.can("edit")} onBlur={(e) => e.target.value.trim() && e.target.value !== h.title && save(h, { title: e.target.value.trim() })} aria-label="Título do destaque" />
            <div className="flex flex-wrap items-center gap-2 text-xs text-carvao/60">
              {p.can("edit") && <UploadButton projectId={p.projectId} folder="instagram" accept="image/png,image/jpeg,image/webp" multiple={false} label={h.coverFileId ? "Trocar capa" : "Enviar capa"} onUploaded={(f) => save(h, { coverFileId: f[0].id })} />}
              {h.coverFileId && p.can("edit") && <button className="btn-ghost btn-sm" onClick={() => save(h, { coverFileId: null })}>Usar cor</button>}
              <input type="color" value={h.coverColor ?? "#E9E2D8"} disabled={!p.can("edit")} onChange={(e) => save(h, { coverColor: e.target.value.toUpperCase() })} aria-label="Cor da capa" />
              <span>{stories.filter((s) => s.highlightId === h.id).length} story(s)</span>
            </div>
          </div>
          {p.can("edit") && (
            <div className="flex flex-col gap-1">
              {i > 0 && <button className="btn-secondary btn-sm" onClick={() => { save(h, { order: sorted[i - 1].order }); save(sorted[i - 1], { order: h.order === sorted[i - 1].order ? h.order + 1 : h.order }); }} aria-label="Subir">↑</button>}
              <ConfirmButton message={`Excluir o destaque “${h.title}”? Os stories continuam salvos.`} onConfirm={() => exec(() => deleteEntityAction(p.projectId, "highlight", h.id), { success: "Destaque excluído." })} />
            </div>
          )}
        </div>
      ))}
      {sorted.length === 0 && <p className="rounded-xl border border-dashed border-taupe/50 p-6 text-center text-sm text-carvao/60">Nenhum destaque ainda.</p>}
      {p.can("edit") && (
        <button className="btn-primary btn-sm" onClick={() => exec(() => saveEntityAction(p.projectId, "highlight", null, { title: "Novo destaque", coverColor: "#E9E2D8", coverFileId: "", order: sorted.length ? Math.max(...sorted.map((x) => x.order)) + 1 : 0 }), { success: "Destaque criado." })}>+ Novo destaque</button>
      )}
    </div>
  );
}

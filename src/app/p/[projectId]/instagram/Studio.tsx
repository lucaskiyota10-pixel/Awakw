"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/project-context";
import { Badge, Field, Modal, PageHeader, SimBanner, Tabs, useAction } from "@/components/ui";
import { UploadButton } from "@/components/Upload";
import { CrudTable } from "@/components/Crud";
import { PhoneProfile, Media } from "@/components/instagram/PhoneProfile";
import { PublicationEditor } from "@/components/instagram/PublicationEditor";
import { PostPreview } from "@/components/instagram/PostPreview";
import { reorderFeedAction, saveProfileAction } from "@/app/actions/creative";
import { PUB_STATUS_LABEL, PUB_TYPE_LABEL } from "@/lib/labels";
import { dateTimeBr } from "@/lib/format";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "@/components/instagram/types";

export function Studio({ profile, highlights, pubs, files, campaigns }: { profile: IgProfile; highlights: IgHighlight[]; pubs: IgPub[]; files: MediaFile[]; campaigns: { id: string; name: string }[] }) {
  const p = useProject();
  const router = useRouter();
  const { exec } = useAction();
  const fileMap = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const [tab, setTab] = useState<"posts" | "perfil" | "destaques" | "stories">("posts");
  const [open, setOpen] = useState<IgPub | "new" | null>(null);
  const [present, setPresent] = useState(false);
  const [storyIdx, setStoryIdx] = useState<number | null>(null);
  const [order, setOrder] = useState<IgPub[] | null>(null);
  const shownPubs = order ?? pubs;
  const stories = pubs.filter((x) => x.type === "STORY");

  return (
    <div>
      <PageHeader
        title="Instagram Studio"
        subtitle="Simulador de perfil fictício, independente de conta real. Arraste as miniaturas no celular para reorganizar o feed."
        actions={<>
          <button className="btn-secondary" onClick={() => setPresent(true)}>Apresentar perfil</button>
          {p.can("edit") && <button className="btn-primary" onClick={() => setOpen("new")}>Nova publicação</button>}
        </>}
      />
      <SimBanner className="mb-6" />
      <div className="grid gap-8 xl:grid-cols-[380px_1fr]">
        <div>
          <PhoneProfile
            profile={profile}
            highlights={highlights}
            pubs={shownPubs}
            files={fileMap}
            editable={p.can("edit")}
            onSelect={(x) => setOpen(x)}
            onReorder={(ids) => {
              const reordered = ids.map((id, i) => ({ ...pubs.find((x) => x.id === id)!, feedOrder: i }));
              setOrder([...reordered, ...pubs.filter((x) => x.type === "STORY")]);
              exec(() => reorderFeedAction(p.projectId, ids), { success: "Feed reorganizado.", onOk: () => setOrder(null) });
            }}
          />
          {stories.length > 0 && <button className="btn-secondary btn-sm mx-auto mt-3 flex" onClick={() => setStoryIdx(0)}>Ver stories ({stories.length})</button>}
        </div>
        <div className="min-w-0">
          <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: "posts", label: `Publicações (${pubs.length})` }, { value: "perfil", label: "Perfil" }, { value: "destaques", label: "Destaques" }, { value: "stories", label: "Stories" }]} /></div>
          {tab === "posts" && (
            <div className="card overflow-x-auto p-0">
              <table className="table">
                <thead><tr><th></th><th>Publicação</th><th>Formato</th><th>Data</th><th>Status</th><th>Responsável</th></tr></thead>
                <tbody>
                  {shownPubs.map((x) => (
                    <tr key={x.id} className="cursor-pointer hover:bg-areia/30" onClick={() => setOpen(x)}>
                      <td><div className="h-10 w-10 overflow-hidden rounded"><Media id={x.mediaFileIds[0]} files={fileMap} color={x.coverColor} label="" /></div></td>
                      <td className="font-medium">{x.title}</td>
                      <td>{PUB_TYPE_LABEL[x.type]}</td>
                      <td className="whitespace-nowrap">{x.scheduledAt ? dateTimeBr(x.scheduledAt) : "—"}</td>
                      <td><Badge tone={x.status === "APPROVED" || x.status === "SCHEDULED" ? "ok" : "neutral"}>{PUB_STATUS_LABEL[x.status]}</Badge></td>
                      <td>{p.memberName(x.responsibleId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "perfil" && <ProfileForm profile={profile} files={files} onSaved={() => router.refresh()} />}
          {tab === "destaques" && (
            <div className="card">
              <p className="mb-3 text-sm text-carvao/70">Capas: use uma cor (#hex) ou o id de uma imagem da aba Arquivos.</p>
              <CrudTable entity="highlight" rows={highlights as unknown as (Record<string, unknown> & { id: string })[]} />
            </div>
          )}
          {tab === "stories" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stories.map((s, i) => (
                <button key={s.id} className="aspect-[9/16] overflow-hidden rounded-xl border" onClick={() => setStoryIdx(i)}><Media id={s.mediaFileIds[0]} files={fileMap} color={s.coverColor} label={s.title} /></button>
              ))}
              {stories.length === 0 && <p className="text-sm text-carvao/50">Nenhum story. Crie uma publicação no formato Story.</p>}
            </div>
          )}
        </div>
      </div>
      <Modal open={open !== null} onClose={() => setOpen(null)} title={open === "new" ? "Nova publicação" : "Publicação"} wide>
        {open !== null && <PublicationEditor pub={open === "new" ? null : open} profile={profile} files={files} campaigns={campaigns} onDone={() => setOpen(null)} />}
      </Modal>
      {present && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-carvao/95 p-6" onClick={() => setPresent(false)}>
          <div onClick={(e) => e.stopPropagation()} className="space-y-3">
            <PhoneProfile profile={profile} highlights={highlights} pubs={pubs} files={fileMap} onSelect={(x) => { setPresent(false); setOpen(x); }} />
            <p className="text-center text-xs text-marfim/70">Perfil fictício — números hipotéticos. Clique fora para sair.</p>
          </div>
        </div>
      )}
      {storyIdx !== null && stories[storyIdx] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carvao/95 p-6" onClick={() => setStoryIdx(null)}>
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-4">
            <button className="btn-secondary" disabled={storyIdx === 0} onClick={() => setStoryIdx(storyIdx - 1)} aria-label="Anterior">‹</button>
            <PostPreview pub={stories[storyIdx]} profile={profile} files={fileMap} />
            <button className="btn-secondary" disabled={storyIdx >= stories.length - 1} onClick={() => setStoryIdx(storyIdx + 1)} aria-label="Próximo">›</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileForm({ profile, files, onSaved }: { profile: IgProfile; files: MediaFile[]; onSaved: () => void }) {
  const p = useProject();
  const { exec, pending } = useAction();
  const [v, setV] = useState(profile);
  return (
    <form className="card grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); exec(() => saveProfileAction(p.projectId, v as unknown as Record<string, unknown>), { success: "Perfil salvo.", onOk: onSaved }); }}>
      <fieldset disabled={!p.can("edit")} className="contents">
        <Field label="Nome exibido"><input className="input" value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} /></Field>
        <Field label="Usuário (@)"><input className="input" value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} /></Field>
        <Field label="Categoria"><input className="input" value={v.category ?? ""} onChange={(e) => setV({ ...v, category: e.target.value })} /></Field>
        <Field label="Link"><input className="input" value={v.link ?? ""} onChange={(e) => setV({ ...v, link: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label={`Bio (${(v.bio ?? "").length}/150)`}><textarea className="input" value={v.bio ?? ""} onChange={(e) => setV({ ...v, bio: e.target.value })} /></Field></div>
        <Field label="Foto de perfil">
          <div className="flex gap-2">
            <select className="input" value={v.avatarFileId ?? ""} onChange={(e) => setV({ ...v, avatarFileId: e.target.value || null })}>
              <option value="">Inicial do nome</option>
              {files.filter((f) => f.mime.startsWith("image/")).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <UploadButton projectId={p.projectId} folder="instagram" accept="image/png,image/jpeg,image/webp" multiple={false} label="Enviar" onUploaded={(f) => setV({ ...v, avatarFileId: f[0].id })} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Seguidores (hipotético)"><input type="number" min={0} className="input" value={v.hypotheticalFollowers} onChange={(e) => setV({ ...v, hypotheticalFollowers: Number(e.target.value) })} /></Field>
          <Field label="Seguindo"><input type="number" min={0} className="input" value={v.hypotheticalFollowing} onChange={(e) => setV({ ...v, hypotheticalFollowing: Number(e.target.value) })} /></Field>
        </div>
      </fieldset>
      {p.can("edit") && <div className="flex justify-end sm:col-span-2"><button className="btn-primary" disabled={pending}>Salvar perfil</button></div>}
    </form>
  );
}

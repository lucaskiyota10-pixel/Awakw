"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/project-context";
import { ConfirmButton, Field, PageHeader, Tabs, useAction } from "@/components/ui";
import { UploadButton } from "@/components/Upload";
import {
  updateProjectAction,
  updateBrandAction,
  updateAcademicAction,
  inviteAction,
  revokeInviteAction,
  updateMemberAction,
  removeMemberAction,
  deleteProjectAction,
} from "@/app/actions/project";
import { changePasswordAction } from "@/app/actions/auth";
import { ROLE_LABEL, canAssignRole, type RoleName } from "@/lib/permissions";
import { SECTORS } from "@/lib/labels";
import { dateBr } from "@/lib/format";
import type { Brand } from "@/lib/brand";

const BRIEFING_FIELDS: [string, string][] = [
  ["client", "Cliente"],
  ["products", "Produtos"],
  ["differentials", "Diferenciais"],
  ["audience", "Público prioritário"],
  ["ticket", "Ticket médio"],
  ["launch", "Lançamento (briefing)"],
  ["objectives", "Objetivos"],
  ["archetypes", "Arquétipos"],
  ["tone", "Tom de voz"],
  ["history", "Histórico de mídia"],
];

export const ACADEMIC_FIELDS: [string, string][] = [
  ["faculdade", "Faculdade / instituição"],
  ["curso", "Curso"],
  ["disciplina", "Disciplina"],
  ["professor", "Professor(a)"],
  ["semestre", "Semestre"],
  ["integrantes", "Integrantes (um por linha)"],
  ["titulo", "Título do trabalho"],
  ["subtitulo", "Subtítulo"],
  ["cidade", "Cidade"],
  ["ano", "Ano"],
];

type Tab = "projeto" | "marca" | "equipe" | "academico" | "conta";

interface Props {
  project: { name: string; alternateName: string | null; officialNameConfirmed: boolean; segment: string | null; launchDate: string; launchDateConfirmed: boolean; briefing: Record<string, string>; academic: Record<string, string> };
  brand: Brand;
  members: { id: string; name: string; email: string; role: RoleName; sector: string | null; responsibilities: string | null }[];
  invites: { id: string; email: string; role: string; sector: string | null; expiresAt: string }[];
  images: { id: string; name: string }[];
}

export function Settings(props: Props) {
  const p = useProject();
  const [tab, setTab] = useState<Tab>("projeto");
  return (
    <div>
      <PageHeader title="Configurações" subtitle="Projeto, identidade visual, equipe, dados acadêmicos e conta." />
      <div className="mb-6"><Tabs value={tab} onChange={setTab} items={[{ value: "projeto", label: "Projeto e briefing" }, { value: "marca", label: "Identidade visual" }, { value: "equipe", label: "Equipe e convites" }, { value: "academico", label: "Dados acadêmicos" }, { value: "conta", label: "Minha conta" }]} /></div>
      {tab === "projeto" && <ProjectTab {...props} readOnly={!p.can("manage")} />}
      {tab === "marca" && <BrandTab brand={props.brand} images={props.images} readOnly={!p.can("manage")} />}
      {tab === "equipe" && <TeamTab {...props} />}
      {tab === "academico" && <AcademicTab academic={props.project.academic} readOnly={!p.can("edit")} />}
      {tab === "conta" && <AccountTab />}
    </div>
  );
}

function ProjectTab({ project, readOnly }: Props & { readOnly: boolean }) {
  const p = useProject();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [v, setV] = useState(project);
  const [confirmName, setConfirmName] = useState("");
  return (
    <div className="space-y-6">
      <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => updateProjectAction(p.projectId, { ...v, launchDate: v.launchDate || null }), { success: "Projeto atualizado." }); }}>
        <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do projeto/cliente"><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Grafia alternativa (briefing)"><input className="input" value={v.alternateName ?? ""} onChange={(e) => setV({ ...v, alternateName: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={v.officialNameConfirmed} onChange={(e) => setV({ ...v, officialNameConfirmed: e.target.checked })} /> Nome oficial confirmado pelo cliente (libera emissão de documentos sem alerta)</label>
          <Field label="Segmento"><input className="input" value={v.segment ?? ""} onChange={(e) => setV({ ...v, segment: e.target.value })} /></Field>
          <Field label="Data de lançamento"><input type="date" className="input" value={v.launchDate} onChange={(e) => setV({ ...v, launchDate: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={v.launchDateConfirmed} onChange={(e) => setV({ ...v, launchDateConfirmed: e.target.checked })} /> Data de lançamento confirmada</label>
          {BRIEFING_FIELDS.map(([k, l]) => (
            <div key={k} className="sm:col-span-2"><Field label={l}><textarea className="input min-h-[60px]" value={v.briefing[k] ?? ""} onChange={(e) => setV({ ...v, briefing: { ...v.briefing, [k]: e.target.value } })} /></Field></div>
          ))}
        </fieldset>
        {!readOnly && <div className="flex justify-end"><button className="btn-primary" disabled={pending}>Salvar</button></div>}
        {readOnly && <p className="text-xs text-carvao/60">Somente administradores editam o projeto.</p>}
      </form>
      {!readOnly && (
        <div className="card border-red-200">
          <h3 className="card-title text-red-800">Excluir projeto</h3>
          <p className="text-sm">Remove definitivamente todos os dados do projeto. Digite o nome exato para confirmar.</p>
          <div className="mt-3 flex gap-2">
            <input className="input" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={project.name} aria-label="Confirme o nome do projeto" />
            <ConfirmButton disabled={confirmName !== project.name} onConfirm={() => exec(() => deleteProjectAction(p.projectId, confirmName), { success: "Projeto excluído.", refresh: false, onOk: () => router.push("/projetos") })}>Excluir projeto</ConfirmButton>
          </div>
        </div>
      )}
    </div>
  );
}

const SERIFS = ["Cormorant Garamond", "Playfair Display", "Libre Baskerville", "DM Serif Display"] as const;
const SANS = ["Inter", "Manrope", "Work Sans", "Lato"] as const;

function BrandTab({ brand, images, readOnly }: { brand: Brand; images: { id: string; name: string }[]; readOnly: boolean }) {
  const p = useProject();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [b, setB] = useState(brand);
  const colorKeys: [keyof Brand["colors"], string][] = [["carvao", "Carvão (texto/primária)"], ["taupe", "Taupe"], ["areia", "Areia"], ["marfim", "Marfim (fundo)"], ["destaque", "Destaque"]];
  return (
    <form className="card space-y-5" onSubmit={(e) => { e.preventDefault(); exec(() => updateBrandAction(p.projectId, b as Parameters<typeof updateBrandAction>[1]), { success: "Identidade atualizada." }); }}>
      <fieldset disabled={readOnly} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome exibido"><input className="input" value={b.displayName} onChange={(e) => setB({ ...b, displayName: e.target.value })} /></Field>
          <Field label="Logo (imagem do projeto)">
            <div className="flex gap-2">
              <select className="input" value={b.logoFileId ?? ""} onChange={(e) => setB({ ...b, logoFileId: e.target.value || null })}>
                <option value="">Sem logo (inicial do nome)</option>
                {images.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <UploadButton projectId={p.projectId} folder="marca" accept="image/png,image/jpeg,image/webp" multiple={false} label="Enviar" onUploaded={(f) => { setB({ ...b, logoFileId: f[0].id }); router.refresh(); }} />
            </div>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {colorKeys.map(([k, l]) => (
            <Field key={k} label={l}>
              <div className="flex items-center gap-2">
                <input type="color" value={b.colors[k]} onChange={(e) => setB({ ...b, colors: { ...b.colors, [k]: e.target.value.toUpperCase() } })} className="h-9 w-10 rounded border" aria-label={l} />
                <input className="input" value={b.colors[k]} onChange={(e) => setB({ ...b, colors: { ...b.colors, [k]: e.target.value } })} />
              </div>
            </Field>
          ))}
        </div>
        <div className="rounded-lg border border-areia p-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.roseOption} onChange={(e) => setB({ ...b, roseOption: e.target.checked })} /> Usar opção visual “rosa modernidade” como destaque</label>
          <p className="mt-1 text-xs text-carvao/60">Mencionada no briefing; disponível como opção configurável, sem ser tratada como cor oficial aprovada.</p>
          <div className="mt-2 flex items-center gap-2"><input type="color" value={b.roseColor} onChange={(e) => setB({ ...b, roseColor: e.target.value.toUpperCase() })} className="h-9 w-10 rounded border" aria-label="Tom de rosa" /><span className="text-xs">{b.roseColor}</span></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fonte de títulos"><select className="input" value={b.fontSerif} onChange={(e) => setB({ ...b, fontSerif: e.target.value })}>{SERIFS.map((f) => <option key={f}>{f}</option>)}</select></Field>
          <Field label="Fonte de texto"><select className="input" value={b.fontSans} onChange={(e) => setB({ ...b, fontSans: e.target.value })}>{SANS.map((f) => <option key={f}>{f}</option>)}</select></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setB({ ...b, colors: { carvao: "#252521", taupe: "#B6A18B", areia: "#E9E2D8", marfim: "#F8F6F1", destaque: "#B6A18B" }, roseOption: false })}>Restaurar Quiet Luxury</button>
        </div>
        <div className="flex gap-2 rounded-lg p-4" style={{ background: b.colors.marfim, color: b.colors.carvao }}>
          {Object.values(b.colors).map((c, i) => <span key={i} className="h-10 w-10 rounded-full border" style={{ background: c }} />)}
          {b.roseOption && <span className="h-10 w-10 rounded-full border" style={{ background: b.roseColor }} />}
          <span className="ml-3 self-center" style={{ fontFamily: b.fontSerif, fontSize: 24 }}>{b.displayName}</span>
        </div>
      </fieldset>
      {!readOnly && <div className="flex justify-end"><button className="btn-primary" disabled={pending}>Salvar identidade</button></div>}
    </form>
  );
}

function TeamTab({ members, invites }: Props) {
  const p = useProject();
  const { exec, pending } = useAction();
  const [inv, setInv] = useState({ email: "", name: "", role: "MEMBER" as RoleName, sector: "", responsibilities: "" });
  const [lastLink, setLastLink] = useState<{ link: string; sent: boolean } | null>(null);
  const [edit, setEdit] = useState<Record<string, { role: RoleName; sector: string; responsibilities: string }>>({});
  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Integrante</th><th>Papel</th><th>Setor</th><th>Responsabilidades</th><th data-admin></th></tr></thead>
          <tbody>
            {members.map((m) => {
              const e = edit[m.id] ?? { role: m.role, sector: m.sector ?? "", responsibilities: m.responsibilities ?? "" };
              const changed = edit[m.id] !== undefined;
              return (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong><br /><span className="text-xs text-carvao/60">{m.email}</span></td>
                  <td>
                    {p.can("manage") ? (
                      <select className="input" value={e.role} onChange={(ev) => setEdit({ ...edit, [m.id]: { ...e, role: ev.target.value as RoleName } })}>
                        {(Object.keys(ROLE_LABEL) as RoleName[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    ) : ROLE_LABEL[m.role]}
                  </td>
                  <td>{p.can("manage") ? <input className="input" list="sectors" value={e.sector} onChange={(ev) => setEdit({ ...edit, [m.id]: { ...e, sector: ev.target.value } })} /> : m.sector}</td>
                  <td>{p.can("manage") ? <input className="input" value={e.responsibilities} onChange={(ev) => setEdit({ ...edit, [m.id]: { ...e, responsibilities: ev.target.value } })} /> : m.responsibilities}</td>
                  <td className="whitespace-nowrap" data-admin>
                    {p.can("manage") && (
                      <div className="flex gap-1">
                        <button className="btn-secondary btn-sm" disabled={!changed} onClick={() => exec(() => updateMemberAction(p.projectId, m.id, e), { success: "Integrante atualizado.", onOk: () => { const n = { ...edit }; delete n[m.id]; setEdit(n); } })}>Salvar</button>
                        {m.id !== p.userId && <ConfirmButton message={`Remover ${m.name} da equipe? As sessões dela serão encerradas.`} onConfirm={() => exec(() => removeMemberAction(p.projectId, m.id), { success: "Removido." })}>Remover</ConfirmButton>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="sectors">{SECTORS.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      {p.can("invite") && (
        <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => inviteAction(p.projectId, inv), { success: "Convite criado.", onOk: (r) => { if (r.ok) setLastLink(r.data as { link: string; sent: boolean }); setInv({ ...inv, email: "", name: "" }); } }); }}>
          <h3 className="card-title">Convidar integrante</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="E-mail *"><input className="input" type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} required /></Field>
            <Field label="Nome"><input className="input" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} /></Field>
            <Field label="Papel">
              <select className="input" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as RoleName })}>
                {(Object.keys(ROLE_LABEL) as RoleName[]).filter((r) => canAssignRole(p.role, r)).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            <Field label="Setor"><input className="input" list="sectors" value={inv.sector} onChange={(e) => setInv({ ...inv, sector: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Responsabilidades"><input className="input" value={inv.responsibilities} onChange={(e) => setInv({ ...inv, responsibilities: e.target.value })} /></Field></div>
          </div>
          <div className="flex justify-end"><button className="btn-primary" disabled={pending}>Gerar convite</button></div>
          {lastLink && (
            <div className="rounded-lg bg-areia/60 p-3 text-sm">
              {lastLink.sent ? "E-mail enviado. " : "SMTP não configurado: envie o link abaixo manualmente (válido por 7 dias). "}
              <code className="block select-all break-all text-xs">{lastLink.link}</code>
              <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => navigator.clipboard.writeText(lastLink.link)}>Copiar link</button>
            </div>
          )}
          {invites.length > 0 && (
            <div>
              <h4 className="label mt-2">Convites pendentes</h4>
              <ul className="space-y-1 text-sm">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span>{i.email} — {ROLE_LABEL[i.role as RoleName]} {i.sector ? `(${i.sector})` : ""} · expira {dateBr(i.expiresAt)}</span>
                    <ConfirmButton message="Revogar este convite?" onConfirm={() => exec(() => revokeInviteAction(p.projectId, i.id), { success: "Convite revogado." })}>Revogar</ConfirmButton>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}
      <div className="card text-sm">
        <h3 className="card-title mb-2">Papéis</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Administrador</strong>: tudo, incluindo configurações, papéis e exclusão do projeto.</li>
          <li><strong>Coordenador</strong>: aprovações finais, decisões, verba aprovada, convites e auditoria.</li>
          <li><strong>Integrante</strong>: cria e edita conteúdo colaborativo; solicita aprovações.</li>
          <li><strong>Visualizador</strong>: leitura e comentários (ex.: professor, cliente).</li>
        </ul>
      </div>
    </div>
  );
}

function AcademicTab({ academic, readOnly }: { academic: Record<string, string>; readOnly: boolean }) {
  const p = useProject();
  const { exec, pending } = useAction();
  const [v, setV] = useState(academic);
  return (
    <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => updateAcademicAction(p.projectId, v), { success: "Dados acadêmicos salvos." }); }}>
      <p className="text-sm text-carvao/70">Usados nas capas e folhas de rosto ABNT. Campos vazios aparecem como “Pendente de preenchimento/validação”.</p>
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        {ACADEMIC_FIELDS.map(([k, l]) => (
          <div key={k} className={k === "integrantes" ? "sm:col-span-2" : ""}>
            <Field label={l}>{k === "integrantes" ? <textarea className="input min-h-[120px]" value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <input className="input" value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</Field>
          </div>
        ))}
      </fieldset>
      {!readOnly && <div className="flex justify-end"><button className="btn-primary" disabled={pending}>Salvar</button></div>}
    </form>
  );
}

function AccountTab() {
  const { exec, pending } = useAction();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  return (
    <form className="card max-w-md space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => changePasswordAction(cur, next), { success: "Senha alterada.", onOk: () => { setCur(""); setNext(""); } }); }}>
      <h3 className="card-title">Alterar senha</h3>
      <Field label="Senha atual"><input type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></Field>
      <Field label="Nova senha (mín. 10, letras e números)"><input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required /></Field>
      <div className="flex justify-end"><button className="btn-primary" disabled={pending}>Alterar</button></div>
      <p className="text-xs text-carvao/60">Privacidade (LGPD): a plataforma armazena apenas nome, e-mail, papel e o conteúdo produzido pela equipe. Solicite ao administrador a exclusão da sua conta quando desejar.</p>
    </form>
  );
}

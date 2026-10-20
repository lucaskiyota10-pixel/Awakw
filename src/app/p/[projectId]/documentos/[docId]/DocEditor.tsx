"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/project-context";
import { Avatar, Badge, ConfirmButton, Field, Modal, SimBanner, Tabs, useAction, useToast } from "@/components/ui";
import { Thread } from "@/components/Thread";
import { DocPreview } from "@/components/DocPreview";
import {
  saveDocumentAction,
  renameDocumentAction,
  getVersionsAction,
  restoreVersionAction,
  regenerateDocumentAction,
  deleteDocumentAction,
  suggestAction,
  resolveSuggestionAction,
  presenceAction,
  approveDocumentAction,
  reopenDocumentAction,
  type SaveResult,
} from "@/app/actions/documents";
import { requestApprovalAction } from "@/app/actions/collab";
import { diffLines, diffWords } from "@/lib/diff";
import { PENDING } from "@/lib/docs/markdown";
import { REVIEW_STATUS } from "@/lib/labels";
import { dateTimeBr, num } from "@/lib/format";

interface Doc {
  id: string;
  title: string;
  kind: string;
  content: string;
  version: number;
  status: string;
  approvedVersion: number | null;
  approvedById: string | null;
  approvedAt: string | null;
  updatedById: string;
  updatedAt: string;
}
interface Suggestion { id: string; authorId: string; original: string; replacement: string; note: string | null; status: string; resolvedById: string | null; createdAt: string }
interface Version { id: string; version: number; content: string; authorId: string; charsAdded: number; charsRemoved: number; note: string | null; createdAt: string }
type Conflict = Extract<SaveResult, { status: "conflict" }>;
type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";

export function DocEditor({ doc, project, images, chartKeys, suggestions }: { doc: Doc; project: { name: string; alternateName: string | null; officialNameConfirmed: boolean }; images: { id: string; name: string }[]; chartKeys: [string, string][]; suggestions: Suggestion[] }) {
  const p = useProject();
  const router = useRouter();
  const toast = useToast();
  const { exec } = useAction();
  const [content, setContent] = useState(doc.content);
  const [base, setBase] = useState(doc.version);
  const [state, setState] = useState<SaveState>("saved");
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [remoteNewer, setRemoteNewer] = useState(false);
  const [view, setView] = useState<"split" | "edit" | "preview">("split");
  const [panel, setPanel] = useState<"comments" | "suggestions" | "versions" | "export">("comments");
  const [title, setTitle] = useState(doc.title);
  const [present, setPresent] = useState<Record<string, number>>({});
  const [suggest, setSuggest] = useState<{ original: string; replacement: string; note: string } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  const baseRef = useRef(base);
  contentRef.current = content;
  baseRef.current = base;

  const locked = doc.status === "APPROVED";
  const canEdit = p.can("edit") && !locked;

  // Atualização vinda do servidor (outro autor salvou): aplica se não houver edição local pendente
  useEffect(() => {
    if (doc.version > baseRef.current) {
      if (state === "saved") {
        setContent(doc.content);
        setBase(doc.version);
        setRemoteNewer(false);
      } else setRemoteNewer(true);
    }
  }, [doc.version, doc.content]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(
    async (opts: { force?: boolean; text?: string; note?: string } = {}) => {
      const text = opts.text ?? contentRef.current;
      setState("saving");
      const r = await saveDocumentAction(p.projectId, doc.id, { content: text, baseVersion: opts.force && conflict ? conflict.serverVersion : baseRef.current, force: opts.force, note: opts.note });
      if (!r.ok) {
        setState("error");
        toast(r.error, "error");
        return;
      }
      const res = r.data as SaveResult;
      if (res.status === "conflict") {
        setConflict(res);
        setState("conflict");
        return;
      }
      setBase(res.version);
      setConflict(null);
      setRemoteNewer(false);
      setState(contentRef.current === text ? "saved" : "dirty");
    },
    [p.projectId, doc.id, conflict, toast],
  );

  // Autosave com debounce
  useEffect(() => {
    if (state !== "dirty") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 2000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, state, save]);

  // Aviso ao sair com alterações não salvas
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (state === "dirty" || state === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [state]);

  // Presença
  useEffect(() => {
    presenceAction(p.projectId, doc.id);
    const iv = setInterval(() => presenceAction(p.projectId, doc.id), 20000);
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { type: string; userId?: string; payload?: { documentId?: string } };
      if (d.type === "presence" && d.payload?.documentId === doc.id && d.userId) setPresent((x) => ({ ...x, [d.userId!]: Date.now() }));
      if (d.type === "document" && d.payload?.documentId === doc.id && d.userId !== p.userId) router.refresh();
    };
    window.addEventListener("acl:event", h);
    const prune = setInterval(() => setPresent((x) => Object.fromEntries(Object.entries(x).filter(([, t]) => Date.now() - t < 45000))), 10000);
    return () => {
      clearInterval(iv);
      clearInterval(prune);
      window.removeEventListener("acl:event", h);
    };
  }, [p.projectId, p.userId, doc.id, router]);

  const edit = (v: string) => {
    setContent(v);
    if (state !== "conflict") setState("dirty");
  };

  const insert = (before: string, after = "", placeholder = "") => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = content.slice(s, e) || placeholder;
    const next = content.slice(0, s) + before + sel + after + content.slice(e);
    edit(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const insertLine = (text: string) => {
    const el = ta.current;
    const pos = el?.selectionStart ?? content.length;
    const lineStart = content.lastIndexOf("\n", pos - 1) + 1;
    edit(content.slice(0, lineStart) + text + "\n" + content.slice(lineStart));
  };

  const others = Object.keys(present).filter((id) => id !== p.userId);
  const stateLabel: Record<SaveState, string> = { saved: `Salvo · v${base}`, dirty: "Alterações não salvas…", saving: "Salvando…", conflict: "Conflito de edição", error: "Erro ao salvar" };
  const exportUrl = (format: string, approved = false, name?: string) => `/api/export/${p.projectId}/doc/${doc.id}?format=${format}${approved ? "&versao=aprovada" : ""}${name ? `&nome=${encodeURIComponent(name)}` : ""}`;
  const pendingCount = (content.match(new RegExp(PENDING.replace(/\//g, "\\/"), "g")) ?? []).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`${p.base}/documentos`} className="text-xs text-carvao/60 hover:underline">← Documentos</Link>
          <input
            className="block w-full bg-transparent font-serif text-3xl focus:outline-none focus:ring-2 focus:ring-taupe/40"
            value={title}
            disabled={!p.can("edit")}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== doc.title && exec(() => renameDocumentAction(p.projectId, doc.id, title), { success: "Título atualizado." })}
            aria-label="Título do documento"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={doc.status === "APPROVED" ? "ok" : doc.status === "IN_REVIEW" ? "warn" : "neutral"}>{REVIEW_STATUS[doc.status]}</Badge>
            {doc.approvedVersion && <span className="text-carvao/60">Versão aprovada: v{doc.approvedVersion} por {p.memberName(doc.approvedById)} em {dateTimeBr(doc.approvedAt)}</span>}
            <span className={state === "conflict" || state === "error" ? "font-medium text-red-700" : "text-carvao/60"} role="status">{stateLabel[state]}</span>
            {pendingCount > 0 && <span className="rounded bg-yellow-100 px-1.5">{pendingCount} lacuna(s) pendente(s)</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2" aria-label="Editando agora">
            {others.map((id) => <Avatar key={id} name={p.memberName(id)} size={28} />)}
          </div>
          {others.length > 0 && <span className="text-xs text-carvao/60">{others.length} pessoa(s) com o documento aberto</span>}
          <Tabs value={view} onChange={setView} items={[{ value: "edit", label: "Editar" }, { value: "split", label: "Lado a lado" }, { value: "preview", label: "Visualizar" }]} />
        </div>
      </div>

      {remoteNewer && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Outra pessoa salvou uma versão mais nova enquanto você editava. Ao salvar, você poderá comparar e mesclar.</div>}
      {locked && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Documento aprovado e bloqueado para edição. {p.can("approve") && <button className="underline" onClick={() => exec(() => reopenDocumentAction(p.projectId, doc.id), { success: "Documento reaberto; a versão aprovada continua disponível para exportação." })}>Reabrir para edição</button>}</div>}

      <div className="grid gap-4 2xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-2">
          {canEdit && view !== "preview" && (
            <div className="flex flex-wrap gap-1 rounded-lg border border-areia bg-white p-1" role="toolbar" aria-label="Formatação">
              <button className="btn-ghost btn-sm" onClick={() => insertLine("# Título de seção")}>H1</button>
              <button className="btn-ghost btn-sm" onClick={() => insertLine("## Subseção")}>H2</button>
              <button className="btn-ghost btn-sm" onClick={() => insertLine("### Seção terciária")}>H3</button>
              <button className="btn-ghost btn-sm font-bold" onClick={() => insert("**", "**", "negrito")}>B</button>
              <button className="btn-ghost btn-sm italic" onClick={() => insert("*", "*", "itálico")}>I</button>
              <button className="btn-ghost btn-sm" onClick={() => insertLine("- item")}>• Lista</button>
              <button className="btn-ghost btn-sm" onClick={() => insertLine("1. item")}>1. Lista</button>
              <button className="btn-ghost btn-sm" onClick={() => insertLine("| Coluna A | Coluna B |\n| --- | --- |\n| valor | valor |")}>Tabela</button>
              <button className="btn-ghost btn-sm" onClick={() => insertLine("> Citação longa")}>Citação</button>
              <select className="rounded border border-areia px-1 text-xs" value="" onChange={(e) => e.target.value && insertLine(`![Legenda da figura](file:${e.target.value})`)} aria-label="Inserir imagem">
                <option value="">Imagem…</option>
                {images.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <select className="rounded border border-areia px-1 text-xs" value="" onChange={(e) => e.target.value && insertLine(`![${chartKeys.find((k) => k[0] === e.target.value)?.[1]}](chart:${e.target.value})`)} aria-label="Inserir gráfico">
                <option value="">Gráfico…</option>
                {chartKeys.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button className="btn-ghost btn-sm" onClick={() => insert(`**${PENDING}**`)}>Marcar pendente</button>
              <button className="btn-ghost btn-sm" onClick={() => insertLine("[[quebra]]")}>Quebra de página</button>
              <span className="mx-1 w-px bg-areia" />
              <button className="btn-ghost btn-sm" onClick={() => { const el = ta.current; if (!el || el.selectionStart === el.selectionEnd) return toast("Selecione um trecho para sugerir alteração.", "error"); const o = content.slice(el.selectionStart, el.selectionEnd); setSuggest({ original: o, replacement: o, note: "" }); }}>Sugerir alteração</button>
              <button className="btn-secondary btn-sm ml-auto" onClick={() => save({ note: "Salvamento manual" })} disabled={state === "saving"}>Salvar versão</button>
            </div>
          )}
          {!canEdit && p.can("view") && !locked && <p className="text-xs text-carvao/60">Você pode ler, comentar e sugerir alterações (selecione o texto na visualização de edição).</p>}
          <div className={`grid gap-4 ${view === "split" ? "lg:grid-cols-2" : ""}`}>
            {view !== "preview" && (
              <textarea
                ref={ta}
                className="input min-h-[70vh] resize-y font-mono text-[13px] leading-relaxed"
                value={content}
                readOnly={!canEdit}
                onChange={(e) => edit(e.target.value)}
                spellCheck
                lang="pt-BR"
                aria-label="Conteúdo do documento (Markdown)"
              />
            )}
            {view !== "edit" && <div className="max-h-[75vh] overflow-y-auto rounded-xl bg-areia/40 p-3"><DocPreview projectId={p.projectId} content={content} /></div>}
          </div>
          {!canEdit && !locked && view !== "preview" && (
            <button className="btn-secondary btn-sm" onClick={() => { const el = ta.current; if (!el || el.selectionStart === el.selectionEnd) return toast("Selecione um trecho.", "error"); const o = content.slice(el.selectionStart, el.selectionEnd); setSuggest({ original: o, replacement: o, note: "" }); }}>Sugerir alteração no trecho selecionado</button>
          )}
        </div>

        <aside className="card min-w-0 space-y-4 p-4">
          <Tabs value={panel} onChange={setPanel} items={[{ value: "comments", label: "Comentários" }, { value: "suggestions", label: `Sugestões (${suggestions.filter((s) => s.status === "OPEN").length})` }, { value: "versions", label: "Versões" }, { value: "export", label: "Exportar" }]} />
          {panel === "comments" && <Thread targetType="document" targetId={doc.id} link={`${p.base}/documentos/${doc.id}`} />}
          {panel === "suggestions" && (
            <ul className="space-y-3">
              {suggestions.length === 0 && <li className="text-sm text-carvao/50">Nenhuma sugestão. Selecione um trecho e use “Sugerir alteração”.</li>}
              {suggestions.map((s) => (
                <li key={s.id} className="rounded-lg border border-areia p-2 text-sm">
                  <p className="text-xs text-carvao/60">{p.memberName(s.authorId)} · {dateTimeBr(s.createdAt)} · {s.status === "OPEN" ? "aberta" : s.status === "ACCEPTED" ? `aceita por ${p.memberName(s.resolvedById)}` : `rejeitada por ${p.memberName(s.resolvedById)}`}</p>
                  <p className="mt-1 whitespace-pre-wrap">{diffWords(s.original, s.replacement).map((d, i) => <span key={i} className={d.type === "add" ? "bg-emerald-100" : d.type === "del" ? "bg-red-100 line-through" : ""}>{d.text}</span>)}</p>
                  {s.note && <p className="text-xs italic text-carvao/60">{s.note}</p>}
                  {s.status === "OPEN" && p.can("edit") && !locked && (
                    <div className="mt-2 flex gap-1">
                      <button className="btn-primary btn-sm" onClick={() => exec(() => resolveSuggestionAction(p.projectId, s.id, true), { success: "Sugestão aplicada." })} disabled={state !== "saved"} title={state !== "saved" ? "Salve suas alterações antes" : ""}>Aceitar</button>
                      <button className="btn-secondary btn-sm" onClick={() => exec(() => resolveSuggestionAction(p.projectId, s.id, false), { success: "Sugestão rejeitada." })}>Rejeitar</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {panel === "versions" && <Versions docId={doc.id} current={content} canRestore={canEdit} onRestored={() => router.refresh()} />}
          {panel === "export" && (
            <ExportPanel project={project} exportUrl={exportUrl} approvedVersion={doc.approvedVersion} dirty={state !== "saved"} />
          )}
          <div className="space-y-2 border-t border-areia pt-3" data-admin>
            {p.can("edit") && doc.status !== "APPROVED" && (
              <button className="btn-secondary btn-sm w-full" onClick={() => exec(() => requestApprovalAction(p.projectId, "document", doc.id, title), { success: "Aprovação solicitada." })}>Solicitar aprovação final</button>
            )}
            {p.can("approve") && doc.status !== "APPROVED" && (
              <ConfirmButton className="btn-primary btn-sm w-full" message={`Aprovar a versão v${base} como final? O documento ficará bloqueado para edição.`} onConfirm={async () => { if (state !== "saved") await save(); exec(() => approveDocumentAction(p.projectId, doc.id), { success: "Versão aprovada." }); }}>Aprovar versão final</ConfirmButton>
            )}
            {canEdit && <ConfirmButton className="btn-secondary btn-sm w-full" message="Substituir o conteúdo pelo gerado com os dados atuais do projeto? O conteúdo atual permanece no histórico de versões." onConfirm={() => exec(() => regenerateDocumentAction(p.projectId, doc.id), { success: "Documento regenerado." })}>Regenerar com dados atuais</ConfirmButton>}
            {p.can("edit") && <ConfirmButton className="btn-danger btn-sm w-full" onConfirm={() => exec(() => deleteDocumentAction(p.projectId, doc.id), { success: "Documento excluído.", refresh: false, onOk: () => router.push(`${p.base}/documentos`) })}>Excluir documento</ConfirmButton>}
          </div>
        </aside>
      </div>

      <Modal open={!!conflict} onClose={() => {}} title="Conflito de edição" wide>
        {conflict && (
          <ConflictResolver
            mine={content}
            conflict={conflict}
            authorName={p.memberName(conflict.serverAuthor)}
            onUseServer={() => { setContent(conflict.serverContent); setBase(conflict.serverVersion); setConflict(null); setState("saved"); }}
            onKeepMine={() => save({ force: true })}
            onMerge={(merged) => { setContent(merged); save({ force: true, text: merged, note: "Mesclagem manual de versões concorrentes" }); }}
          />
        )}
      </Modal>
      <Modal open={!!suggest} onClose={() => setSuggest(null)} title="Sugerir alteração">
        {suggest && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); exec(() => suggestAction(p.projectId, doc.id, suggest), { success: "Sugestão enviada.", onOk: () => setSuggest(null) }); }}>
            <Field label="Trecho original"><textarea className="input min-h-[80px] bg-areia/30" readOnly value={suggest.original} /></Field>
            <Field label="Proposta"><textarea className="input min-h-[100px]" value={suggest.replacement} onChange={(e) => setSuggest({ ...suggest, replacement: e.target.value })} /></Field>
            <Field label="Justificativa (opcional)"><input className="input" value={suggest.note} onChange={(e) => setSuggest({ ...suggest, note: e.target.value })} /></Field>
            <div className="flex justify-end"><button className="btn-primary">Enviar sugestão</button></div>
          </form>
        )}
      </Modal>
      <SimBanner />
    </div>
  );
}

function ConflictResolver({ mine, conflict, authorName, onUseServer, onKeepMine, onMerge }: { mine: string; conflict: Conflict; authorName: string; onUseServer: () => void; onKeepMine: () => void; onMerge: (t: string) => void }) {
  const [merged, setMerged] = useState(mine);
  const [mode, setMode] = useState<"diff" | "merge">("diff");
  return (
    <div className="space-y-3">
      <p className="text-sm">{authorName} salvou a versão v{conflict.serverVersion} em {dateTimeBr(conflict.serverUpdatedAt)} enquanto você editava. Nada foi perdido: escolha como continuar.</p>
      <Tabs value={mode} onChange={setMode} items={[{ value: "diff", label: "Diferenças (servidor → sua versão)" }, { value: "merge", label: "Mesclar manualmente" }]} />
      {mode === "diff" ? (
        <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-areia bg-white p-3 text-xs">
          {diffLines(conflict.serverContent, mine).map((d, i) => <span key={i} className={d.type === "add" ? "bg-emerald-100" : d.type === "del" ? "bg-red-100 line-through" : "text-carvao/60"}>{d.text}</span>)}
        </pre>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          <div><p className="label">Versão do servidor (somente leitura)</p><textarea className="input h-[45vh] font-mono text-xs" readOnly value={conflict.serverContent} /></div>
          <div><p className="label">Resultado da mesclagem (editável)</p><textarea className="input h-[45vh] font-mono text-xs" value={merged} onChange={(e) => setMerged(e.target.value)} /></div>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" onClick={onUseServer}>Descartar a minha e usar a do servidor</button>
        <button className="btn-secondary" onClick={onKeepMine}>Gravar a minha por cima</button>
        {mode === "merge" && <button className="btn-primary" onClick={() => onMerge(merged)}>Salvar mesclagem</button>}
      </div>
    </div>
  );
}

function Versions({ docId, current, canRestore, onRestored }: { docId: string; current: string; canRestore: boolean; onRestored: () => void }) {
  const p = useProject();
  const { exec } = useAction();
  const [list, setList] = useState<Version[] | null>(null);
  const [view, setView] = useState<Version | null>(null);
  useEffect(() => {
    getVersionsAction(p.projectId, docId).then((r) => r.ok && setList(r.data as Version[]));
  }, [p.projectId, docId]);
  return (
    <div>
      <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
        {list === null && <li className="text-sm text-carvao/50">Carregando…</li>}
        {list?.map((v) => (
          <li key={v.id} className="rounded-lg border border-areia p-2 text-sm">
            <div className="flex items-center justify-between">
              <strong>v{v.version}</strong>
              <span className="text-xs text-carvao/60">{dateTimeBr(v.createdAt)}</span>
            </div>
            <p className="text-xs">{p.memberName(v.authorId)} · <span className="text-emerald-700">+{num(v.charsAdded)}</span> <span className="text-red-700">−{num(v.charsRemoved)}</span></p>
            {v.note && <p className="text-xs italic text-carvao/60">{v.note}</p>}
            <div className="mt-1 flex gap-1">
              <button className="btn-ghost btn-sm" onClick={() => setView(v)}>Comparar</button>
              {canRestore && <ConfirmButton className="btn-ghost btn-sm" message={`Restaurar a v${v.version}? Uma nova versão será criada; nada é apagado.`} onConfirm={() => exec(() => restoreVersionAction(p.projectId, docId, v.id), { success: "Versão restaurada.", onOk: onRestored })}>Restaurar</ConfirmButton>}
            </div>
          </li>
        ))}
      </ul>
      <Modal open={!!view} onClose={() => setView(null)} title={`v${view?.version} → texto atual`} wide>
        {view && (
          <pre className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap text-xs">
            {diffLines(view.content, current).map((d, i) => <span key={i} className={d.type === "add" ? "bg-emerald-100" : d.type === "del" ? "bg-red-100 line-through" : "text-carvao/60"}>{d.text}</span>)}
          </pre>
        )}
      </Modal>
    </div>
  );
}

function ExportPanel({ project, exportUrl, approvedVersion, dirty }: { project: { name: string; alternateName: string | null; officialNameConfirmed: boolean }; exportUrl: (f: string, approved?: boolean, name?: string) => string; approvedVersion: number | null; dirty: boolean }) {
  const [name, setName] = useState(project.name);
  const [ack, setAck] = useState(project.officialNameConfirmed);
  return (
    <div className="space-y-3 text-sm">
      {!project.officialNameConfirmed && (
        <div className="rounded-lg bg-amber-50 p-2 text-amber-900">
          <p className="font-medium">Nome oficial ainda não confirmado.</p>
          {project.alternateName && (
            <label className="mt-1 block">Usar no documento:
              <select className="input mt-1" value={name} onChange={(e) => setName(e.target.value)}>
                <option>{project.name}</option>
                <option>{project.alternateName}</option>
              </select>
            </label>
          )}
          <label className="mt-2 flex items-start gap-2"><input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Estou ciente de que o documento sairá com aviso de nome pendente de confirmação.</label>
        </div>
      )}
      {dirty && <p className="text-xs text-amber-800">Há alterações ainda não salvas — a exportação usa a última versão salva.</p>}
      <p className="label">Versão atual</p>
      <div className="flex gap-2">
        <a className={`btn-primary btn-sm ${ack ? "" : "pointer-events-none opacity-50"}`} href={exportUrl("docx", false, name)}>DOCX</a>
        <a className={`btn-primary btn-sm ${ack ? "" : "pointer-events-none opacity-50"}`} href={exportUrl("pdf", false, name)}>PDF</a>
      </div>
      <p className="label">Versão aprovada</p>
      {approvedVersion ? (
        <div className="flex gap-2">
          <a className={`btn-secondary btn-sm ${ack ? "" : "pointer-events-none opacity-50"}`} href={exportUrl("docx", true, name)}>DOCX (v{approvedVersion})</a>
          <a className={`btn-secondary btn-sm ${ack ? "" : "pointer-events-none opacity-50"}`} href={exportUrl("pdf", true, name)}>PDF (v{approvedVersion})</a>
        </div>
      ) : <p className="text-xs text-carvao/60">Ainda não há versão aprovada.</p>}
      <p className="text-xs text-carvao/60">Modelo ABNT: capa, folha de rosto, sumário, seções numeradas, figuras/tabelas com fonte, referências cadastradas (Pesquisa → Referências) e aviso de simulação no rodapé. Margens 3/2 cm, Arial 12, espaçamento 1,5.</p>
    </div>
  );
}

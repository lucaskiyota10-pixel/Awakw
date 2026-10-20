"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/project-context";
import { Avatar, Field, Modal, useAction, useToast } from "@/components/ui";
import { UploadButton, FileThumb, type UploadedFile } from "@/components/Upload";
import { createChannelAction, sendMessageAction } from "@/app/actions/collab";
import { dateTimeBr } from "@/lib/format";

interface Msg {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  parentId: string | null;
  linkType: string | null;
  linkId: string | null;
  fileIds: string[];
  mentions: string[];
  createdAt: string;
}
type LinkKind = "task" | "document" | "decision";

export function ChatView({
  channels,
  activeId,
  messages,
  files,
  query,
  results,
  links,
}: {
  channels: { id: string; name: string; type: string; memberIds: string[] }[];
  activeId: string | null;
  messages: Msg[];
  files: { id: string; name: string; mime: string }[];
  query: string;
  results: { id: string; channelId: string; authorId: string; body: string; createdAt: string }[];
  links: Record<LinkKind, { id: string; title: string }[]>;
}) {
  const p = useProject();
  const router = useRouter();
  const toast = useToast();
  const { exec } = useAction();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [attach, setAttach] = useState<UploadedFile[]>([]);
  const [link, setLink] = useState<{ type: LinkKind; id: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [newCh, setNewCh] = useState<"GROUP" | "DIRECT" | null>(null);
  const [q, setQ] = useState(query);
  const bottom = useRef<HTMLDivElement>(null);
  const active = channels.find((c) => c.id === activeId);
  const fileMap = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const roots = messages.filter((m) => !m.parentId);
  const replies = (id: string) => messages.filter((m) => m.parentId === id);

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [messages.length, activeId]);

  const chLabel = (c: (typeof channels)[number]) =>
    c.type === "DIRECT" ? `@ ${c.memberIds.filter((m) => m !== p.userId).map(p.memberName).join(", ") || "você"}` : `# ${c.name}`;

  const send = async () => {
    if (!active || (!text.trim() && !attach.length)) return;
    setSending(true);
    const r = await sendMessageAction(p.projectId, active.id, { body: text, parentId: replyTo?.id ?? null, fileIds: attach.map((a) => a.id), linkType: link?.type ?? null, linkId: link?.id ?? null });
    setSending(false);
    if (!r.ok) return toast(r.error, "error");
    setText("");
    setAttach([]);
    setLink(null);
    setReplyTo(null);
    router.refresh();
  };

  const linkHref = (m: Msg) =>
    m.linkType === "task" ? `${p.base}/tarefas?t=${m.linkId}` : m.linkType === "document" ? `${p.base}/documentos/${m.linkId}` : `${p.base}/decisoes?d=${m.linkId}`;
  const linkTitle = (m: Msg) => links[m.linkType as LinkKind]?.find((x) => x.id === m.linkId)?.title ?? "item removido";

  const renderBody = (body: string) =>
    body.split(/(@[\p{L}\p{N}_.-]+)/u).map((part, i) => (part.startsWith("@") ? <span key={i} className="rounded bg-areia px-1 font-medium">{part}</span> : part));

  const MessageItem = ({ m, nested }: { m: Msg; nested?: boolean }) => (
    <li className={`group flex gap-3 ${nested ? "ml-10 mt-2" : ""}`}>
      <Avatar name={p.memberName(m.authorId)} size={nested ? 24 : 32} />
      <div className="min-w-0 flex-1">
        <p className="text-xs"><strong className="text-sm">{p.memberName(m.authorId)}</strong> <span className="text-carvao/50">{dateTimeBr(m.createdAt)}</span></p>
        {m.body && <p className={`whitespace-pre-wrap break-words text-sm ${m.mentions.includes(p.userId) ? "rounded bg-amber-50 px-1" : ""}`}>{renderBody(m.body)}</p>}
        {m.linkType && <Link href={linkHref(m)} className="mt-1 inline-block rounded border border-taupe/50 px-2 py-0.5 text-xs hover:bg-areia">🔗 {m.linkType === "task" ? "Tarefa" : m.linkType === "document" ? "Documento" : "Decisão"}: {linkTitle(m)}</Link>}
        {m.fileIds.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {m.fileIds.map((id) => {
              const f = fileMap.get(id);
              return f?.mime.startsWith("image/") ? (
                <a key={id} href={`/api/files/${id}`} target="_blank" className="block h-24 w-24 overflow-hidden rounded border"><FileThumb id={id} mime={f.mime} name={f.name} /></a>
              ) : (
                <a key={id} href={`/api/files/${id}?download`} className="rounded border px-2 py-1 text-xs underline">📎 {f?.name ?? "arquivo"}</a>
              );
            })}
          </div>
        )}
        {!nested && <button className="mt-1 text-xs text-carvao/50 opacity-0 hover:underline focus:opacity-100 group-hover:opacity-100" onClick={() => setReplyTo(m)}>Responder</button>}
        {!nested && replies(m.id).length > 0 && <ul>{replies(m.id).map((r) => <MessageItem key={r.id} m={r} nested />)}</ul>}
      </div>
    </li>
  );

  return (
    <div className="grid h-[calc(100vh-140px)] min-h-[520px] gap-4 md:grid-cols-[240px_1fr]">
      <aside className="card overflow-y-auto p-3">
        <form onSubmit={(e) => { e.preventDefault(); router.push(`${p.base}/chat?${new URLSearchParams({ ...(activeId ? { c: activeId } : {}), ...(q ? { q } : {}) })}`); }}>
          <input className="input mb-3" placeholder="Pesquisar mensagens…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar mensagens" />
        </form>
        {(["GENERAL", "SECTOR", "GROUP", "DIRECT"] as const).map((t) => {
          const list = channels.filter((c) => c.type === t);
          return (
            <div key={t} className="mb-3">
              <p className="mb-1 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-widest text-carvao/40">
                {t === "GENERAL" ? "Geral" : t === "SECTOR" ? "Setores" : t === "GROUP" ? "Grupos" : "Mensagens privadas"}
                {(t === "GROUP" || t === "DIRECT") && <button className="text-base leading-none text-carvao/60 hover:text-carvao" onClick={() => setNewCh(t)} aria-label={t === "GROUP" ? "Novo grupo" : "Nova conversa privada"}>+</button>}
              </p>
              <ul>
                {list.map((c) => (
                  <li key={c.id}>
                    <Link href={`${p.base}/chat?c=${c.id}`} className={`block truncate rounded px-2 py-1 text-sm ${c.id === activeId ? "bg-carvao text-marfim" : "hover:bg-areia"}`}>{chLabel(c)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </aside>
      <section className="card flex min-h-0 flex-col p-0">
        {query ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-xl">Resultados para “{query}”</h2><Link href={`${p.base}/chat${activeId ? `?c=${activeId}` : ""}`} className="text-sm underline">Fechar busca</Link></div>
            <ul className="space-y-3">
              {results.length === 0 && <li className="text-sm text-carvao/50">Nada encontrado.</li>}
              {results.map((r) => (
                <li key={r.id} className="text-sm"><Link className="hover:underline" href={`${p.base}/chat?c=${r.channelId}`}><span className="text-xs text-carvao/50">{chLabel(channels.find((c) => c.id === r.channelId)!)} · {p.memberName(r.authorId)} · {dateTimeBr(r.createdAt)}</span><br />{r.body}</Link></li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <header className="border-b border-areia px-4 py-3"><h2 className="text-xl">{active ? chLabel(active) : "Sem canal"}</h2></header>
            <div className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-4">
                {roots.length === 0 && <li className="text-sm text-carvao/50">Nenhuma mensagem ainda. Use @nome para mencionar e @todos para avisar a equipe.</li>}
                {roots.map((m) => <MessageItem key={m.id} m={m} />)}
              </ul>
              <div ref={bottom} />
            </div>
            {active && (
              <div className="border-t border-areia p-3">
                {replyTo && <p className="mb-2 flex justify-between rounded bg-areia/60 px-2 py-1 text-xs">Respondendo a {p.memberName(replyTo.authorId)}: “{replyTo.body.slice(0, 60)}” <button onClick={() => setReplyTo(null)} aria-label="Cancelar resposta">✕</button></p>}
                {(attach.length > 0 || link) && (
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    {attach.map((a) => <span key={a.id} className="rounded bg-areia px-2 py-0.5">📎 {a.name} <button onClick={() => setAttach(attach.filter((x) => x.id !== a.id))}>✕</button></span>)}
                    {link && <span className="rounded bg-areia px-2 py-0.5">🔗 {links[link.type].find((x) => x.id === link.id)?.title} <button onClick={() => setLink(null)}>✕</button></span>}
                  </div>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <textarea
                    className="input min-h-[44px] flex-1"
                    rows={1}
                    placeholder={`Mensagem para ${chLabel(active)} — Enter envia, Shift+Enter quebra linha`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    aria-label="Mensagem"
                  />
                  <UploadButton projectId={p.projectId} folder="chat" label="📎" onUploaded={(f) => setAttach([...attach, ...f])} className="btn-secondary" />
                  <select className="input w-40" value="" onChange={(e) => { const [type, id] = e.target.value.split(":"); if (id) setLink({ type: type as LinkKind, id }); }} aria-label="Vincular item">
                    <option value="">Vincular…</option>
                    <optgroup label="Tarefas">{links.task.map((x) => <option key={x.id} value={`task:${x.id}`}>{x.title}</option>)}</optgroup>
                    <optgroup label="Documentos">{links.document.map((x) => <option key={x.id} value={`document:${x.id}`}>{x.title}</option>)}</optgroup>
                    <optgroup label="Decisões">{links.decision.map((x) => <option key={x.id} value={`decision:${x.id}`}>{x.title}</option>)}</optgroup>
                  </select>
                  <button className="btn-primary" onClick={send} disabled={sending}>Enviar</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <NewChannel type={newCh} onClose={() => setNewCh(null)} onCreate={(name, ids) =>
        exec(() => createChannelAction(p.projectId, { name, type: newCh!, memberIds: ids }), {
          success: "Canal criado.",
          onOk: (r) => { setNewCh(null); if (r.ok && r.data) router.push(`${p.base}/chat?c=${(r.data as { id: string }).id}`); },
        })
      } />
    </div>
  );
}

function NewChannel({ type, onClose, onCreate }: { type: "GROUP" | "DIRECT" | null; onClose: () => void; onCreate: (name: string, ids: string[]) => void }) {
  const p = useProject();
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  return (
    <Modal open={type !== null} onClose={onClose} title={type === "GROUP" ? "Novo grupo" : "Nova conversa privada"}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onCreate(name, ids); }}>
        {type === "GROUP" && <Field label="Nome do grupo"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>}
        <fieldset>
          <legend className="label">{type === "GROUP" ? "Participantes" : "Com quem?"}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {p.members.filter((m) => m.id !== p.userId).map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type={type === "DIRECT" ? "radio" : "checkbox"} name="m" checked={ids.includes(m.id)} onChange={(e) => setIds(type === "DIRECT" ? [m.id] : e.target.checked ? [...ids, m.id] : ids.filter((x) => x !== m.id))} />
                {m.name} <span className="text-xs text-carvao/50">{m.sector}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end"><button className="btn-primary" disabled={!ids.length}>Criar</button></div>
      </form>
    </Modal>
  );
}

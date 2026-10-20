"use client";

import { useCallback, useEffect, useState } from "react";
import { addCommentAction, getThreadAction } from "@/app/actions/collab";
import { useProject } from "./project-context";
import { Avatar, useToast } from "./ui";
import { dateTimeBr } from "@/lib/format";
import { ACTION_LABEL } from "@/lib/labels";

type Target = "task" | "decision" | "publication" | "scenario" | "document" | "campaign" | "budget";
interface ThreadData {
  comments: { id: string; authorId: string; body: string; createdAt: string }[];
  history: { id: string; userId: string | null; action: string; data: unknown; createdAt: string }[];
}

/** Comentários (com @menções) + histórico de auditoria de qualquer item. */
export function Thread({ targetType, targetId, link, showHistory = true }: { targetType: Target; targetId: string; link?: string; showHistory?: boolean }) {
  const p = useProject();
  const toast = useToast();
  const [data, setData] = useState<ThreadData | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await getThreadAction(p.projectId, targetType, targetId);
    if (r.ok && r.data) setData(r.data as ThreadData);
  }, [p.projectId, targetType, targetId]);
  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("acl:event", h);
    return () => window.removeEventListener("acl:event", h);
  }, [load]);
  return (
    <div className="space-y-4">
      <div>
        <h4 className="label">Comentários</h4>
        <ul className="space-y-3">
          {data?.comments.length === 0 && <li className="text-sm text-carvao/50">Sem comentários.</li>}
          {data?.comments.map((c) => (
            <li key={c.id} className="flex gap-2 text-sm">
              <Avatar name={p.memberName(c.authorId)} size={24} />
              <div>
                <span className="font-medium">{p.memberName(c.authorId)}</span> <span className="text-xs text-carvao/50">{dateTimeBr(c.createdAt)}</span>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            setBusy(true);
            const r = await addCommentAction(p.projectId, targetType, targetId, text, link);
            setBusy(false);
            if (r.ok) {
              setText("");
              load();
            } else toast(r.error, "error");
          }}
        >
          <input className="input" placeholder="Comentar… use @nome para mencionar" value={text} onChange={(e) => setText(e.target.value)} aria-label="Novo comentário" />
          <button className="btn-primary" disabled={busy}>Enviar</button>
        </form>
      </div>
      {showHistory && (
        <details>
          <summary className="label cursor-pointer">Histórico ({data?.history.length ?? 0})</summary>
          <ul className="mt-2 space-y-1 text-xs text-carvao/70">
            {data?.history.map((h) => (
              <li key={h.id}>
                {dateTimeBr(h.createdAt)} — <strong>{p.memberName(h.userId)}</strong> {ACTION_LABEL[h.action] ?? h.action}
                {h.data && h.action !== "create" ? <code className="ml-1 break-all text-[10px]">{JSON.stringify(h.data).slice(0, 200)}</code> : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

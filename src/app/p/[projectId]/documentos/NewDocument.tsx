"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Modal, useAction } from "@/components/ui";
import { MemberSelect, useProject } from "@/components/project-context";
import { createDocumentAction } from "@/app/actions/documents";

export function NewDocument({ kinds }: { kinds: [string, string][] }) {
  const p = useProject();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("FINAL");
  const [title, setTitle] = useState("");
  const [memberId, setMemberId] = useState<string | null>(p.userId);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>Novo documento</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo documento">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); exec(() => createDocumentAction(p.projectId, { kind, title, memberId: memberId ?? undefined }), { success: "Documento gerado.", onOk: (r) => r.ok && r.data && router.push(`${p.base}/documentos/${(r.data as { id: string }).id}`) }); }}>
          <Field label="Modelo"><select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          {kind === "INDIVIDUAL" && <Field label="Integrante"><MemberSelect value={memberId} onChange={setMemberId} allowEmpty={false} /></Field>}
          <Field label="Título (opcional)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gerado automaticamente" /></Field>
          <p className="text-xs text-carvao/60">O conteúdo é montado com os dados reais do projeto (briefing, SWOT, campanhas, verba, calendário, mensuração, cenários). Lacunas aparecem como “Pendente de preenchimento/validação”. Nenhuma bibliografia, resultado ou aprovação é inventado.</p>
          <div className="flex justify-end"><button className="btn-primary" disabled={pending}>{pending ? "Gerando…" : "Gerar"}</button></div>
        </form>
      </Modal>
    </>
  );
}

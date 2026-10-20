"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/project-context";
import { ConfirmButton, Empty, PageHeader, useAction } from "@/components/ui";
import { UploadButton, FileThumb } from "@/components/Upload";
import { deleteFileAction } from "@/app/actions/files";
import { dateTimeBr, num } from "@/lib/format";

interface F { id: string; name: string; mime: string; size: number; folder: string | null; uploaderId: string; createdAt: string }

const FOLDERS = ["geral", "briefing", "referencias", "midia", "instagram", "documentos", "concorrentes"];

export function Files({ files }: { files: F[] }) {
  const p = useProject();
  const router = useRouter();
  const { exec } = useAction();
  const [folder, setFolder] = useState("");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState("geral");
  const folders = [...new Set([...FOLDERS, ...files.map((f) => f.folder ?? "geral")])];
  const list = files.filter((f) => (!folder || (f.folder ?? "geral") === folder) && (!q || f.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <PageHeader
        title="Arquivos"
        subtitle="Biblioteca protegida: arquivos só são acessíveis a membros autenticados do projeto. Tipos permitidos: imagens, PDF, MP4, DOCX, XLSX, PPTX, TXT, CSV."
        actions={p.can("edit") && (
          <div className="flex gap-2">
            <select className="input w-40" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Pasta de destino">{FOLDERS.map((f) => <option key={f}>{f}</option>)}</select>
            <UploadButton projectId={p.projectId} folder={target} onUploaded={() => router.refresh()} className="btn-primary" label="Enviar arquivos" />
          </div>
        )}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input w-60" placeholder="Buscar arquivo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar arquivo" />
        <select className="input w-48" value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Pasta"><option value="">Todas as pastas</option>{folders.map((f) => <option key={f}>{f}</option>)}</select>
      </div>
      {list.length === 0 ? <Empty>Nenhum arquivo.</Empty> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((f) => (
            <div key={f.id} className="card p-2">
              <div className="aspect-square overflow-hidden rounded-lg bg-areia"><FileThumb id={f.id} mime={f.mime} name={f.name} /></div>
              <p className="mt-2 truncate text-sm" title={f.name}>{f.name}</p>
              <p className="text-[11px] text-carvao/50">{f.folder} · {num(f.size / 1024)} KB · {p.memberName(f.uploaderId)}</p>
              <p className="text-[11px] text-carvao/50">{dateTimeBr(f.createdAt)}</p>
              <p className="mt-1 select-all text-[10px] text-carvao/40" title="Identificador do arquivo">id: {f.id}</p>
              <div className="mt-1 flex gap-1">
                <a className="btn-ghost btn-sm" href={`/api/files/${f.id}?download`}>Baixar</a>
                {p.can("edit") && <ConfirmButton onConfirm={() => exec(() => deleteFileAction(p.projectId, f.id), { success: "Arquivo excluído." })} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

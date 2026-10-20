"use client";

import { useRef, useState } from "react";
import { useToast } from "./ui";

export interface UploadedFile {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export function UploadButton({
  projectId,
  folder = "geral",
  accept,
  multiple = true,
  label = "Enviar arquivo",
  onUploaded,
  className = "btn-secondary btn-sm",
}: {
  projectId: string;
  folder?: string;
  accept?: string;
  multiple?: boolean;
  label?: string;
  onUploaded: (files: UploadedFile[]) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <>
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          setBusy(true);
          const fd = new FormData();
          files.forEach((f) => fd.append("file", f));
          fd.append("folder", folder);
          try {
            const r = await fetch(`/api/upload/${projectId}`, { method: "POST", body: fd });
            const j = await r.json();
            if (!r.ok) toast(j.error ?? "Falha no envio.", "error");
            else {
              toast(`${j.files.length} arquivo(s) enviado(s).`);
              onUploaded(j.files);
            }
          } catch {
            toast("Falha no envio.", "error");
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <button type="button" className={className} disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Enviando…" : label}
      </button>
    </>
  );
}

export function FileThumb({ id, mime, name, className = "h-full w-full object-cover" }: { id: string; mime?: string; name?: string; className?: string }) {
  if (!mime || mime.startsWith("image/"))
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/files/${id}`} alt={name ?? ""} className={className} />;
  if (mime === "video/mp4") return <video src={`/api/files/${id}`} className={className} muted playsInline controls />;
  return (
    <a href={`/api/files/${id}?download`} className="flex h-full w-full items-center justify-center bg-areia p-2 text-center text-xs underline">
      {name ?? "arquivo"}
    </a>
  );
}

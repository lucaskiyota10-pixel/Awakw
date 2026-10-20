import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const ALLOWED_MIME: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "application/pdf": [".pdf"],
  "video/mp4": [".mp4"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
};

export const maxUploadBytes = () => Number(process.env.UPLOAD_MAX_MB || 15) * 1024 * 1024;

function root() {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

/** Verifica assinatura (magic bytes) para tipos binários comuns. */
export function sniffOk(mime: string, buf: Buffer): boolean {
  const starts = (...b: number[]) => b.every((x, i) => buf[i] === x);
  switch (mime) {
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/gif":
      return starts(0x47, 0x49, 0x46);
    case "image/webp":
      return starts(0x52, 0x49, 0x46, 0x46) && buf.subarray(8, 12).toString() === "WEBP";
    case "application/pdf":
      return starts(0x25, 0x50, 0x44, 0x46);
    case "video/mp4":
      return buf.subarray(4, 8).toString() === "ftyp";
    default:
      if (mime.startsWith("application/vnd.openxmlformats")) return starts(0x50, 0x4b, 0x03, 0x04);
      return !buf.includes(0); // texto
  }
}

export function validateUpload(name: string, mime: string, buf: Buffer): string | null {
  const exts = ALLOWED_MIME[mime];
  if (!exts) return "Tipo de arquivo não permitido.";
  const ext = path.extname(name).toLowerCase();
  if (!exts.includes(ext)) return "Extensão não corresponde ao tipo do arquivo.";
  if (buf.length > maxUploadBytes()) return `Arquivo acima de ${process.env.UPLOAD_MAX_MB || 15} MB.`;
  if (buf.length === 0) return "Arquivo vazio.";
  if (!sniffOk(mime, buf)) return "Conteúdo do arquivo não corresponde ao tipo informado.";
  return null;
}

/** "db" guarda o conteúdo no PostgreSQL (hospedagens sem disco persistente, como Render/Railway grátis); "disk" usa UPLOAD_DIR. */
export const storageDriver = () => (process.env.STORAGE_DRIVER === "db" ? "db" : "disk");

/** Grava o arquivo. No modo "db" devolve os bytes para irem no próprio registro FileAsset. */
export async function storeFile(projectId: string, buf: Buffer, ext: string): Promise<{ key: string; data: Uint8Array<ArrayBuffer> | null }> {
  if (storageDriver() === "db") return { key: `db:${projectId}/${randomUUID()}${ext}`, data: new Uint8Array(buf) };
  const key = `${projectId}/${randomUUID()}${ext}`;
  const full = path.join(root(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return { key, data: null };
}

function safePath(key: string) {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("Caminho inválido");
  return full;
}

/** Lê o conteúdo de um FileAsset (do banco ou do disco). */
export async function readStored(file: { storageKey: string; data?: Uint8Array | null }): Promise<Buffer> {
  if (file.data) return Buffer.from(file.data);
  if (file.storageKey.startsWith("db:")) throw new Error("Arquivo sem conteúdo no banco");
  return readFile(safePath(file.storageKey));
}
export const deleteStored = (key: string) => (key.startsWith("db:") ? Promise.resolve() : unlink(safePath(key)).catch(() => undefined));

export function safeFileName(name: string) {
  return name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "arquivo";
}

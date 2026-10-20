import "server-only";
import { prisma } from "./db";
import { readStored } from "./files";
import { resolveChart } from "./charts";
import { parseMarkdown } from "../docs/markdown";
import type { ResolvedAssets } from "../docs/docx";
import type { DocMeta } from "../docs/meta";

/** Dimensões de PNG/JPEG/GIF lendo o cabeçalho. */
export function imageSize(buf: Buffer): { w: number; h: number; type: "png" | "jpg" | "gif" } | null {
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: "png" };
  if (buf.subarray(0, 3).toString() === "GIF") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8), type: "gif" };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), type: "jpg" };
      i += 2 + len;
    }
  }
  return null;
}

export async function resolveAssets(projectId: string, markdown: string): Promise<ResolvedAssets> {
  const blocks = parseMarkdown(markdown);
  const images: ResolvedAssets["images"] = new Map();
  const charts: ResolvedAssets["charts"] = new Map();
  for (const b of blocks) {
    if (b.type === "image" && !images.has(b.fileId)) {
      const f = await prisma.fileAsset.findFirst({ where: { id: b.fileId, projectId } });
      if (!f || !f.mime.startsWith("image/")) continue;
      try {
        const data = await readStored(f.storageKey);
        const s = imageSize(data);
        if (s) images.set(b.fileId, { data, type: s.type, width: s.w, height: s.h });
      } catch {
        /* arquivo ausente: o exportador mostra marcador */
      }
    }
    if (b.type === "chart" && !charts.has(b.key)) {
      const c = await resolveChart(projectId, b.key);
      if (c) charts.set(b.key, c);
    }
  }
  return { images, charts };
}

export async function docMeta(projectId: string, title: string, versionLabel: string, nameOverride?: string): Promise<DocMeta> {
  const [p, refs] = await Promise.all([prisma.project.findUniqueOrThrow({ where: { id: projectId } }), prisma.reference.findMany({ where: { projectId } })]);
  const academic = (p.academic ?? {}) as Record<string, string>;
  const allowed = [p.name, p.alternateName].filter(Boolean) as string[];
  const projectName = nameOverride && allowed.includes(nameOverride) ? nameOverride : p.name;
  return {
    projectName,
    officialNameConfirmed: p.officialNameConfirmed,
    title: academic.titulo?.trim() && title.startsWith("Relatório final") ? academic.titulo : title,
    subtitle: academic.subtitulo?.trim() || undefined,
    academic,
    references: refs.map((r) => r.abnt + (r.url ? ` Disponível em: ${r.url}.` : "") + (r.accessedAt ? ` Acesso em: ${r.accessedAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.` : "")),
    versionLabel,
  };
}

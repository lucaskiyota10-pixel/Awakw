/** Extrai menções @Nome / @Apelido / @todos. Retorna ids de membros mencionados. */
export interface Mentionable {
  id: string;
  name: string;
  nickname?: string | null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function handlesFor(m: Mentionable): string[] {
  const first = m.name.split(/\s+/)[0];
  return [first, m.nickname ?? "", m.name.replace(/\s+/g, "")].filter(Boolean).map(norm);
}

export function parseMentions(text: string, members: Mentionable[]): string[] {
  const tokens = [...text.matchAll(/@([\p{L}\p{N}_.-]+)/gu)].map((x) => norm(x[1]));
  if (!tokens.length) return [];
  if (tokens.includes("todos") || tokens.includes("all")) return members.map((m) => m.id);
  const ids = new Set<string>();
  for (const m of members) {
    const hs = handlesFor(m);
    if (tokens.some((t) => hs.includes(t))) ids.add(m.id);
  }
  return [...ids];
}

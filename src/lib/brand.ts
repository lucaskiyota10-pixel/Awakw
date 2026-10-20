import { DEFAULT_BRAND } from "./server/bootstrap-shared";

export type Brand = typeof DEFAULT_BRAND;

export function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "0 0 0";
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

export function brandOf(raw: unknown): Brand {
  const b = (raw ?? {}) as Partial<Brand>;
  return { ...DEFAULT_BRAND, ...b, colors: { ...DEFAULT_BRAND.colors, ...(b.colors ?? {}) } };
}

export function brandStyle(b: Brand): Record<string, string> {
  return {
    "--c-carvao": hexToRgb(b.colors.carvao),
    "--c-taupe": hexToRgb(b.colors.taupe),
    "--c-areia": hexToRgb(b.colors.areia),
    "--c-marfim": hexToRgb(b.colors.marfim),
    "--c-destaque": hexToRgb(b.roseOption ? b.roseColor : b.colors.destaque),
    "--font-serif": `"${b.fontSerif}"`,
    "--font-sans": `"${b.fontSans}"`,
  };
}

export function fontHref(b: Brand) {
  const fam = (f: string, w: string) => `family=${f.replace(/ /g, "+")}:wght@${w}`;
  return `https://fonts.googleapis.com/css2?${fam(b.fontSerif, "400;600")}&${fam(b.fontSans, "400;500;600")}&display=swap`;
}

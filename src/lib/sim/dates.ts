/** Datas como "YYYY-MM-DD" em UTC — evita deslocamentos de fuso nas séries temporais. */

export function parseDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fmtDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return fmtDay(parseDay(iso) + n * 86400000);
}

/** Soma meses mantendo o dia (limitado ao último dia do mês). */
export function addMonths(iso: string, n: number): string {
  const d = new Date(parseDay(iso));
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fmtDay(target.getTime());
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}

export function daysInMonth(iso: string): number {
  const d = new Date(parseDay(iso));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

export function monthIndex(iso: string): number {
  return new Date(parseDay(iso)).getUTCMonth();
}

/** Número de meses completos entre start e iso (0 no primeiro mês relativo). */
export function relativeMonth(start: string, iso: string): number {
  let m = 0;
  while (addMonths(start, m + 1) <= iso) m++;
  return m;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function fmtBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function fmtShort(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1]}/${y}`;
}

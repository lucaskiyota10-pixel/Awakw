/** Diferença por palavras (LCS) para comparar versões de legendas e documentos. */
export type DiffPart = { type: "same" | "add" | "del"; text: string };

export function diffWords(a: string, b: string, maxTokens = 4000): DiffPart[] {
  const ta = a.split(/(\s+)/).filter((x) => x !== "");
  const tb = b.split(/(\s+)/).filter((x) => x !== "");
  if (ta.length > maxTokens || tb.length > maxTokens) {
    // textos muito longos: comparação por linhas
    return diffLines(a, b);
  }
  return lcs(ta, tb);
}

export function diffLines(a: string, b: string): DiffPart[] {
  return lcs(a.split("\n").map((l) => l + "\n"), b.split("\n").map((l) => l + "\n"));
}

function lcs(ta: string[], tb: string[]): DiffPart[] {
  const n = ta.length;
  const m = tb.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = ta[i] === tb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ta[i] === tb[j]) {
      push("same", ta[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", ta[i++]);
    else push("add", tb[j++]);
  }
  while (i < n) push("del", ta[i++]);
  while (j < m) push("add", tb[j++]);
  return out;
}

/** Contagem de caracteres adicionados/removidos (para relatório de contribuições). */
export function changeStats(a: string, b: string) {
  const parts = diffWords(a, b);
  return {
    added: parts.filter((p) => p.type === "add").reduce((s, p) => s + p.text.length, 0),
    removed: parts.filter((p) => p.type === "del").reduce((s, p) => s + p.text.length, 0),
  };
}

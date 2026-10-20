// Smoke test com navegador: login + visita às rotas, reportando erros de página/console.
// Uso: node scripts/smoke.mjs [baseUrl] [email] [senha] [rota1 rota2 ...]
import { chromium } from "playwright-core";

const [base = "http://localhost:3000", email = "lucas@awake.demo", password = process.env.SEED_DEMO_PASSWORD, ...routes] = process.argv.slice(2);
const shots = process.env.SHOTS_DIR;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !m.text().includes("fonts.g") && errors.push(`console: ${m.text().slice(0, 300)}`));
await page.goto(`${base}/login`);
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await Promise.all([page.waitForURL(/projetos/), page.click('button:has-text("Entrar")')]);
await page.click("a[href^='/p/']");
await page.waitForURL(/\/p\//);
const pid = page.url().split("/p/")[1].split(/[/?]/)[0];
let fail = 0;
for (const r of routes.length ? routes : [""]) {
  const before = errors.length;
  const url = `${base}/p/${pid}${r ? "/" + r : ""}`;
  const resp = await page.goto(url, { waitUntil: "load" }).then(async (r) => { await page.waitForTimeout(600); return r; }).catch((e) => ({ status: () => `ERR ${e.message}` }));
  const status = resp?.status();
  const title = await page.locator("h1").first().textContent().catch(() => "?");
  const errs = errors.slice(before);
  if (status !== 200 || errs.length) fail++;
  console.log(`${status} /${r} — ${title?.trim()} ${errs.length ? "\n   " + errs.join("\n   ") : ""}`);
  if (shots) await page.screenshot({ path: `${shots}/${(r || "dashboard").replace(/\//g, "_")}.png`, fullPage: false });
}
await browser.close();
console.log(fail ? `FALHAS: ${fail}` : "OK");
process.exit(fail ? 1 : 0);

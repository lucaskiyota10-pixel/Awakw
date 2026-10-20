// Gera docs/Manual-Campaign-Forge.pdf a partir de docs/manual/manual.html.
// Uso: node docs/manual/build.mjs   (requer Chromium; ver CHROMIUM_PATH)
import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, "..", "Manual-Campaign-Forge.pdf");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(dir, "manual.html")).href, { waitUntil: "networkidle" });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  displayHeaderFooter: true,
  headerTemplate: '<div style="width:100%;font:7.5px Helvetica,Arial;color:#8C7B6B;padding:0 16mm;display:flex;justify-content:space-between"><span>Campaign Forge — Manual de instruções</span><span>SIMULAÇÃO ACADÊMICA — RESULTADOS HIPOTÉTICOS</span></div>',
  footerTemplate: '<div style="width:100%;font:8px Helvetica,Arial;color:#8C7B6B;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});
await browser.close();
console.log("PDF gerado:", out);

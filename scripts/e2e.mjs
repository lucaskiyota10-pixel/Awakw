// Teste ponta a ponta multiusuário (requer app rodando e seed aplicado).
// Uso: SEED_DEMO_PASSWORD=... node scripts/e2e.mjs [baseUrl]
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.argv[2] || "http://localhost:3000";
const PW = process.env.SEED_DEMO_PASSWORD;
if (!PW) throw new Error("Defina SEED_DEMO_PASSWORD");
const prisma = new PrismaClient();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
};

async function login(email, password = PW) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror ${email}] ${e.message}`));
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL(/projetos/), page.click('button:has-text("Entrar")')]);
  return { ctx, page };
}

const project = await prisma.project.findFirstOrThrow({ where: { isDemo: true } });
const P = `${BASE}/p/${project.id}`;
// estado inicial idempotente para a tarefa usada no teste de aprovação
const seedTask = await prisma.task.findFirst({ where: { projectId: project.id, title: { contains: "Plano de mídia" } } });
if (seedTask) {
  await prisma.task.update({ where: { id: seedTask.id }, data: { status: "IN_REVIEW" } });
  await prisma.approval.deleteMany({ where: { targetId: seedTask.id } });
}

try {
  const lucas = await login("lucas@awake.demo");
  const juh = await login("juh@awake.demo");

  // 1) Documento: gerar a partir dos dados
  await lucas.page.goto(`${P}/documentos`);
  await lucas.page.click('button:has-text("Novo documento")');
  await lucas.page.selectOption("select >> nth=0", "FINAL");
  await Promise.all([lucas.page.waitForURL(/documentos\/c/), lucas.page.click('button:has-text("Gerar")')]);
  const docUrl = lucas.page.url();
  const content = await lucas.page.inputValue("textarea");
  check("Documento final gerado com dados do projeto", content.includes("# Introdução") && content.includes("Análise SWOT") && content.includes("Pendente de preenchimento/validação"));

  // 2) Autosave
  await lucas.page.fill("textarea", content + "\n\nParágrafo escrito pelo Lucas.");
  await lucas.page.waitForSelector("text=/Salvo · v\\d+/", { timeout: 15000 });
  const docId = docUrl.split("/documentos/")[1];
  const saved = await prisma.document.findUniqueOrThrow({ where: { id: docId } });
  check("Autosave persiste no banco com nova versão", saved.content.includes("Parágrafo escrito pelo Lucas") && saved.version >= 2, `v${saved.version}`);

  // 3) Conflito: Juh salva enquanto Lucas edita sem recarregar
  await juh.page.goto(docUrl);
  await juh.page.waitForSelector("textarea");
  const juhText = await juh.page.inputValue("textarea");
  await juh.page.fill("textarea", juhText + "\n\nContribuição da Juh.");
  await juh.page.waitForSelector("text=/Salvo · v\\d+/", { timeout: 15000 });
  const afterJuh = await prisma.document.findUniqueOrThrow({ where: { id: docId } });
  check("Segunda autora salva versão", afterJuh.content.includes("Contribuição da Juh"), `v${afterJuh.version}`);
  // Lucas digita em seguida: ou recebeu a atualização em tempo real (sem conflito), ou recebe o modal de conflito
  await lucas.page.waitForTimeout(1500);
  const lucasHasJuh = (await lucas.page.inputValue("textarea")).includes("Contribuição da Juh");
  await lucas.page.fill("textarea", (await lucas.page.inputValue("textarea")) + "\n\nMais um trecho do Lucas.");
  if (lucasHasJuh) {
    await lucas.page.waitForSelector("text=/Salvo · v\\d+/", { timeout: 15000 });
    const final = await prisma.document.findUniqueOrThrow({ where: { id: docId } });
    check("Atualização em tempo real evita conflito (Lucas recebeu a versão da Juh)", final.content.includes("Contribuição da Juh") && final.content.includes("Mais um trecho do Lucas"));
  } else {
    await lucas.page.waitForSelector("text=Conflito de edição", { timeout: 15000 });
    check("Conflito detectado e exibido", true);
    await lucas.page.click('button:has-text("Mesclar manualmente")');
    const merged = (await lucas.page.inputValue("textarea >> nth=-1")) + "\n\nContribuição da Juh.";
    await lucas.page.fill("textarea >> nth=-1", merged);
    await lucas.page.click('button:has-text("Salvar mesclagem")');
    await lucas.page.waitForTimeout(2000);
    const final = await prisma.document.findUniqueOrThrow({ where: { id: docId } });
    check("Mesclagem manual preserva as duas contribuições", final.content.includes("Contribuição da Juh") && final.content.includes("Mais um trecho do Lucas"));
  }
  // Conflito forçado: uma sessão sem tempo real (SSE bloqueado) edita sobre versão antiga
  const offline = await login("lucas@awake.demo");
  await offline.page.route("**/api/events/**", (r) => r.abort());
  await offline.page.goto(docUrl);
  await offline.page.waitForSelector("textarea");
  await juh.page.goto(docUrl);
  await juh.page.waitForSelector("textarea");
  await juh.page.fill("textarea", (await juh.page.inputValue("textarea")) + "\n\nAjuste concorrente da Juh.");
  await juh.page.waitForSelector("text=/Salvo · v\\d+/", { timeout: 15000 });
  await offline.page.fill("textarea", (await offline.page.inputValue("textarea")) + "\n\nEdição offline do Lucas.");
  await offline.page.waitForSelector("text=Conflito de edição", { timeout: 15000 });
  check("Conflito de edição detectado (controle otimista de versão)", true);
  await offline.page.click('button:has-text("Mesclar manualmente")');
  const mergeBox = offline.page.locator('textarea[class*="h-[45vh]"]').nth(1);
  await mergeBox.fill((await mergeBox.inputValue()) + "\n\nAjuste concorrente da Juh.");
  await offline.page.click('button:has-text("Salvar mesclagem")');
  await offline.page.waitForSelector("text=/Salvo · v\\d+/", { timeout: 15000 });
  const mergedDoc = await prisma.document.findUniqueOrThrow({ where: { id: docId } });
  check("Mesclagem manual preserva as duas edições", mergedDoc.content.includes("Ajuste concorrente da Juh") && mergedDoc.content.includes("Edição offline do Lucas"));
  await offline.ctx.close();

  const versions = await prisma.documentVersion.findMany({ where: { documentId: docId } });
  check("Histórico registra autoria de ambos", new Set(versions.map((v) => v.authorId)).size >= 2, `${versions.length} snapshots`);

  // 4) Exportações funcionais
  const cookies = await lucas.ctx.cookies();
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const get = (u) => fetch(u, { headers: { cookie } });
  const docx = await get(`${BASE}/api/export/${project.id}/doc/${docId}?format=docx`);
  const docxBuf = Buffer.from(await docx.arrayBuffer());
  check("Exporta DOCX", docx.status === 200 && docxBuf.subarray(0, 2).toString() === "PK", `${docxBuf.length} bytes`);
  const pdf = await get(`${BASE}/api/export/${project.id}/doc/${docId}?format=pdf`);
  const pdfBuf = Buffer.from(await pdf.arrayBuffer());
  check("Exporta PDF", pdf.status === 200 && pdfBuf.subarray(0, 4).toString() === "%PDF", `${pdfBuf.length} bytes`);
  const pptx = await get(`${BASE}/api/export/${project.id}/presentation?format=pptx`);
  const pptxBuf = Buffer.from(await pptx.arrayBuffer());
  check("Exporta apresentação PPTX", pptx.status === 200 && pptxBuf.subarray(0, 2).toString() === "PK", `${pptxBuf.length} bytes`);
  const spdf = await get(`${BASE}/api/export/${project.id}/presentation?format=pdf`);
  check("Exporta apresentação PDF", spdf.status === 200 && Buffer.from(await spdf.arrayBuffer()).subarray(0, 4).toString() === "%PDF");
  const approvedExport = await get(`${BASE}/api/export/${project.id}/doc/${docId}?format=pdf&versao=aprovada`);
  check("Versão aprovada inexistente é recusada (409)", approvedExport.status === 409);

  // 5) Chat em tempo real com menção
  await juh.page.goto(`${P}/chat`);
  await lucas.page.goto(`${P}/chat`);
  const msg = `Teste e2e @Juh ${Date.now()}`;
  await lucas.page.fill('textarea[aria-label="Mensagem"]', msg);
  await lucas.page.click('button:has-text("Enviar")');
  let realtime = false;
  try {
    await juh.page.waitForSelector(`text=${msg.slice(-13)}`, { timeout: 8000 });
    realtime = true;
  } catch {}
  check("Mensagem chega em tempo real para outra usuária (SSE)", realtime);
  const juhUser = await prisma.user.findUniqueOrThrow({ where: { email: "juh@awake.demo" } });
  const notif = await prisma.notification.findFirst({ where: { userId: juhUser.id, type: "mention" }, orderBy: { createdAt: "desc" } });
  check("Menção gera notificação", !!notif && notif.body?.includes("Teste e2e"));

  // 6) Permissões: integrante não aprova; coordenador aprova
  const isa = await login("isabely@awake.demo");
  const task = await prisma.task.findFirstOrThrow({ where: { projectId: project.id, title: { contains: "Plano de mídia" } } });
  await isa.page.goto(`${P}/tarefas?t=${task.id}`);
  await isa.page.waitForSelector('[role="dialog"] form select', { timeout: 20000 });
  const approvedOptionDisabled = await isa.page.$eval('[role="dialog"] form select', (el) => [...el.options].find((o) => o.value === "APPROVED")?.disabled ?? false);
  check("Integrante não pode marcar tarefa como Aprovada (UI)", approvedOptionDisabled);
  await isa.page.click('[role="dialog"] button:has-text("Solicitar aprovação")');
  await isa.page.waitForTimeout(1500);
  const appr = await prisma.approval.findFirst({ where: { targetId: task.id, status: "PENDING" } });
  check("Integrante solicita aprovação", !!appr);
  const gus = await login("gustavo@awake.demo");
  await gus.page.goto(`${P}/aprovacoes`);
  await gus.page.click('button:has-text("Aprovar") >> nth=0');
  await gus.page.waitForTimeout(1500);
  const tAfter = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
  const apprAfter = await prisma.approval.findUniqueOrThrow({ where: { id: appr.id } });
  check("Coordenador aprova e o item muda de status", apprAfter.status === "APPROVED" && tAfter.status === "APPROVED");

  // 7) Visualizador: sem botões de edição, mas comenta
  const prof = await login("professor@awake.demo");
  await prof.page.goto(`${P}/tarefas`);
  check("Visualizador não vê 'Nova tarefa'", !(await prof.page.isVisible('button:has-text("Nova tarefa")')));
  await prof.page.goto(`${P}/decisoes`);
  await prof.page.click("button.card >> nth=0");
  await prof.page.fill('input[aria-label="Novo comentário"]', "Comentário do professor");
  await prof.page.click('button:has-text("Enviar")');
  await prof.page.waitForTimeout(1200);
  check("Visualizador pode comentar", !!(await prisma.comment.findFirst({ where: { body: "Comentário do professor" } })));

  // 8) Isolamento entre agências
  const email = `isolado-${Date.now()}@teste.local`;
  const other = await prisma.user.create({
    data: { email, name: "Outra Agência", passwordHash: await bcrypt.hash("SenhaIsolada123", 12), memberships: { create: { role: "ADMIN", agency: { create: { name: "Agência Isolada (teste)" } } } } },
  });
  const iso = await browser.newContext();
  const ip = await iso.newPage();
  await ip.goto(`${BASE}/login`);
  await ip.fill('input[name="email"]', email);
  await ip.fill('input[name="password"]', "SenhaIsolada123");
  await Promise.all([ip.waitForURL(/projetos/), ip.click('button:has-text("Entrar")')]);
  const r1 = await ip.goto(P);
  check("Outra agência não acessa o projeto (404)", r1.status() === 404);
  const isoCookie = (await iso.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const r2 = await fetch(`${BASE}/api/export/${project.id}/doc/${docId}?format=pdf`, { headers: { cookie: isoCookie } });
  check("Outra agência não exporta documentos (401)", r2.status === 401);
  const r3 = await fetch(`${BASE}/api/events/${project.id}`, { headers: { cookie: isoCookie } });
  check("Outra agência não assina eventos em tempo real (401)", r3.status === 401);
  await prisma.membership.deleteMany({ where: { userId: other.id } });
  await prisma.user.delete({ where: { id: other.id } });

  // 9) Upload protegido: tipo inválido recusado
  const fd = new FormData();
  fd.append("file", new Blob(["<svg onload=alert(1)>"], { type: "image/svg+xml" }), "x.svg");
  const up = await fetch(`${BASE}/api/upload/${project.id}`, { method: "POST", body: fd, headers: { cookie, origin: BASE } });
  check("Upload de SVG (risco XSS) é recusado", up.status === 400);
  const fd2 = new FormData();
  fd2.append("file", new Blob(["nao sou png"], { type: "image/png" }), "falso.png");
  const up2 = await fetch(`${BASE}/api/upload/${project.id}`, { method: "POST", body: fd2, headers: { cookie, origin: BASE } });
  check("Upload com assinatura falsa é recusado", up2.status === 400);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082", "hex");
  const fd3 = new FormData();
  fd3.append("file", new Blob([png], { type: "image/png" }), "pixel.png");
  fd3.append("folder", "instagram");
  const up3 = await fetch(`${BASE}/api/upload/${project.id}`, { method: "POST", body: fd3, headers: { cookie, origin: BASE } });
  const upJson = await up3.json();
  check("Upload válido aceito", up3.status === 200 && upJson.files?.length === 1);
  const dl = await fetch(`${BASE}/api/files/${upJson.files[0].id}`);
  check("Arquivo exige autenticação para download", dl.status === 404);
} catch (e) {
  console.error(e);
  check("Execução sem exceções", false, e.message);
} finally {
  await browser.close();
  await prisma.$disconnect();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
process.exit(failed ? 1 : 0);

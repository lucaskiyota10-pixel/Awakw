"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import {
  clientIp,
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  newToken,
  passwordProblems,
  rateLimit,
  sha256,
  verifyPassword,
} from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { appUrl, sendMail } from "@/lib/server/mailer";
import { run, UserError } from "@/lib/server/action";

const email = z.string().trim().toLowerCase().email("E-mail inválido.");

export async function loginAction(_: unknown, form: FormData) {
  const parsed = z.object({ email, password: z.string().min(1, "Informe a senha.") }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}:${parsed.data.email}`, 8, 15 * 60000))
    return { error: "Muitas tentativas. Aguarde 15 minutos." };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) return { error: "E-mail ou senha incorretos." };
  await createSession(user.id);
  await audit({ userId: user.id, action: "login", entity: "user", entityId: user.id });
  redirect("/projetos");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/** Configuração inicial: só funciona quando não há nenhum usuário. */
export async function setupAction(_: unknown, form: FormData) {
  if ((await prisma.user.count()) > 0) return { error: "A plataforma já foi configurada. Faça login." };
  const p = z
    .object({ name: z.string().trim().min(2, "Informe seu nome."), email, password: z.string(), agency: z.string().trim().min(2, "Informe a agência.") })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const prob = passwordProblems(p.data.password);
  if (prob) return { error: prob };
  const user = await prisma.user.create({
    data: {
      name: p.data.name,
      email: p.data.email,
      passwordHash: await hashPassword(p.data.password),
      memberships: { create: { role: "ADMIN", agency: { create: { name: p.data.agency } } } },
    },
  });
  await createSession(user.id);
  redirect("/projetos");
}

export async function requestResetAction(_: unknown, form: FormData) {
  const p = email.safeParse(form.get("email"));
  const generic = { message: "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação." };
  if (!p.success) return { error: "E-mail inválido." };
  if (!rateLimit(`reset:${await clientIp()}`, 5, 15 * 60000)) return { error: "Muitas solicitações. Aguarde." };
  const user = await prisma.user.findUnique({ where: { email: p.data } });
  if (!user) return generic;
  const token = newToken();
  await prisma.passwordResetToken.create({
    data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 60 * 60000) },
  });
  const link = `${appUrl()}/redefinir/${token}`;
  const { sent } = await sendMail(user.email, "Recuperação de senha — Campaign Forge", `Para definir uma nova senha, acesse (válido por 1 hora):\n${link}`);
  if (!sent) console.info(`[recuperação de senha] SMTP não configurado. Link para ${user.email}: ${link}`);
  await audit({ userId: user.id, action: "password_reset_requested", entity: "user", entityId: user.id });
  return generic;
}

export async function resetPasswordAction(_: unknown, form: FormData) {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password !== form.get("confirm")) return { error: "As senhas não conferem." };
  const prob = passwordProblems(password);
  if (prob) return { error: prob };
  const rec = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return { error: "Link inválido ou expirado." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: rec.userId } }),
  ]);
  await audit({ userId: rec.userId, action: "password_reset", entity: "user", entityId: rec.userId });
  redirect("/login?redefinida=1");
}

export async function acceptInviteAction(_: unknown, form: FormData) {
  const token = String(form.get("token") ?? "");
  const inv = await prisma.invite.findUnique({ where: { tokenHash: sha256(token) } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return { error: "Convite inválido ou expirado." };
  const existing = await prisma.user.findUnique({ where: { email: inv.email } });
  let userId: string;
  if (existing) {
    const current = await getCurrentUser();
    if (current?.id !== existing.id) return { error: "Este e-mail já tem conta. Faça login com ela e abra o convite novamente." };
    userId = existing.id;
  } else {
    const name = String(form.get("name") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (name.length < 2) return { error: "Informe seu nome." };
    const prob = passwordProblems(password);
    if (prob) return { error: prob };
    const u = await prisma.user.create({ data: { name, email: inv.email, passwordHash: await hashPassword(password) } });
    userId = u.id;
  }
  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_agencyId: { userId, agencyId: inv.agencyId } },
      update: { role: inv.role, sector: inv.sector, responsibilities: inv.responsibilities },
      create: { userId, agencyId: inv.agencyId, role: inv.role, sector: inv.sector, responsibilities: inv.responsibilities },
    }),
    prisma.invite.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
  ]);
  await audit({ userId, action: "invite_accepted", entity: "invite", entityId: inv.id });
  if (!existing) await createSession(userId);
  redirect("/projetos");
}

export async function changePasswordAction(current: string, next: string) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UserError("Sessão expirada.");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(current, u.passwordHash))) throw new UserError("Senha atual incorreta.");
    const prob = passwordProblems(next);
    if (prob) throw new UserError(prob);
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next) } });
    await audit({ userId: u.id, action: "password_changed", entity: "user", entityId: u.id });
    return undefined;
  });
}

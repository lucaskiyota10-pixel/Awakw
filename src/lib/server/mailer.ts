import "server-only";

/** Envio de e-mail opcional via SMTP. Sem SMTP configurado, nada é enviado (retorna sent:false). */
export async function sendMail(to: string, subject: string, text: string): Promise<{ sent: boolean }> {
  if (!process.env.SMTP_HOST) return { sent: false };
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
  return { sent: true };
}

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

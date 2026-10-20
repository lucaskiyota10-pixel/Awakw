import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { setupAction } from "@/app/actions/auth";
import { AuthForm } from "../AuthForm";

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) redirect("/login");
  return (
    <>
      <h2 className="mb-1 text-2xl">Configuração inicial</h2>
      <p className="muted mb-4 text-sm">Crie a conta de administrador e a agência. Depois convide os integrantes.</p>
      <AuthForm action={setupAction} submit="Criar administrador">
        <label className="block"><span className="label">Seu nome</span><input className="input" name="name" required /></label>
        <label className="block"><span className="label">E-mail</span><input className="input" name="email" type="email" required /></label>
        <label className="block"><span className="label">Senha (mín. 10, letras e números)</span><input className="input" name="password" type="password" autoComplete="new-password" required /></label>
        <label className="block"><span className="label">Agência / equipe</span><input className="input" name="agency" required /></label>
      </AuthForm>
    </>
  );
}

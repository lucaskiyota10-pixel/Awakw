import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/server/auth";
import { AuthForm } from "../AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redefinida?: string }> }) {
  if (await getCurrentUser()) redirect("/projetos");
  const sp = await searchParams;
  return (
    <>
      {sp.redefinida && <p className="mb-4 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">Senha redefinida. Entre com a nova senha.</p>}
      <AuthForm action={loginAction} submit="Entrar">
        <label className="block"><span className="label">E-mail</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label className="block"><span className="label">Senha</span><input className="input" name="password" type="password" autoComplete="current-password" required /></label>
      </AuthForm>
      <p className="mt-4 text-center text-sm"><Link className="underline" href="/recuperar">Esqueci minha senha</Link></p>
    </>
  );
}

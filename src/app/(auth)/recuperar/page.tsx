import Link from "next/link";
import { requestResetAction } from "@/app/actions/auth";
import { AuthForm } from "../AuthForm";

export default function RecoverPage() {
  return (
    <>
      <h2 className="mb-1 text-2xl">Recuperar senha</h2>
      <p className="muted mb-4 text-sm">Enviaremos um link válido por 1 hora. Sem SMTP configurado, o link é registrado no log do servidor.</p>
      <AuthForm action={requestResetAction} submit="Enviar link">
        <label className="block"><span className="label">E-mail</span><input className="input" name="email" type="email" required /></label>
      </AuthForm>
      <p className="mt-4 text-center text-sm"><Link className="underline" href="/login">Voltar ao login</Link></p>
    </>
  );
}

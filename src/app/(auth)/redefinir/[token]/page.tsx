import { resetPasswordAction } from "@/app/actions/auth";
import { AuthForm } from "../../AuthForm";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h2 className="mb-4 text-2xl">Nova senha</h2>
      <AuthForm action={resetPasswordAction} submit="Redefinir senha">
        <input type="hidden" name="token" value={token} />
        <label className="block"><span className="label">Nova senha</span><input className="input" name="password" type="password" autoComplete="new-password" required /></label>
        <label className="block"><span className="label">Confirmar</span><input className="input" name="confirm" type="password" autoComplete="new-password" required /></label>
      </AuthForm>
    </>
  );
}

import { prisma } from "@/lib/server/db";
import { sha256, getCurrentUser } from "@/lib/server/auth";
import { acceptInviteAction } from "@/app/actions/auth";
import { ROLE_LABEL, type RoleName } from "@/lib/permissions";
import { AuthForm } from "../../AuthForm";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await prisma.invite.findUnique({ where: { tokenHash: sha256(token) }, include: { agency: true } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date())
    return <p className="text-sm">Convite inválido, expirado ou já utilizado. Peça um novo convite ao coordenador.</p>;
  const hasAccount = !!(await prisma.user.findUnique({ where: { email: inv.email } }));
  const current = await getCurrentUser();
  return (
    <>
      <h2 className="mb-1 text-2xl">Convite</h2>
      <p className="muted mb-4 text-sm">
        Você foi convidado(a) para <strong>{inv.agency.name}</strong> como <strong>{ROLE_LABEL[inv.role as RoleName]}</strong>
        {inv.sector ? ` — ${inv.sector}` : ""}. E-mail: {inv.email}
      </p>
      {hasAccount && current?.email !== inv.email ? (
        <p className="text-sm">Este e-mail já possui conta. Faça login com ele e abra este link novamente.</p>
      ) : (
        <AuthForm action={acceptInviteAction} submit="Aceitar convite">
          <input type="hidden" name="token" value={token} />
          {!hasAccount && (
            <>
              <label className="block"><span className="label">Seu nome</span><input className="input" name="name" defaultValue={inv.name ?? ""} required /></label>
              <label className="block"><span className="label">Crie uma senha</span><input className="input" name="password" type="password" autoComplete="new-password" required /></label>
            </>
          )}
        </AuthForm>
      )}
    </>
  );
}

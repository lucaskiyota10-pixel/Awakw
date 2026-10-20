import Link from "next/link";
import { prisma } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { ROLE_LABEL, type RoleName } from "@/lib/permissions";
import { dateBr } from "@/lib/format";
import { logoutAction } from "../actions/auth";
import { NewProject } from "./NewProject";
import { ToastProvider } from "@/components/ui";

export default async function ProjectsPage() {
  const user = await requireUser();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { agency: { include: { projects: { orderBy: { createdAt: "asc" } } } } },
  });
  return (
    <ToastProvider>
      <main className="mx-auto max-w-5xl p-6 sm:p-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-taupe">Awake Campaign Lab</p>
            <h1 className="text-4xl">Projetos</h1>
            <p className="muted text-sm">Olá, {user.name}. Cada agência tem seus dados isolados.</p>
          </div>
          <form action={logoutAction}><button className="btn-secondary">Sair</button></form>
        </div>
        {memberships.length === 0 && <p className="card">Você ainda não faz parte de nenhuma agência. Peça um convite.</p>}
        {memberships.map((m) => (
          <section key={m.id} className="mb-10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl">{m.agency.name} <span className="badge bg-areia text-carvao align-middle">{ROLE_LABEL[m.role as RoleName]}</span></h2>
              {(m.role === "ADMIN" || m.role === "COORDINATOR") && <NewProject agencyId={m.agencyId} />}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {m.agency.projects.map((p) => (
                <Link key={p.id} href={`/p/${p.id}`} className="card block transition hover:border-taupe hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-2xl">{p.name}</h3>
                    {p.isDemo && <span className="badge bg-amber-100 text-amber-900">Dados demonstrativos</span>}
                  </div>
                  <p className="muted mt-1 text-sm">{p.segment ?? "Segmento não informado"}</p>
                  <p className="mt-3 text-xs text-carvao/60">
                    Lançamento: {p.launchDate ? dateBr(p.launchDate) : "a definir"} {p.launchDate && !p.launchDateConfirmed && "(provisório)"}
                  </p>
                </Link>
              ))}
              {m.agency.projects.length === 0 && <p className="muted text-sm">Nenhum projeto ainda.</p>}
            </div>
          </section>
        ))}
      </main>
    </ToastProvider>
  );
}

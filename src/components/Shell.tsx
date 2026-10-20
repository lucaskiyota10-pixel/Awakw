"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "./ui";
import { useProject } from "./project-context";
import { ROLE_LABEL } from "@/lib/permissions";
import { dateTimeBr } from "@/lib/format";
import { markNotificationsReadAction } from "@/app/actions/project";
import { logoutAction } from "@/app/actions/auth";

const NAV: { group: string; items: [string, string][] }[] = [
  { group: "Visão geral", items: [["", "Dashboard"]] },
  { group: "Equipe", items: [["chat", "Chat"], ["decisoes", "Central de Decisões"], ["tarefas", "Tarefas"], ["calendario", "Calendário"], ["aprovacoes", "Aprovações"], ["arquivos", "Arquivos"]] },
  { group: "Criação & Campanha", items: [["instagram", "Instagram Studio"], ["editorial", "Calendário editorial"], ["campanhas", "Campanhas"]] },
  { group: "Simulação", items: [["simulador", "Métricas & investimento"], ["crescimento", "Growth Simulator"], ["verba", "Planejamento de verba"]] },
  { group: "Planejamento", items: [["digital", "Planejamento Digital — Lucas"], ["pesquisa", "Pesquisa & SWOT"]] },
  { group: "Entrega", items: [["documentos", "Documentos"], ["apresentacao", "Apresentação"]] },
  { group: "Projeto", items: [["configuracoes", "Configurações"], ["auditoria", "Auditoria"]] },
];

export interface NotificationLite {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function Shell({ children, notifications, logoUrl, brandName }: { children: ReactNode; notifications: NotificationLite[]; logoUrl: string | null; brandName: string }) {
  const p = useProject();
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const unread = notifications.filter((n) => !n.readAt).length;
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tempo real: SSE do projeto → atualiza dados do servidor (com debounce)
  useEffect(() => {
    const es = new EventSource(`/api/events/${p.projectId}`);
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data);
        if (e.type === "hello") return;
        window.dispatchEvent(new CustomEvent("acl:event", { detail: e }));
        if (e.type === "presence") return;
        if (e.type === "notification" && e.userId !== p.userId) return;
        if (e.type === "document" && e.userId === p.userId) return; // não interrompe quem está editando
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 400);
      } catch {}
    };
    return () => es.close();
  }, [p.projectId, p.userId, router]);

  useEffect(() => setMenu(false), [path]);

  const active = (slug: string) => (slug === "" ? path === p.base : path.startsWith(`${p.base}/${slug}`));

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 overflow-y-auto border-r border-areia bg-marfim p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Menu principal"
      >
        <Link href="/projetos" className="mb-6 flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-carvao font-serif text-lg text-marfim">{brandName[0]}</span>
          )}
          <span>
            <span className="block font-serif text-xl leading-tight">{brandName}</span>
            <span className="block text-[10px] uppercase tracking-[0.25em] text-taupe">Campaign Lab</span>
          </span>
        </Link>
        <nav className="space-y-5">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-carvao/40">{g.group}</p>
              <ul>
                {g.items.map(([slug, label]) => (
                  <li key={slug}>
                    <Link
                      href={slug ? `${p.base}/${slug}` : p.base}
                      aria-current={active(slug) ? "page" : undefined}
                      className={`block rounded-md px-2 py-1.5 text-sm transition ${active(slug) ? "bg-carvao text-marfim" : "text-carvao/80 hover:bg-areia"}`}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-carvao/30 lg:hidden" onClick={() => setMenu(false)} />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-areia bg-marfim/90 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="btn-ghost lg:hidden" onClick={() => setMenu(true)} aria-label="Abrir menu">☰</button>
            <span className="truncate text-sm text-carvao/70">{p.projectName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/apresentar/${p.projectId}`} className="btn-secondary btn-sm hidden sm:inline-flex">Modo apresentação</Link>
            <div className="relative">
              <button className="btn-ghost relative" onClick={() => setBell((b) => !b)} aria-label={`Notificações (${unread} não lidas)`} aria-expanded={bell}>
                🔔
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{unread}</span>}
              </button>
              {bell && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-areia bg-white p-2 shadow-xl">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-sm font-medium">Notificações</span>
                    {unread > 0 && (
                      <button className="text-xs underline" onClick={async () => { await markNotificationsReadAction(p.projectId); router.refresh(); }}>
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  <ul className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 && <li className="p-3 text-sm text-carvao/60">Nada por aqui.</li>}
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <Link
                          href={n.link ?? p.base}
                          onClick={() => { setBell(false); markNotificationsReadAction(p.projectId, [n.id]); }}
                          className={`block rounded-lg p-2 text-sm hover:bg-areia/50 ${n.readAt ? "text-carvao/60" : ""}`}
                        >
                          <span className="block font-medium">{n.title}</span>
                          {n.body && <span className="block truncate text-xs">{n.body}</span>}
                          <span className="block text-[10px] text-carvao/50">{dateTimeBr(n.createdAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar name={p.userName} />
              <span className="text-xs leading-tight">
                <span className="block">{p.userName}</span>
                <span className="block text-carvao/50">{ROLE_LABEL[p.role]}</span>
              </span>
            </div>
            <form action={logoutAction}><button className="btn-ghost btn-sm">Sair</button></form>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

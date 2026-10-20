"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GLOSSARY } from "@/lib/format";
import { SIM_DISCLAIMER } from "@/lib/sim/origin";

/* ---------- Toasts ---------- */
type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`rounded-lg px-4 py-3 text-sm shadow-lg ${t.kind === "error" ? "bg-red-700 text-white" : "bg-carvao text-marfim"}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

type Result = { ok: true; data?: unknown; message?: string } | { ok: false; error: string };

/** Executa uma server action com estado de carregamento, toast e refresh. */
export function useAction() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const exec = useCallback(
    <R extends Result>(fn: () => Promise<R>, opts: { success?: string; refresh?: boolean; onOk?: (r: R) => void } = {}) =>
      new Promise<R | null>((resolve) => {
        start(async () => {
          try {
            const r = await fn();
            if (r.ok) {
              if (opts.success || r.message) toast(r.message ?? opts.success!);
              opts.onOk?.(r);
              if (opts.refresh !== false) router.refresh();
            } else toast(r.error, "error");
            resolve(r);
          } catch {
            toast("Falha de comunicação com o servidor.", "error");
            resolve(null);
          }
        });
      }),
    [router, toast],
  );
  return { pending, exec };
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-carvao/40 p-4 sm:p-10" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`w-full ${wide ? "max-w-4xl" : "max-w-xl"} rounded-2xl bg-marfim p-6 shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-2xl">{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Confirmação de exclusão ---------- */
export function ConfirmButton({
  onConfirm,
  children = "Excluir",
  message = "Esta ação não pode ser desfeita. Deseja continuar?",
  className = "btn-danger btn-sm",
  disabled,
}: {
  onConfirm: () => void;
  children?: ReactNode;
  message?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} disabled={disabled} data-admin>
        {children}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirmar">
        <p className="text-sm">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          <button
            className="btn bg-red-700 text-white hover:bg-red-800"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Confirmar
          </button>
        </div>
      </Modal>
    </>
  );
}

/* ---------- Tooltip educativo ---------- */
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const text = GLOSSARY[k];
  return (
    <span className="group relative inline-flex items-center gap-1">
      {children ?? k}
      {text && (
        <>
          <button type="button" className="h-4 w-4 rounded-full border border-taupe text-[10px] leading-none text-taupe" aria-label={`O que é ${k}?`}>
            ?
          </button>
          <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden w-64 rounded-lg bg-carvao p-2 text-xs font-normal normal-case tracking-normal text-marfim shadow-lg group-focus-within:block group-hover:block">
            {text}
          </span>
        </>
      )}
    </span>
  );
}

export function SimBanner({ className = "" }: { className?: string }) {
  return <div className={`sim-banner ${className}`}>{SIM_DISCLAIMER}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "danger" | "info" | "dark" }) {
  const map = {
    neutral: "bg-areia text-carvao",
    ok: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-900",
    danger: "bg-red-100 text-red-800",
    info: "bg-sky-100 text-sky-900",
    dark: "bg-carvao text-marfim",
  };
  return <span className={`badge ${map[tone]}`}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-carvao/50">{hint}</span>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-taupe/50 p-8 text-center text-sm text-carvao/60">{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-areia/60 p-1">
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          className={`rounded-md px-3 py-1.5 text-sm transition ${value === i.value ? "bg-white shadow-sm" : "text-carvao/70 hover:text-carvao"}`}
          onClick={() => onChange(i.value)}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="muted mt-1 max-w-3xl text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2" data-admin>{actions}</div>}
    </div>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const ini = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-taupe font-medium text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {ini}
    </span>
  );
}

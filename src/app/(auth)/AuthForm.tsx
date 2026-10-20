"use client";

import { useActionState, type ReactNode } from "react";

type State = { error?: string; message?: string } | undefined;

export function AuthForm({
  action,
  children,
  submit,
}: {
  action: (s: State, f: FormData) => Promise<State>;
  children: ReactNode;
  submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{state.error}</p>}
      {state?.message && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{state.message}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Aguarde…" : submit}</button>
    </form>
  );
}

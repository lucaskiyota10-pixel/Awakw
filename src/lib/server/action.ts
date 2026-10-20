import "server-only";
import { ZodError } from "zod";
import { AccessError } from "./access";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Envolve server actions: converte erros de validação/permissão em mensagens claras. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" ") };
    if (e instanceof AccessError || e instanceof UserError) return { ok: false, error: e.message };
    // redirect()/notFound() do Next devem propagar
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[action]", e);
    return { ok: false, error: "Erro inesperado. Tente novamente." };
  }
}

export class UserError extends Error {}

import "server-only";
import { EventEmitter } from "node:events";

/**
 * Barramento de eventos em memória para SSE. Funciona em instância única.
 * Para múltiplas instâncias, substitua por Postgres LISTEN/NOTIFY ou Redis pub/sub
 * mantendo a mesma interface publish/subscribe.
 */
export interface RealtimeEvent {
  type: "message" | "task" | "notification" | "document" | "presence" | "decision" | "publication";
  projectId: string;
  userId?: string;
  payload?: Record<string, unknown>;
}

const g = globalThis as unknown as { __bus?: EventEmitter };
const bus = g.__bus ?? new EventEmitter();
bus.setMaxListeners(1000);
g.__bus = bus;

export function publish(e: RealtimeEvent) {
  bus.emit(`p:${e.projectId}`, e);
}

export function subscribe(projectId: string, fn: (e: RealtimeEvent) => void) {
  const k = `p:${projectId}`;
  bus.on(k, fn);
  return () => bus.off(k, fn);
}

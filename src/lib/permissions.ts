/** Papéis e permissões — puro (usado no cliente e no servidor). */
export type RoleName = "ADMIN" | "COORDINATOR" | "MEMBER" | "VIEWER";

export const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Administrador",
  COORDINATOR: "Coordenador",
  MEMBER: "Integrante",
  VIEWER: "Visualizador",
};

const RANK: Record<RoleName, number> = { VIEWER: 0, MEMBER: 1, COORDINATOR: 2, ADMIN: 3 };

export type Action =
  | "view" // ler dados do projeto
  | "edit" // criar/editar conteúdo colaborativo
  | "approve" // aprovações finais, decisões, verba aprovada, versão final de documentos
  | "invite" // convidar integrantes
  | "manage"; // configurações do projeto, papéis, exclusão de projeto

const MIN: Record<Action, RoleName> = {
  view: "VIEWER",
  edit: "MEMBER",
  approve: "COORDINATOR",
  invite: "COORDINATOR",
  manage: "ADMIN",
};

export function can(role: RoleName | null | undefined, action: Action): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[MIN[action]];
}

/** Exclusão: autor do item (se pode editar) ou coordenador+. */
export function canDelete(role: RoleName | null | undefined, isOwner: boolean): boolean {
  return can(role, "approve") || (isOwner && can(role, "edit"));
}

/** Quem pode atribuir um papel: só admin cria admin; coordenador convida até coordenador. */
export function canAssignRole(actor: RoleName, target: RoleName): boolean {
  if (actor === "ADMIN") return true;
  if (actor === "COORDINATOR") return RANK[target] <= RANK.COORDINATOR;
  return false;
}

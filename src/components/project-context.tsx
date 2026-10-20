"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type Action, type RoleName } from "@/lib/permissions";

export interface MemberLite {
  id: string;
  name: string;
  nickname: string | null;
  role: RoleName;
  sector: string | null;
  responsibilities: string | null;
}

interface Ctx {
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  role: RoleName;
  members: MemberLite[];
}

const C = createContext<Ctx | null>(null);

export function ProjectProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useProject() {
  const v = useContext(C);
  if (!v) throw new Error("useProject fora do ProjectProvider");
  return {
    ...v,
    can: (a: Action) => can(v.role, a),
    memberName: (id: string | null | undefined) => (id ? (v.members.find((m) => m.id === id)?.name ?? "Ex-integrante") : "—"),
    base: `/p/${v.projectId}`,
  };
}

export function MemberSelect({
  value,
  onChange,
  allowEmpty = true,
  className = "input",
  id,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  allowEmpty?: boolean;
  className?: string;
  id?: string;
}) {
  const { members } = useProject();
  return (
    <select id={id} className={className} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty && <option value="">— sem responsável —</option>}
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
          {m.sector ? ` (${m.sector})` : ""}
        </option>
      ))}
    </select>
  );
}

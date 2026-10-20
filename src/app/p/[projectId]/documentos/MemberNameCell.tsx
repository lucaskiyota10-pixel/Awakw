"use client";
import { useProject } from "@/components/project-context";
export function MemberNameCell({ id }: { id: string | null }) {
  return <>{useProject().memberName(id)}</>;
}

import { describe, expect, it } from "vitest";
import { diffWords, changeStats } from "@/lib/diff";
import { parseMentions } from "@/lib/mentions";
import { can, canDelete, canAssignRole } from "@/lib/permissions";

describe("diff", () => {
  it("marca adições e remoções", () => {
    const d = diffWords("sua parede sua assinatura", "sua parede, sua marca");
    expect(d.some((p) => p.type === "add" && p.text.includes("marca"))).toBe(true);
    expect(d.some((p) => p.type === "del" && p.text.includes("assinatura"))).toBe(true);
    const s = changeStats("abc", "abc def");
    expect(s.added).toBeGreaterThan(0);
    expect(s.removed).toBe(0);
  });
});

describe("menções", () => {
  const members = [
    { id: "1", name: "Jhiulyana", nickname: "Juh" },
    { id: "2", name: "Letícia" },
    { id: "3", name: "Lucas" },
  ];
  it("reconhece nome, apelido e acentos", () => {
    expect(parseMentions("oi @Juh e @leticia", members).sort()).toEqual(["1", "2"]);
    expect(parseMentions("sem menção", members)).toEqual([]);
    expect(parseMentions("@todos atenção", members)).toHaveLength(3);
  });
});

describe("permissões", () => {
  it("hierarquia de papéis", () => {
    expect(can("VIEWER", "view")).toBe(true);
    expect(can("VIEWER", "edit")).toBe(false);
    expect(can("MEMBER", "edit")).toBe(true);
    expect(can("MEMBER", "approve")).toBe(false);
    expect(can("COORDINATOR", "approve")).toBe(true);
    expect(can("COORDINATOR", "manage")).toBe(false);
    expect(can("ADMIN", "manage")).toBe(true);
    expect(can(null, "view")).toBe(false);
  });
  it("exclusão e atribuição de papéis", () => {
    expect(canDelete("MEMBER", true)).toBe(true);
    expect(canDelete("MEMBER", false)).toBe(false);
    expect(canDelete("VIEWER", true)).toBe(false);
    expect(canDelete("COORDINATOR", false)).toBe(true);
    expect(canAssignRole("COORDINATOR", "ADMIN")).toBe(false);
    expect(canAssignRole("COORDINATOR", "MEMBER")).toBe(true);
    expect(canAssignRole("MEMBER", "VIEWER")).toBe(false);
  });
});

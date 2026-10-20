"use client";

import { useState } from "react";
import { num } from "@/lib/format";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "./types";

export function Media({ id, files, className = "h-full w-full object-cover", color, label }: { id?: string; files: Map<string, MediaFile>; className?: string; color?: string | null; label?: string }) {
  const f = id ? files.get(id) : undefined;
  if (f?.mime === "video/mp4") return <video src={`/api/files/${f.id}`} className={className} muted playsInline loop autoPlay />;
  if (f) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/files/${f.id}`} alt={f.name} className={className} />;
  }
  return (
    <div className={`${className} flex items-center justify-center p-2 text-center`} style={{ background: color ?? "#E9E2D8" }}>
      <span className="font-serif text-[11px] leading-tight" style={{ color: isDark(color) ? "#F8F6F1" : "#252521" }}>{label}</span>
    </div>
  );
}

export function isDark(hex?: string | null) {
  if (!hex) return false;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[340px] max-w-full rounded-[44px] border-[10px] border-carvao bg-carvao shadow-2xl">
      <div className="relative h-[660px] overflow-hidden rounded-[34px] bg-white">
        <div className="absolute left-1/2 top-1.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-carvao" />
        <div className="h-full overflow-y-auto pt-7">{children}</div>
      </div>
    </div>
  );
}

export function PhoneProfile({
  profile,
  highlights,
  pubs,
  files,
  followersOverride,
  onSelect,
  onReorder,
  editable,
}: {
  profile: IgProfile;
  highlights: IgHighlight[];
  pubs: IgPub[];
  files: Map<string, MediaFile>;
  followersOverride?: number;
  onSelect?: (p: IgPub) => void;
  onReorder?: (ids: string[]) => void;
  editable?: boolean;
}) {
  const [tab, setTab] = useState<"grid" | "reels">("grid");
  const [drag, setDrag] = useState<string | null>(null);
  const grid = pubs.filter((p) => p.type !== "STORY").sort((a, b) => a.feedOrder - b.feedOrder);
  const shown = tab === "reels" ? grid.filter((p) => p.type === "REEL") : grid;
  const followers = followersOverride ?? profile.hypotheticalFollowers;
  const stories = pubs.filter((p) => p.type === "STORY");
  const drop = (targetId: string) => {
    if (!drag || drag === targetId || !onReorder) return;
    const ids = grid.map((p) => p.id).filter((id) => id !== drag);
    ids.splice(ids.indexOf(targetId), 0, drag);
    onReorder(ids);
    setDrag(null);
  };
  return (
    <PhoneFrame>
      <div className="px-4 pb-2 text-[13px] text-black">
        <div className="mb-3 flex items-center justify-between font-semibold"><span>{profile.username}</span><span className="text-[10px] font-normal text-neutral-400">perfil fictício</span></div>
        <div className="flex items-center gap-3">
          <div className={`h-20 w-20 shrink-0 overflow-hidden rounded-full ${stories.length ? "ring-2 ring-offset-2 ring-pink-500" : ""}`}>
            <Media id={profile.avatarFileId ?? undefined} files={files} color="#252521" label={profile.displayName[0]} />
          </div>
          <div className="grid flex-1 grid-cols-3 text-center text-[11px] leading-tight">
            <span><strong className="block text-[14px]">{grid.length}</strong>posts</span>
            <span title="Número hipotético"><strong className="block text-[14px]">{num(followers)}</strong>seguidores*</span>
            <span><strong className="block text-[14px]">{num(profile.hypotheticalFollowing)}</strong>seguindo</span>
          </div>
        </div>
        <p className="mt-2 font-semibold">{profile.displayName}</p>
        {profile.category && <p className="text-neutral-500">{profile.category}</p>}
        {profile.bio && <p className="whitespace-pre-wrap">{profile.bio}</p>}
        {profile.link && <p className="font-medium text-[#00376B]">{profile.link.replace(/^https?:\/\//, "")}</p>}
        <p className="mt-1 text-[10px] text-neutral-400">* seguidores, curtidas e visualizações são hipotéticos</p>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <span className="rounded-lg bg-neutral-100 py-1.5 text-center font-semibold">Seguir</span>
          <span className="rounded-lg bg-neutral-100 py-1.5 text-center font-semibold">Mensagem</span>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {highlights.sort((a, b) => a.order - b.order).map((h) => (
            <div key={h.id} className="w-16 shrink-0 text-center">
              <div className="mx-auto h-14 w-14 overflow-hidden rounded-full border border-neutral-300 p-0.5">
                <div className="h-full w-full overflow-hidden rounded-full"><Media id={h.coverFileId ?? undefined} files={files} color={h.coverColor} label="" /></div>
              </div>
              <p className="mt-1 truncate text-[11px]">{h.title}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-neutral-200 text-center text-xs">
        <button className={`py-2 ${tab === "grid" ? "border-b-2 border-black font-semibold" : "text-neutral-400"}`} onClick={() => setTab("grid")}>▦ Posts</button>
        <button className={`py-2 ${tab === "reels" ? "border-b-2 border-black font-semibold" : "text-neutral-400"}`} onClick={() => setTab("reels")}>▶ Reels</button>
      </div>
      <div className={`grid grid-cols-3 gap-0.5 ${tab === "reels" ? "auto-rows-[150px]" : "auto-rows-[108px]"}`}>
        {shown.map((p) => (
          <button
            key={p.id}
            draggable={editable}
            onDragStart={() => setDrag(p.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(p.id)}
            onClick={() => onSelect?.(p)}
            className={`relative overflow-hidden ${drag === p.id ? "opacity-40" : ""}`}
            aria-label={`${p.title} (${p.type})`}
          >
            <Media id={p.mediaFileIds[0]} files={files} color={p.coverColor} label={p.title} />
            {p.type === "CAROUSEL" && <span className="absolute right-1 top-1 text-xs text-white drop-shadow">❐</span>}
            {p.type === "REEL" && <span className="absolute right-1 top-1 text-xs text-white drop-shadow">▶</span>}
            {p.status !== "APPROVED" && p.status !== "SCHEDULED" && <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-[9px] text-white">rascunho</span>}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="p-6 text-center text-xs text-neutral-400">Sem publicações.</p>}
    </PhoneFrame>
  );
}

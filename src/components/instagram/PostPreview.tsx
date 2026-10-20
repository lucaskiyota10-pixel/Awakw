"use client";

import { useState } from "react";
import { num } from "@/lib/format";
import { Media, PhoneFrame } from "./PhoneProfile";
import type { IgProfile, IgPub, MediaFile } from "./types";

export function PostPreview({ pub, profile, files }: { pub: Pick<IgPub, "type" | "title" | "caption" | "hashtags" | "cta" | "mediaFileIds" | "coverColor" | "hypotheticalLikes" | "hypotheticalComments" | "hypotheticalViews">; profile: IgProfile; files: Map<string, MediaFile> }) {
  const [i, setI] = useState(0);
  const media = pub.mediaFileIds.length ? pub.mediaFileIds : [undefined];
  const idx = Math.min(i, media.length - 1);
  if (pub.type === "STORY" || pub.type === "REEL") {
    return (
      <PhoneFrame>
        <div className="relative -mt-7 h-[660px] bg-black text-white">
          <Media id={media[idx]} files={files} color={pub.coverColor} label={pub.title} className="h-full w-full object-cover" />
          <div className="absolute left-0 right-0 top-8 flex items-center gap-2 px-3 text-xs">
            {pub.type === "STORY" && <div className="absolute -top-4 left-3 right-3 h-0.5 rounded bg-white/70" />}
            <span className="h-7 w-7 overflow-hidden rounded-full"><Media id={profile.avatarFileId ?? undefined} files={files} color="#252521" label="" /></span>
            <strong>{profile.username}</strong> <span className="opacity-70">{pub.type === "REEL" ? "Reels" : "agora"}</span>
          </div>
          <div className="absolute bottom-6 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-2 pt-10 text-[13px]">
            {pub.caption && <p className="line-clamp-3 whitespace-pre-wrap">{pub.caption}</p>}
            {pub.hashtags && <p className="text-white/80">{pub.hashtags}</p>}
            {pub.cta && <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">{pub.cta}</span>}
            {pub.type === "REEL" && <p className="mt-1 text-[11px] opacity-80">▶ {num(pub.hypotheticalViews)} visualizações (hipotético)</p>}
          </div>
        </div>
      </PhoneFrame>
    );
  }
  return (
    <PhoneFrame>
      <div className="text-[13px] text-black">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="h-8 w-8 overflow-hidden rounded-full"><Media id={profile.avatarFileId ?? undefined} files={files} color="#252521" label="" /></span>
          <strong>{profile.username}</strong>
        </div>
        <div className="relative aspect-[4/5] w-full">
          <Media id={media[idx]} files={files} color={pub.coverColor} label={pub.title} />
          {media.length > 1 && (
            <>
              {idx > 0 && <button className="absolute left-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white/80" onClick={() => setI(idx - 1)} aria-label="Anterior">‹</button>}
              {idx < media.length - 1 && <button className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white/80" onClick={() => setI(idx + 1)} aria-label="Próxima">›</button>}
              <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 text-[11px] text-white">{idx + 1}/{media.length}</span>
            </>
          )}
        </div>
        {pub.cta && <div className="flex justify-between border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-[#0095F6]"><span>{pub.cta}</span><span>›</span></div>}
        <div className="px-3 py-2">
          <p className="text-lg">♡ 💬 ↗</p>
          <p className="font-semibold">{num(pub.hypotheticalLikes)} curtidas <span className="text-[10px] font-normal text-neutral-400">(hipotético)</span></p>
          <p className="whitespace-pre-wrap"><strong>{profile.username}</strong> {pub.caption}</p>
          {pub.hashtags && <p className="text-[#00376B]">{pub.hashtags}</p>}
          <p className="text-neutral-400">Ver todos os {num(pub.hypotheticalComments)} comentários (hipotético)</p>
        </div>
      </div>
    </PhoneFrame>
  );
}

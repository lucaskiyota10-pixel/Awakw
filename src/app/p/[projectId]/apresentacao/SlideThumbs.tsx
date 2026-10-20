"use client";

import { SlideView } from "@/components/SlideDeck";
import type { Slide } from "@/lib/server/presentation";

export function SlideThumbs({ slides, creative }: { slides: Slide[]; creative: Parameters<typeof SlideView>[0]["creative"] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {slides.map((s, i) => (
        <div key={i}>
          <p className="mb-1 text-xs text-carvao/60">Slide {i + 1}</p>
          <div className="aspect-video overflow-hidden rounded-xl border border-areia shadow-sm">
            <div className="h-[200%] w-[200%] origin-top-left scale-50"><SlideView s={s} creative={creative} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

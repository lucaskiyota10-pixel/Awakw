"use client";
/* eslint-disable @next/next/no-img-element -- mídia enviada pelo usuário servida por /api/files */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { num } from "@/lib/format";
import type { IgHighlight, IgProfile, IgPub, MediaFile } from "./types";

/** Simulador interativo do app: perfil, feed, publicação, Reels e stories. Nada é publicado no Instagram real. */

const ICONS: Record<string, ReactNode> = {
  heart: <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />,
  comment: <path d="M20.7 16.9A9 9 0 1 0 17 20.6L21.5 21.5z" />,
  send: <path d="M22 3 9.2 10.1M22 3l-6.8 18-3.6-8.3L3 9.1z" />,
  save: <path d="M19 21l-7-5.5L5 21V3.5h14z" />,
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6.5H9V21H3z" />,
  search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
  plus: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 8v8M8 12h8" /></>,
  reels: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M3 8.5h18M8.5 3l3 5.5M14 3l3 5.5" /><path d="m10 12 5 3-5 3z" /></>,
  grid: <><rect x="3.5" y="3.5" width="17" height="17" /><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" /></>,
  tag: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><circle cx="12" cy="10" r="3" /><path d="M6.5 20c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" /></>,
  more: <><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></>,
  back: <path d="m15 4-8 8 8 8" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  carousel: <><path d="M7 3h11a3 3 0 0 1 3 3v11" /><rect x="3" y="7" width="14" height="14" rx="2.5" /></>,
  link: <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />,
};
const Ico = ({ n, style }: { n: string; style?: React.CSSProperties }) => <svg className="i" viewBox="0 0 24 24" aria-hidden="true" style={style}>{ICONS[n]}</svg>;

const STORY_MS = 5000;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const longDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3600000);
  return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
};
const compact = (n: number) => (n >= 1e6 ? `${num(n / 1e6, 1)} mi` : n >= 1e4 ? `${num(n / 1e3, 1)} mil` : num(n));
const isDark = (hex?: string | null) => {
  const n = parseInt((hex || "#E9E2D8").slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
};

export type Screen = "profile" | "home" | "post" | "reels";
interface Story { items: IgPub[]; idx: number; title?: string; preview?: boolean }

export function PhoneSim({
  profile,
  highlights,
  pubs,
  files,
  followersByMonth,
  focus,
  editable,
  onReorder,
  onOpen,
}: {
  profile: IgProfile;
  highlights: IgHighlight[];
  pubs: IgPub[];
  files: Map<string, MediaFile>;
  followersByMonth?: Record<number, number>;
  /** publicação em edição: o celular mostra a prévia dela (post, Reels ou story) */
  focus?: IgPub | null;
  editable?: boolean;
  onReorder?: (ids: string[]) => void;
  onOpen?: (p: IgPub) => void;
}) {
  const [screen, setScreen] = useState<Screen>("profile");
  const [gridTab, setGridTab] = useState<"grid" | "reels" | "tagged">("grid");
  const [postId, setPostId] = useState<string | null>(null);
  const [reelIdx, setReelIdx] = useState(0);
  const [dark, setDark] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState(false);
  const [capOpen, setCapOpen] = useState<Set<string>>(new Set());
  const [slide, setSlide] = useState<Record<string, number>>({});
  const [story, setStory] = useState<Story | null>(null);
  const [seen, setSeen] = useState(false);
  const [pop, setPop] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const paused = useRef(false);
  const bar = useRef<HTMLElement | null>(null);
  const swipe = useRef<{ x: number; id: string } | null>(null);

  // a publicação em edição substitui a versão salva na prévia
  const all = useMemo(() => {
    const list = pubs.map((p) => (focus && p.id === focus.id ? focus : p));
    if (focus && !list.some((p) => p.id === focus.id)) list.push(focus);
    return list.sort((a, b) => a.feedOrder - b.feedOrder);
  }, [pubs, focus]);
  const feed = all.filter((p) => p.type !== "STORY");
  const reels = feed.filter((p) => p.type === "REEL");
  const stories = all.filter((p) => p.type === "STORY").sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

  useEffect(() => {
    if (!focus) return;
    if (focus.type === "STORY") setStory({ items: [focus], idx: 0, preview: true });
    else {
      setStory(null);
      if (focus.type === "REEL") {
        setScreen("reels");
        const rs = pubs.filter((x) => x.type === "REEL").sort((a, b) => a.feedOrder - b.feedOrder);
        setReelIdx(Math.max(0, rs.findIndex((r) => r.id === focus.id)));
      } else {
        setScreen("post");
        setPostId(focus.id);
      }
    }
  }, [focus, pubs]);
  useEffect(() => {
    if (!focus && story?.preview) setStory(null);
  }, [focus, story]);

  // reprodução dos stories com barra de progresso
  useEffect(() => {
    if (!story || story.preview) return;
    let raf = 0;
    let t0 = performance.now();
    let last = 0;
    const loop = (now: number) => {
      if (paused.current) t0 = now - (last / 100) * STORY_MS;
      last = Math.min(100, ((now - t0) / STORY_MS) * 100);
      if (bar.current) bar.current.style.width = `${last}%`;
      if (last >= 100) {
        setStory((s) => (s && s.idx + 1 < s.items.length ? { ...s, idx: s.idx + 1 } : null));
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [story]);

  const followers = (profile.followersMode === "scenario" ? followersByMonth?.[profile.followersMonths] ?? 0 : profile.hypotheticalFollowers) + (following ? 1 : 0);
  const mediaOf = useCallback((p: IgPub) => p.mediaFileIds.map((id) => files.get(id)).filter(Boolean) as MediaFile[], [files]);
  const toggle = (set: Set<string>, id: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    fn(n);
  };
  const openStories = (items: IgPub[], title?: string) => {
    if (!items.length) return;
    setSeen(true);
    setStory({ items, idx: 0, title });
  };

  const Media = ({ f, cls }: { f: MediaFile; cls?: string }) =>
    f.mime.startsWith("video/") ? <video className={cls} src={`/api/files/${f.id}`} muted loop autoPlay playsInline /> : <img className={cls} src={`/api/files/${f.id}`} alt="" draggable={false} />;
  const Ph = ({ p }: { p: IgPub }) => <div className="ph" style={{ background: p.coverColor ?? "#E9E2D8", color: isDark(p.coverColor) ? "#F8F6F1" : "#252521" }}>{p.title}</div>;
  const Avatar = ({ size }: { size: number }) => {
    const f = profile.avatarFileId ? files.get(profile.avatarFileId) : undefined;
    return (
      <div className={`av ${profile.avatarFit === "contain" ? "contain" : ""}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {profile.avatarFileId ? <img src={`/api/files/${profile.avatarFileId}`} alt={f?.name ?? "Foto de perfil"} /> : (profile.displayName || "A")[0]}
      </div>
    );
  };

  const PostCard = ({ p }: { p: IgPub }) => {
    const media = mediaOf(p);
    const n = Math.max(1, media.length);
    const idx = Math.min(slide[p.id] ?? 0, n - 1);
    const go = (d: number) => setSlide({ ...slide, [p.id]: Math.max(0, Math.min(n - 1, idx + d)) });
    const tags = (p.hashtags ?? "").trim();
    const full = p.caption ?? "";
    const open = capOpen.has(p.id) || full.length < 110;
    return (
      <article className="post">
        <div className="phead"><Avatar size={32} /><div className="who"><b>{profile.username}</b><small>{p.isAd ? "Patrocinado" : p.location}</small></div><Ico n="more" /></div>
        <div
          className="media"
          onDoubleClick={() => { setLiked(new Set(liked).add(p.id)); setPop(p.id); setTimeout(() => setPop(null), 800); }}
          onPointerDown={(e) => (swipe.current = { x: e.clientX, id: p.id })}
          onPointerUp={(e) => { const s = swipe.current; swipe.current = null; if (s && s.id === p.id && Math.abs(e.clientX - s.x) > 40) go(e.clientX < s.x ? 1 : -1); }}
        >
          <div className="track" style={{ transform: `translateX(-${idx * 100}%)` }}>
            {media.length ? media.map((f) => <div className="slide" key={f.id}><Media f={f} /></div>) : <div className="slide"><Ph p={p} /></div>}
          </div>
          {n > 1 && (
            <>
              <span className="count">{idx + 1}/{n}</span>
              {idx > 0 && <button className="nav l" onClick={() => go(-1)} aria-label="Anterior">‹</button>}
              {idx < n - 1 && <button className="nav r" onClick={() => go(1)} aria-label="Próxima">›</button>}
            </>
          )}
          <div className={`heart ${pop === p.id ? "pop" : ""}`}><Ico n="heart" /></div>
        </div>
        {(p.isAd || p.cta) && <div className={`ctab ${p.isAd ? "ad" : ""}`}><span>{p.isAd ? p.adCta || "Saiba mais" : p.cta}</span><span>›</span></div>}
        <div className="acts">
          <button className={liked.has(p.id) ? "liked" : ""} onClick={() => toggle(liked, p.id, setLiked)} aria-label="Curtir"><Ico n="heart" /></button>
          <button aria-label="Comentar"><Ico n="comment" /></button>
          <button aria-label="Compartilhar"><Ico n="send" /></button>
          {n > 1 ? <div className="dots">{Array.from({ length: n }, (_, i) => <i key={i} className={i === idx ? "on" : ""} />)}</div> : <span />}
          <button className={saved.has(p.id) ? "saved" : ""} onClick={() => toggle(saved, p.id, setSaved)} aria-label="Salvar"><Ico n="save" /></button>
        </div>
        <div className="cap" style={{ paddingTop: 6 }}>
          {p.hypotheticalLikes == null ? (liked.has(p.id) ? <b>1 curtida</b> : "Seja a primeira pessoa a curtir") : <><b>{num(p.hypotheticalLikes + (liked.has(p.id) ? 1 : 0))} curtidas</b> <span className="hypo">(hipotético)</span></>}
        </div>
        <div className="cap">
          <b>{profile.username}</b> {open ? full : full.slice(0, 100)}
          {!open && <>… <button className="more" onClick={() => setCapOpen(new Set(capOpen).add(p.id))}>mais</button></>}
          {open && tags && <><br /><span className="tags">{tags}</span></>}
        </div>
        <div className="cap mute" style={{ fontSize: 12 }}>
          {p.hypotheticalComments ? <>Ver todos os {num(p.hypotheticalComments)} comentários <span className="hypo">(hipotético)</span><br /></> : null}
          {longDate(p.scheduledAt)}
        </div>
      </article>
    );
  };

  const Tile = ({ p, reel }: { p: IgPub; reel?: boolean }) => {
    const f = mediaOf(p)[0];
    return (
      <button
        className={`tile ${drag === p.id ? "dragging" : ""} ${over === p.id ? "dropt" : ""}`}
        draggable={!!editable && !reel}
        onDragStart={() => setDrag(p.id)}
        onDragEnd={() => { setDrag(null); setOver(null); }}
        onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(p.id); } }}
        onDrop={() => {
          if (!drag || drag === p.id || !onReorder) return;
          const ids = feed.map((x) => x.id).filter((x) => x !== drag);
          ids.splice(ids.indexOf(p.id), 0, drag);
          setDrag(null);
          setOver(null);
          onReorder(ids);
        }}
        onClick={() => {
          if (p.type === "REEL") { setScreen("reels"); setReelIdx(Math.max(0, reels.findIndex((r) => r.id === p.id))); }
          else { setScreen("post"); setPostId(p.id); }
        }}
        aria-label={p.title}
      >
        {f ? <Media f={f} /> : <Ph p={p} />}
        {p.type === "CAROUSEL" && <span className="badge"><Ico n="carousel" /></span>}
        {p.type === "REEL" && !reel && <span className="badge"><Ico n="reels" /></span>}
        {reel && p.hypotheticalViews ? <span className="views">▷ {compact(p.hypotheticalViews)}</span> : null}
        {p.status !== "APPROVED" && p.status !== "SCHEDULED" && <span className="draft">rascunho</span>}
      </button>
    );
  };

  const ringAvatar = (size: number) =>
    stories.length ? (
      <button className={`ring ${seen ? "seen" : ""}`} onClick={() => openStories(stories)} aria-label="Ver stories"><span className="gap"><Avatar size={size} /></span></button>
    ) : <Avatar size={size} />;

  const profileScreen = () => {
    const list = gridTab === "reels" ? reels : gridTab === "tagged" ? [] : feed;
    return (
      <>
        <div className="topbar"><span>{profile.username} <small style={{ fontSize: 12 }}>⌄</small></span><span className="acts"><Ico n="plus" /><Ico n="menu" /></span></div>
        <div className="prof">
          <div className="top">
            {ringAvatar(82)}
            <div className="counts"><span><b>{feed.length}</b>posts</span><span><b>{compact(followers)}</b>seguidores</span><span><b>{compact(profile.hypotheticalFollowing)}</b>seguindo</span></div>
          </div>
          <div className="bio">
            <b>{profile.displayName}</b>
            {profile.category && <><br /><span className="cat">{profile.category}</span></>}
            {profile.bio && <><br />{profile.bio}</>}
            {profile.link && <><br /><span className="lnk"><Ico n="link" style={{ width: 13, height: 13, verticalAlign: -2 }} /> {profile.link.replace(/^https?:\/\//, "")}</span></>}
          </div>
          <div className="hypo" style={{ marginTop: 4 }}>Seguidores {profile.followersMode === "scenario" ? "do cenário de referência" : "informados"} · número hipotético</div>
          <div className="btns"><button className={following ? "" : "primary"} onClick={() => setFollowing(!following)}>{following ? "Seguindo ⌄" : "Seguir"}</button><button>Mensagem</button><button aria-label="Sugestões">⌄</button></div>
        </div>
        <div className="hls">
          {highlights.map((h) => {
            const items = stories.filter((s) => s.highlightId === h.id);
            return (
              <button key={h.id} onClick={() => openStories(items, h.title)} title={items.length ? undefined : "Sem stories neste destaque"}>
                <div className="cov"><div style={h.coverFileId ? { backgroundImage: `url('/api/files/${h.coverFileId}')` } : { background: h.coverColor ?? "#E9E2D8" }} /></div>
                {h.title}
              </button>
            );
          })}
        </div>
        <div className="gtabs">
          {(["grid", "reels", "tagged"] as const).map((t) => <button key={t} className={gridTab === t ? "on" : ""} onClick={() => setGridTab(t)} aria-label={t}><Ico n={t === "grid" ? "grid" : t === "reels" ? "reels" : "tag"} /></button>)}
        </div>
        {list.length ? (
          <div className={`grid3 ${gridTab === "reels" ? "reels" : ""}`}>{list.map((p) => <Tile key={p.id} p={p} reel={gridTab === "reels"} />)}</div>
        ) : (
          <p className="mute" style={{ textAlign: "center", padding: "30px 20px" }}>{gridTab === "tagged" ? "Fotos em que a marca for marcada aparecerão aqui." : "Ainda não há publicações."}</p>
        )}
      </>
    );
  };

  const homeScreen = () => (
    <>
      <div className="topbar"><span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 24 }}>Início</span><span className="acts"><Ico n="heart" /><Ico n="send" /></span></div>
      <div className="tray">
        <button onClick={() => openStories(stories)}>{stories.length ? <span className="ring"><span className="gap"><Avatar size={58} /></span></span> : <Avatar size={58} />}<span className="n">{profile.username}</span></button>
        {highlights.map((h) => (
          <button key={h.id} onClick={() => openStories(stories.filter((s) => s.highlightId === h.id), h.title)}>
            <span className="ring seen"><span className="gap"><span className="av" style={{ width: 58, height: 58, ...(h.coverFileId ? { background: `url('/api/files/${h.coverFileId}') center/cover` } : { background: h.coverColor ?? "#E9E2D8" }) }} /></span></span>
            <span className="n">{h.title}</span>
          </button>
        ))}
      </div>
      {feed.length ? [...feed].sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? "")).map((p) => <PostCard key={p.id} p={p} />) : <p className="mute" style={{ textAlign: "center", padding: 40 }}>Nenhuma publicação no feed.</p>}
    </>
  );

  const postScreen = () => {
    const p = all.find((x) => x.id === postId);
    if (!p) return profileScreen();
    return (
      <>
        <div className="topbar" style={{ fontSize: 15 }}>
          <button onClick={() => setScreen("profile")} style={{ border: 0, background: "none", color: "inherit", cursor: "pointer", padding: 0, display: "grid" }} aria-label="Voltar"><Ico n="back" /></button>
          <span style={{ flex: 1, textAlign: "center", lineHeight: 1.1 }}><small className="mute" style={{ display: "block", fontWeight: 400, fontSize: 11 }}>{profile.username.toUpperCase()}</small>Publicações</span>
          <span style={{ width: 24 }} />
        </div>
        <PostCard p={p} />
        {onOpen && <p style={{ textAlign: "center", padding: 8 }}><button className="more mute" style={{ border: 0, background: "none", cursor: "pointer", textDecoration: "underline" }} onClick={() => onOpen(p)}>Editar esta publicação</button></p>}
      </>
    );
  };

  const reelScreen = () => {
    if (!reels.length) return <div className="full" style={{ display: "grid", placeItems: "center", padding: 30, textAlign: "center" }}>Nenhum Reels ainda. Crie uma publicação no formato Reels.</div>;
    const i = Math.max(0, Math.min(reelIdx, reels.length - 1));
    const p = reels[i];
    const f = mediaOf(p)[0];
    return (
      <div className="full">
        <div className="bg">{f ? <Media f={f} /> : <Ph p={p} />}</div>
        <div className="shade top" /><div className="shade" />
        <div style={{ position: "absolute", top: 52, left: 16, right: 16, display: "flex", justifyContent: "space-between", zIndex: 2, fontWeight: 700, fontSize: 18 }}>
          Reels
          {reels.length > 1 && (
            <span style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setReelIdx((i - 1 + reels.length) % reels.length)} style={{ border: 0, background: "rgba(255,255,255,.2)", color: "#fff", borderRadius: "50%", width: 28, height: 28, cursor: "pointer" }} aria-label="Reels anterior">↑</button>
              <button onClick={() => setReelIdx((i + 1) % reels.length)} style={{ border: 0, background: "rgba(255,255,255,.2)", color: "#fff", borderRadius: "50%", width: 28, height: 28, cursor: "pointer" }} aria-label="Próximo Reels">↓</button>
            </span>
          )}
        </div>
        <div className="rside">
          <button onClick={() => toggle(liked, p.id, setLiked)} style={{ border: 0, background: "none", color: "#fff", cursor: "pointer", display: "grid", justifyItems: "center", gap: 2 }}>
            <Ico n="heart" style={liked.has(p.id) ? { fill: "#ff3040", stroke: "#ff3040" } : undefined} />
            <span>{p.hypotheticalLikes ? compact(p.hypotheticalLikes + (liked.has(p.id) ? 1 : 0)) : liked.has(p.id) ? "1" : "Curtir"}</span>
          </button>
          <span><Ico n="comment" /><br />{p.hypotheticalComments ? compact(p.hypotheticalComments) : 0}</span>
          <Ico n="send" />
          <Ico n="more" />
        </div>
        <div className="rcap">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar size={30} /><b>{profile.username}</b><span style={{ border: "1px solid rgba(255,255,255,.7)", borderRadius: 7, padding: "1px 8px", fontSize: 12 }}>Seguir</span></div>
          {p.isAd && <span style={{ fontSize: 11 }}>Patrocinado</span>}
          <div>{(p.caption ?? "").slice(0, 120)}{(p.caption ?? "").length > 120 ? "…" : ""} <span style={{ color: "#e0f1ff" }}>{p.hashtags}</span></div>
          <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><Ico n="music" style={{ width: 14, height: 14 }} /> {profile.username} · Áudio original</div>
          {p.isAd && <span className="sticker" style={{ justifyContent: "center" }}>{p.adCta || "Saiba mais"} ›</span>}
          <span className="hypo" style={{ color: "rgba(255,255,255,.75)" }}>{p.hypotheticalViews ? `${compact(p.hypotheticalViews)} visualizações · ` : ""}números hipotéticos</span>
        </div>
      </div>
    );
  };

  const storyLayer = () => {
    if (!story) return null;
    const p = story.items[story.idx];
    if (!p) return null;
    const f = mediaOf(p)[0];
    return (
      <div className="full" onPointerDown={() => (paused.current = true)} onPointerUp={() => (paused.current = false)} onPointerLeave={() => (paused.current = false)}>
        <div className="bg">{f ? <Media f={f} /> : <Ph p={p} />}</div>
        <div className="shade top" />
        <div className="bars">{story.items.map((_, i) => <i key={i}><b ref={i === story.idx ? bar : undefined} style={{ width: `${i < story.idx ? 100 : i === story.idx && story.preview ? 35 : 0}%` }} /></i>)}</div>
        <div className="sthead"><Avatar size={30} /><b>{profile.username}</b><small>{p.isAd ? "Patrocinado" : story.title || longDate(p.scheduledAt)}</small><button className="x" onClick={() => setStory(null)} aria-label="Fechar">×</button></div>
        {!story.preview && (
          <>
            <button className="tap l" onClick={() => setStory({ ...story, idx: Math.max(0, story.idx - 1) })} aria-label="Story anterior" />
            <button className="tap r" onClick={() => (story.idx + 1 < story.items.length ? setStory({ ...story, idx: story.idx + 1 }) : setStory(null))} aria-label="Próximo story" />
          </>
        )}
        <div className="stfoot">
          {p.caption && <div className="stcap">{p.caption}</div>}
          {p.isAd ? <span className="sticker">↑ {p.adCta || "Saiba mais"}</span> : p.cta ? <span className="sticker"><Ico n="link" style={{ width: 15, height: 15, stroke: "#0095f6" }} /> {p.cta}</span> : null}
          <div style={{ display: "flex", gap: 8, width: "100%", alignItems: "center" }}><span style={{ flex: 1, border: "1px solid rgba(255,255,255,.6)", borderRadius: 99, padding: "8px 14px", fontSize: 12.5 }}>Enviar mensagem</span><Ico n="heart" /><Ico n="send" /></div>
        </div>
      </div>
    );
  };

  const go = (s: Screen) => { setStory(null); setScreen(s); };
  const fullScreen = screen === "reels" || !!story;

  return (
    <div className="igsim">
      <div className="flex flex-wrap justify-center gap-1.5" role="toolbar" aria-label="Telas do app">
        {([["profile", "Perfil"], ["home", "Feed"], ["reels", "Reels"]] as const).map(([s, l]) => (
          <button key={s} className={`btn-sm ${screen === s || (s === "profile" && screen === "post") ? "btn-primary" : "btn-secondary"}`} onClick={() => go(s)}>{l}</button>
        ))}
        <button className="btn-secondary btn-sm" onClick={() => openStories(stories)} disabled={!stories.length}>▶ Stories</button>
        <button className="btn-secondary btn-sm" onClick={() => setDark(!dark)}>{dark ? "App claro" : "App escuro"}</button>
      </div>
      <div className="device">
        <div className={`scr ${dark || screen === "reels" ? "dark" : ""}`}>
          <div className="island" />
          <div className={`sbar ${fullScreen ? "over" : ""}`}><span>9:41</span><span style={{ letterSpacing: 2 }}>▮▮▮ ◔</span></div>
          <div className="body">{screen === "home" ? homeScreen() : screen === "post" ? postScreen() : screen === "reels" ? reelScreen() : profileScreen()}</div>
          <nav className="tnav" aria-label="Navegação do app">
            <button className={screen === "home" ? "on" : ""} onClick={() => go("home")} aria-label="Início"><Ico n="home" /></button>
            <button aria-label="Pesquisar"><Ico n="search" /></button>
            <button aria-label="Criar"><Ico n="plus" /></button>
            <button className={screen === "reels" ? "on" : ""} onClick={() => go("reels")} aria-label="Reels"><Ico n="reels" /></button>
            <button onClick={() => go("profile")} aria-label="Perfil" style={{ padding: 6 }}><span style={{ borderRadius: "50%", boxShadow: screen === "profile" || screen === "post" ? "0 0 0 2px var(--ig-fg)" : undefined }}><Avatar size={26} /></span></button>
          </nav>
          {storyLayer()}
        </div>
      </div>
      <p className="max-w-[360px] text-center text-xs text-carvao/60">Dois cliques na imagem curtem · arraste as miniaturas do perfil para reorganizar o feed · toque nas laterais do story para avançar e segure para pausar.</p>
    </div>
  );
}

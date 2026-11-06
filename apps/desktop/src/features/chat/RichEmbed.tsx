"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  YoutubeLogo,
  GithubLogo,
  Globe,
  GameController,
  SpotifyLogo,
  Play,
  FilmStrip,
  MusicNotes,
} from "@phosphor-icons/react";
import {
  TwitterEmbed,
  TikTokEmbed,
  InstagramEmbed,
} from "react-social-media-embed";

export interface RichEmbedProps {
  content: string;
}

interface EmbedData {
  type:
    | "steam"
    | "epic"
    | "spotify"
    | "youtube"
    | "soundcloud"
    | "twitch"
    | "direct_video"
    | "direct_image"
    | "twitter"
    | "tiktok"
    | "instagram"
    | "github"
    | "generic";
  url: string;
  id?: string;
  extraType?: string;
  title?: string;
  subtitle?: string;
}

interface OpenGraphMeta {
  title?: string;
  description?: string;
  publisher?: string;
  logoUrl?: string;
  imageUrl?: string;
}

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

// Cache em memória para metadados OpenGraph de links genéricos
const ogCache = new Map<string, OpenGraphMeta | null>();

function cleanSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function RichEmbed({ content }: RichEmbedProps) {
  const [ogData, setOgData] = useState<OpenGraphMeta | null>(null);
  const [, setLoadingOg] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const embed = useMemo<EmbedData | null>(() => {
    if (!content) return null;
    const matches = content.match(URL_REGEX);
    if (!matches || matches.length === 0) return null;

    const firstUrl = matches[0];

    // 1. Direct Video files (.mp4, .webm, .mov)
    if (/\.(mp4|webm|mov)(\?[^#\s]*)?$/i.test(firstUrl)) {
      return {
        type: "direct_video",
        url: firstUrl,
        title: "Vídeo",
      };
    }

    // 2. Direct Images / GIFs (.png, .jpg, .jpeg, .gif, .webp)
    if (/\.(png|jpe?g|gif|webp)(\?[^#\s]*)?$/i.test(firstUrl)) {
      return {
        type: "direct_image",
        url: firstUrl,
        title: "Imagem",
      };
    }

    // 3. Steam Store detection (App e Workshop)
    const steamMatch = firstUrl.match(
      /store\.steampowered\.com\/app\/(\d+)(?:\/([^\s/?#]+))?/i,
    );
    if (steamMatch && steamMatch[1]) {
      const appId = steamMatch[1];
      const rawSlug = steamMatch[2] ? decodeURIComponent(steamMatch[2]) : "";
      const gameTitle = rawSlug ? cleanSlug(rawSlug) : `App Steam #${appId}`;
      return {
        type: "steam",
        url: firstUrl,
        id: appId,
        title: gameTitle,
        subtitle: "Steam Store",
      };
    }

    // 4. Spotify detection: suporta faixas, álbuns, playlists, episódios, podcasts e URIs com/sem locale
    const spotifyMatch = firstUrl.match(
      /(?:open\.spotify\.com\/(?:intl-[a-zA-Z-]+\/)?|spotify:)(track|album|playlist|episode|artist|show)(?:\/|:)([a-zA-Z0-9]+)/i,
    );
    if (spotifyMatch && spotifyMatch[1] && spotifyMatch[2]) {
      const type = spotifyMatch[1].toLowerCase();
      const id = spotifyMatch[2];
      const labelMap: Record<string, string> = {
        track: "Música no Spotify",
        album: "Álbum no Spotify",
        playlist: "Playlist no Spotify",
        episode: "Episódio no Spotify",
        show: "Podcast no Spotify",
        artist: "Artista no Spotify",
      };
      return {
        type: "spotify",
        url: firstUrl,
        extraType: type,
        id,
        title: labelMap[type] || "Spotify",
        subtitle: cleanSlug(type),
      };
    }

    // 5. YouTube detection (padrão, encurtado, shorts, embed e live)
    const ytMatch = firstUrl.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    );
    if (ytMatch && ytMatch[1]) {
      return {
        type: "youtube",
        url: firstUrl,
        id: ytMatch[1],
        title: "YouTube Video",
      };
    }

    // 6. SoundCloud detection
    const soundcloudMatch = firstUrl.match(
      /soundcloud\.com\/([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_]+)/i,
    );
    if (soundcloudMatch && !firstUrl.includes("/you/") && !firstUrl.includes("/discover")) {
      return {
        type: "soundcloud",
        url: firstUrl,
        title: cleanSlug(soundcloudMatch[2]),
        subtitle: cleanSlug(soundcloudMatch[1]),
      };
    }

    // 7. Twitch detection (canal ou clipe)
    const twitchClipMatch = firstUrl.match(/(?:clips\.twitch\.tv\/|twitch\.tv\/[^\/]+\/clip\/)([a-zA-Z0-9-_]+)/i);
    if (twitchClipMatch && twitchClipMatch[1]) {
      return {
        type: "twitch",
        url: firstUrl,
        id: twitchClipMatch[1],
        extraType: "clip",
        title: "Clipe da Twitch",
      };
    }

    const twitchStreamMatch = firstUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
    if (twitchStreamMatch && twitchStreamMatch[1] && !["directory", "downloads", "p", "videos"].includes(twitchStreamMatch[1])) {
      return {
        type: "twitch",
        url: firstUrl,
        id: twitchStreamMatch[1],
        extraType: "stream",
        title: `Twitch / ${twitchStreamMatch[1]}`,
      };
    }

    // 8. Epic Games Store detection
    const epicMatch = firstUrl.match(
      /store\.epicgames\.com\/(?:[a-zA-Z-]+(?:\/p\/|\/product\/))([a-zA-Z0-9_-]+)/i,
    );
    if (epicMatch && epicMatch[1]) {
      const slug = epicMatch[1];
      return {
        type: "epic",
        url: firstUrl,
        id: slug,
        title: cleanSlug(slug),
        subtitle: "Epic Games Store",
      };
    }

    // 9. Twitter / X detection
    const twitterMatch = firstUrl.match(
      /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/i,
    );
    if (twitterMatch) {
      return {
        type: "twitter",
        url: firstUrl,
        id: twitterMatch[1],
        title: "X / Twitter",
      };
    }

    // 10. TikTok detection
    const tiktokMatch = firstUrl.match(
      /tiktok\.com\/@[a-zA-Z0-9_.-]+\/video\/(\d+)/i,
    );
    if (tiktokMatch) {
      return {
        type: "tiktok",
        url: firstUrl,
        id: tiktokMatch[1],
        title: "TikTok",
      };
    }

    // 11. Instagram detection
    const instaMatch = firstUrl.match(
      /instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/i,
    );
    if (instaMatch) {
      return {
        type: "instagram",
        url: firstUrl,
        id: instaMatch[1],
        title: "Instagram",
      };
    }

    // 12. GitHub repository detection
    const ghMatch = firstUrl.match(
      /github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/i,
    );
    if (ghMatch && ghMatch[1] && ghMatch[2]) {
      return {
        type: "github",
        url: firstUrl,
        title: `${ghMatch[1]}/${ghMatch[2]}`,
        subtitle: "Repositório no GitHub",
      };
    }

    // 13. Generic URL fallback para extração OpenGraph
    try {
      const parsed = new URL(firstUrl);
      return {
        type: "generic",
        url: firstUrl,
        title: parsed.hostname,
        subtitle: parsed.pathname !== "/" ? parsed.pathname : undefined,
      };
    } catch {
      return null;
    }
  }, [content]);

  // Busca metadados OpenGraph via microlink para links genéricos e GitHub
  useEffect(() => {
    if (!embed || (embed.type !== "generic" && embed.type !== "github")) {
      return;
    }

    const cached = ogCache.get(embed.url);
    if (cached !== undefined) {
      setOgData(cached);
      return;
    }

    let active = true;
    setLoadingOg(true);

    const fetchMeta = async () => {
      try {
        const res = await fetch(
          `https://api.microlink.io?url=${encodeURIComponent(embed.url)}`,
          { signal: AbortSignal.timeout(4500) },
        );
        if (!res.ok) throw new Error("Fetch failed");
        const json = await res.json();
        if (json.status === "success" && json.data && active) {
          const meta: OpenGraphMeta = {
            title: json.data.title || undefined,
            description: json.data.description || undefined,
            publisher: json.data.publisher || undefined,
            logoUrl: json.data.logo?.url || undefined,
            imageUrl: json.data.image?.url || undefined,
          };
          ogCache.set(embed.url, meta);
          setOgData(meta);
        } else if (active) {
          ogCache.set(embed.url, null);
          setOgData(null);
        }
      } catch {
        if (active) {
          ogCache.set(embed.url, null);
          setOgData(null);
        }
      } finally {
        if (active) setLoadingOg(false);
      }
    };

    void fetchMeta();

    return () => {
      active = false;
    };
  }, [embed]);

  if (!embed) return null;

  // --- STEAM STORE EMBED (Harmonizado sem duplicações de cabeçalho) ---
  if (embed.type === "steam" && embed.id) {
    return (
      <div className="mt-2 max-w-[620px] w-full rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-2xl animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-[#171a21]/90">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#1b2838] text-acc border border-acc/20 shadow-xs shrink-0">
              <GameController size={14} weight="bold" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-txt truncate">{embed.title}</p>
              <span className="text-[10px] text-acc font-medium uppercase tracking-wider">Steam Store</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-[11px] font-semibold text-acc hover:text-acc-press bg-acc/10 hover:bg-acc/20 border border-acc/30 px-2.5 py-0.5 rounded-lg transition-all"
              title="Abrir no aplicativo Steam instalado"
            >
              Abrir na Steam
            </a>
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
              title="Abrir no navegador"
              aria-label="Abrir no navegador"
            >
              <ArrowSquareOut size={14} />
            </a>
          </div>
        </div>

        {/* Widget oficial interativo da Steam */}
        <div className="w-full bg-[#1b2838] overflow-hidden">
          <iframe
            src={`https://store.steampowered.com/widget/${embed.id}/`}
            title={`Steam Widget ${embed.title}`}
            width="100%"
            height="190"
            className="w-full border-0 block"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  // --- SPOTIFY EMBED (Suporta faixas, álbuns, playlists, podcasts e shows) ---
  if (embed.type === "spotify" && embed.id && embed.extraType) {
    const isLarge = ["album", "playlist", "artist", "show"].includes(embed.extraType);
    const height = isLarge ? 352 : 152;

    return (
      <div className="mt-2.5 max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-2xl animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.03]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/30 shrink-0">
              <SpotifyLogo size={16} weight="fill" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-txt truncate block">Spotify Player</span>
              <span className="text-[10px] text-mut/80 font-medium">{embed.title}</span>
            </div>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Abrir no aplicativo do Spotify"
            aria-label="Abrir no aplicativo do Spotify"
          >
            <ArrowSquareOut size={14} />
          </a>
        </div>
        <div className="w-full bg-[#121212] p-1">
          <iframe
            src={`https://open.spotify.com/embed/${embed.extraType}/${embed.id}?utm_source=generator&theme=0`}
            title="Spotify Player"
            width="100%"
            height={height}
            className="w-full rounded-xl border-0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  // --- SOUNDCLOUD EMBED ---
  if (embed.type === "soundcloud") {
    return (
      <div className="mt-2.5 max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.03]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
              <MusicNotes size={14} weight="bold" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-txt truncate">{embed.title}</p>
              <span className="text-[10px] text-orange-400 font-medium">SoundCloud</span>
            </div>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Abrir no SoundCloud"
            aria-label="Abrir no SoundCloud"
          >
            <ArrowSquareOut size={14} />
          </a>
        </div>
        <div className="w-full bg-[#12161f]">
          <iframe
            width="100%"
            height="166"
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(
              embed.url,
            )}&color=%230fb9a8&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
            className="w-full border-0 block"
          />
        </div>
      </div>
    );
  }

  // --- YOUTUBE EMBED ---
  if (embed.type === "youtube" && embed.id) {
    const thumbnailUrl = `https://img.youtube.com/vi/${embed.id}/hqdefault.jpg`;

    return (
      <div className="mt-2 max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#12161f]/90 overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-600/15 text-red-500 border border-red-500/30 shrink-0">
              <YoutubeLogo size={16} weight="fill" />
            </div>
            <span className="text-xs font-semibold text-txt truncate">YouTube</span>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Abrir no YouTube"
            aria-label="Abrir no YouTube"
          >
            <ArrowSquareOut size={14} />
          </a>
        </div>

        {showVideo ? (
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${embed.id}?autoplay=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : (
          <div
            onClick={() => setShowVideo(true)}
            className="cursor-pointer relative aspect-video w-full bg-black/60 group overflow-hidden"
          >
            <img
              src={thumbnailUrl}
              alt="Prévia do vídeo"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-xl shadow-red-600/40 group-hover:scale-110 active:scale-95 transition-all">
                <Play size={20} weight="fill" className="ml-0.5" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- DIRECT VIDEO EMBED (.mp4, .webm, .mov) ---
  if (embed.type === "direct_video") {
    return (
      <div className="mt-2 max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#12161f]/90 overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-xs text-mut font-medium">
            <FilmStrip size={14} />
            <span>Vídeo</span>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <ArrowSquareOut size={13} />
          </a>
        </div>
        <video
          src={embed.url}
          controls
          preload="metadata"
          className="w-full max-h-80 bg-black object-contain"
        />
      </div>
    );
  }

  // --- DIRECT IMAGE EMBED (.png, .jpg, .gif, .webp) ---
  if (embed.type === "direct_image") {
    return (
      <div className="mt-2 max-w-md rounded-2xl border border-white/[0.08] bg-[#12161f]/90 overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <a href={embed.url} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
          <img
            src={embed.url}
            alt="Mídia inline"
            className="w-full max-h-80 object-cover hover:scale-[1.01] transition-transform duration-200"
            loading="lazy"
          />
        </a>
      </div>
    );
  }

  // --- EPIC GAMES STORE EMBED ---
  if (embed.type === "epic" && embed.id) {
    return (
      <div className="mt-2.5 max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-white/[0.03]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-black text-txt border border-white/[0.1] shadow-xs font-bold text-xs shrink-0">
              EG
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-txt truncate">{embed.title}</p>
              <span className="text-[10px] text-mut/80 font-medium">Epic Games Store</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-[11px] font-semibold text-txt hover:bg-white/[0.1] bg-white/[0.05] border border-white/[0.15] px-2.5 py-0.5 rounded-lg transition-all"
              title="Abrir no Launcher da Epic Games"
            >
              Abrir
            </a>
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              <ArrowSquareOut size={14} />
            </a>
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-white/[0.02] to-white/[0.05] flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-txt">{embed.title}</h4>
            <p className="text-xs text-mut/80">Disponível para PC na Epic Games Store</p>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer shrink-0 rounded-xl bg-acc text-bg text-xs font-semibold px-3 py-1.5 shadow-md shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>Ver Oferta</span>
            <ArrowSquareOut size={13} weight="bold" />
          </a>
        </div>
      </div>
    );
  }

  // --- TWITTER / X EMBED ---
  if (embed.type === "twitter") {
    return (
      <div className="mt-2.5 max-w-md rounded-2xl overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <TwitterEmbed url={embed.url} width={380} />
      </div>
    );
  }

  // --- TIKTOK EMBED ---
  if (embed.type === "tiktok") {
    return (
      <div className="mt-2.5 max-w-sm rounded-2xl overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <TikTokEmbed url={embed.url} width={325} />
      </div>
    );
  }

  // --- INSTAGRAM EMBED ---
  if (embed.type === "instagram") {
    return (
      <div className="mt-2.5 max-w-sm rounded-2xl overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <InstagramEmbed url={embed.url} width={328} />
      </div>
    );
  }

  // --- GITHUB REPOSITORY CARD OU LINK GENÉRICO ENRIQUECIDO COM OPENGRAPH ---
  // Estilo Discord com borda lateral com acento teal, título clicável, imagem e favicon
  const displayTitle = ogData?.title || embed.title || "Link";
  const displayDesc = ogData?.description || embed.subtitle;
  const displayPublisher =
    ogData?.publisher || (embed.type === "github" ? "GitHub" : "Link Externo");
  const displayImage = ogData?.imageUrl;
  const displayLogo = ogData?.logoUrl;

  return (
    <div className="mt-2 max-w-[520px] w-full rounded-2xl border-l-4 border-l-acc border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl hover:border-white/[0.15] transition-all group animate-in fade-in-0 duration-150">
      <div className="p-3.5 space-y-2">
        {/* Cabeçalho do Card: Favicon / Logo + Nome do Site */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {displayLogo ? (
              <img
                src={displayLogo}
                alt=""
                className="h-4 w-4 rounded-sm object-contain shrink-0"
              />
            ) : embed.type === "github" ? (
              <GithubLogo size={16} weight="bold" className="text-txt shrink-0" />
            ) : (
              <Globe size={15} className="text-acc shrink-0" />
            )}
            <span className="text-[11px] font-medium text-mut truncate uppercase tracking-wider">
              {displayPublisher}
            </span>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors shrink-0"
            title="Abrir no navegador"
            aria-label="Abrir no navegador"
          >
            <ArrowSquareOut size={14} />
          </a>
        </div>

        {/* Título do Link */}
        <h4 className="text-sm font-semibold text-txt group-hover:text-acc transition-colors line-clamp-2">
          <a href={embed.url} target="_blank" rel="noopener noreferrer">
            {displayTitle}
          </a>
        </h4>

        {/* Descrição resumida */}
        {displayDesc && (
          <p className="text-xs text-mut/80 leading-relaxed line-clamp-3">
            {displayDesc}
          </p>
        )}

        {/* Imagem rica OpenGraph quando disponível */}
        {displayImage && (
          <div className="pt-1 overflow-hidden rounded-xl">
            <a href={embed.url} target="_blank" rel="noopener noreferrer">
              <img
                src={displayImage}
                alt={displayTitle}
                className="w-full max-h-56 object-cover rounded-xl border border-white/[0.06] hover:scale-[1.01] transition-transform duration-200"
                loading="lazy"
              />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

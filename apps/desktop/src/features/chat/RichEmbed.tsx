"use client";

import { useMemo, useState } from "react";
import {
  ArrowSquareOut,
  YoutubeLogo,
  GithubLogo,
  Globe,
  GameController,
  SpotifyLogo,
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

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

function cleanSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function RichEmbed({ content }: RichEmbedProps) {
  const embed = useMemo<EmbedData | null>(() => {
    if (!content) return null;
    const matches = content.match(URL_REGEX);
    if (!matches || matches.length === 0) return null;

    const firstUrl = matches[0];

    // 1. Steam Store detection
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

    // 2. Epic Games Store detection
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

    // 3. Spotify detection (Tracks, Albums, Playlists, Episodes)
    const spotifyMatch = firstUrl.match(
      /open\.spotify\.com\/(track|album|playlist|episode|artist)\/([a-zA-Z0-9]+)/i,
    );
    if (spotifyMatch && spotifyMatch[1] && spotifyMatch[2]) {
      return {
        type: "spotify",
        url: firstUrl,
        extraType: spotifyMatch[1],
        id: spotifyMatch[2],
        title: "Spotify",
        subtitle: cleanSlug(spotifyMatch[1]),
      };
    }

    // 4. YouTube detection
    const ytMatch = firstUrl.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    );
    if (ytMatch && ytMatch[1]) {
      return {
        type: "youtube",
        url: firstUrl,
        id: ytMatch[1],
        title: "YouTube Video",
      };
    }

    // 5. Twitter / X detection
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

    // 6. TikTok detection
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

    // 7. Instagram detection
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

    // 8. GitHub repository detection
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

    // 9. Generic URL fallback
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

  const [showVideo, setShowVideo] = useState(false);

  if (!embed) return null;

  // --- STEAM STORE EMBED ---
  if (embed.type === "steam" && embed.id) {
    const steamClientUrl = `steam://store/${embed.id}`;
    return (
      <div className="mt-2.5 max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-white/[0.03]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#1b2838] text-acc border border-acc/20 shadow-xs">
              <GameController size={16} weight="bold" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-txt truncate">
                {embed.title}
              </p>
              <span className="text-[10px] text-acc font-medium">Steam Store</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={steamClientUrl}
              className="cursor-pointer text-[11px] font-semibold text-acc hover:text-acc-press bg-acc/10 hover:bg-acc/20 border border-acc/30 px-2 py-0.5 rounded-lg transition-all"
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

        {/* Widget oficial da Steam */}
        <div className="w-full bg-[#1b2838]/80 p-0 overflow-hidden">
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

  // --- EPIC GAMES STORE EMBED ---
  if (embed.type === "epic" && embed.id) {
    const epicLauncherUrl = `com.epicgames.launcher://apps/${embed.id}?action=launch`;
    return (
      <div className="mt-2.5 max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-white/[0.03]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-black text-txt border border-white/[0.1] shadow-xs font-bold text-xs">
              EG
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-txt truncate">
                {embed.title}
              </p>
              <span className="text-[10px] text-mut/80 font-medium">Epic Games Store</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={epicLauncherUrl}
              className="cursor-pointer text-[11px] font-semibold text-txt hover:bg-white/[0.1] bg-white/[0.05] border border-white/[0.15] px-2 py-0.5 rounded-lg transition-all"
              title="Abrir no Launcher da Epic Games"
            >
              Launcher
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

  // --- SPOTIFY EMBED ---
  if (embed.type === "spotify" && embed.id && embed.extraType) {
    return (
      <div className="mt-2.5 max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.03]">
          <div className="flex items-center gap-2 min-w-0">
            <SpotifyLogo size={18} weight="fill" className="text-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-txt truncate">Spotify Player</span>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Abrir no Spotify"
            aria-label="Abrir no Spotify"
          >
            <ArrowSquareOut size={14} />
          </a>
        </div>
        <div className="w-full bg-[#121212] p-1">
          <iframe
            src={`https://open.spotify.com/embed/${embed.extraType}/${embed.id}?utm_source=generator&theme=0`}
            title="Spotify Player"
            width="100%"
            height="152"
            className="w-full rounded-xl border-0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
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

  // --- YOUTUBE EMBED ---
  if (embed.type === "youtube" && embed.id) {
    const thumbnailUrl = `https://img.youtube.com/vi/${embed.id}/hqdefault.jpg`;

    return (
      <div className="mt-2 max-w-md rounded-2xl border border-white/[0.08] bg-[#12161f]/90 overflow-hidden shadow-lg animate-in fade-in-0 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0">
            <YoutubeLogo size={18} weight="fill" className="text-red-500 shrink-0" />
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
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-85 group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-xl shadow-red-600/40 group-hover:scale-110 active:scale-95 transition-all">
                <YoutubeLogo size={28} weight="fill" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- GITHUB REPOSITORY CARD ---
  if (embed.type === "github") {
    return (
      <a
        href={embed.url}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer mt-2 flex items-center justify-between gap-3 p-3 rounded-2xl border border-white/[0.08] bg-[#12161f]/80 hover:bg-[#12161f] hover:border-acc/40 transition-all max-w-sm group shadow-md"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-txt">
            <GithubLogo size={20} weight="bold" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-txt truncate group-hover:text-acc transition-colors">
              {embed.title}
            </p>
            <p className="text-[10px] text-mut/80 truncate">{embed.subtitle}</p>
          </div>
        </div>
        <ArrowSquareOut size={15} className="text-mut group-hover:text-txt shrink-0" />
      </a>
    );
  }

  // --- GENERIC LINK FALLBACK ---
  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      className="cursor-pointer mt-2 flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-white/[0.08] bg-[#12161f]/60 hover:bg-[#12161f] hover:border-acc/30 transition-all max-w-xs group shadow-sm text-xs"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Globe size={15} className="text-acc shrink-0" />
        <span className="font-medium text-txt truncate group-hover:text-acc transition-colors">
          {embed.title}
        </span>
      </div>
      <ArrowSquareOut size={13} className="text-mut group-hover:text-txt shrink-0" />
    </a>
  );
}

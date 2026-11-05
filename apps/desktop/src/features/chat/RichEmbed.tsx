"use client";

import { useMemo, useState } from "react";
import { ArrowSquareOut, YoutubeLogo, GithubLogo, Globe } from "@phosphor-icons/react";

export interface RichEmbedProps {
  content: string;
}

interface EmbedData {
  type: "youtube" | "github" | "generic";
  url: string;
  id?: string;
  title?: string;
  subtitle?: string;
}

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

export default function RichEmbed({ content }: RichEmbedProps) {
  const embed = useMemo<EmbedData | null>(() => {
    if (!content) return null;
    const matches = content.match(URL_REGEX);
    if (!matches || matches.length === 0) return null;

    const firstUrl = matches[0];

    // YouTube detection
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

    // GitHub repository detection
    const ghMatch = firstUrl.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/i);
    if (ghMatch && ghMatch[1] && ghMatch[2]) {
      return {
        type: "github",
        url: firstUrl,
        title: `${ghMatch[1]}/${ghMatch[2]}`,
        subtitle: "Repositório no GitHub",
      };
    }

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


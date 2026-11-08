"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  YoutubeLogo,
  GithubLogo,
  Globe,
  GameController,
  SpotifyLogo,
  SoundcloudLogo,
  TwitchLogo,
  DiscordLogo,
  RedditLogo,
  SteamLogo,
  Play,
  FilmStrip,
  MusicNotes,
} from "@phosphor-icons/react";
import {
  TwitterEmbed,
  TikTokEmbed,
  InstagramEmbed,
} from "react-social-media-embed";
import { launchAppProtocol } from "@/lib/appLauncher";
import { ECHO_API_CONFIG } from "@/lib/api/config";

export interface RichEmbedProps {
  content: string;
  align?: "left" | "right";
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
    | "direct_audio"
    | "direct_image"
    | "twitter"
    | "tiktok"
    | "instagram"
    | "github"
    | "discord"
    | "reddit"
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

interface SpotifyOEmbedData {
  title?: string;
  thumbnail_url?: string;
  provider_name?: string;
  html?: string;
  iframe_url?: string;
}

interface SteamGameDetails {
  name: string;
  headerImage: string;
  shortDescription?: string;
  isFree?: boolean;
  priceFormatted?: string;
  discountPercent?: number;
  genres?: string[];
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
}

const URL_REGEX = /((?:https?:\/\/|spotify:|steam:\/\/)[^\s<]+)/gi;

// Caches em memória para metadados (persistentes durante a sessão)
const ogCache = new Map<string, OpenGraphMeta | null>();
const spotifyCache = new Map<string, SpotifyOEmbedData | null>();
const steamCache = new Map<string, SteamGameDetails | null>();

function cleanSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function RichEmbed({ content, align = "left" }: RichEmbedProps) {
  const alignClass = align === "right" ? "ml-auto" : "mr-auto";
  const [ogData, setOgData] = useState<OpenGraphMeta | null>(null);
  const [, setLoadingOg] = useState(false);
  const [spotifyMeta, setSpotifyMeta] = useState<SpotifyOEmbedData | null>(null);
  const [steamDetails, setSteamDetails] = useState<SteamGameDetails | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  const embed = useMemo<EmbedData | null>(() => {
    if (!content) return null;
    const matches = content.match(URL_REGEX);
    if (!matches || matches.length === 0) return null;

    // Normaliza a primeira URL encontrada
    let firstUrl = matches[0].trim();
    // Remove pontuações finais comuns que possam ter sido capturadas
    firstUrl = firstUrl.replace(/[.,!?:;]+$/, "");

    // 1. Arquivos de Vídeo Direto (.mp4, .webm, .mov, .ogg)
    if (/\.(mp4|webm|mov)(\?[^#\s]*)?$/i.test(firstUrl)) {
      return {
        type: "direct_video",
        url: firstUrl,
        title: "Vídeo",
      };
    }

    // 2. Arquivos de Áudio Direto (.mp3, .wav, .ogg, .m4a)
    if (/\.(mp3|wav|ogg|m4a)(\?[^#\s]*)?$/i.test(firstUrl)) {
      return {
        type: "direct_audio",
        url: firstUrl,
        title: "Áudio",
      };
    }

    // 3. Arquivos de Imagem / GIF Direto (.png, .jpg, .jpeg, .gif, .webp, .svg)
    if (/\.(png|jpe?g|gif|webp|svg)(\?[^#\s]*)?$/i.test(firstUrl)) {
      return {
        type: "direct_image",
        url: firstUrl,
        title: "Imagem",
      };
    }

    // 4. Steam Store & Workshop (URLs web e URI steam://)
    const steamMatch = firstUrl.match(
      /(?:store\.steampowered\.com\/app\/|steam:\/\/store\/|steam:\/\/run\/)(\d+)(?:\/([^\s/?#]+))?/i,
    );
    if (steamMatch && steamMatch[1]) {
      const appId = steamMatch[1];
      const rawSlug = steamMatch[2] ? decodeURIComponent(steamMatch[2]) : "";
      const gameTitle = rawSlug ? cleanSlug(rawSlug) : `App Steam #${appId}`;
      const canonicalWebUrl = firstUrl.startsWith("steam://")
        ? `https://store.steampowered.com/app/${appId}/`
        : firstUrl;
      return {
        type: "steam",
        url: canonicalWebUrl,
        id: appId,
        title: gameTitle,
        subtitle: "Steam Store",
      };
    }

    // 5. Spotify detection: suporta faixas, álbuns, playlists, episódios, podcasts, artistas, URLs internacionais e URIs spotify:
    const spotifyMatch = firstUrl.match(
      /(?:open\.spotify\.com\/(?:intl-[a-zA-Z-]+\/)?(?:embed\/)?(?:user\/[^\s/?#]+\/)?|spotify:)(track|album|playlist|episode|artist|show)(?:\/|:)([a-zA-Z0-9]+)/i,
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
      const canonicalWebUrl = firstUrl.startsWith("spotify:")
        ? `https://open.spotify.com/${type}/${id}`
        : firstUrl;
      return {
        type: "spotify",
        url: canonicalWebUrl,
        extraType: type,
        id,
        title: labelMap[type] || "Spotify Player",
        subtitle: cleanSlug(type),
      };
    }

    // 6. YouTube detection (padrão, encurtado, shorts, embed e live)
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

    // 8. SoundCloud detection
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

    // 9. Epic Games Store detection
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

    // 10. Discord Invites (discord.gg / discord.com/invite)
    const discordMatch = firstUrl.match(/(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9-_]+)/i);
    if (discordMatch && discordMatch[1]) {
      return {
        type: "discord",
        url: firstUrl,
        id: discordMatch[1],
        title: `Convite Discord: ${discordMatch[1]}`,
        subtitle: "Discord Server",
      };
    }

    // 11. Reddit detection
    const redditMatch = firstUrl.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)(?:\/comments\/([a-zA-Z0-9]+))?/i);
    if (redditMatch && redditMatch[1]) {
      return {
        type: "reddit",
        url: firstUrl,
        id: redditMatch[1],
        title: `r/${redditMatch[1]}`,
        subtitle: "Publicação no Reddit",
      };
    }

    // 12. GitHub repository / issues / pull requests
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

    // 13. Twitter / X detection
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

    // 14. TikTok detection
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

    // 15. Instagram detection
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

    // 16. Fallback universal para links genéricos da web
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

  // Carrega metadados da Steam Store (API oficial com fallback de CDN)
  useEffect(() => {
    if (!embed || embed.type !== "steam" || !embed.id) return;

    const appId = embed.id;
    const cached = steamCache.get(appId);
    if (cached !== undefined) {
      setSteamDetails(cached);
      return;
    }

    let active = true;
    const defaultBanner = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;

    const fetchSteam = async () => {
      try {
        const res = await fetch(
          `https://store.steampowered.com/api/appdetails?appids=${appId}&l=portuguese`,
          { signal: AbortSignal.timeout(4500) },
        );
        if (!res.ok) throw new Error("Steam API request failed");
        const json = await res.json();
        const appData = json?.[appId]?.data;
        if (appData && active) {
          const details: SteamGameDetails = {
            name: appData.name || embed.title || `App #${appId}`,
            headerImage: appData.header_image || defaultBanner,
            shortDescription: appData.short_description || undefined,
            isFree: Boolean(appData.is_free),
            priceFormatted: appData.is_free
              ? "Gratuito para Jogar"
              : appData.price_overview?.final_formatted || undefined,
            discountPercent: appData.price_overview?.discount_percent || 0,
            genres: appData.genres?.map((g: { description: string }) => g.description).slice(0, 4) || [],
            platforms: appData.platforms || { windows: true },
          };
          steamCache.set(appId, details);
          setSteamDetails(details);
          return;
        }
      } catch {
        // Fallback robusto usando assets CDN da Steam
      }

      if (active) {
        const fallbackDetails: SteamGameDetails = {
          name: embed.title || `App #${appId}`,
          headerImage: defaultBanner,
          platforms: { windows: true },
        };
        steamCache.set(appId, fallbackDetails);
        setSteamDetails(fallbackDetails);
      }
    };

    void fetchSteam();
    return () => {
      active = false;
    };
  }, [embed]);

  // Carrega metadados oEmbed oficiais do Spotify (Capa, Artista, Título)
  useEffect(() => {
    if (!embed || embed.type !== "spotify") return;

    const cached = spotifyCache.get(embed.url);
    if (cached !== undefined) {
      setSpotifyMeta(cached);
      return;
    }

    let active = true;
    const fetchSpotify = async () => {
      try {
        const res = await fetch(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(embed.url)}`,
          { signal: AbortSignal.timeout(4500) },
        );
        if (!res.ok) throw new Error("Spotify oEmbed request failed");
        const json: SpotifyOEmbedData = await res.json();
        if (active) {
          spotifyCache.set(embed.url, json);
          setSpotifyMeta(json);
        }
      } catch {
        if (active) {
          spotifyCache.set(embed.url, null);
          setSpotifyMeta(null);
        }
      }
    };

    void fetchSpotify();
    return () => {
      active = false;
    };
  }, [embed]);

  // Carrega metadados OpenGraph via endpoint interno na echo-api para links genéricos, Discord e GitHub
  useEffect(() => {
    if (!embed || (embed.type !== "generic" && embed.type !== "github" && embed.type !== "discord" && embed.type !== "reddit")) {
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
          `${ECHO_API_CONFIG.baseUrl}/api/link-preview?url=${encodeURIComponent(embed.url)}`,
          { signal: AbortSignal.timeout(4500) },
        );
        if (!res.ok) throw new Error("Fetch failed");
        const json = await res.json();
        if (json.status === "success" && json.data && active) {
          const meta: OpenGraphMeta = {
            title: json.data.title || undefined,
            description: json.data.description || undefined,
            publisher: json.data.publisher || undefined,
            logoUrl: json.data.logoUrl || json.data.logo?.url || undefined,
            imageUrl: json.data.imageUrl || json.data.image?.url || undefined,
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

  // ── STEAM STORE EMBED (Design Discord com Dark Glassmorphism, Metadados e Ações Nativas) ──
  if (embed.type === "steam" && embed.id) {
    const gameName = steamDetails?.name || embed.title || "Steam Game";

    return (
      <div className={`mt-2.5 max-w-[650px] w-full ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-2xl animate-in fade-in-0 duration-150 text-left`}>
        {/* Cabeçalho do Card */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-[#171a21]/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#1b2838] text-acc border border-acc/25 shadow-sm shrink-0">
              <SteamLogo size={16} weight="bold" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-txt truncate">{gameName}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-acc font-semibold uppercase tracking-wider">Steam Store</span>
                <span className="text-[10px] text-mut/60 font-mono">#{embed.id}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                void launchAppProtocol({
                  appName: "Steam",
                  protocolUrl: `steam://store/${embed.id}`,
                  webUrl: embed.url,
                });
              }}
              className="cursor-pointer text-[11px] font-semibold text-acc hover:text-acc-press bg-acc/10 hover:bg-acc/20 border border-acc/30 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5"
              title="Abrir no aplicativo Steam instalado"
            >
              <SteamLogo size={13} weight="bold" />
              <span>Abrir na Steam</span>
            </button>
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-mut hover:text-txt p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              title="Abrir no navegador"
              aria-label="Abrir no navegador"
            >
              <ArrowSquareOut size={14} />
            </a>
          </div>
        </div>

        {/* Widget oficial da Steam com largura responsiva adequada */}
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

        {/* Rodapé com Ações Nativas do Echo */}
        <div className="p-2.5 bg-[#12161f] border-t border-white/[0.06] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => {
                void launchAppProtocol({
                  appName: "Steam",
                  protocolUrl: `steam://run/${embed.id}`,
                  webUrl: embed.url,
                });
              }}
              className="cursor-pointer rounded-xl bg-acc text-bg text-xs font-semibold px-3 py-1.5 shadow-md shadow-acc/20 hover:bg-acc-press active:scale-[0.98] transition-all flex items-center gap-1.5"
              title="Instalar ou executar o jogo via Steam"
            >
              <GameController size={14} weight="bold" />
              <span>Instalar / Jogar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void launchAppProtocol({
                  appName: "Steam",
                  protocolUrl: `steam://store/${embed.id}`,
                  webUrl: embed.url,
                });
              }}
              className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.03] text-mut hover:text-txt hover:bg-white/[0.06] text-xs font-medium px-3 py-1.5 transition-all flex items-center gap-1.5"
            >
              <SteamLogo size={13} weight="bold" />
              <span>Loja Steam</span>
            </button>
          </div>

          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-acc hover:underline flex items-center gap-1 font-medium shrink-0"
          >
            <span>Navegador</span>
            <ArrowSquareOut size={12} />
          </a>
        </div>
      </div>
    );
  }

  // ── SPOTIFY EMBED (Design Discord, Capa em Alta Resolução, Player Integrado e Protocolo) ──
  if (embed.type === "spotify" && embed.id && embed.extraType) {
    const isLarge = ["album", "playlist", "artist", "show"].includes(embed.extraType);
    const height = isLarge ? 352 : 152;
    const trackTitle = spotifyMeta?.title || embed.title || "Spotify Player";
    const coverArt = spotifyMeta?.thumbnail_url;
    const typeLabel = cleanSlug(embed.extraType);

    return (
      <div className={`mt-2.5 max-w-[500px] w-full ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-2xl animate-in fade-in-0 duration-150 text-left`}>
        {/* Cabeçalho do Card com Branding Spotify */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-[#12161f]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/30 shadow-xs shrink-0">
              <SpotifyLogo size={18} weight="fill" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-txt truncate block">Spotify Player</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#1DB954] font-semibold uppercase tracking-wider">{typeLabel}</span>
                <span className="text-[10px] text-mut/60 truncate">{trackTitle}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                void launchAppProtocol({
                  appName: "Spotify",
                  protocolUrl: `spotify:${embed.extraType}:${embed.id}`,
                  webUrl: embed.url,
                });
              }}
              className="cursor-pointer text-[11px] font-semibold text-[#1DB954] hover:text-[#1ed760] bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/30 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5"
              title="Abrir no aplicativo desktop do Spotify"
            >
              <SpotifyLogo size={13} weight="fill" />
              <span>Abrir no Spotify</span>
            </button>
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-mut hover:text-txt p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              title="Abrir no navegador"
              aria-label="Abrir no navegador"
            >
              <ArrowSquareOut size={14} />
            </a>
          </div>
        </div>

        {/* Prévia Rica Estilo Discord com Capa do Álbum (quando disponível) */}
        {coverArt && (
          <div className="p-3.5 flex items-center gap-3.5 bg-gradient-to-br from-[#1DB954]/[0.06] to-transparent border-b border-white/[0.04]">
            <img
              src={coverArt}
              alt={trackTitle}
              className="h-16 w-16 rounded-xl object-cover border border-white/[0.08] shadow-md shrink-0"
              loading="lazy"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <h4 className="text-sm font-bold text-txt truncate">{trackTitle}</h4>
              <p className="text-xs text-mut/80">Disponível no Spotify • {typeLabel}</p>
            </div>
          </div>
        )}

        {/* Player Oficial Embutido */}
        <div className="w-full bg-[#121212]">
          <iframe
            src={`https://open.spotify.com/embed/${embed.extraType}/${embed.id}?utm_source=generator&theme=0`}
            title="Spotify Player"
            width="100%"
            height={height}
            className="w-full border-0 block"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  // ── SOUNDCLOUD EMBED ──
  if (embed.type === "soundcloud") {
    return (
      <div className={`mt-2.5 max-w-md w-full ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl animate-in fade-in-0 duration-150 text-left`}>
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.03]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
              <SoundcloudLogo size={16} weight="bold" />
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

  // ── YOUTUBE EMBED ──
  if (embed.type === "youtube" && embed.id) {
    const thumbnailUrl = `https://img.youtube.com/vi/${embed.id}/hqdefault.jpg`;

    return (
      <div className={`mt-2.5 max-w-md w-full ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/90 overflow-hidden shadow-xl animate-in fade-in-0 duration-150 text-left`}>
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

  // ── TWITCH EMBED ──
  if (embed.type === "twitch" && embed.id) {
    const parentHost = typeof window !== "undefined" ? window.location.hostname || "localhost" : "localhost";
    const twitchSrc =
      embed.extraType === "clip"
        ? `https://clips.twitch.tv/embed?clip=${embed.id}&parent=${parentHost}`
        : `https://player.twitch.tv/?channel=${embed.id}&parent=${parentHost}&muted=false`;

    return (
      <div className={`mt-2.5 max-w-md w-full ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/90 overflow-hidden shadow-xl animate-in fade-in-0 duration-150 text-left`}>
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-[#9146FF]/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#9146FF]/20 text-[#9146FF] border border-[#9146FF]/30 shrink-0">
              <TwitchLogo size={16} weight="fill" />
            </div>
            <span className="text-xs font-semibold text-txt truncate">{embed.title}</span>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Abrir na Twitch"
            aria-label="Abrir na Twitch"
          >
            <ArrowSquareOut size={14} />
          </a>
        </div>
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={twitchSrc}
            title={embed.title}
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    );
  }

  // ── DIRECT VIDEO EMBED (.mp4, .webm, .mov) ──
  if (embed.type === "direct_video") {
    return (
      <div className={`mt-2.5 max-w-md w-full ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/90 overflow-hidden shadow-xl animate-in fade-in-0 duration-150 text-left`}>
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

  // ── DIRECT AUDIO EMBED (.mp3, .wav, .ogg, .m4a) ──
  if (embed.type === "direct_audio") {
    return (
      <div className={`mt-2.5 max-w-md w-full ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/90 overflow-hidden shadow-xl animate-in fade-in-0 duration-150 p-3 text-left`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-acc font-medium">
            <MusicNotes size={15} weight="bold" />
            <span>Arquivo de Áudio</span>
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
        <audio src={embed.url} controls className="w-full" preload="metadata" />
      </div>
    );
  }

  // ── DIRECT IMAGE EMBED (.png, .jpg, .gif, .webp, .svg) ──
  if (embed.type === "direct_image") {
    return (
      <div className={`mt-2 max-w-md ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/90 overflow-hidden shadow-xl animate-in fade-in-0 duration-150`}>
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

  // ── EPIC GAMES STORE EMBED ──
  if (embed.type === "epic" && embed.id) {
    return (
      <div className={`mt-2.5 max-w-md w-full ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl animate-in fade-in-0 duration-150 text-left`}>
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

  // ── DISCORD INVITE CARD ──
  if (embed.type === "discord" && embed.id) {
    return (
      <div className={`mt-2.5 max-w-md w-full ${alignClass} rounded-2xl border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl animate-in fade-in-0 duration-150 text-left`}>
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-[#5865F2]/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#5865F2] text-white shadow-xs shrink-0">
              <DiscordLogo size={18} weight="fill" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-txt">Discord Server</span>
              <span className="text-[10px] text-mut/80 block">Convite para Comunidade</span>
            </div>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-semibold px-3 py-1.5 shadow-md shadow-[#5865F2]/20 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <span>Entrar</span>
            <ArrowSquareOut size={13} weight="bold" />
          </a>
        </div>
      </div>
    );
  }

  // ── REDDIT CARD ──
  if (embed.type === "reddit" && embed.id) {
    return (
      <div className={`mt-2.5 max-w-md w-full ${alignClass} rounded-2xl border-l-4 border-l-[#FF4500] border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl animate-in fade-in-0 duration-150 p-3.5 space-y-2 text-left`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FF4500]/20 text-[#FF4500]">
              <RedditLogo size={16} weight="fill" />
            </div>
            <span className="text-xs font-bold text-[#FF4500]">{embed.title}</span>
          </div>
          <a
            href={embed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <ArrowSquareOut size={14} />
          </a>
        </div>
        <p className="text-xs text-mut/90 leading-relaxed">
          Ver discussão e publicações no Reddit
        </p>
      </div>
    );
  }

  // ── TWITTER / X EMBED ──
  if (embed.type === "twitter") {
    return (
      <div className={`mt-2.5 max-w-md ${alignClass} rounded-2xl overflow-hidden shadow-xl animate-in fade-in-0 duration-150`}>
        <TwitterEmbed url={embed.url} width={380} />
      </div>
    );
  }

  // ── TIKTOK EMBED ──
  if (embed.type === "tiktok") {
    return (
      <div className={`mt-2.5 max-w-sm ${alignClass} rounded-2xl overflow-hidden shadow-xl animate-in fade-in-0 duration-150`}>
        <TikTokEmbed url={embed.url} width={325} />
      </div>
    );
  }

  // ── INSTAGRAM EMBED ──
  if (embed.type === "instagram") {
    return (
      <div className={`mt-2.5 max-w-sm ${alignClass} rounded-2xl overflow-hidden shadow-xl animate-in fade-in-0 duration-150`}>
        <InstagramEmbed url={embed.url} width={328} />
      </div>
    );
  }

  // ── GITHUB REPOSITORY CARD OU LINK GENÉRICO ENRIQUECIDO COM OPENGRAPH ──
  // Estilo Discord com borda lateral com acento teal, título clicável, imagem e favicon
  const displayTitle = ogData?.title || embed.title || "Link";
  const displayDesc = ogData?.description || embed.subtitle;
  const displayPublisher =
    ogData?.publisher || (embed.type === "github" ? "GitHub" : "Link Externo");
  const displayImage = ogData?.imageUrl;
  const displayLogo = ogData?.logoUrl;

  return (
    <div className={`mt-2 max-w-[520px] w-full ${alignClass} rounded-2xl border-l-4 border-l-acc border border-white/[0.08] bg-[#12161f]/95 overflow-hidden shadow-xl hover:border-white/[0.15] transition-all group animate-in fade-in-0 duration-150 text-left`}>
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

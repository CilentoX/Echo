"use client";

import { useState } from "react";
import { ArrowsOutSimple, Chats, Copy, PushPin, Hash, At } from "@phosphor-icons/react";
import type { NormalizedEvent, NormalizedReaction } from "@/lib/matrix/types";
import { useProfileStore } from "@/stores/profileStore";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useThemeStore } from "@/stores/themeStore";
import { senderLabel } from "./groupMessages";
import ReplyChip from "./ReplyChip";
import EditedBadge from "./EditedBadge";
import ReactionStack from "./ReactionStack";
import MessageBody from "./MessageBody";
import RichEmbed from "./RichEmbed";
import MxcImage from "@/components/media/MxcImage";
import AudioPlayer from "@/components/media/AudioPlayer";
import MediaLightbox from "@/components/media/MediaLightbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { mxcToHttp } from "@/lib/media/mxc";

const EMPTY_MEMBERS: import("@/lib/matrix/types").MemberSummary[] = [];
const EMPTY_PINNED: readonly string[] = Object.freeze([]);

export interface MessageBubbleProps {
  event: NormalizedEvent;
  /** Primeira mensagem do grupo: mostra avatar, nome e hora. */
  showHeader: boolean;
  /** Placeholder otimista `pending-*` ainda não confirmado pelo server. */
  pending?: boolean;
  isBot?: boolean;
  /** Reações normalizadas do store (m.reaction). */
  reactions?: NormalizedReaction[];
  /** userId do próprio usuário (marca reações próprias). */
  myUserId?: string | null;
  /** Respostas em thread; chip só aparece quando > 0. */
  threadReplies?: number;
  /** Callback ao clicar em uma reação. */
  onToggleReaction?: (eventId: string, emoji: string) => void;
}

/**
 * Uma mensagem da timeline: bolha diferenciada para remetente (sender,
 * à direita) vs destinatário (receiver, à esquerda), avatar inicial,
 * nome, hora, reply-to chip, edição/exclusão, corpo em markdown, visualizador
 * de imagens com lightbox e player de áudio com waveform dinâmico.
 */
export default function MessageBubble({
  event,
  showHeader,
  pending = false,
  isBot = false,
  reactions,
  myUserId,
  threadReplies,
  onToggleReaction,
}: MessageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isSender = event.sender === myUserId;
  const density = useThemeStore((s) => s.density);
  const isCompact = density === "compact";
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const guildProfiles = useSyncStore((s) =>
    activeGuildId && activeGuildId !== "home" ? s.guildMemberProfiles[activeGuildId] : undefined,
  );
  const memberProfile = guildProfiles?.[event.sender];
  const guildNick = memberProfile?.nickname;
  const myNickname = useProfileStore((s) => s.nickname);
  const myDisplayName = useProfileStore((s) => s.displayName);
  const myAppwriteAvatar = useProfileStore((s) => s.appwriteAvatarUrl);
  const myAvatar = useProfileStore((s) => s.avatarUrl);

  const rawRoomMembers = useSyncStore((s) => s.membersByRoom[event.roomId]);
  const roomMembers = rawRoomMembers ?? EMPTY_MEMBERS;
  const roomMember = roomMembers.find((m) => m.userId === event.sender);
  const friends = useFriendsStore((s) => s.friends);
  const friend = friends.find((f) => f.userId === event.sender);

  const isPinned = useSyncStore((s) =>
    (s.pinnedByRoom[event.roomId] ?? EMPTY_PINNED).includes(event.eventId),
  );
  const pinMessage = useSyncStore((s) => s.pinMessage);
  const unpinMessage = useSyncStore((s) => s.unpinMessage);

  // Nome de exibição: prioriza apelido na guilda, depois apelido global, depois displayName, depois fallback do Matrix
  const name =
    guildNick ||
    (isSender ? (myNickname || myDisplayName) : roomMember?.displayName || friend?.displayName) ||
    senderLabel(event.sender);

  // Avatar com cadeia de fallback e cache persistente em disco
  const senderAvatar = isSender
    ? (memberProfile?.avatarUrl ?? myAppwriteAvatar ?? myAvatar ?? event.senderAvatarUrl ?? null)
    : (memberProfile?.avatarUrl ?? roomMember?.avatarUrl ?? friend?.avatarUrl ?? event.senderAvatarUrl ?? null);
  const time = new Date(event.originServerTs).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const mediaUrl = event.url
    ? event.url.startsWith("mxc://")
      ? mxcToHttp(event.url)
      : event.url
    : null;

  const isAudio =
    event.msgtype === "m.audio" ||
    Boolean(event.info?.mimetype && event.info.mimetype.startsWith("audio/")) ||
    event.body.startsWith("[Mensagem de voz]") ||
    (typeof mediaUrl === "string" &&
      (mediaUrl.endsWith(".webm") ||
        mediaUrl.endsWith(".ogg") ||
        mediaUrl.endsWith(".mp3") ||
        mediaUrl.endsWith(".m4a") ||
        mediaUrl.endsWith(".wav")));

  const isImage =
    event.msgtype === "m.image" ||
    Boolean(event.info?.mimetype && event.info.mimetype.startsWith("image/")) ||
    event.body.startsWith("[Imagem]") ||
    (typeof mediaUrl === "string" &&
      (mediaUrl.endsWith(".jpg") ||
        mediaUrl.endsWith(".jpeg") ||
        mediaUrl.endsWith(".png") ||
        mediaUrl.endsWith(".webp") ||
        mediaUrl.endsWith(".gif") ||
        mediaUrl.endsWith(".svg")));

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          data-event-id={event.eventId}
          data-pending={pending || undefined}
          data-is-sender={isSender || undefined}
          className={`group relative flex gap-3.5 px-4 transition-colors w-full hover:bg-white/[0.03] ${
            isCompact ? "py-0.5" : showHeader ? "pt-2.5 pb-0.5" : "py-0.5"
          }`}
        >
          {/* Barra de Ações Rápidas Flutuante (Hover Bar) */}
      {!pending && (
        <div
          data-testid="message-hover-bar"
          className="absolute right-4 -top-3.5 hidden group-hover:flex items-center gap-0.5 rounded-lg border border-bd bg-card-bg/95 px-1 py-0.5 shadow-lg shadow-black/10 dark:shadow-black/40 backdrop-blur z-10 transition-all"
        >
          <button
            type="button"
            title="Curtir"
            aria-label="Reagir com coração"
            onClick={() => onToggleReaction?.(event.eventId, "❤️")}
            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded hover:bg-surf2 text-xs transition-transform hover:scale-110 active:scale-95"
          >
            ❤️
          </button>
          <button
            type="button"
            title="Joinha"
            aria-label="Reagir com joinha"
            onClick={() => onToggleReaction?.(event.eventId, "👍")}
            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded hover:bg-surf2 text-xs transition-transform hover:scale-110 active:scale-95"
          >
            👍
          </button>
          <button
            type="button"
            title="Risada"
            aria-label="Reagir com risada"
            onClick={() => onToggleReaction?.(event.eventId, "😂")}
            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded hover:bg-surf2 text-xs transition-transform hover:scale-110 active:scale-95"
          >
            😂
          </button>
          <div className="w-[1px] h-3.5 bg-bd mx-0.5" />
          <button
            type="button"
            title={isPinned ? "Desafixar mensagem" : "Fixar mensagem"}
            aria-label={isPinned ? "Desafixar mensagem" : "Fixar mensagem"}
            onClick={() => {
              if (isPinned) unpinMessage(event.roomId, event.eventId);
              else pinMessage(event.roomId, event.eventId);
            }}
            className={`cursor-pointer flex h-7 w-7 items-center justify-center rounded hover:bg-surf2 transition-colors active:scale-95 ${
              isPinned ? "text-acc font-bold" : "text-mut hover:text-txt"
            }`}
          >
            <PushPin size={13} weight={isPinned ? "fill" : "regular"} />
          </button>
          <button
            type="button"
            title="Copiar texto"
            aria-label="Copiar texto"
            onClick={() => navigator.clipboard.writeText(event.body)}
            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded hover:bg-surf2 text-mut hover:text-txt transition-colors active:scale-95"
          >
            <Copy size={13} />
          </button>
        </div>
      )}

      {/* Avatar do remetente (sempre à esquerda, ergonomia Discord) */}
      <div className="shrink-0 pt-0.5">
        {showHeader ? (
          <div className={`relative ${isCompact ? "w-7 h-7" : "w-10 h-10"}`}>
            <MxcImage
              mxcUrl={senderAvatar}
              width={isCompact ? 28 : 40}
              height={isCompact ? 28 : 40}
              alt={`Avatar de ${name}`}
              className={`rounded-full object-cover border border-white/[0.08] shadow-sm ${
                isCompact ? "h-7 w-7" : "h-10 w-10"
              }`}
              fallback={
                <span
                  aria-hidden="true"
                  className={`flex h-full w-full items-center justify-center rounded-full bg-acc text-bg font-display font-semibold shadow-sm ${
                    isCompact ? "text-[10px]" : "text-xs font-bold"
                  }`}
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
              }
            />
          </div>
        ) : (
          <div className={`${isCompact ? "w-7" : "w-10"} flex items-center justify-center`} aria-hidden="true">
            <span className="hidden group-hover:block text-[10px] text-mut/50 font-mono select-none">
              {time.slice(0, 5)}
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo da mensagem (Full width, estilo Discord) */}
      <div className="flex-1 min-w-0">
        {/* Chip de reply-to (citação) */}
        {event.replyTo && <ReplyChip replyTo={event.replyTo} />}

        {/* Cabeçalho: nome, hora, selos (apenas primeiro do grupo) */}
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="truncate font-display text-sm font-semibold text-txt hover:underline cursor-pointer">
              {name}
            </span>
            {isBot && (
              <span className="rounded border border-acc/40 bg-acc/10 px-1 text-[10px] font-bold uppercase tracking-wide text-acc">
                BOT
              </span>
            )}
            {event.editedAt && <EditedBadge editedAt={event.editedAt} />}
            <time className="shrink-0 text-[11px] text-mut/70 font-sans">{time}</time>
            {isPinned && (
              <span title="Mensagem fixada" className="text-acc inline-flex items-center">
                <PushPin size={11} weight="fill" />
              </span>
            )}
          </div>
        )}

        {/* Áudio / Mensagem de Voz */}
        {isAudio && mediaUrl ? (
          <div className="my-1 max-w-md">
            <AudioPlayer
              src={mediaUrl}
              duration={event.info?.duration}
              waveform={event.info?.waveform}
              isSender={isSender}
            />
          </div>
        ) : isImage && mediaUrl ? (
          /* Imagem com prévia ampliada e Lightbox */
          <div className="my-1 space-y-1">
            <div
              className="relative group/img cursor-pointer overflow-hidden rounded-xl border border-bd-subtle max-w-sm inline-block shadow-sm"
              onClick={() => setLightboxOpen(true)}
            >
              <MxcImage
                mxcUrl={mediaUrl}
                alt={event.body || "Imagem"}
                className="max-h-64 max-w-full rounded-xl object-cover hover:scale-[1.02] transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold">
                  <ArrowsOutSimple size={14} />
                  <span>Ampliar</span>
                </span>
              </div>
            </div>
            {event.body && !event.body.startsWith("[Imagem]") && (
              <MessageBody body={event.body} redacted={event.redacted} pending={pending} />
            )}
            <MediaLightbox
              src={mediaUrl}
              alt={event.body || "Imagem"}
              open={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
            />
          </div>
        ) : (
          /* Corpo da mensagem (markdown) */
          <div className="text-sm text-txt/90 leading-relaxed break-words">
            <MessageBody body={event.body} redacted={event.redacted} pending={pending} />
            {!event.redacted && <RichEmbed content={event.body} />}
          </div>
        )}

        {pending && (
          <p className="mt-0.5 text-[10px] text-mut" aria-label="Enviando">
            Enviando…
          </p>
        )}

        {/* Reações empilhadas */}
        {((reactions?.length ?? 0) > 0 || (threadReplies ?? 0) > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ReactionStack
              reactions={reactions ?? []}
              myUserId={myUserId}
              onToggleReaction={onToggleReaction}
              eventId={event.eventId}
            />
            {(threadReplies ?? 0) > 0 && (
              <button
                type="button"
                aria-label="Abrir tópico"
                className="cursor-pointer flex items-center gap-1 rounded-full border border-bd bg-surf2 px-1.5 py-0.5 text-[11px] text-mut hover:border-acc/40 hover:text-txt active:scale-95"
                onClick={() => {
                  // Fase D: abrir tópico de respostas
                }}
              >
                <Chats size={12} aria-hidden />
                <span>
                  {threadReplies} {threadReplies === 1 ? "resposta" : "respostas"}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  </ContextMenuTrigger>

  <ContextMenuContent className="w-56">
    <ContextMenuLabel className="truncate text-txt font-semibold flex items-center justify-between">
      <span className="truncate">{name}</span>
      <span className="text-[10px] text-mut/60 font-mono">{time}</span>
    </ContextMenuLabel>
    <ContextMenuSeparator />

    {/* Reações rápidas */}
    {onToggleReaction && !pending && (
      <>
        <div className="flex items-center justify-around px-2 py-1.5 bg-white/[0.02] rounded-lg my-1">
          {["❤️", "👍", "😂", "🎉", "🔥"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(event.eventId, emoji)}
              className="cursor-pointer text-base hover:scale-125 transition-transform p-1 rounded hover:bg-white/[0.08]"
              title={`Reagir com ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <ContextMenuSeparator />
      </>
    )}

    {/* Copiar Texto */}
    {event.body && (
      <ContextMenuItem onClick={() => navigator.clipboard.writeText(event.body)}>
        <Copy size={15} weight="bold" />
        <span>Copiar Texto</span>
      </ContextMenuItem>
    )}

    {/* Fixar / Desafixar */}
    {!pending && (
      <ContextMenuItem
        onClick={() => {
          if (isPinned) unpinMessage(event.roomId, event.eventId);
          else pinMessage(event.roomId, event.eventId);
        }}
      >
        <PushPin size={15} weight={isPinned ? "fill" : "bold"} className={isPinned ? "text-acc" : ""} />
        <span>{isPinned ? "Desafixar Mensagem" : "Fixar Mensagem"}</span>
      </ContextMenuItem>
    )}

    {/* Mencionar Autor */}
    {!isSender && (
      <ContextMenuItem
        onClick={() => {
          const cleanNick = name.replace(/\s+/g, "");
          window.dispatchEvent(
            new CustomEvent("echo:insert-mention", {
              detail: { userId: event.sender, mentionText: `@${cleanNick} ` },
            })
          );
        }}
      >
        <At size={15} weight="bold" />
        <span>Mencionar Autor</span>
      </ContextMenuItem>
    )}

    {/* Se mídia */}
    {mediaUrl && (
      <ContextMenuItem onClick={() => setLightboxOpen(true)}>
        <ArrowsOutSimple size={15} weight="bold" />
        <span>Ampliar Mídia</span>
      </ContextMenuItem>
    )}

    <ContextMenuSeparator />

    {/* Copiar ID */}
    <ContextMenuItem onClick={() => navigator.clipboard.writeText(event.eventId)}>
      <Hash size={15} weight="bold" />
      <span>Copiar ID da Mensagem</span>
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
  );
}

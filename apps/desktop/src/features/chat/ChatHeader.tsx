import { useMemo } from "react";
import {
  Hash,
  List,
  MagnifyingGlass,
  Phone,
  Users,
  VideoCamera,
} from "@phosphor-icons/react";
import { useFriendsStore } from "@/stores/friendsStore";
import { useUiStore } from "@/stores/uiStore";
import MxcImage from "@/components/media/MxcImage";
import PinnedMessagesPopover from "./PinnedMessagesPopover";

export interface ChatHeaderProps {
  roomId: string;
  channelName?: string | null;
  topic?: string | null;
  showSidebarToggle?: boolean;
  showMembersToggle?: boolean;
  onToggleSidebar?: () => void;
  onToggleMembers?: () => void;
}

export default function ChatHeader({
  roomId,
  channelName,
  topic,
  showSidebarToggle = false,
  showMembersToggle = false,
  onToggleSidebar,
  onToggleMembers,
}: ChatHeaderProps) {
  const friends = useFriendsStore((s) => s.friends);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const uiPresence = useUiStore((s) => s.presence);

  // Identifica se a sala atual é uma DM com um amigo (apenas quando fora de guildas)
  const isGuild = Boolean(activeGuildId && activeGuildId !== "home");
  const activeFriend = useMemo(() => {
    if (isGuild) return null;
    return friends.find((f) => f.directRoomId === roomId);
  }, [friends, roomId, isGuild]);

  const isDm = !isGuild && Boolean(activeFriend);

  const presence = activeFriend
    ? uiPresence[activeFriend.userId] || activeFriend.presence || "offline"
    : "offline";

  const presenceColor =
    presence === "online"
      ? "bg-emerald-500"
      : presence === "unavailable"
      ? "bg-amber-500"
      : "bg-zinc-500";

  const presenceLabel =
    presence === "online"
      ? "Disponível"
      : presence === "unavailable"
      ? "Ausente"
      : "Offline";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-bd px-4 bg-bg select-none z-10">
      {/* Lado Esquerdo: Identificação do Canal ou Amigo */}
      <div className="flex items-center gap-2.5 min-w-0">
        {showSidebarToggle && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Abrir canais"
            className="cursor-pointer mr-1 rounded-lg p-1.5 text-mut hover:bg-surf2 hover:text-txt transition-colors md:hidden"
          >
            <List size={20} />
          </button>
        )}

        {isDm && activeFriend ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              {activeFriend.avatarUrl ? (
                <MxcImage
                  mxcUrl={activeFriend.avatarUrl}
                  alt={activeFriend.displayName}
                  className="h-8 w-8 rounded-full object-cover shadow-sm"
                  width={32}
                  height={32}
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acc/20 font-display text-xs font-bold text-acc shadow-sm">
                  {activeFriend.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg ${presenceColor}`}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 leading-tight">
              <h1 className="truncate font-display text-sm font-bold text-txt">
                {activeFriend.displayName}
              </h1>
              <p className="truncate text-[10px] text-mut font-mono">
                {presenceLabel} {activeFriend.nickname ? `• @${activeFriend.nickname}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <Hash size={20} className="text-mut shrink-0" weight="bold" />
            <h1 className="truncate font-display text-sm font-bold text-txt">
              {channelName ?? "geral"}
            </h1>
            {topic && (
              <>
                <div className="h-4 w-[1px] bg-bd/60 mx-1 shrink-0 hidden sm:block" />
                <p className="truncate text-xs text-mut max-w-sm hidden sm:block">{topic}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Lado Direito: Ações Rápidas */}
      <div className="flex items-center gap-1">
        {isDm ? (
          <>
            <button
              type="button"
              title="Iniciar chamada de voz"
              aria-label="Iniciar chamada de voz"
              className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg text-mut hover:bg-surf2 hover:text-txt transition-colors"
            >
              <Phone size={18} />
            </button>

            <button
              type="button"
              title="Iniciar chamada de vídeo"
              aria-label="Iniciar chamada de vídeo"
              className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg text-mut hover:bg-surf2 hover:text-txt transition-colors"
            >
              <VideoCamera size={18} />
            </button>
          </>
        ) : (
          <PinnedMessagesPopover roomId={roomId} />
        )}

        <button
          type="button"
          title="Buscar mensagens"
          aria-label="Buscar mensagens"
          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg text-mut hover:bg-surf2 hover:text-txt transition-colors"
        >
          <MagnifyingGlass size={18} />
        </button>

        {showMembersToggle && !isDm && (
          <button
            type="button"
            onClick={onToggleMembers}
            title="Membros do canal"
            aria-label="Membros do canal"
            className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg text-mut hover:bg-surf2 hover:text-txt transition-colors"
          >
            <Users size={18} />
          </button>
        )}
      </div>
    </header>
  );
}


import { useCallback, useEffect, useMemo, useRef } from "react";
import { Hash } from "@phosphor-icons/react";
import { selectTimeline, useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useShallow } from "zustand/shallow";
import Composer, { type SendMessageFn, type SendFileFn } from "./Composer";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatHeader from "./ChatHeader";
import MxcImage from "@/components/media/MxcImage";
import { groupMessages } from "./groupMessages";
import { loadOlder } from "@/lib/matrix/wiring";
import { matrixService } from "@/lib/matrix/instance";
import VoiceStage from "@/features/voice/VoiceStage";

/** Remetente do bot Eco — o wiring (Task 11) pode sobrescrever via prop. */
const DEFAULT_BOT_SENDERS = ["@eco:eco"];

export interface ChatPaneProps {
  /** R2: `(roomId, body) => matrixService.sendMessage(...)` — wiring Task 11. */
  sendMessage?: SendMessageFn;
  /** Envio de anexos/mídia via MatrixService. */
  sendFile?: SendFileFn;
  /** Sender IDs tratados como bot (selo BOT teal). */
  botSenders?: string[];
  /** Contagem de respostas em thread por eventId. */
  threadReplies?: Record<string, number>;
  /** Conteúdo renderizado dentro do chat (ex.: FriendsDashboard, EmptyState). */
  children?: React.ReactNode;
  showSidebarToggle?: boolean;
  showMembersToggle?: boolean;
  onToggleSidebar?: () => void;
  onToggleMembers?: () => void;
}

/**
 * Painel de chat: timeline em tempo real agrupada por autor/gap de 5 min,
 * indicador de digitação e composer com envio otimista. Lê somente os
 * stores (T8/T9) — a fala com o MatrixService é do wiring (Task 11).
 */
export default function ChatPane({
  sendMessage = () => Promise.reject(new Error("sendMessage não conectado (wiring Task 11)")),
  sendFile,
  botSenders = DEFAULT_BOT_SENDERS,
  threadReplies,
  children,
  showSidebarToggle = false,
  showMembersToggle = false,
  onToggleSidebar,
  onToggleMembers,
}: ChatPaneProps) {
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);
  const guilds = useSyncStore((s) => s.guilds);
  const myUserId = useUiStore((s) => s.myUserId);

  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const setActiveChannel = useUiStore((s) => s.setActiveChannel);

  // Auto-seleciona o primeiro canal da guilda se nenhum estiver selecionado
  useEffect(() => {
    if (!activeChannelId && activeGuildId && activeGuildId !== "home") {
      const guildChannels = channelsByGuild[activeGuildId] ?? [];
      if (guildChannels.length > 0) {
        setActiveChannel(guildChannels[0].channelId);
      }
    }
  }, [activeChannelId, activeGuildId, channelsByGuild, setActiveChannel]);
  const friends = useFriendsStore((s) => s.friends);
  const selectedFriendId = useFriendsStore((s) => s.selectedFriendId);

  const timeline = useSyncStore(
    useMemo(() => selectTimeline(activeChannelId ?? ""), [activeChannelId]),
  );

  // Typing indicator do store (via wiring onTyping → uiStore.setTypingUsers)
  const typingUsers = useUiStore(
    useShallow((state) => (activeChannelId ? state.typingUsers[activeChannelId] ?? [] : [])),
  );

  // Reações reais via m.reaction (P12) — lidas do store, não estado local.
  const reactionsByEvent = useSyncStore((s) => s.reactionsByEvent);

  const sendReaction = async (eventId: string, emoji: string) => {
    if (!activeChannelId || !myUserId) return;
    try {
      const already = (reactionsByEvent[eventId] ?? []).some(
        (r) => r.emoji === emoji && r.sender === myUserId,
      );
      if (already) {
        return;
      }
      await matrixService.sendReaction(activeChannelId, eventId, emoji);
    } catch {
      // Falha silenciosa: reação não é crítica.
    }
  };

  const groups = useMemo(() => groupMessages(timeline), [timeline]);

  // Identifica se a sala é DM com um amigo
  const activeFriend = useMemo(() => {
    return friends.find(
      (f) => f.directRoomId === activeChannelId || (selectedFriendId && f.userId === selectedFriendId),
    );
  }, [friends, activeChannelId, selectedFriendId]);

  const activeChannelData = useMemo(() => {
    if (!activeChannelId) return null;
    for (const channels of Object.values(channelsByGuild)) {
      const channel = channels.find((c) => c.channelId === activeChannelId);
      if (channel) return channel;
    }
    return null;
  }, [channelsByGuild, activeChannelId]);

  const channelName = activeFriend ? activeFriend.displayName : (activeChannelData?.name ?? null);
  const channelTopic = activeChannelData?.topic ?? null;

  // P8/P9: carrega histórico antigo ao abrir canal e ao rolar para cima.
  const loadHistory = useCallback(
    async (id: string, limit = 30) => {
      if (!id) return;
      await loadOlder(id, limit);
    },
    [],
  );

  useEffect(() => {
    if (activeChannelId) {
      void loadHistory(activeChannelId, 30).catch(() => {});
    }
  }, [activeChannelId, loadHistory]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const lastChannelRef = useRef<string | null>(activeChannelId);
  if (lastChannelRef.current !== activeChannelId) {
    lastChannelRef.current = activeChannelId;
    atBottomRef.current = true;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [timeline]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distanceToBottom < 80;

    if (el.scrollTop === 0 && activeChannelId && timeline.length >= 30) {
      void loadHistory(activeChannelId, 30);
    }
  };

  const reactionsFor = (eventId: string) => reactionsByEvent[eventId] ?? [];

  // Se um conteúdo customizado foi passado (ex: FriendsDashboard ou EmptyState), renderiza-o diretamente
  if (children) {
    return (
      <section
        data-column="chat"
        aria-label="Conteúdo Principal"
        className="flex min-w-0 flex-1 flex-col bg-bg font-ui overflow-hidden"
      >
        {children}
      </section>
    );
  }

  if (!activeChannelId) {
    return (
      <section
        data-column="chat"
        aria-label="Mensagens"
        className="flex min-w-0 flex-1 flex-col bg-bg font-ui"
      >
        <div className="flex h-12 w-full shrink-0 items-center border-b border-bd-subtle px-4">
          <span className="font-display text-sm font-semibold text-txt">Comunidade</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-acc/10 text-acc mb-3 shadow-md shadow-acc/10">
            <Hash size={28} weight="bold" />
          </div>
          <h2 className="font-display text-base font-semibold text-txt">Nenhum canal selecionado</h2>
          <p className="mt-1 text-xs text-mut leading-relaxed">
            Escolha um canal para começar a conversar.
          </p>
        </div>
      </section>
    );
  }

  // Visualização dedicada de Canal de Áudio (Estritamente de Áudio - sem composer e sem mensagens de texto)
  if (activeChannelData?.type === "voice") {
    const activeGuild = guilds.find((g) => g.guildId === activeGuildId);
    return (
      <section
        data-column="chat"
        aria-label="Canal de Voz"
        className="flex min-w-0 flex-1 flex-col bg-bg font-ui overflow-hidden"
      >
        <VoiceStage
          channelId={activeChannelData.channelId}
          channelName={activeChannelData.name}
          topic={activeChannelData.topic}
          guildId={activeGuildId}
          guildName={activeGuild?.name}
        />
      </section>
    );
  }

  return (
    <section
      data-column="chat"
      aria-label="Mensagens"
      className="flex min-w-0 flex-1 flex-col bg-bg font-ui"
    >
      {/* Cabeçalho Superior Fixo */}
      <ChatHeader
        roomId={activeChannelId}
        channelName={channelName}
        topic={channelTopic}
        showSidebarToggle={showSidebarToggle}
        showMembersToggle={showMembersToggle}
        onToggleSidebar={onToggleSidebar}
        onToggleMembers={onToggleMembers}
      />

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-4">
        {/* Hero Banner: Amigo (DM) vs Canal de Guilda */}
        {activeFriend ? (
          <div className="px-6 pt-6 pb-4 mb-3">
            <div className="relative mb-3 inline-block">
              {activeFriend.avatarUrl ? (
                <MxcImage
                  mxcUrl={activeFriend.avatarUrl}
                  alt={activeFriend.displayName}
                  className="h-16 w-16 rounded-full object-cover shadow-md"
                  width={64}
                  height={64}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-acc/20 font-display text-2xl font-bold text-acc shadow-md">
                  {activeFriend.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <h2 className="font-display text-2xl font-bold text-txt">
              {activeFriend.displayName}
            </h2>
            <p className="font-mono text-xs text-mut mt-0.5">
              {activeFriend.nickname ? `@${activeFriend.nickname}` : activeFriend.userId}
            </p>
            <p className="mt-2 text-xs text-mut max-w-lg leading-relaxed">
              Este é o início da sua conversa direta com <strong className="text-txt">{activeFriend.displayName}</strong>. As mensagens trocadas aqui são criptografadas de ponta a ponta e privadas.
            </p>
            <div className="w-full h-[1px] bg-bd/40 mt-5" />
          </div>
        ) : (
          <div className="px-4 pt-4 pb-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surf2 border border-bd text-acc mb-2 shadow-sm">
              <Hash size={24} weight="bold" />
            </div>
            <h2 className="font-display text-xl font-bold text-txt">
              Bem-vindo a #{channelName ?? "geral"}!
            </h2>
            <p className="mt-0.5 text-xs text-mut max-w-lg">
              Este é o início do canal #{channelName ?? "geral"}. Diga olá e comece a conversa!
            </p>
            <div className="w-full h-[1px] bg-bd/40 mt-3" />
          </div>
        )}

        {timeline.length === 0 && (
          <p className="px-6 text-sm text-mut">Nenhuma mensagem ainda. Diga olá!</p>
        )}
        {groups.map((group) =>
          group.events.map((event, index) => (
            <MessageBubble
              key={event.eventId}
              event={event}
              showHeader={index === 0}
              pending={event.eventId.startsWith("pending-")}
              isBot={botSenders.includes(event.sender)}
              reactions={reactionsFor(event.eventId)}
              myUserId={myUserId ?? undefined}
              threadReplies={threadReplies?.[event.eventId]}
              onToggleReaction={sendReaction}
            />
          )),
        )}
      </div>

      <TypingIndicator names={typingUsers} />

      <Composer
        roomId={activeChannelId}
        sendMessage={sendMessage}
        sendFile={sendFile}
        channelName={channelName ?? undefined}
      />
    </section>
  );
}

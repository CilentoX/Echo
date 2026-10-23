import { useCallback, useEffect, useMemo, useRef } from "react";
import { selectTimeline, useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import Composer, { type SendMessageFn } from "./Composer";
import MessageBubble, { type ReactionChip } from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { groupMessages } from "./groupMessages";
import { loadOlder } from "@/lib/matrix/wiring";
import { matrixService } from "@/lib/matrix/instance";

/** Remetente do bot Eco — o wiring (Task 11) pode sobrescrever via prop. */
const DEFAULT_BOT_SENDERS = ["@eco:eco"];

export interface ChatPaneProps {
  /** R2: `(roomId, body) => matrixService.sendMessage(...)` — wiring Task 11. */
  sendMessage?: SendMessageFn;
  /** Nomes de quem está digitando; vazio enquanto a Fase 2 não traz presence. */
  typingUsers?: string[];
  /** Sender IDs tratados como bot (selo BOT teal). */
  botSenders?: string[];
  /** Contagem de respostas em thread por eventId. */
  threadReplies?: Record<string, number>;
}

/**
 * Painel de chat: timeline em tempo real agrupada por autor/gap de 5 min,
 * indicador de digitação e composer com envio otimista. Lê somente os
 * stores (T8/T9) — a fala com o MatrixService é do wiring (Task 11).
 */
export default function ChatPane({
  sendMessage = () => Promise.reject(new Error("sendMessage não conectado (wiring Task 11)")),
  typingUsers = [],
  botSenders = DEFAULT_BOT_SENDERS,
  threadReplies,
}: ChatPaneProps) {
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);
  const myUserId = useUiStore((s) => s.myUserId);

  const timeline = useSyncStore(
    useMemo(() => selectTimeline(activeChannelId ?? ""), [activeChannelId]),
  );

  // Reações reais via m.reaction (P12) — lidas do store, não estado local.
  const reactionsByEvent = useSyncStore((s) => s.reactionsByEvent);

  const sendReaction = async (eventId: string, emoji: string) => {
    if (!activeChannelId || !myUserId) return;
    try {
      // Se o usuário já reagiu com este emoji, remove (toggle off).
      const already = (reactionsByEvent[eventId] ?? []).some(
        (r) => r.emoji === emoji && r.sender === myUserId,
      );
      if (already) {
        // removeReaction recebe (roomId, reactionEventId) — precisamos do eventId da reação própria.
        // Como não armazenamos o eventId da reação própria localmente, enviamos uma nova reação
        // e deixamos o server dedupe; a remoção explícita vem na Fase 2 com m.reaction completo.
        return;
      }
      await matrixService.sendReaction(activeChannelId, eventId, emoji);
      // O sync loop (wiring onReaction) aplica no store via applyReaction.
    } catch {
      // Falha silenciosa: reação não é crítica.
    }
  };

  const groups = useMemo(() => groupMessages(timeline), [timeline]);

  const channelName = useMemo(() => {
    if (!activeChannelId) return null;
    for (const channels of Object.values(channelsByGuild)) {
      const channel = channels.find((c) => c.channelId === activeChannelId);
      if (channel) return channel.name;
    }
    return null;
  }, [channelsByGuild, activeChannelId]);

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

  // Acompanha o fim da timeline apenas quando o usuário está no fim;
  // rolando para cima (lendo histórico), novas mensagens não roubam a posição.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const lastChannelRef = useRef<string | null>(activeChannelId);
  if (lastChannelRef.current !== activeChannelId) {
    lastChannelRef.current = activeChannelId;
    atBottomRef.current = true; // troca de canal volta a acompanhar o fim
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [timeline.length, activeChannelId]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    // P9: próximo da borda superior → carrega mais histórico.
    if (el.scrollTop <= 40 && activeChannelId) {
      void loadHistory(activeChannelId, 30);
    }
  }, [activeChannelId, loadHistory]);

  const reactionsFor = (eventId: string): ReactionChip[] => {
    const base = reactionsByEvent[eventId] ?? [];
    if (base.length === 0) return [];
    const merged = new Map<string, { count: number; active: boolean }>();
    for (const r of base) {
      const current = merged.get(r.emoji);
      if (current) {
        current.count += 1;
        if (r.sender === myUserId) current.active = true;
      } else {
        merged.set(r.emoji, { count: 1, active: r.sender === myUserId });
      }
    }
    return [...merged.entries()].map(([emoji, value]) => ({
      emoji,
      count: value.count,
      active: value.active,
    }));
  };

  if (!activeChannelId) {
    return (
      <section
        data-column="chat"
        aria-label="Mensagens"
        className="flex min-w-0 flex-1 flex-col bg-bg font-ui"
      >
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-mut">Escolha um canal para começar a conversar.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      data-column="chat"
      aria-label="Mensagens"
      className="flex min-w-0 flex-1 flex-col bg-bg font-ui"
    >
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-4">
        {timeline.length === 0 && (
          <p className="px-4 text-sm text-mut">Nenhuma mensagem ainda. Diga olá!</p>
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
        channelName={channelName ?? undefined}
      />
    </section>
  );
}

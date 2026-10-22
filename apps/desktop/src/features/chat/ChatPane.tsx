import { useEffect, useMemo, useRef, useState } from "react";
import { selectTimeline, useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import Composer, { type SendMessageFn } from "./Composer";
import MessageBubble, { type ReactionChip } from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { groupMessages } from "./groupMessages";

/** Remetente do bot Eco — o wiring (Task 11) pode sobrescrever via prop. */
const DEFAULT_BOT_SENDERS = ["@eco:eco"];

export interface ChatPaneProps {
  /** R2: `(roomId, body) => matrixService.sendMessage(...)` — wiring Task 11. */
  sendMessage?: SendMessageFn;
  /** Nomes de quem está digitando; vazio enquanto a Fase 2 não traz presence. */
  typingUsers?: string[];
  /** Sender IDs tratados como bot (selo BOT teal). */
  botSenders?: string[];
  /** Reações agregadas por eventId (fase de wiring agrega eventos m.reaction). */
  reactions?: Record<string, ReactionChip[]>;
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
  reactions,
  threadReplies,
}: ChatPaneProps) {
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);

  const timeline = useSyncStore(
    useMemo(() => selectTimeline(activeChannelId ?? ""), [activeChannelId]),
  );

  // Reações locais (meus toggles) enquanto a agregação de m.reaction não chega.
  const [mine, setMine] = useState<Record<string, string[]>>({});

  const groups = useMemo(() => groupMessages(timeline), [timeline]);

  const channelName = useMemo(() => {
    if (!activeChannelId) return null;
    for (const channels of Object.values(channelsByGuild)) {
      const channel = channels.find((c) => c.channelId === activeChannelId);
      if (channel) return channel.name;
    }
    return null;
  }, [channelsByGuild, activeChannelId]);

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

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const toggleReaction = (eventId: string, emoji: string) => {
    setMine((prev) => {
      const current = prev[eventId] ?? [];
      const next = current.includes(emoji)
        ? current.filter((e) => e !== emoji)
        : [...current, emoji];
      return { ...prev, [eventId]: next };
    });
  };

  const reactionsFor = (eventId: string): ReactionChip[] => {
    const base = reactions?.[eventId] ?? [];
    const myEmojis = mine[eventId] ?? [];
    if (base.length === 0 && myEmojis.length === 0) return [];
    const merged = new Map<string, { count: number; active: boolean }>();
    for (const chip of base) {
      merged.set(chip.emoji, {
        count: chip.count,
        active: Boolean(chip.active) || myEmojis.includes(chip.emoji),
      });
    }
    for (const emoji of myEmojis) {
      const current = merged.get(emoji);
      if (current) current.count += 1;
      else merged.set(emoji, { count: 1, active: true });
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
              onToggleReaction={toggleReaction}
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

import type { NormalizedReaction } from "@/lib/matrix/types";

export interface ReactionStackProps {
  /** Reações normalizadas do store. */
  reactions: NormalizedReaction[];
  /** userId do próprio usuário (para marcar "eu reagi"). */
  myUserId?: string | null;
  /** eventId da mensagem alvo (passado ao callback de toggle). */
  eventId: string;
  /** Callback ao clicar em uma reação. */
  onToggleReaction?: (eventId: string, emoji: string) => void;
}

/**
 * Reações empilhadas abaixo da bolha: mostra até 3 avatares iniciais
 * (ou emoji quando não há avatar) com o total de reações.
 */
export default function ReactionStack({
  reactions,
  myUserId,
  eventId,
  onToggleReaction,
}: ReactionStackProps) {
  if (!reactions || reactions.length === 0) return null;

  // Agrupa por emoji, contando e marcando se o próprio usuário reagiu.
  const byEmoji = new Map<
    string,
    { count: number; active: boolean; senders: string[] }
  >();
  for (const r of reactions) {
    const cur = byEmoji.get(r.emoji);
    if (cur) {
      cur.count += 1;
      if (r.sender === myUserId) cur.active = true;
      cur.senders.push(r.sender);
    } else {
      byEmoji.set(r.emoji, {
        count: 1,
        active: r.sender === myUserId,
        senders: [r.sender],
      });
    }
  }

  const items = [...byEmoji.entries()];

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {items.map(([emoji, data]) => {
        const senderInitial = data.senders[0]?.startsWith("@")
          ? data.senders[0].slice(1).split(":")[0]?.slice(0, 1).toUpperCase() ||
          "?"
          : data.senders[0]?.slice(0, 1).toUpperCase() || "?";
        return (
          <button
            key={emoji}
            type="button"
            data-testid="reaction-chip"
            aria-pressed={data.active ? "true" : "false"}
            aria-label={`Reagir com ${emoji} (${data.count})`}
            className="cursor-pointer flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors"
            onClick={() => onToggleReaction?.(eventId, emoji)}
          >
            <span
              aria-hidden="true"
              className="flex-shrink-0 h-5 w-5 shrink-0 rounded-full flex items-center justify-center font-display font-bold text-[10px] bg-surf2 border border-transparent"
            >
              {senderInitial}
            </span>
            <span aria-hidden="true" className="text-txt">
              {emoji}
            </span>
            <span className="text-txt">{data.count}</span>
            {data.active && (
              <span
                aria-hidden="true"
                className="ml-0.5 h-1 w-1 rounded-full bg-acc"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

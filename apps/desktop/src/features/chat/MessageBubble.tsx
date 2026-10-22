import { Chats } from "@phosphor-icons/react";
import type { NormalizedEvent } from "@/lib/matrix/types";
import { senderLabel } from "./groupMessages";

export interface ReactionChip {
  emoji: string;
  count: number;
  /** Eu já reagi com este emoji? */
  active?: boolean;
}

export interface MessageBubbleProps {
  event: NormalizedEvent;
  /** Primeira mensagem do grupo: mostra avatar, nome e hora. */
  showHeader: boolean;
  /** Placeholder otimista `pending-*` ainda não confirmado pelo server. */
  pending?: boolean;
  isBot?: boolean;
  reactions?: ReactionChip[];
  /** Respostas em thread; chip só aparece quando > 0. */
  threadReplies?: number;
  onToggleReaction?: (eventId: string, emoji: string) => void;
}

/**
 * Uma mensagem da timeline: avatar (inicial), nome, hora, corpo e
 * chips de reação/tópico. Mensagens de grupo sem cabeçalho repetido.
 */
export default function MessageBubble({
  event,
  showHeader,
  pending = false,
  isBot = false,
  reactions,
  threadReplies,
  onToggleReaction,
}: MessageBubbleProps) {
  const name = senderLabel(event.sender);
  const time = new Date(event.originServerTs).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const chips = reactions ?? [];

  return (
    <article
      data-event-id={event.eventId}
      data-pending={pending || undefined}
      className="flex gap-3 px-4 py-0.5 hover:bg-surf/40"
    >
      <div className="w-8 shrink-0 pt-0.5">
        {showHeader && (
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-semibold ${
              isBot ? "bg-acc/15 text-acc" : "bg-surf2 text-txt"
            }`}
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="flex items-baseline gap-2">
            <span className="truncate font-display text-sm font-semibold text-txt">
              {name}
            </span>
            {isBot && (
              <span className="rounded border border-acc/40 bg-acc/10 px-1 text-[10px] font-bold uppercase tracking-wide text-acc">
                BOT
              </span>
            )}
            <time className="shrink-0 text-[11px] text-mut">{time}</time>
          </div>
        )}
        <p
          className={`whitespace-pre-wrap break-words text-sm ${
            pending ? "text-txt opacity-70" : "text-txt"
          }`}
        >
          {event.body}
        </p>
        {pending && (
          <p className="text-[11px] text-mut" aria-label="Enviando">
            Enviando…
          </p>
        )}

        {(chips.length > 0 || (threadReplies ?? 0) > 0) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.emoji}
                type="button"
                aria-pressed={chip.active ? "true" : "false"}
                aria-label={`Reagir com ${chip.emoji}`}
                onClick={() => onToggleReaction?.(event.eventId, chip.emoji)}
                className={`cursor-pointer flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${
                  chip.active
                    ? "border-acc/60 bg-acc/10 text-txt"
                    : "border-bd bg-surf2 text-mut hover:border-acc/40"
                }`}
              >
                <span aria-hidden="true">{chip.emoji}</span>
                <span>{chip.count}</span>
              </button>
            ))}
            {(threadReplies ?? 0) > 0 && (
              <button
                type="button"
                aria-label="Abrir tópico"
                className="cursor-pointer flex items-center gap-1 rounded-full border border-bd bg-surf2 px-1.5 py-0.5 text-[11px] text-mut hover:border-acc/40 hover:text-txt active:scale-95"
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
  );
}

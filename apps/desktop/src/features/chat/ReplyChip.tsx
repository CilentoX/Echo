import type { NormalizedEvent } from "@/lib/matrix/types";

export interface ReplyChipProps {
  replyTo: NormalizedEvent["replyTo"];
}

/**
 * Chip de citação (reply-to): mostra avatar inicial do autor da
 * resposta + corpo truncado da mensagem citada. Clicar pode focar
 * a mensagem alvo (Fase D).
 */
export default function ReplyChip({ replyTo }: ReplyChipProps) {
  if (!replyTo) return null;

  const sender = replyTo.sender.startsWith("@")
    ? replyTo.sender.slice(1).split(":")[0] || replyTo.sender
    : replyTo.sender;
  const initial = sender.slice(0, 1).toUpperCase();
  const body = (replyTo.body ?? "").slice(0, 90);

  return (
    <div
      data-testid="reply-chip"
      className="mb-1 flex items-start gap-2 rounded-l border-l-2 border-acc pl-1.5 text-xs text-mut"
    >
      <span
        aria-hidden="true"
        className="flex-shrink-0 mt-0.5 h-4 w-4 rounded-full bg-acc/15 flex items-center justify-center font-display font-semibold text-[10px] text-acc"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <span className="font-semibold text-txt truncate block">{sender}</span>
        <span className="text-txt opacity-80 truncate block">{body}</span>
      </div>
    </div>
  );
}

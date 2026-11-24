import type { NormalizedEvent } from "@/lib/matrix/types";

export interface ReplyChipProps {
  replyTo: NormalizedEvent["replyTo"];
  /** Nome de exibição já resolvido (guild nick > room display > friend > MXID localpart). */
  displayName?: string;
}

/**
 * Chip de citação (reply-to): mostra inicial do autor + nome + corpo truncado.
 * O nome deve ser resolvido pelo pai (MessageBubble) usando a mesma cadeia
 * de fallback do cabeçalho da mensagem, garantindo consistência visual.
 */
export default function ReplyChip({ replyTo, displayName }: ReplyChipProps) {
  if (!replyTo) return null;

  const name = displayName || "…";
  const initial = name.slice(0, 1).toUpperCase();
  const body = (replyTo.body ?? "").slice(0, 120);

  return (
    <div
      data-testid="reply-chip"
      className="mb-1 flex max-w-full items-center gap-2 rounded-lg border border-acc/15 bg-srf/60 px-2.5 py-1.5 text-[11px] leading-snug backdrop-blur-sm transition-colors hover:bg-srf/80"
    >
      {/* Barra lateral accent */}
      <span aria-hidden="true" className="h-6 w-[3px] flex-shrink-0 rounded-full bg-acc" />

      {/* Inicial do autor */}
      <span
        aria-hidden="true"
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-acc/15 font-display text-[9px] font-bold uppercase tracking-wide text-acc"
      >
        {initial}
      </span>

      {/* Nome + preview do texto */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <span className="mr-1.5 inline-block max-w-[120px] truncate font-semibold text-acc sm:max-w-[200px]">
          {name}
        </span>
        <span className="inline-block truncate text-txt/60">{body || "…"}</span>
      </div>
    </div>
  );
}

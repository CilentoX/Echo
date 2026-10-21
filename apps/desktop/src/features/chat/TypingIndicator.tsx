export interface TypingIndicatorProps {
  /** Nomes de exibição de quem está digitando, na ordem em que começaram. */
  names: string[];
}

/** "Lucas está digitando…" com três pontinhos animados (CSS puro). */
export default function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} está digitando…`
      : names.length === 2
        ? `${names[0]} e ${names[1]} estão digitando…`
        : `${names.length} pessoas estão digitando…`;

  return (
    <div
      role="status"
      aria-label={label}
      className="flex items-center gap-2 px-4 py-1 text-xs text-mut"
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 animate-bounce rounded-full bg-mut"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}

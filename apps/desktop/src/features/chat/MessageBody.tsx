import { renderMarkdown } from "@/lib/markdown";

export interface MessageBodyProps {
  /** Texto cru da mensagem (sem markdown processado). */
  body: string;
  /** Se true, não renderiza nada além de um placeholder de excluído. */
  redacted?: boolean;
  /** Se true, reduz a opacidade (placeholder otimista ainda não confirmado). */
  pending?: boolean;
}

/**
 * Corpo da mensagem: renderiza markdown simples (negrito, itálico, código,
 * links, listas, citações) de forma segura (escape de HTML). Quando a
 * mensagem foi redactada, mostra "[mensagem excluída]" em vez do corpo.
 */
export default function MessageBody({
  body,
  redacted = false,
  pending = false,
}: MessageBodyProps) {
  if (redacted) {
    return (
      <p
        data-testid="message-body-redacted"
        className="whitespace-pre-wrap break-words text-sm text-mut italic"
      >
        [mensagem excluída]
      </p>
    );
  }

  const html = renderMarkdown(body);

  return (
    <p
      data-testid="message-body"
      className={`whitespace-pre-wrap break-words text-sm ${pending ? "opacity-70" : ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

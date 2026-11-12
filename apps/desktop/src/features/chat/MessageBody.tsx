import { useMemo, useCallback } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

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
 * links, listas, citações) de forma segura (escape de HTML) e emojis customizados.
 */
export default function MessageBody({
  body,
  redacted = false,
  pending = false,
}: MessageBodyProps) {
  const guildEmojis = useSyncStore((s) => s.guildEmojis);

  const customEmojiMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const list of Object.values(guildEmojis)) {
      if (Array.isArray(list)) {
        for (const e of list) {
          map[e.name] = e.url;
        }
      }
    }
    return map;
  }, [guildEmojis]);

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

  // Sanitiza caso um evento antigo contenha resíduo corrompido de token
  const trimmed = (body ?? "").trim();
  const isOrphanToken =
    /^%%URL[\s_]*(?:TOKEN|<em>TOKEN<\/em>|&lt;em&gt;TOKEN&lt;\/em&gt;)?[\s_]*\d*%%$/i.test(trimmed) ||
    /^@@URLTOKEN\d*@@$/i.test(trimmed);
  if (isOrphanToken) {
    return null;
  }

  const handleClick = useCallback((e: React.MouseEvent<HTMLParagraphElement>) => {
    const target = (e.target as HTMLElement).closest(".mention-pill, .channel-pill");
    if (!target) return;
    const channelId = target.getAttribute("data-channel-id");
    const mentionId = target.getAttribute("data-mention-id");
    if (channelId) {
      useUiStore.getState().setActiveChannel(channelId);
    } else if (mentionId) {
      useUiStore.getState().setMemberProfileUserId(mentionId);
    }
  }, []);

  const html = renderMarkdown(body, customEmojiMap);
  if (!html.trim()) {
    return null;
  }

  return (
    <p
      data-testid="message-body"
      onClick={handleClick}
      className={`whitespace-pre-wrap break-words text-sm ${pending ? "opacity-70" : ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

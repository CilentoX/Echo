import { Paperclip, PaperPlaneTilt } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";

/** Contrato P10: envio espera o servidor responder. Não há placeholder otimista. */
export type SendMessageFn = (roomId: string, body: string) => Promise<string>;

export interface ComposerProps {
  roomId: string;
  sendMessage: SendMessageFn;
  /** Nome do canal ativo para o placeholder ("Conversar em #geral"). */
  channelName?: string;
}

/**
 * Campo de mensagem com envio síncrono (P10): só mostra a mensagem depois que
 * o servidor confirma. Falha (P11) mantém o rascunho e mostra erro com retry.
 * Enter durante um envio em curso é enfileirado: ao concluir, o rascunho
 * corrente é enviado (nada é engolido silenciosamente). Anexo fica
 * desabilitado até a Fase 2.
 */
export default function Composer({ roomId, sendMessage, channelName }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const sendingRef = useRef(false);
  const queuedRef = useRef(false);
  const draftRef = useRef("");
  draftRef.current = draft;

  const sendText = async (body: string) => {
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setFailed(false);
    setDraft("");

    try {
      const eventId = await sendMessage(roomId, body);
      // Mensagem só aparece na timeline após confirmação do servidor (via sync → applyEvent).
      // Não há placeholder otimista (P10).
      void eventId;
    } catch {
      // Mantém o rascunho para retry (P11).
      setDraft((prev) => (prev === "" ? body : prev));
      setFailed(true);
    } finally {
      sendingRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        const next = draftRef.current.trim();
        if (next) void sendText(next);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (sendingRef.current) {
        queuedRef.current = true;
        return;
      }
      void sendText(draft.trim());
    }
  };

  return (
    <div className="shrink-0 border-t border-bd bg-bg px-4 py-3">
      <div aria-live="polite">
        {failed && (
          <p role="alert" className="mb-2 text-xs text-err">
            Não foi possível enviar. Tente novamente.
          </p>
        )}
      </div>

      <div className="flex items-end gap-2 rounded-lg bg-surf px-3 py-2">
        {/* Upload chega na Fase 2 (Task de mídia); botão visível, mas desabilitado. */}
        <button
          type="button"
          aria-label="Anexar arquivo"
          aria-disabled="true"
          disabled
          title="Anexos chegam na Fase 2"
          className="flex items-center rounded p-1 text-mut opacity-40 hover:bg-surf2"
        >
          <Paperclip size={18} />
        </button>

        <textarea
          aria-label="Mensagem"
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Auto-grow: ajusta a altura conforme o conteúdo
            const ta = e.target as HTMLTextAreaElement;
            ta.style.height = "auto";
            ta.style.height = `${ta.scrollHeight}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder={channelName ? `Conversar em #${channelName}` : "Mensagem"}
          className="max-h-32 flex-1 resize-none bg-transparent text-sm text-txt outline-none placeholder:text-mut"
          style={{ height: draft ? "auto" : undefined }}
        />

        <button
          type="button"
          onClick={() => void sendText(draft.trim())}
          disabled={draft.trim() === ""}
          className="cursor-pointer flex items-center gap-1.5 rounded bg-acc px-2.5 py-1.5 text-sm font-semibold text-bg hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PaperPlaneTilt size={16} weight="bold" aria-hidden />
          Enviar
        </button>
      </div>
    </div>
  );
}

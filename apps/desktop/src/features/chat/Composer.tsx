import { Paperclip, PaperPlaneTilt } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import type { NormalizedEvent } from "@/lib/matrix/types";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

/** Contrato R2: Task 11 passa `(roomId, body) => matrixService.sendMessage(...)`,
 *  que resolve com o eventId real. */
export type SendMessageFn = (roomId: string, body: string) => Promise<string>;

export interface ComposerProps {
  roomId: string;
  sendMessage: SendMessageFn;
  /** Nome do canal ativo para o placeholder ("Conversar em #geral"). */
  channelName?: string;
}

/** Sender fallback quando a sessão ainda não está no uiStore (testes). */
const FALLBACK_SENDER = "Você";

/**
 * Campo de mensagem com envio otimista (R2): placeholder `pending-*` entra
 * na timeline imediatamente; sucesso troca por `resolvePending`, falha faz
 * rollback com `removePending`, restaura o texto e mostra o erro.
 *
 * Enter durante um envio em curso é enfileirado: ao concluir, o rascunho
 * corrente é enviado (nada é engolido silenciosamente). Anexo fica
 * desabilitado até a Fase 2 (MediaPreview pronto, mas sem upload real).
 */
export default function Composer({ roomId, sendMessage, channelName }: ComposerProps) {
  const myUserId = useUiStore((s) => s.myUserId);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const sendingRef = useRef(false);
  const queuedRef = useRef(false);
  const counterRef = useRef(0);
  // Espelho do draft para leitura fora do closure (envio enfileirado).
  const draftRef = useRef("");
  draftRef.current = draft;

  const addPendingEvent = useSyncStore((s) => s.addPendingEvent);
  const resolvePending = useSyncStore((s) => s.resolvePending);
  const removePending = useSyncStore((s) => s.removePending);

  const sender = myUserId ?? FALLBACK_SENDER;

  const sendText = async (body: string) => {
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setFailed(false);
    setDraft("");

    const localId = `pending-${Date.now()}-${++counterRef.current}`;
    const optimistic: NormalizedEvent = {
      eventId: localId,
      roomId,
      sender,
      body,
      originServerTs: Date.now(),
    };
    addPendingEvent(optimistic);

    try {
      const eventId = await sendMessage(roomId, body);
      resolvePending(localId, { ...optimistic, eventId });
    } catch {
      removePending(roomId, localId);
      // Restaura o rascunho só se o usuário não digitou algo novo enquanto isso.
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
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={channelName ? `Conversar em #${channelName}` : "Mensagem"}
          className="max-h-32 flex-1 resize-none bg-transparent text-sm text-txt outline-none placeholder:text-mut"
        />

        <button
          type="button"
          onClick={() => void sendText(draft.trim())}
          disabled={draft.trim() === ""}
          className="flex items-center gap-1.5 rounded bg-acc px-2.5 py-1.5 text-sm font-semibold text-bg hover:bg-acc-press disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PaperPlaneTilt size={16} weight="bold" aria-hidden />
          Enviar
        </button>
      </div>
    </div>
  );
}

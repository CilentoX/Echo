import { Paperclip, PaperPlaneTilt } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import type { NormalizedEvent } from "@/lib/matrix/types";
import { useSyncStore } from "@/stores/syncStore";
import MediaPreview from "./MediaPreview";

/** Contrato R2: Task 11 passa `(roomId, body) => matrixService.sendMessage(...)`,
 *  que resolve com o eventId real. */
export type SendMessageFn = (roomId: string, body: string) => Promise<string>;

export interface ComposerProps {
  roomId: string;
  sendMessage: SendMessageFn;
  /** Nome do canal ativo para o placeholder ("Conversar em #geral"). */
  channelName?: string;
}

/** Remetente dos eventos otimistas locais (sessão real chega no wiring, Task 11). */
const MY_SENDER = "Você";

/**
 * Campo de mensagem com envio otimista (R2): placeholder `pending-*` entra
 * na timeline imediatamente; sucesso troca por `resolvePending`, falha faz
 * rollback com `removePending`, restaura o texto e mostra o erro.
 */
export default function Composer({ roomId, sendMessage, channelName }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; kind: "image" | "file" } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const sendingRef = useRef(false);
  const counterRef = useRef(0);

  const addPendingEvent = useSyncStore((s) => s.addPendingEvent);
  const resolvePending = useSyncStore((s) => s.resolvePending);
  const removePending = useSyncStore((s) => s.removePending);

  const send = async () => {
    const body = draft.trim();
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setFailed(false);
    setDraft("");
    setAttachment(null);

    const localId = `pending-${Date.now()}-${++counterRef.current}`;
    const optimistic: NormalizedEvent = {
      eventId: localId,
      roomId,
      sender: MY_SENDER,
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
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
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

      {attachment && (
        <MediaPreview
          name={attachment.name}
          kind={attachment.kind}
          onRemove={() => setAttachment(null)}
        />
      )}

      <div className="flex items-end gap-2 rounded-lg bg-surf px-3 py-2">
        <button
          type="button"
          aria-label="Anexar arquivo"
          onClick={() =>
            setAttachment((prev) =>
              prev ? null : { name: "foto-do-chat.png", kind: "image" },
            )
          }
          className="flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
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
          onClick={() => void send()}
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

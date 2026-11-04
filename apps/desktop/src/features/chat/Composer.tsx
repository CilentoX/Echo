import { Paperclip, Send, Smile, X } from "lucide-react";
import { Microphone } from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";

import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import type { NormalizedEvent } from "@/lib/matrix/types";
import { EmojiPicker } from "@/components/emoji/EmojiPicker";
import VoiceRecorder from "./VoiceRecorder";

/** Contrato de envio de texto (P10/P12). */
export type SendMessageFn = (roomId: string, body: string) => Promise<string>;

/** Contrato de envio de anexo (Fase B/Multimídia). */
export type SendFileFn = (roomId: string, file: File, body?: string) => Promise<string>;

export interface ComposerProps {
  roomId: string;
  /** Envio de mensagem de texto. */
  sendMessage: SendMessageFn;
  /** Envio de anexo (arquivo, imagem ou gravação de voz). */
  sendFile?: SendFileFn;
  /** Nome do canal ativo para o placeholder ("Conversar em #geral"). */
  channelName?: string;
}

interface PendingMessage {
  localId: string;
  body: string;
  file?: File;
  status: "sending" | "failed";
  error?: string;
  duration?: number;
  waveform?: number[];
}

export default function Composer({
  roomId,
  sendMessage,
  sendFile,
  channelName,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; preview: string } | null>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const myUserId = useUiStore((s) => s.myUserId);
  const addEvent = useSyncStore((s) => s.addPendingEvent);
  const removeEvent = useSyncStore((s) => s.removePending);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  /** Insere texto na posição do cursor (ou substitui a seleção). */
  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setDraft((prev) => prev + text);
      return;
    }
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const value = ta.value;
    const next = value.slice(0, start) + text + value.slice(end);
    setDraft(next);
    ta.focus();
    ta.setSelectionRange(start + text.length, start + text.length);
    // Auto-grow
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  const wrapSelection = useCallback((open: string, close: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const value = ta.value;
    const selected = value.slice(start, end);
    const wrapped = selected ? `${open}${selected}${close}` : `${open}${close}`;
    const next = value.slice(0, start) + wrapped + value.slice(end);
    const caret = start + wrapped.length;
    setDraft(next);
    ta.focus();
    ta.setSelectionRange(caret, caret);
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      insertAtCursor(emoji);
      setEmojiOpen(false);
    },
    [insertAtCursor],
  );

  const handleAttachmentChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const preview = URL.createObjectURL(file);
      setAttachment({ file, preview });
    },
    [],
  );

  const removeAttachment = useCallback(() => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
  }, [attachment]);

  /** Suporte a colar imagens diretamente da área de transferência (Ctrl+V) */
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (
        file.type.startsWith("image/") ||
        file.type.startsWith("audio/") ||
        file.type.startsWith("application/") ||
        file.type.startsWith("text/")
      ) {
        e.preventDefault();
        const preview = URL.createObjectURL(file);
        setAttachment({ file, preview });
      }
    }
  }, []);

  /** Suporte a arrastar e soltar arquivos (Drag & Drop) */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const preview = URL.createObjectURL(file);
      setAttachment({ file, preview });
    }
  }, []);

  /** Constrói um evento placeholder otimista. */
  const buildOptimisticEvent = useCallback(
    (body: string, file?: File, waveform?: number[], duration?: number): NormalizedEvent => {
      const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const isImg = file?.type.startsWith("image/");
      const isAud = file?.type.startsWith("audio/");
      const event: NormalizedEvent = {
        eventId: localId,
        roomId,
        sender: myUserId ?? "",
        body: isAud
          ? "[Mensagem de voz]"
          : isImg
            ? (body || `[Imagem] ${file?.name ?? "anexo"}`)
            : file
              ? `[Arquivo] ${file.name}`
              : body,
        originServerTs: Date.now(),
        msgtype: isAud ? "m.audio" : isImg ? "m.image" : file ? "m.file" : "m.text",
        url: file ? URL.createObjectURL(file) : undefined,
        info: file
          ? {
              mimetype: file.type,
              size: file.size,
              duration,
              waveform,
            }
          : undefined,
      };
      addEvent(event);
      return event;
    },
    [addEvent, myUserId, roomId],
  );

  /** Envia um item pendente (texto ou arquivo). */
  const sendPending = useCallback(
    async (item: PendingMessage) => {
      setPending((list) =>
        list.map((p) => (p.localId === item.localId ? { ...p, status: "sending" as const } : p)),
      );
      try {
        if (item.file && sendFile) {
          await sendFile(roomId, item.file, item.body);
        } else {
          await sendMessage(roomId, item.body);
        }
        setPending((list) => list.filter((p) => p.localId !== item.localId));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Falha ao enviar";
        setPending((list) =>
          list.map((p) =>
            p.localId === item.localId
              ? { ...p, status: "failed" as const, error: message }
              : p,
          ),
        );
      }
    },
    [roomId, sendFile, sendMessage],
  );

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body && !attachment) return;
    if (sendingRef.current) return;

    sendingRef.current = true;

    try {
      if (attachment) {
        const item: PendingMessage = {
          localId: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          body: body || attachment.file.name,
          file: attachment.file,
          status: "sending",
        };
        setPending((list) => [...list, item]);
        buildOptimisticEvent(item.body, item.file);
        setAttachment(null);
        setDraft("");
        void sendPending(item);
      } else {
        const item: PendingMessage = {
          localId: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          body,
          status: "sending",
        };
        setPending((list) => [...list, item]);
        buildOptimisticEvent(body);
        setDraft("");
        void sendPending(item);
      }
    } finally {
      sendingRef.current = false;
    }
  }, [draft, attachment, buildOptimisticEvent, sendPending]);

  /** Envio de gravação de áudio do VoiceRecorder */
  const handleSendVoice = useCallback(
    (file: File, duration: number, waveform: number[]) => {
      setIsVoiceRecording(false);
      const item: PendingMessage = {
        localId: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        body: "[Mensagem de voz]",
        file,
        status: "sending",
        duration,
        waveform,
      };
      setPending((list) => [...list, item]);
      buildOptimisticEvent("[Mensagem de voz]", file, waveform, duration);
      void sendPending(item);
    },
    [buildOptimisticEvent, sendPending],
  );

  const retryPending = useCallback((localId: string) => {
    setPending((list) => {
      const item = list.find((p) => p.localId === localId);
      if (!item) return list;
      const updated = list.map((p) =>
        p.localId === localId ? { ...p, status: "sending" as const, error: undefined } : p,
      );
      setPending(updated);
      buildOptimisticEvent(item.body, item.file, item.waveform, item.duration);
      void sendPending(item);
      return updated;
    });
  }, [buildOptimisticEvent, sendPending]);

  const cancelPending = useCallback((localId: string) => {
    setPending((list) => {
      removeEvent(roomId, localId);
      return list.filter((p) => p.localId !== localId);
    });
  }, [removeEvent, roomId]);

  return (
    <div
      className="shrink-0 border-t border-bd bg-bg px-4 py-3"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div aria-live="polite">
        {pending.filter((p) => p.status === "failed").length > 0 && (
          <p role="alert" className="mb-2 text-xs text-err">
            Alguma mensagem não pôde ser enviada. Clique em Tentar novamente.
          </p>
        )}
      </div>

      {isVoiceRecording ? (
        <VoiceRecorder
          onCancel={() => setIsVoiceRecording(false)}
          onSend={handleSendVoice}
        />
      ) : (
        <div
          className={`flex items-end gap-1.5 rounded-2xl border bg-surf/90 px-3.5 py-2.5 shadow-sm transition-all focus-within:border-acc/40 focus-within:ring-2 focus-within:ring-acc/10 ${
            isDraggingOver ? "border-acc ring-2 ring-acc/20 bg-acc/5" : "border-bd/80"
          }`}
        >
          {/* Botão emoji com Popover acoplado */}
          <EmojiPicker
            onSelect={handleEmojiSelect}
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
          >
            <button
              type="button"
              aria-label="Escolher emoji"
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((o) => !o)}
              className="cursor-pointer p-1.5 hover:bg-surf2 rounded-xl transition-colors text-mut hover:text-txt active:scale-95"
            >
              <Smile size={16} />
            </button>
          </EmojiPicker>

          {/* Botão anexar */}
          <button
            type="button"
            aria-label="Anexar arquivo"
            onClick={() => {
              const input = document.getElementById("composer-file-input") as HTMLInputElement | null;
              input?.click();
            }}
            className="cursor-pointer p-1.5 hover:bg-surf2 rounded-xl transition-colors text-mut hover:text-txt active:scale-95"
          >
            <Paperclip size={16} />
          </button>

          {/* Botão Gravar Áudio */}
          <button
            type="button"
            aria-label="Gravar áudio"
            title="Gravar mensagem de voz"
            onClick={() => setIsVoiceRecording(true)}
            className="cursor-pointer p-1.5 hover:bg-surf2 rounded-xl transition-colors text-mut hover:text-acc active:scale-95"
          >
            <Microphone size={16} weight="bold" />
          </button>

          <input
            id="composer-file-input"
            data-testid="composer-file-input"
            type="file"
            className="hidden"
            onChange={handleAttachmentChange}
          />

          {/* Anexo selecionado com preview real para imagem */}
          {attachment && (
            <div className="flex items-center gap-2 bg-surf2 border border-bd rounded-xl px-2 py-1 shadow-xs">
              {attachment.file.type.startsWith("image/") ? (
                <img
                  src={attachment.preview}
                  alt="Prévia"
                  className="h-8 w-8 rounded-lg object-cover ring-1 ring-bd shrink-0"
                />
              ) : (
                <span className="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-bd text-mut font-bold shrink-0">
                  {attachment.file.name.split(".").pop() || "FILE"}
                </span>
              )}
              <span className="text-xs text-txt truncate max-w-[120px]" title={attachment.file.name}>
                {attachment.file.name}
              </span>
              <button
                type="button"
                onClick={removeAttachment}
                aria-label="Remover anexo"
                className="cursor-pointer p-1 hover:bg-surf rounded-lg text-mut hover:text-txt active:scale-95"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Formatação rápida */}
          <button
            type="button"
            onClick={() => wrapSelection("**", "**")}
            aria-label="Negrito"
            className="cursor-pointer p-1 hover:bg-surf2 rounded-lg text-mut font-bold text-xs"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => wrapSelection("*", "*")}
            aria-label="Itálico"
            className="cursor-pointer p-1 hover:bg-surf2 rounded-lg text-mut italic text-xs"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => wrapSelection("`", "`")}
            aria-label="Código"
            className="cursor-pointer p-1 hover:bg-surf2 rounded-lg text-mut text-xs font-mono"
          >
            `
          </button>

          <textarea
            ref={textareaRef}
            aria-label="Mensagem"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={channelName ? `Conversar em #${channelName}` : "Mensagem"}
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-txt outline-none placeholder:text-mut"
            style={{ height: draft ? "auto" : undefined }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={draft.trim() === "" && !attachment}
            className="cursor-pointer flex items-center gap-1.5 rounded-xl bg-acc px-3 py-1.5 text-sm font-semibold text-bg hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 transition-all shadow-sm"
          >
            <Send size={16} aria-hidden />
            Enviar
          </button>
        </div>
      )}

      {/* Lista de mensagens pendentes (placeholder otimista + retry) */}
      {pending.length > 0 && (
        <div className="mt-2 space-y-1">
          {pending.map((item) => (
            <div
              key={item.localId}
              className="flex items-start gap-2 px-2 py-1 text-xs rounded bg-surf2 border border-transparent hover:border-bd"
            >
              <span
                className={`flex-shrink-0 mt-0.5 ${
                  item.status === "sending"
                    ? "text-acc"
                    : item.status === "failed"
                      ? "text-err"
                      : "text-mut"
                }`}
              >
                {item.status === "sending" ? "…" : "⚠"}
              </span>
              <span
                className={`truncate ${
                  item.status === "failed" ? "line-through text-mut" : "text-txt"
                }`}
                title={item.body}
              >
                {item.body}
              </span>
              {item.status === "failed" && (
                <>
                  <button
                    type="button"
                    onClick={() => retryPending(item.localId)}
                    className="cursor-pointer text-xs text-acc underline hover:text-acc-press"
                  >
                    Tentar novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelPending(item.localId)}
                    className="cursor-pointer text-xs text-err underline hover:text-err-press ml-1"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

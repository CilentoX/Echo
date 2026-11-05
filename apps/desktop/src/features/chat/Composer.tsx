import { Paperclip, Send, Smile, X } from "lucide-react";
import { Microphone } from "@phosphor-icons/react";
import { useCallback, useRef, useState, useEffect } from "react";

import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import type { NormalizedEvent } from "@/lib/matrix/types";
import { EmojiPicker } from "@/components/emoji/EmojiPicker";
import VoiceRecorder from "./VoiceRecorder";
import { optimizeImageForUpload } from "@/lib/media/imageOptimizer";
import { hasChannelPermission } from "@/lib/permissions/channelPermissions";
import { matrixService } from "@/lib/matrix/instance";

/** Contrato de envio de texto (P10/P12). */
export type SendMessageFn = (roomId: string, body: string) => Promise<string>;

/** Contrato de envio de anexo (Fase B/Multimídia). */
export type SendFileFn = (roomId: string, file: File, body?: string) => Promise<string>;

const EMPTY_ROLES: string[] = [];
const EMPTY_GUILD_ROLES: any[] = [];

export interface ComposerProps {
  roomId: string;
  /** Envio de mensagem de texto. */
  sendMessage: SendMessageFn;
  /** Envio de anexo (arquivo, imagem ou gravação de voz). */
  sendFile?: SendFileFn;
  /** Nome do canal ativo para o placeholder ("Conversar em #geral"). */
  channelName?: string;
  /** Sobrescrita explícita de permissão para envio de mensagens. */
  canSendMessages?: boolean;
  /** Sobrescrita explícita de permissão para envio de anexos. */
  canAttachFiles?: boolean;
}

interface PendingMessage {
  localId: string;
  body: string;
  file?: File;
  status: "sending" | "failed";
  error?: string;
  duration?: number;
  waveform?: number[];
  optimisticEvent?: NormalizedEvent;
}

export default function Composer({
  roomId,
  sendMessage,
  sendFile,
  channelName,
  canSendMessages: propCanSend,
  canAttachFiles: propCanAttach,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; preview: string } | null>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const myUserId = useUiStore((s) => s.myUserId);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const addEvent = useSyncStore((s) => s.addPendingEvent);
  const resolveEvent = useSyncStore((s) => s.resolvePending);
  const removeEvent = useSyncStore((s) => s.removePending);

  const activeGuild = useSyncStore((s) => s.guilds.find((g) => g.guildId === activeGuildId));
  const effectiveUserId =
    myUserId || (typeof matrixService?.getUserId === "function" ? matrixService.getUserId() : "") || "";
  const isGuildOwner = Boolean(
    activeGuild && (activeGuild as any).createdBy && effectiveUserId && (activeGuild as any).createdBy === effectiveUserId,
  );
  const guildRoles = useSyncStore((s) => (activeGuildId ? s.guildRoles[activeGuildId] ?? EMPTY_GUILD_ROLES : EMPTY_GUILD_ROLES));
  const userRoleIds = useSyncStore((s) =>
    activeGuildId && effectiveUserId ? s.guildMemberRoles[activeGuildId]?.[effectiveUserId] ?? EMPTY_ROLES : EMPTY_ROLES,
  );
  const channelConfig = useSyncStore((s) => s.channelPermissions[roomId]);

  const canSend =
    propCanSend !== undefined
      ? propCanSend
      : hasChannelPermission("SEND_MESSAGES", {
          userId: effectiveUserId,
          isGuildOwner,
          userRoleIds: userRoleIds || [],
          guildRoles: (guildRoles as any[]) || [],
          channelConfig,
          channelType: "text",
        });

  const canAttach =
    propCanAttach !== undefined
      ? propCanAttach
      : hasChannelPermission("ATTACH_FILES", {
          userId: effectiveUserId,
          isGuildOwner,
          userRoleIds: userRoleIds || [],
          guildRoles: (guildRoles as any[]) || [],
          channelConfig,
          channelType: "text",
        });

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
      const rawFile = e.target.files?.[0];
      if (!rawFile) return;
      const preview = URL.createObjectURL(rawFile);
      setAttachment({ file: rawFile, preview });
      void optimizeImageForUpload(rawFile).then((optimized) => {
        if (optimized !== rawFile) {
          setAttachment((curr) => (curr ? { ...curr, file: optimized } : null));
        }
      });
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
      const rawFile = files[0];
      if (
        rawFile.type.startsWith("image/") ||
        rawFile.type.startsWith("audio/") ||
        rawFile.type.startsWith("application/") ||
        rawFile.type.startsWith("text/")
      ) {
        e.preventDefault();
        const preview = URL.createObjectURL(rawFile);
        setAttachment({ file: rawFile, preview });
        void optimizeImageForUpload(rawFile).then((optimized) => {
          if (optimized !== rawFile) {
            setAttachment((curr) => (curr ? { ...curr, file: optimized } : null));
          }
        });
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
      const rawFile = files[0];
      const preview = URL.createObjectURL(rawFile);
      setAttachment({ file: rawFile, preview });
      void optimizeImageForUpload(rawFile).then((optimized) => {
        if (optimized !== rawFile) {
          setAttachment((curr) => (curr ? { ...curr, file: optimized } : null));
        }
      });
    }
  }, []);

  /** Escuta arquivos soltos na timeline do Chat (Drag & Drop global da timeline) */
  useEffect(() => {
    const handleFilesDropped = (e: Event) => {
      const custom = e as CustomEvent<{ files: FileList }>;
      const files = custom.detail?.files;
      if (files && files.length > 0) {
        const rawFile = files[0];
        const preview = URL.createObjectURL(rawFile);
        setAttachment({ file: rawFile, preview });
        void optimizeImageForUpload(rawFile).then((optimized) => {
          if (optimized !== rawFile) {
            setAttachment((curr) => (curr ? { ...curr, file: optimized } : null));
          }
        });
      }
    };

    window.addEventListener("echo:files-dropped", handleFilesDropped);
    return () => window.removeEventListener("echo:files-dropped", handleFilesDropped);
  }, []);

  /** Constrói um evento placeholder otimista. */
  const buildOptimisticEvent = useCallback(
    (
      localId: string,
      body: string,
      file?: File,
      waveform?: number[],
      duration?: number,
    ): NormalizedEvent => {
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
        let realEventId: string | undefined;
        if (item.file && sendFile) {
          realEventId = await sendFile(roomId, item.file, item.body);
        } else {
          realEventId = await sendMessage(roomId, item.body);
        }
        if (realEventId && typeof realEventId === "string") {
          const base = item.optimisticEvent ?? {
            eventId: realEventId,
            roomId,
            sender: myUserId ?? "",
            body: item.body,
            originServerTs: Date.now(),
            msgtype: item.file
              ? item.file.type.startsWith("audio/")
                ? "m.audio"
                : item.file.type.startsWith("image/")
                  ? "m.image"
                  : "m.file"
              : "m.text",
          };
          resolveEvent(item.localId, {
            ...base,
            eventId: realEventId,
          });
        } else {
          removeEvent(roomId, item.localId);
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
    [myUserId, resolveEvent, removeEvent, roomId, sendFile, sendMessage],
  );

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body && !attachment) return;
    if (sendingRef.current) return;

    sendingRef.current = true;

    try {
      const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (attachment) {
        const bodyText = body || attachment.file.name;
        const optEvent = buildOptimisticEvent(localId, bodyText, attachment.file);
        const item: PendingMessage = {
          localId,
          body: bodyText,
          file: attachment.file,
          status: "sending",
          optimisticEvent: optEvent,
        };
        setPending((list) => [...list, item]);
        setAttachment(null);
        setDraft("");
        void sendPending(item);
      } else {
        const optEvent = buildOptimisticEvent(localId, body);
        const item: PendingMessage = {
          localId,
          body,
          status: "sending",
          optimisticEvent: optEvent,
        };
        setPending((list) => [...list, item]);
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
      const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optEvent = buildOptimisticEvent(localId, "[Mensagem de voz]", file, waveform, duration);
      const item: PendingMessage = {
        localId,
        body: "[Mensagem de voz]",
        file,
        status: "sending",
        duration,
        waveform,
        optimisticEvent: optEvent,
      };
      setPending((list) => [...list, item]);
      void sendPending(item);
    },
    [buildOptimisticEvent, sendPending],
  );

  const retryPending = useCallback(
    (localId: string) => {
      setPending((list) => {
        const item = list.find((p) => p.localId === localId);
        if (!item) return list;
        const optEvent = buildOptimisticEvent(
          item.localId,
          item.body,
          item.file,
          item.waveform,
          item.duration,
        );
        const updatedItem = {
          ...item,
          status: "sending" as const,
          error: undefined,
          optimisticEvent: optEvent,
        };
        void sendPending(updatedItem);
        return list.map((p) => (p.localId === localId ? updatedItem : p));
      });
    },
    [buildOptimisticEvent, sendPending],
  );

  const cancelPending = useCallback(
    (localId: string) => {
      setPending((list) => {
        removeEvent(roomId, localId);
        return list.filter((p) => p.localId !== localId);
      });
    },
    [removeEvent, roomId],
  );

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
            !canSend ? "opacity-60 bg-surf/40 cursor-not-allowed" : ""
          } ${
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
              disabled={!canSend}
              onClick={() => canSend && setEmojiOpen((o) => !o)}
              className={`p-1.5 rounded-xl transition-colors ${
                !canSend
                  ? "cursor-not-allowed opacity-40 text-mut"
                  : "cursor-pointer hover:bg-surf2 text-mut hover:text-txt active:scale-95"
              }`}
            >
              <Smile size={16} />
            </button>
          </EmojiPicker>

          {/* Botão anexar */}
          <button
            type="button"
            aria-label="Anexar arquivo"
            disabled={!canAttach || !canSend}
            title={canAttach ? "Anexar arquivo" : "Você não tem permissão para anexar arquivos"}
            onClick={() => {
              if (!canAttach || !canSend) return;
              const input = document.getElementById("composer-file-input") as HTMLInputElement | null;
              input?.click();
            }}
            className={`p-1.5 rounded-xl transition-colors ${
              !canAttach || !canSend
                ? "cursor-not-allowed opacity-40 text-mut"
                : "cursor-pointer hover:bg-surf2 text-mut hover:text-txt active:scale-95"
            }`}
          >
            <Paperclip size={16} />
          </button>

          {/* Botão Gravar Áudio */}
          <button
            type="button"
            aria-label="Gravar áudio"
            disabled={!canAttach || !canSend}
            title={canAttach ? "Gravar mensagem de voz" : "Você não tem permissão para gravar áudio"}
            onClick={() => {
              if (!canAttach || !canSend) return;
              setIsVoiceRecording(true);
            }}
            className={`p-1.5 rounded-xl transition-colors ${
              !canAttach || !canSend
                ? "cursor-not-allowed opacity-40 text-mut"
                : "cursor-pointer hover:bg-surf2 text-mut hover:text-acc active:scale-95"
            }`}
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
            disabled={!canSend}
            onClick={() => canSend && wrapSelection("**", "**")}
            aria-label="Negrito"
            className={`p-1 rounded-lg font-bold text-xs ${
              !canSend ? "opacity-40 cursor-not-allowed text-mut" : "cursor-pointer hover:bg-surf2 text-mut"
            }`}
          >
            B
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => canSend && wrapSelection("*", "*")}
            aria-label="Itálico"
            className={`p-1 rounded-lg italic text-xs ${
              !canSend ? "opacity-40 cursor-not-allowed text-mut" : "cursor-pointer hover:bg-surf2 text-mut"
            }`}
          >
            I
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => canSend && wrapSelection("`", "`")}
            aria-label="Código"
            className={`p-1 rounded-lg text-xs font-mono ${
              !canSend ? "opacity-40 cursor-not-allowed text-mut" : "cursor-pointer hover:bg-surf2 text-mut"
            }`}
          >
            `
          </button>

          <textarea
            ref={textareaRef}
            aria-label="Mensagem"
            disabled={!canSend}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (!canSend) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              } else if (e.key === "ArrowUp" && draft.trim() === "") {
                const timeline = useSyncStore.getState().timelineByChannel[roomId] ?? [];
                const myMessages = timeline.filter(
                  (m) =>
                    (m.sender === effectiveUserId || (myUserId ? m.sender === myUserId : false)) &&
                    m.body &&
                    !m.eventId.startsWith("pending-"),
                );
                const lastMsg = myMessages[myMessages.length - 1];
                if (lastMsg && lastMsg.body) {
                  e.preventDefault();
                  setDraft(lastMsg.body);
                }
              }
            }}
            placeholder={
              !canSend
                ? "🔒 Você não tem permissão para enviar mensagens neste canal."
                : channelName
                  ? `Conversar em #${channelName}`
                  : "Mensagem"
            }
            className={`max-h-32 flex-1 resize-none bg-transparent text-sm text-txt outline-none placeholder:text-mut ${
              !canSend ? "cursor-not-allowed" : ""
            }`}
            style={{ height: draft ? "auto" : undefined }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || (draft.trim() === "" && !attachment)}
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

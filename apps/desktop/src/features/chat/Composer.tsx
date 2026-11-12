import { Paperclip, PaperPlaneTilt, Smiley, X, TextB, TextItalic, Code, TextStrikethrough, Link as LinkIcon, Quotes } from "@phosphor-icons/react";
import { Microphone } from "@phosphor-icons/react";
import { useCallback, useRef, useState, useEffect } from "react";

import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import type { NormalizedEvent } from "@/lib/matrix/types";
import { EmojiPicker } from "@/components/emoji/EmojiPicker";
import VoiceRecorder from "./VoiceRecorder";
import MentionAutocompletePopover, { type MentionItem } from "./MentionAutocompletePopover";
import { optimizeImageForUpload } from "@/lib/media/imageOptimizer";
import { hasChannelPermission } from "@/lib/permissions/channelPermissions";
import { matrixService } from "@/lib/matrix/instance";

/** Contrato de envio de texto (P10/P12). */
export type SendMessageFn = (roomId: string, body: string, options?: { replyToEventId?: string }) => Promise<string>;

/** Contrato de envio de anexo (Fase B/Multimídia). */
export type SendFileFn = (roomId: string, file: File, body?: string) => Promise<string>;

const EMPTY_ROLES: string[] = [];
const EMPTY_GUILD_ROLES: any[] = [];
const MAX_MESSAGE_LENGTH = 4000;

// Dicas contextuais rotativas para o placeholder
const PLACEHOLDER_TIPS = [
  "Use **negrito** ou *itálico* para formatar",
  "Pressione ↑ para editar sua última mensagem",
  "Arraste imagens ou use Ctrl+V para colar",
  "Digite @ para mencionar alguém",
  "Digite # para buscar canais",
  "Shift+Enter para nova linha",
];

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
  channelName: _channelName,
  canSendMessages: propCanSend,
  canAttachFiles: propCanAttach,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; preview: string } | null>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [placeholderTip, setPlaceholderTip] = useState(0);
  const [editMode, setEditMode] = useState<string | null>(null); // eventId da mensagem sendo editada
  const [replyTo, setReplyTo] = useState<{ eventId: string; sender: string; body: string } | null>(null);

  // Escuta evento echo:reply-to disparado pelo botão "Responder" em MessageBubble
  useEffect(() => {
    const handleReplyTo = (e: Event) => {
      const detail = (e as CustomEvent).detail as { eventId: string; sender: string; body: string } | undefined;
      if (detail?.eventId) {
        setReplyTo(detail);
        // Foca no input após definir reply
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    };
    window.addEventListener("echo:reply-to", handleReplyTo);
    return () => window.removeEventListener("echo:reply-to", handleReplyTo);
  }, []);

  // Placeholder rotativo a cada 8 segundos
  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderTip((prev) => (prev + 1) % PLACEHOLDER_TIPS.length);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  // Toolbar flutuante de formatação (estilo Notion) — aparece ao selecionar texto
  const [selectionToolbar, setSelectionToolbar] = useState<{
    visible: boolean;
    top: number;
    left: number;
  }>({ visible: false, top: 0, left: 0 });

  const updateSelectionToolbar = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || ta.selectionStart === ta.selectionEnd) {
      setSelectionToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    // Calcula posição aproximada da seleção relativa ao textarea
    const taRect = ta.getBoundingClientRect();
    const lineHeight = 22; // altura estimada da linha
    const linesBefore = ta.value.slice(0, ta.selectionStart).split("\n").length - 1;
    const top = taRect.top + linesBefore * lineHeight - 40; // 40px acima da linha
    const left = taRect.left + 60; // offset horizontal
    setSelectionToolbar({ visible: true, top, left });
  }, []);

  const [autocomplete, setAutocomplete] = useState<{
    isOpen: boolean;
    type: "mention" | "channel";
    query: string;
    triggerIndex: number;
  } | null>(null);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const autocompleteItemsRef = useRef<MentionItem[]>([]);

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

  // Atalho ↑ para editar última mensagem quando o input está vazio
  const handleEditLastMessage = useCallback(() => {
    if (draft.trim() !== "") return;
    const events = useSyncStore.getState().timelineByChannel[roomId];
    if (!events || events.length === 0) return;
    const myLastMsg = [...events].reverse().find(
      (e) => e.sender === effectiveUserId && e.msgtype != null,
    );
    if (myLastMsg) {
      setEditMode(myLastMsg.eventId);
      setDraft(myLastMsg.body ?? "");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [draft, roomId, effectiveUserId]);

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

  const checkAutocomplete = useCallback((text: string, cursorPosition: number) => {
    const textBefore = text.slice(0, cursorPosition);
    const match = textBefore.match(/(?:^|\s)([@#])([a-zA-Z0-9_\-\u00C0-\u017F]*)$/);
    if (match && match[1]) {
      const trigger = match[1];
      const query = match[2] ?? "";
      const triggerIndex = textBefore.lastIndexOf(trigger);
      setAutocomplete({
        isOpen: true,
        type: trigger === "@" ? "mention" : "channel",
        query,
        triggerIndex,
      });
      setAutocompleteIndex(0);
    } else {
      setAutocomplete(null);
    }
  }, []);

  const handleSelectAutocomplete = useCallback(
    (item: MentionItem) => {
      if (!autocomplete) return;
      const ta = textareaRef.current;
      const cursor = ta?.selectionStart ?? draft.length;
      const beforeTrigger = draft.slice(0, autocomplete.triggerIndex);
      const afterCursor = draft.slice(cursor);

      let insertion = "";
      if (item.kind === "member") {
        insertion = `@[${item.name}](${item.id}) `;
      } else if (item.kind === "role") {
        insertion = `@[${item.name}](role:${item.id}) `;
      } else if (item.kind === "special") {
        insertion = `@${item.name} `;
      } else if (item.kind === "channel") {
        insertion = `#[${item.name}](channel:${item.id}) `;
      }

      const nextDraft = beforeTrigger + insertion + afterCursor;
      setDraft(nextDraft);
      setAutocomplete(null);

      if (ta) {
        const newPos = beforeTrigger.length + insertion.length;
        setTimeout(() => {
          ta.focus();
          ta.setSelectionRange(newPos, newPos);
        }, 0);
      }
    },
    [autocomplete, draft],
  );

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

  /** Escuta inserção de menção/resposta via quick actions ou context menu */
  useEffect(() => {
    const handleInsertMention = (e: Event) => {
      const custom = e as CustomEvent<{ userId?: string; mentionText?: string }>;
      if (custom.detail?.mentionText) {
        insertAtCursor(custom.detail.mentionText);
      }
    };

    window.addEventListener("echo:insert-mention", handleInsertMention);
    return () => window.removeEventListener("echo:insert-mention", handleInsertMention);
  }, [insertAtCursor]);

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
      const isVid = file?.type.startsWith("video/") || Boolean(file && /\.(mp4|webm|mov|mkv|ogv)$/i.test(file.name));
      const event: NormalizedEvent = {
        eventId: localId,
        roomId,
        sender: myUserId ?? "",
        body: isAud
          ? "[Mensagem de voz]"
          : isVid
            ? (body || `[Vídeo] ${file?.name ?? "vídeo"}`)
            : isImg
              ? (body || `[Imagem] ${file?.name ?? "anexo"}`)
              : file
                ? `[Arquivo] ${file.name}`
                : body,
        originServerTs: Date.now(),
        msgtype: isAud ? "m.audio" : isVid ? "m.video" : isImg ? "m.image" : file ? "m.file" : "m.text",
        url: file ? URL.createObjectURL(file) : undefined,
        info: file
          ? {
              mimetype: file.type,
              size: file.size,
              duration,
              waveform,
            }
          : undefined,
        ...(replyTo ? { replyTo: { eventId: replyTo.eventId, sender: replyTo.sender, body: replyTo.body } } : {}),
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
        // Extract replyTo from the optimistic event captured at send time,
        // NOT from the closure variable which may already be cleared by setReplyTo(null).
        const itemReplyTo = item.optimisticEvent?.replyTo;
        if (item.file && sendFile) {
          realEventId = await sendFile(roomId, item.file, item.body);
        } else {
          realEventId = await sendMessage(roomId, item.body, {
            ...(itemReplyTo ? { replyToEventId: itemReplyTo.eventId } : {}),
          });
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
                  : item.file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|ogv)$/i.test(item.file.name)
                    ? "m.video"
                    : "m.file"
              : "m.text",
          };
          resolveEvent(item.localId, {
            ...base,
            eventId: realEventId,
            // Preserve replyTo from optimistic event when server event doesn't include it yet
            ...(item.optimisticEvent?.replyTo && !base.replyTo ? { replyTo: item.optimisticEvent.replyTo } : {}),
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
        // Revoga ObjectURL do preview para evitar memory leak
        if (attachment.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(attachment.preview);
        }
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
        setReplyTo(null);
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

      {/* Reply-to chip — aparece quando o usuário clica "Responder" em uma mensagem */}
      {replyTo && !isVoiceRecording && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-acc bg-surf/60 px-3 py-2 text-xs">
          <span className="font-semibold text-txt truncate">
            Respondendo a {replyTo.sender.startsWith("@") ? replyTo.sender.slice(1).split(":")[0] : replyTo.sender}
          </span>
          <span className="text-mut truncate flex-1">{replyTo.body.slice(0, 80)}</span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="cursor-pointer p-0.5 rounded hover:bg-white/[0.08] text-mut hover:text-txt transition-colors"
            aria-label="Cancelar resposta"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      )}

      {isVoiceRecording ? (
        <VoiceRecorder
          onCancel={() => setIsVoiceRecording(false)}
          onSend={handleSendVoice}
        />
      ) : (
        <div
          className={`relative flex flex-col rounded-2xl border bg-surf/90 shadow-sm transition-all focus-within:border-acc/40 focus-within:ring-2 focus-within:ring-acc/10 ${
            !canSend ? "opacity-60 bg-surf/40 cursor-not-allowed" : ""
          } ${
            isDraggingOver ? "border-acc ring-2 ring-acc/20 bg-acc/5" : "border-bd/80"
          }`}
        >
          {/* Toolbar Flutuante de Formatação (estilo Notion) — aparece ao selecionar texto */}
          {selectionToolbar.visible && canSend && (
            <div
              className="fixed z-50 flex items-center gap-0.5 rounded-xl bg-[#1a1f2e] border border-bd/60 px-1 py-1 shadow-xl shadow-black/40 animate-in fade-in slide-in-from-bottom-1 duration-150"
              style={{ top: selectionToolbar.top, left: selectionToolbar.left }}
            >
              <button type="button" onClick={() => wrapSelection("**", "**")} title="Negrito" className="cursor-pointer p-1.5 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-colors"><TextB size={14} /></button>
              <button type="button" onClick={() => wrapSelection("*", "*")} title="Itálico" className="cursor-pointer p-1.5 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-colors"><TextItalic size={14} /></button>
              <button type="button" onClick={() => wrapSelection("~~", "~~")} title="Tachado" className="cursor-pointer p-1.5 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-colors"><TextStrikethrough size={14} /></button>
              <div className="w-[1px] h-4 bg-bd/40 mx-0.5" />
              <button type="button" onClick={() => wrapSelection("`", "`")} title="Código inline" className="cursor-pointer p-1.5 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-colors"><Code size={14} /></button>
              <button type="button" onClick={() => wrapSelection("> ", "")} title="Citação" className="cursor-pointer p-1.5 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-colors"><Quotes size={14} /></button>
              <button type="button" onClick={() => wrapSelection("[", "](url)")} title="Link" className="cursor-pointer p-1.5 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-colors"><LinkIcon size={14} /></button>
            </div>
          )}

          {/* Autocomplete flutuante de Menções e Canais */}
          {autocomplete?.isOpen && (
            <MentionAutocompletePopover
              type={autocomplete.type}
              query={autocomplete.query}
              roomId={roomId}
              guildId={activeGuildId}
              selectedIndex={autocompleteIndex}
              onSelect={handleSelectAutocomplete}
              onItemsChange={(items) => {
                autocompleteItemsRef.current = items;
              }}
            />
          )}

          {/* Anexo selecionado com preview real para imagem */}
          {attachment && (
            <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5 bg-surf2 border border-bd rounded-xl px-3 py-1.5 shadow-sm">
                {attachment.file.type.startsWith("image/") ? (
                  <img
                    src={attachment.preview}
                    alt="Prévia"
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-bd shrink-0"
                  />
                ) : (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-1 rounded bg-bd text-mut font-bold shrink-0">
                    {attachment.file.name.split(".").pop() || "FILE"}
                  </span>
                )}
                <div className="flex flex-col min-w-0 pr-1">
                  <span className="text-xs text-txt font-medium truncate max-w-[200px]" title={attachment.file.name}>
                    {attachment.file.name}
                  </span>
                  <span className="text-[10px] text-mut">
                    {(attachment.file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeAttachment}
                  aria-label="Remover anexo"
                  className="cursor-pointer p-1 hover:bg-surf rounded-lg text-mut hover:text-err transition-colors active:scale-95"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Linha Principal do Input: [ 📎 ] | textarea | [ B I ` ] | [ 😀 ] [ 🎤 ] [ Enviar ] */}
          <div className="flex items-end gap-2 px-3.5 py-2.5">
            {/* Botão de Anexo (+) estilo Discord no lado esquerdo */}
            <button
              type="button"
              aria-label="Anexar arquivo"
              disabled={!canAttach || !canSend}
              title={canAttach ? "Anexar arquivo ou mídia" : "Você não tem permissão para anexar arquivos"}
              onClick={() => {
                if (!canAttach || !canSend) return;
                const input = document.getElementById("composer-file-input") as HTMLInputElement | null;
                input?.click();
              }}
              className={`p-2 rounded-xl transition-all flex items-center justify-center shrink-0 mb-0.5 ${
                !canAttach || !canSend
                  ? "cursor-not-allowed opacity-40 text-mut"
                  : "cursor-pointer bg-white/[0.04] hover:bg-white/[0.08] text-mut hover:text-txt active:scale-95"
              }`}
            >
              <Paperclip size={18} />
            </button>

            <input
              id="composer-file-input"
              data-testid="composer-file-input"
              type="file"
              className="hidden"
              onChange={handleAttachmentChange}
            />

            {/* Campo Textarea com auto-grow, placeholder rotativo e suporte a edição */}
            <div className="flex-1 relative">
              {/* Banner de Modo Edição */}
              {editMode && (
                <div className="absolute -top-8 left-0 right-0 flex items-center justify-between px-3 py-1 rounded-t-xl bg-acc/10 border-b border-acc/20 animate-in slide-in-from-bottom-1 duration-150">
                  <span className="text-[11px] font-medium text-acc flex items-center gap-1.5">
                    <span className="text-xs">✏️</span> Editando mensagem
                  </span>
                  <button
                    type="button"
                    onClick={() => { setEditMode(null); setDraft(""); }}
                    className="cursor-pointer p-0.5 rounded hover:bg-acc/20 text-acc/70 hover:text-acc transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                aria-label="Mensagem"
                disabled={!canSend}
                rows={1}
                value={draft}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraft(val);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  checkAutocomplete(val, e.target.selectionStart ?? val.length);
                }}
                onPaste={handlePaste}
                onSelect={updateSelectionToolbar}
                onMouseUp={updateSelectionToolbar}
                onKeyUp={(e) => {
                  if (e.shiftKey || e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
                    updateSelectionToolbar();
                  }
                }}
                onKeyDown={(e) => {
                  if (!canSend) return;

                  // Navegação e seleção no autocomplete de menções / canais
                  if (autocomplete?.isOpen && autocompleteItemsRef.current.length > 0) {
                    const items = autocompleteItemsRef.current;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setAutocompleteIndex((prev) => (prev + 1) % items.length);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setAutocompleteIndex((prev) => (prev - 1 + items.length) % items.length);
                      return;
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      const selected = items[autocompleteIndex] ?? items[0];
                      if (selected) {
                        handleSelectAutocomplete(selected);
                      }
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setAutocomplete(null);
                      return;
                    }
                  }

                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  } else if (e.key === "Escape" && editMode) {
                    e.preventDefault();
                    setEditMode(null);
                    setDraft("");
                  } else if (e.key === "ArrowUp" && draft.trim() === "" && !editMode) {
                    handleEditLastMessage();
                  }
                }}
                placeholder={
                  !canSend
                    ? "🔒 Você não tem permissão para enviar mensagens neste canal."
                    : editMode
                      ? "Editando mensagem… (Esc para cancelar)"
                      : PLACEHOLDER_TIPS[placeholderTip]
                }
                className={`max-h-40 min-h-[24px] py-1 w-full resize-none bg-transparent text-sm text-txt outline-none placeholder:text-mut/50 leading-relaxed overflow-y-hidden transition-colors duration-300 ${
                  !canSend ? "cursor-not-allowed" : editMode ? "placeholder:text-acc/60" : ""
                }`}
                style={{ height: draft ? undefined : "24px" }}
              />

              {/* Character Count Discreto */}
              {draft.length > MAX_MESSAGE_LENGTH * 0.8 && (
                <span className={`absolute bottom-1 right-1 text-[10px] font-mono transition-colors ${
                  draft.length > MAX_MESSAGE_LENGTH ? "text-err font-semibold" : "text-mut/50"
                }`}>
                  {draft.length}/{MAX_MESSAGE_LENGTH}
                </span>
              )}
            </div>

            {/* Controles do Lado Direito */}
            <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
              {/* Formatação rápida discreta (Markdown) */}
              <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-mut mr-1">
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => canSend && wrapSelection("**", "**")}
                  aria-label="Negrito"
                  title="Negrito (**texto**)"
                  className={`px-1.5 py-0.5 rounded-lg font-bold text-xs hover:text-txt hover:bg-white/[0.06] transition-colors ${
                    !canSend ? "opacity-40 cursor-not-allowed text-mut" : "cursor-pointer"
                  }`}
                >
                  B
                </button>
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => canSend && wrapSelection("*", "*")}
                  aria-label="Itálico"
                  title="Itálico (*texto*)"
                  className={`px-1.5 py-0.5 rounded-lg italic text-xs hover:text-txt hover:bg-white/[0.06] transition-colors ${
                    !canSend ? "opacity-40 cursor-not-allowed text-mut" : "cursor-pointer"
                  }`}
                >
                  I
                </button>
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => canSend && wrapSelection("`", "`")}
                  aria-label="Código"
                  title="Código inline (`código`)"
                  className={`px-1.5 py-0.5 rounded-lg text-xs font-mono hover:text-txt hover:bg-white/[0.06] transition-colors ${
                    !canSend ? "opacity-40 cursor-not-allowed text-mut" : "cursor-pointer"
                  }`}
                >
                  {"</>"}
                </button>
              </div>

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
                  className={`p-2 rounded-xl transition-all ${
                    !canSend
                      ? "cursor-not-allowed opacity-40 text-mut"
                      : "cursor-pointer hover:bg-white/[0.06] text-mut hover:text-yellow-400 active:scale-95"
                  }`}
                >
                  <Smiley size={18} />
                </button>
              </EmojiPicker>

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
                className={`p-2 rounded-xl transition-all ${
                  !canAttach || !canSend
                    ? "cursor-not-allowed opacity-40 text-mut"
                    : "cursor-pointer hover:bg-white/[0.06] text-mut hover:text-acc active:scale-95"
                }`}
              >
                <Microphone size={18} weight="bold" />
              </button>

              {/* Botão Enviar com estilo refinado */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend || (draft.trim() === "" && !attachment)}
                aria-label="Enviar"
                className="cursor-pointer flex items-center gap-1.5 rounded-xl bg-acc px-3.5 py-2 text-xs font-semibold text-bg hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-acc transition-all shadow-md shadow-acc/15"
              >
                <PaperPlaneTilt size={15} aria-hidden />
                <span>Enviar</span>
              </button>
            </div>
          </div>
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

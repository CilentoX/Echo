"use client";

import { useMemo, useState } from "react";
import { PushPin, Trash, ChatText } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSyncStore } from "@/stores/syncStore";
import type { NormalizedEvent } from "@/lib/matrix/types";

export interface PinnedMessagesPopoverProps {
  roomId: string;
}

const EMPTY_ARRAY: readonly any[] = Object.freeze([]);

export default function PinnedMessagesPopover({ roomId }: PinnedMessagesPopoverProps) {
  const [open, setOpen] = useState(false);

  const pinnedIds = useSyncStore(
    (s) => s.pinnedByRoom[roomId] ?? (EMPTY_ARRAY as string[]),
  );
  const timeline = useSyncStore(
    (s) => s.timelineByChannel[roomId] ?? (EMPTY_ARRAY as NormalizedEvent[]),
  );
  const unpinMessage = useSyncStore((s) => s.unpinMessage);

  const pinnedEvents = useMemo(() => {
    return timeline.filter((e) => pinnedIds.includes(e.eventId));
  }, [timeline, pinnedIds]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Mensagens fixadas"
          aria-label="Mensagens fixadas"
          className="cursor-pointer relative flex h-8 w-8 items-center justify-center rounded-lg text-mut hover:bg-surf2 hover:text-txt transition-colors"
        >
          <PushPin size={18} className={pinnedIds.length > 0 ? "text-acc" : ""} />
          {pinnedIds.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-acc px-1 text-[9px] font-bold text-bg shadow-sm">
              {pinnedIds.length}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 bg-[#12161f] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden text-txt z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Cabeçalho */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
          <PushPin size={16} weight="bold" className="text-acc shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-txt">
            Mensagens Fixadas
          </h3>
          <span className="ml-auto text-[11px] font-mono text-mut/80">
            {pinnedEvents.length}
          </span>
        </div>

        {/* Lista de Mensagens Fixadas */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-2 scrollbar-thin">
          {pinnedEvents.length > 0 ? (
            pinnedEvents.map((event) => {
              const time = new Date(event.originServerTs).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={event.eventId}
                  className="group relative flex flex-col gap-1 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-txt truncate">
                      {event.sender.replace(/^@/, "").split(":")[0]}
                    </span>
                    <time className="text-[10px] text-mut/70 font-mono">{time}</time>
                  </div>

                  <p className="text-xs text-mut/90 line-clamp-3 leading-relaxed break-words">
                    {event.body}
                  </p>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => unpinMessage(roomId, event.eventId)}
                      title="Desafixar mensagem"
                      aria-label="Desafixar mensagem"
                      className="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-mut hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash size={12} />
                      <span>Desafixar</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 px-4 text-center space-y-2">
              <div className="w-8 h-8 mx-auto rounded-full bg-white/[0.04] flex items-center justify-center text-mut/60">
                <ChatText size={16} />
              </div>
              <p className="text-xs font-medium text-txt">Nenhuma mensagem fixada</p>
              <p className="text-[11px] text-mut/60 leading-relaxed">
                Passe o mouse sobre qualquer mensagem e clique no alfinete para fixá-la neste canal.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}


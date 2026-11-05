"use client";

import { useState } from "react";
import { Bell, BellSlash, Clock } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSyncStore } from "@/stores/syncStore";

export interface ChannelMutePopoverProps {
  channelId: string;
  channelName: string;
  guildId?: string;
  className?: string;
}

const DURATION_OPTIONS = [
  { label: "Por 15 minutos", minutes: 15 },
  { label: "Por 1 hora", minutes: 60 },
  { label: "Por 8 horas", minutes: 480 },
  { label: "Por 24 horas", minutes: 1440 },
  { label: "Até eu reativar", minutes: undefined },
];

export default function ChannelMutePopover({
  channelId,
  channelName,
  guildId,
  className = "",
}: ChannelMutePopoverProps) {
  const [open, setOpen] = useState(false);
  const muteChannel = useSyncStore((s) => s.muteChannel);
  const unmuteChannel = useSyncStore((s) => s.unmuteChannel);
  const isMuted = useSyncStore((s) => s.isChannelMuted(channelId, guildId));

  const handleSelect = (minutes?: number) => {
    muteChannel(channelId, minutes);
    setOpen(false);
  };

  const handleUnmute = () => {
    unmuteChannel(channelId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={isMuted ? `Reativar notificações de #${channelName}` : `Silenciar #${channelName}`}
          title={isMuted ? "Canal silenciado (clique para opções)" : "Silenciar canal"}
          className={`cursor-pointer p-1 rounded-lg transition-all active:scale-95 ${
            isMuted
              ? "text-amber-400 hover:text-amber-300 hover:bg-white/[0.08]"
              : "text-mut hover:text-txt hover:bg-white/[0.08] opacity-0 group-hover:opacity-100"
          } ${className}`}
        >
          {isMuted ? <BellSlash size={13} weight="bold" /> : <Bell size={13} />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={6}
        className="w-56 p-2 rounded-2xl bg-[#12161f] border border-white/[0.08] shadow-2xl text-txt z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <div className="px-2 py-1.5 border-b border-white/[0.06] mb-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-txt">
            {isMuted ? <BellSlash size={14} className="text-amber-400" /> : <Bell size={14} className="text-acc" />}
            <span className="truncate">{channelName}</span>
          </div>
          <span className="text-[10px] text-mut/80">
            {isMuted ? "Notificações pausadas" : "Silenciar notificações"}
          </span>
        </div>

        {isMuted ? (
          <button
            type="button"
            onClick={handleUnmute}
            className="cursor-pointer w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-acc hover:bg-acc/10 transition-colors"
          >
            <Bell size={14} weight="bold" />
            <span>Reativar Notificações</span>
          </button>
        ) : (
          <div className="space-y-0.5">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleSelect(opt.minutes)}
                className="cursor-pointer w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-mut hover:text-txt hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-mut/60" />
                  <span>{opt.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

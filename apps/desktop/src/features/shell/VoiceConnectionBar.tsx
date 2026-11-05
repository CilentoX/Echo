"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import { PhoneDisconnect, Broadcast, SpeakerHigh } from "@phosphor-icons/react";

export interface VoiceConnectionBarProps {
  onOpenVoiceSettings?: () => void;
}

export default function VoiceConnectionBar({ onOpenVoiceSettings }: VoiceConnectionBarProps) {
  const isConnected = useVoiceStore((s) => s.isConnected);
  const isConnecting = useVoiceStore((s) => s.isConnecting);
  const activeVoiceChannelName = useVoiceStore((s) => s.activeVoiceChannelName);
  const activeVoiceGuildName = useVoiceStore((s) => s.activeVoiceGuildName);
  const pingMs = useVoiceStore((s) => s.pingMs);
  const disconnectVoice = useVoiceStore((s) => s.disconnectVoice);

  const handleDisconnect = () => {
    const currentActiveVoiceId = useVoiceStore.getState().activeVoiceChannelId;
    disconnectVoice();
    const currentActiveChannelId = useUiStore.getState().activeChannelId;
    if (currentActiveChannelId === currentActiveVoiceId) {
      const activeGuildId = useUiStore.getState().activeGuildId;
      const guildChannels = (activeGuildId ? useSyncStore.getState().channelsByGuild[activeGuildId] : []) ?? [];
      const firstTextChannel = guildChannels.find((c) => c.type !== "voice");
      useUiStore.getState().setActiveChannel(firstTextChannel?.channelId ?? null);
    }
  };

  if (!isConnected && !isConnecting) {
    return null;
  }

  return (
    <div
      data-testid="voice-connection-bar"
      className="flex h-12 w-full shrink-0 items-center justify-between border-b border-bd-subtle bg-surf/95 px-3 backdrop-blur-md z-20 select-none animate-in fade-in-0 duration-150"
    >
      {/* Informações da Conexão */}
      <button
        type="button"
        onClick={onOpenVoiceSettings}
        className="cursor-pointer group flex items-center gap-2.5 min-w-0 text-left transition-all"
        title="Configurações de voz"
      >
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-online/10 text-online border border-online/20 shadow-xs">
          {isConnecting ? (
            <Broadcast size={15} className="animate-spin text-warn" />
          ) : (
            <>
              <SpeakerHigh size={15} weight="bold" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-online animate-pulse" />
            </>
          )}
        </div>

        <div className="flex flex-col min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-online group-hover:underline">
              {isConnecting ? "Conectando à voz..." : "Voz Conectada"}
            </span>
            <span className="font-mono text-[10px] text-mut/70 bg-white/[0.04] px-1 py-0.2 rounded border border-bd-subtle">
              {pingMs}ms
            </span>
          </div>
          <span className="truncate text-[11px] text-mut/80 group-hover:text-txt transition-colors">
            {activeVoiceGuildName ? `${activeVoiceGuildName} / ` : ""}#{activeVoiceChannelName ?? "voz"}
          </span>
        </div>
      </button>

      {/* Botão de Desconectar */}
      <button
        type="button"
        data-testid="voice-disconnect-btn"
        aria-label="Desconectar do canal de voz"
        title="Desconectar da chamada de voz"
        onClick={handleDisconnect}
        className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-xl text-err/80 bg-err/10 hover:bg-err hover:text-bg active:scale-95 transition-all shadow-xs"
      >
        <PhoneDisconnect size={16} weight="bold" />
      </button>
    </div>
  );
}

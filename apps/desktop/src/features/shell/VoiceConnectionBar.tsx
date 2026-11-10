"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { PhoneDisconnect, Broadcast, SpeakerHigh, Screencast, Sliders } from "@phosphor-icons/react";
import { useVoiceActivity } from "@/features/voice/useVoiceActivity";
import { usePushToTalk } from "@/features/voice/usePushToTalk";
import { matrixService } from "@/lib/matrix/instance";

export interface VoiceConnectionBarProps {
  onOpenVoiceSettings?: () => void;
}

export default function VoiceConnectionBar({ onOpenVoiceSettings }: VoiceConnectionBarProps) {
  const isConnected = useVoiceStore((s) => s.isConnected);
  const isConnecting = useVoiceStore((s) => s.isConnecting);
  const microphoneEnabled = useSettingsStore((s) => s.microphoneEnabled);
  const headphonesEnabled = useSettingsStore((s) => s.headphonesEnabled);
  const isMuted = !microphoneEnabled;
  const isDeafened = !headphonesEnabled;
  const setSpeaking = useVoiceStore((s) => s.setSpeaking);
  const setParticipantSpeaking = useVoiceStore((s) => s.setParticipantSpeaking);
  const myUserId = useUiStore((s) => s.myUserId);
  const effectiveUserId =
    myUserId || (typeof matrixService?.getUserId === "function" ? matrixService.getUserId() : "") || "me";
  const activeVoiceChannelName = useVoiceStore((s) => s.activeVoiceChannelName);
  const activeVoiceGuildName = useVoiceStore((s) => s.activeVoiceGuildName);
  const pingMs = useVoiceStore((s) => s.pingMs);
  const disconnectVoice = useVoiceStore((s) => s.disconnectVoice);
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const inputMode = useSettingsStore((s) => s.inputMode);

  usePushToTalk();

  useVoiceActivity({
    enabled: isConnected && !isMuted && !isDeafened && inputMode === "voice_activity",
    isMuted: isMuted || isDeafened,
    onSpeakingChange: (speaking) => {
      setSpeaking(speaking);
      if (effectiveUserId) {
        setParticipantSpeaking(effectiveUserId, speaking);
      }
      setParticipantSpeaking("me", speaking);
    },
  });

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

  const handleNavigateToVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    const voiceChannelId = useVoiceStore.getState().activeVoiceChannelId;
    if (voiceChannelId) {
      useUiStore.getState().setActiveChannel(voiceChannelId);
      const syncGuilds = useSyncStore.getState().guilds;
      for (const g of syncGuilds) {
        const channels = useSyncStore.getState().channelsByGuild[g.guildId] ?? [];
        if (channels.some((c) => c.channelId === voiceChannelId)) {
          useUiStore.getState().setActiveGuild(g.guildId);
          break;
        }
      }
    }
  };

  const handleToggleScreenShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("echo:toggle-screenshare"));
  };

  if (!isConnected && !isConnecting) {
    return null;
  }

  const pingColor =
    pingMs < 60
      ? "text-online bg-online/10 border-online/20"
      : pingMs < 120
        ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
        : "text-err bg-err/10 border-err/20";

  return (
    <div
      data-testid="voice-connection-bar"
      className="flex h-12 w-full shrink-0 items-center justify-between border-t border-b border-white/[0.08] bg-[#0c1017]/95 px-2.5 backdrop-blur-md z-20 select-none animate-in fade-in-0 slide-in-from-bottom-2 duration-150 shadow-sm"
    >
      {/* Informações da Conexão (Arrastável para outro canal de voz ou clique para navegar) */}
      <button
        type="button"
        draggable={true}
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData(
            "application/x-echo-voice-member",
            JSON.stringify({ userId: myUserId || "me", username: "Você", isMe: true }),
          );
          e.dataTransfer.setData("text/plain", myUserId || "me");
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={handleNavigateToVoice}
        className="cursor-pointer group flex items-center gap-2 min-w-0 text-left transition-all cursor-grab active:cursor-grabbing flex-1 mr-1"
        title="Arrastar para transferir de canal, ou clicar para visualizar a chamada"
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
              {isConnecting ? "Conectando..." : "Voz Conectada"}
            </span>
            <span className={`font-mono text-[9px] px-1 py-0.2 rounded border font-semibold ${pingColor}`}>
              {pingMs}ms
            </span>
          </div>
          <span className="truncate text-[11px] text-mut/80 group-hover:text-txt transition-colors">
            {activeVoiceGuildName ? `${activeVoiceGuildName} / ` : ""}#{activeVoiceChannelName ?? "voz"}
          </span>
        </div>
      </button>

      {/* Ações Rápidas: Tela e Desconectar */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleToggleScreenShare}
          title={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"}
          aria-label="Compartilhar tela"
          className={`cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
            isScreenSharing
              ? "bg-acc/20 text-acc border border-acc/30 shadow-xs"
              : "text-mut hover:text-txt hover:bg-white/[0.08]"
          }`}
        >
          <Screencast size={15} weight={isScreenSharing ? "bold" : "regular"} />
        </button>

        {onOpenVoiceSettings && (
          <button
            type="button"
            onClick={onOpenVoiceSettings}
            title="Configurações de Voz e Vídeo"
            aria-label="Configurações de Voz e Vídeo"
            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-all"
          >
            <Sliders size={15} />
          </button>
        )}

        <button
          type="button"
          data-testid="voice-disconnect-btn"
          aria-label="Desconectar do canal de voz"
          title="Desconectar da chamada de voz"
          onClick={handleDisconnect}
          className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-err/80 bg-err/10 hover:bg-err hover:text-bg active:scale-95 transition-all shadow-xs"
        >
          <PhoneDisconnect size={15} weight="bold" />
        </button>
      </div>
    </div>
  );
}

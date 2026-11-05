import { useState } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useSyncStore } from "@/stores/syncStore";
import { startSyncWiring } from "@/lib/matrix/wiring";
import MxcImage from "@/components/media/MxcImage";
import { CaretUp, Gear, Headphones, Microphone, MicrophoneSlash, ShieldCheck } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AudioDeviceQuickMenu from "./AudioDeviceQuickMenu";

export interface UserBarProps {
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenVoiceSettings?: () => void;
}

/**
 * Dock Inferior Persistente ("___") do Echo:
 * Integrada com harmonia geométrica sob o trilho e a barra lateral.
 * Superfície contínua com borda ultra-sutil e transições suaves.
 */
export default function UserBar({ onOpenProfile, onOpenSettings, onOpenVoiceSettings }: UserBarProps) {
  const myUserId = useUiStore((s) => s.myUserId);
  const username = useProfileStore((s) => s.username);
  const nickname = useProfileStore((s) => s.nickname);
  const displayName = useProfileStore((s) => s.displayName);
  const avatarUrl = useProfileStore((s) => s.avatarUrl);
  const appwriteAvatarUrl = useProfileStore((s) => s.appwriteAvatarUrl);
  const presence = useProfileStore((s) => s.presence);
  const customStatus = useProfileStore((s) => s.customStatus);

  const microphoneEnabled = useSettingsStore((s) => s.microphoneEnabled);
  const setMicrophoneEnabled = useSettingsStore((s) => s.setMicrophoneEnabled);
  const headphonesEnabled = useSettingsStore((s) => s.headphonesEnabled);
  const setHeadphonesEnabled = useSettingsStore((s) => s.setHeadphonesEnabled);

  const setSpeaking = useVoiceStore((s) => s.setSpeaking);
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const setParticipantMuted = useVoiceStore((s) => s.setParticipantMuted);
  const setParticipantDeafened = useVoiceStore((s) => s.setParticipantDeafened);

  const [audioQuickOpen, setAudioQuickOpen] = useState(false);

  const syncStatus = useSyncStore((s) => s.status);
  const guilds = useSyncStore((s) => s.guilds);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const guildProfiles = useSyncStore((s) =>
    activeGuildId && activeGuildId !== "home" && myUserId ? s.guildMemberProfiles[activeGuildId] : undefined,
  );
  const myGuildNick = myUserId && guildProfiles ? guildProfiles[myUserId]?.nickname : null;

  const effectiveAvatar = appwriteAvatarUrl ?? avatarUrl;
  const effectiveHandle = username || myUserId?.replace(/^@/, "").split(":")[0] || "";
  const effectiveName = myGuildNick || nickname || displayName || effectiveHandle || "Usuário";
  const userTag = effectiveHandle ? `@${effectiveHandle}` : "";

  const presenceColor =
    presence === "dnd"
      ? "bg-dnd"
      : presence === "idle"
        ? "bg-idle"
        : presence === "offline"
          ? "bg-offline"
          : "bg-online";

  const initial = effectiveName.charAt(0).toUpperCase();

  const isHome = activeGuildId === "home" || !activeGuildId;
  const activeGuild = guilds.find((g) => g.guildId === activeGuildId);
  const activeChannel = activeGuildId && activeChannelId
    ? (channelsByGuild[activeGuildId] ?? []).find((c) => c.channelId === activeChannelId)
    : null;

  return (
    <footer
      data-testid="user-bar"
      className="flex h-14 w-full shrink-0 items-center justify-between bg-userbar-bg/95 backdrop-blur-md text-txt z-30 select-none border-t border-bd-glass"
    >
      {/* Lado Esquerdo: Alinhamento natural com o Rail (72px) e Sidebar (232px) */}
      <div className="w-auto max-w-[calc(100vw-180px)] sm:w-[304px] shrink-0 h-full flex items-center min-w-0">
        {/* Extensão sutil da coluna do Rail (72px) com divisor discreto */}
        <div className="w-[72px] shrink-0 h-full flex items-center justify-center border-r border-bd-subtle" aria-hidden="true">
          <div className="h-1.5 w-1.5 rounded-full bg-acc/40" />
        </div>

        {/* Cápsula de Perfil sob a sidebar */}
        <div className="flex-1 min-w-0 h-full flex items-center px-2">
          <button
            type="button"
            onClick={onOpenProfile}
            title="Abrir perfil"
            className="cursor-pointer group flex h-10 w-full items-center gap-2.5 px-2 rounded-xl text-left transition-all dark:hover:bg-white/[0.05] hover:bg-black/[0.05] active:scale-[0.98]"
          >
            {/* Foto / Avatar do usuário com anel de presença e anel de fala */}
            <div className="relative shrink-0">
              {effectiveAvatar ? (
                <MxcImage
                  mxcUrl={effectiveAvatar}
                  alt={effectiveName}
                  className={`h-8 w-8 rounded-full object-cover transition-all shadow-sm ${
                    isSpeaking
                      ? "ring-2 ring-online shadow-sm shadow-online/50 animate-pulse"
                      : "ring-1 ring-bd-subtle group-hover:ring-acc/60"
                  }`}
                  width={32}
                  height={32}
                />
              ) : (
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full bg-acc font-display text-xs font-bold text-bg shadow-sm transition-all ${
                    isSpeaking
                      ? "ring-2 ring-online shadow-sm shadow-online/50 animate-pulse"
                      : ""
                  }`}
                >
                  {initial}
                </div>
              )}
              {/* Anel de presença com corte */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-userbar-bg ${presenceColor}`}
                aria-hidden="true"
              />
            </div>

            {/* Nome e @tag ou Status de Atividade */}
            <div className="flex-1 min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold text-txt group-hover:text-acc transition-colors">
                {effectiveName}
              </p>
              {customStatus ? (
                <p className="truncate text-[10px] text-acc/90 flex items-center gap-1 font-medium" title={customStatus.text}>
                  {customStatus.emoji && <span>{customStatus.emoji}</span>}
                  <span className="truncate">{customStatus.text}</span>
                </p>
              ) : (
                <p className="truncate text-[10px] text-mut/80 font-mono">{userTag}</p>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Centro: Indicador Contextual refinado */}
      <div className="hidden md:flex items-center gap-2 px-3.5 py-1 rounded-full dark:bg-white/[0.03] bg-card-bg/60 border border-bd-subtle text-xs text-mut max-w-sm truncate shadow-inner">
        {isHome ? (
          <div className="flex items-center gap-2 truncate">
            <ShieldCheck size={14} className="text-acc shrink-0" />
            <span className="font-medium text-txt/90 truncate">Echo</span>
            <span className="text-mut/40 shrink-0">•</span>
            <span className="text-mut/70 text-[11px] truncate">Rede Segura & Descentralizada</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-txt truncate">{activeGuild?.name ?? "Guilda"}</span>
            {activeChannel ? (
              <>
                <span className="text-mut/40 shrink-0">/</span>
                <span className="text-acc font-mono font-medium truncate">#{activeChannel.name}</span>
              </>
            ) : (
              <span className="text-mut/60 text-[11px] truncate">• Geral</span>
            )}
          </div>
        )}
      </div>

      {/* Lado Direito: Controles de Áudio, Conexão e Configurações */}
      <div className="flex items-center gap-1.5 px-3.5 shrink-0">
        <Popover open={audioQuickOpen} onOpenChange={setAudioQuickOpen}>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={microphoneEnabled ? "Silenciar microfone" : "Ativar microfone"}
              title={microphoneEnabled ? "Silenciar microfone (Botão direito para opções)" : "Ativar microfone (Botão direito para opções)"}
              onClick={() => {
                const next = !microphoneEnabled;
                setMicrophoneEnabled(next);
                if (!next) setSpeaking(false);
                if (myUserId) {
                  setParticipantMuted(myUserId, !next);
                  setParticipantMuted("me", !next);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setAudioQuickOpen(true);
              }}
              className={`cursor-pointer flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                microphoneEnabled
                  ? isSpeaking
                    ? "text-online bg-online/20 ring-1 ring-online/50 shadow-sm shadow-online/30 animate-pulse"
                    : "text-online bg-online/10 hover:bg-online/20"
                  : "text-err bg-err/10 hover:bg-err/20"
              }`}
            >
              {microphoneEnabled ? <Microphone size={18} weight="fill" /> : <MicrophoneSlash size={18} />}
            </button>

            <button
              type="button"
              aria-label={headphonesEnabled ? "Desativar áudio" : "Ativar áudio"}
              title={headphonesEnabled ? "Desativar áudio (Botão direito para opções)" : "Ativar áudio (Botão direito para opções)"}
              onClick={() => {
                const next = !headphonesEnabled;
                setHeadphonesEnabled(next);
                if (!next) setSpeaking(false);
                if (myUserId) {
                  setParticipantDeafened(myUserId, !next);
                  setParticipantDeafened("me", !next);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setAudioQuickOpen(true);
              }}
              className={`cursor-pointer flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                headphonesEnabled
                  ? "text-online bg-online/10 hover:bg-online/20"
                  : "text-err bg-err/10 hover:bg-err/20"
              }`}
            >
              <Headphones size={18} weight={headphonesEnabled ? "fill" : "regular"} />
            </button>

            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Opções rápidas de áudio"
                title="Opções de dispositivos de áudio"
                className="cursor-pointer flex h-9 w-4 items-center justify-center rounded-lg text-mut/60 hover:text-txt dark:hover:bg-white/[0.06] hover:bg-black/[0.06] transition-all -ml-0.5"
              >
                <CaretUp size={11} weight="bold" />
              </button>
            </PopoverTrigger>
          </div>

          <PopoverContent
            side="top"
            align="end"
            sideOffset={10}
            className="p-0 border-0 bg-transparent shadow-none w-auto"
          >
            <AudioDeviceQuickMenu
              onClose={() => setAudioQuickOpen(false)}
              onOpenVoiceSettings={() => {
                setAudioQuickOpen(false);
                if (onOpenVoiceSettings) {
                  onOpenVoiceSettings();
                } else if (onOpenSettings) {
                  onOpenSettings();
                }
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Indicador de Status Matrix integrado */}
        <button
          type="button"
          onClick={() => {
            if (syncStatus !== "syncing") {
              void startSyncWiring();
            }
          }}
          title={
            syncStatus === "syncing"
              ? "Rede Matrix: Conectado e sincronizado"
              : syncStatus === "connecting"
                ? "Conectando ao Matrix... Clique para tentar novamente"
                : "Desconectado da rede Matrix. Clique para reconectar"
          }
          aria-label={
            syncStatus === "syncing"
              ? "Status da rede: Conectado e sincronizado"
              : syncStatus === "connecting"
                ? "Status da rede: Conectando. Clique para tentar novamente"
                : "Status da rede: Desconectado. Clique para reconectar"
          }
          className="cursor-pointer hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg dark:bg-white/[0.03] bg-card-bg/60 dark:hover:bg-white/[0.06] hover:bg-card-bg text-[11px] text-mut border border-bd-subtle select-none transition-all active:scale-95 ml-1"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              syncStatus === "syncing"
                ? "bg-online shadow-[0_0_8px_rgba(20,218,166,0.6)]"
                : syncStatus === "connecting"
                  ? "bg-idle animate-pulse"
                  : "bg-err"
            }`}
          />
          <span className="font-mono text-[10px] text-txt/80">
            {syncStatus === "syncing" ? "Matrix Sync" : syncStatus === "connecting" ? "Syncing…" : "Offline"}
          </span>
        </button>

        <button
          type="button"
          aria-label="Configurações"
          title="Configurações"
          onClick={onOpenSettings}
          className="cursor-pointer group flex h-9 w-9 items-center justify-center rounded-xl text-mut dark:hover:bg-white/[0.06] hover:bg-black/[0.06] hover:text-txt transition-all ml-0.5"
        >
          <Gear size={18} className="transition-transform duration-300 group-hover:rotate-45" />
        </button>
      </div>
    </footer>
  );
}

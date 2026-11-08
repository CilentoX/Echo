import { useState } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useSyncStore } from "@/stores/syncStore";
import MxcImage from "@/components/media/MxcImage";
import { Gear, Headphones, Microphone, MicrophoneSlash } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AudioDeviceQuickMenu from "./AudioDeviceQuickMenu";

export interface UserBarProps {
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenVoiceSettings?: () => void;
}

/**
 * Dock Inferior Persistente do Echo (Padrão Discord):
 * Ancorada na base da Coluna 2 (Sidebar de 232px).
 * Exibe foto de perfil com anel de presença/fala, nome/handle,
 * controles de áudio (microfone e fone com mute/deafen) e acesso a configurações.
 */
export default function UserBar({ onOpenProfile, onOpenSettings, onOpenVoiceSettings }: UserBarProps) {
  const myUserId = useUiStore((s) => s.myUserId);
  const username = useProfileStore((s) => s.username);
  const nickname = useProfileStore((s) => s.nickname);
  const displayName = useProfileStore((s) => s.displayName);
  const avatarUrl = useProfileStore((s) => s.avatarUrl ?? s.appwriteAvatarUrl);
  const presence = useProfileStore((s) => s.presence);
  const customStatus = useProfileStore((s) => s.customStatus);

  const microphoneEnabled = useSettingsStore((s) => s.microphoneEnabled);
  const setMicrophoneEnabled = useSettingsStore((s) => s.setMicrophoneEnabled);
  const headphonesEnabled = useSettingsStore((s) => s.headphonesEnabled);
  const setHeadphonesEnabled = useSettingsStore((s) => s.setHeadphonesEnabled);

  const isConnected = useVoiceStore((s) => s.isConnected);
  const setSpeaking = useVoiceStore((s) => s.setSpeaking);
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const setParticipantMuted = useVoiceStore((s) => s.setParticipantMuted);
  const setParticipantDeafened = useVoiceStore((s) => s.setParticipantDeafened);

  // Usuário só é considerado falando se estiver conectado na call, com mic ativo e sem ensurdecimento
  const isUserSpeaking = isConnected && microphoneEnabled && headphonesEnabled && isSpeaking;

  const [audioQuickOpen, setAudioQuickOpen] = useState(false);

  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const guildProfiles = useSyncStore((s) =>
    activeGuildId && activeGuildId !== "home" && myUserId ? s.guildMemberProfiles[activeGuildId] : undefined,
  );
  const myGuildNick = myUserId && guildProfiles ? guildProfiles[myUserId]?.nickname : null;

  const effectiveAvatar = avatarUrl;
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

  return (
    <footer
      data-testid="user-bar"
      className="flex h-14 w-full shrink-0 items-center justify-between bg-userbar-bg/95 backdrop-blur-md text-txt z-30 select-none border-t border-bd-glass px-2"
    >
      {/* Cápsula de Perfil sob a sidebar */}
      <div className="flex-1 min-w-0 h-full flex items-center mr-1">
        <button
          type="button"
          onClick={onOpenProfile}
          title="Abrir perfil"
          className="cursor-pointer group flex h-10 w-full items-center gap-2 px-1.5 rounded-xl text-left transition-all dark:hover:bg-white/[0.05] hover:bg-black/[0.05] active:scale-[0.98] min-w-0"
        >
          {/* Foto / Avatar do usuário com anel de presença e anel de fala */}
          <div className="relative shrink-0">
            {effectiveAvatar ? (
              <MxcImage
                mxcUrl={effectiveAvatar}
                alt={effectiveName}
                className={`h-8 w-8 rounded-full object-cover transition-all shadow-sm ${
                  isUserSpeaking
                    ? "ring-2 ring-online shadow-sm shadow-online/50 animate-pulse"
                    : "ring-1 ring-bd-subtle group-hover:ring-acc/60"
                }`}
                width={32}
                height={32}
              />
            ) : (
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-acc font-display text-xs font-bold text-bg shadow-sm transition-all ${
                  isUserSpeaking
                    ? "ring-2 ring-online shadow-sm shadow-online/50 animate-pulse"
                    : ""
                }`}
              >
                {initial}
              </div>
            )}
            {/* Anel de presença com corte */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-userbar-bg ${presenceColor}`}
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

      {/* Controles de Áudio e Configurações */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Popover open={audioQuickOpen} onOpenChange={setAudioQuickOpen}>
          <PopoverTrigger asChild>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label={microphoneEnabled ? "Silenciar microfone" : "Ativar microfone"}
                title={microphoneEnabled ? "Silenciar microfone (Botão direito para opções)" : "Ativar microfone (Botão direito para opções)"}
                onClick={() => {
                  const next = !microphoneEnabled;
                  setMicrophoneEnabled(next);
                  if (myUserId) {
                    setParticipantMuted(myUserId, !next);
                  }
                  setParticipantMuted("me", !next);
                  if (!next) setSpeaking(false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setAudioQuickOpen(true);
                }}
                className={`cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  microphoneEnabled
                    ? isUserSpeaking
                      ? "text-online bg-online/20 ring-1 ring-online/50 shadow-sm shadow-online/30 animate-pulse"
                      : "text-online bg-online/10 hover:bg-online/20"
                    : "text-err bg-err/10 hover:bg-err/20"
                }`}
              >
                {microphoneEnabled ? <Microphone size={16} weight="fill" /> : <MicrophoneSlash size={16} />}
              </button>

              <button
                type="button"
                aria-label={headphonesEnabled ? "Desativar áudio" : "Ativar áudio"}
                title={headphonesEnabled ? "Desativar áudio (Botão direito para opções)" : "Ativar áudio (Botão direito para opções)"}
                onClick={() => {
                  const next = !headphonesEnabled;
                  setHeadphonesEnabled(next);
                  if (myUserId) {
                    setParticipantDeafened(myUserId, !next);
                  }
                  setParticipantDeafened("me", !next);
                  if (!next) setSpeaking(false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setAudioQuickOpen(true);
                }}
                className={`cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  headphonesEnabled
                    ? "text-online bg-online/10 hover:bg-online/20"
                    : "text-err bg-err/10 hover:bg-err/20"
                }`}
              >
                <Headphones size={16} weight={headphonesEnabled ? "fill" : "regular"} />
              </button>
            </div>
          </PopoverTrigger>

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

        <button
          type="button"
          aria-label="Configurações"
          title="Configurações"
          onClick={onOpenSettings}
          className="cursor-pointer group flex h-8 w-8 items-center justify-center rounded-lg text-mut dark:hover:bg-white/[0.06] hover:bg-black/[0.06] hover:text-txt transition-all"
        >
          <Gear size={16} className="transition-transform duration-300 group-hover:rotate-45" />
        </button>
      </div>
    </footer>
  );
}

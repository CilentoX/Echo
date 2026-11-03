import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import MxcImage from "@/components/media/MxcImage";
import { Gear, Headphones, Microphone, MicrophoneSlash } from "@phosphor-icons/react";

export interface UserBarProps {
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
}

export default function UserBar({ onOpenProfile, onOpenSettings }: UserBarProps) {
  const myUserId = useUiStore((s) => s.myUserId);
  const nickname = useProfileStore((s) => s.nickname);
  const displayName = useProfileStore((s) => s.displayName);
  const avatarUrl = useProfileStore((s) => s.avatarUrl);
  const appwriteAvatarUrl = useProfileStore((s) => s.appwriteAvatarUrl);
  const presence = useProfileStore((s) => s.presence);

  const microphoneEnabled = useSettingsStore((s) => s.microphoneEnabled);
  const setMicrophoneEnabled = useSettingsStore((s) => s.setMicrophoneEnabled);
  const headphonesEnabled = useSettingsStore((s) => s.headphonesEnabled);
  const setHeadphonesEnabled = useSettingsStore((s) => s.setHeadphonesEnabled);

  const effectiveAvatar = appwriteAvatarUrl ?? avatarUrl;
  const effectiveName = nickname || displayName || myUserId?.replace(/^@/, "").split(":")[0] || "Usuário";
  const userTag = myUserId ? `@${myUserId.replace(/^@/, "").split(":")[0]}` : "";

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
      className="flex h-14 shrink-0 items-center justify-between border-t border-bd bg-surf/80 px-2.5 backdrop-blur-md"
    >
      {/* Botão de Perfil */}
      <button
        type="button"
        onClick={onOpenProfile}
        title="Abrir perfil"
        className="cursor-pointer group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-surf2"
      >
        <div className="relative shrink-0">
          {effectiveAvatar ? (
            <MxcImage
              mxcUrl={effectiveAvatar}
              alt={effectiveName}
              className="h-8 w-8 rounded-full object-cover"
              width={32}
              height={32}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acc font-display text-xs font-bold text-bg">
              {initial}
            </div>
          )}
          {/* Anel de presença com corte */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surf ${presenceColor}`}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold text-txt group-hover:text-acc transition-colors">
            {effectiveName}
          </p>
          <p className="truncate text-[10px] text-mut">{userTag}</p>
        </div>
      </button>

      {/* Controles de Áudio e Configurações */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          aria-label={microphoneEnabled ? "Silenciar microfone" : "Ativar microfone"}
          title={microphoneEnabled ? "Silenciar microfone" : "Ativar microfone"}
          onClick={() => setMicrophoneEnabled(!microphoneEnabled)}
          className={`cursor-pointer flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            microphoneEnabled
              ? "text-mut hover:bg-surf2 hover:text-txt"
              : "text-err bg-err/10 hover:bg-err/20"
          }`}
        >
          {microphoneEnabled ? <Microphone size={16} /> : <MicrophoneSlash size={16} />}
        </button>

        <button
          type="button"
          aria-label={headphonesEnabled ? "Desativar áudio" : "Ativar áudio"}
          title={headphonesEnabled ? "Desativar áudio" : "Ativar áudio"}
          onClick={() => setHeadphonesEnabled(!headphonesEnabled)}
          className={`cursor-pointer flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            headphonesEnabled
              ? "text-mut hover:bg-surf2 hover:text-txt"
              : "text-err bg-err/10 hover:bg-err/20"
          }`}
        >
          <Headphones size={16} />
        </button>

        <button
          type="button"
          aria-label="Configurações"
          title="Configurações"
          onClick={onOpenSettings}
          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-md text-mut hover:bg-surf2 hover:text-txt transition-colors"
        >
          <Gear size={16} />
        </button>
      </div>
    </footer>
  );
}


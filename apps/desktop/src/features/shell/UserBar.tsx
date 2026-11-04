import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSyncStore } from "@/stores/syncStore";
import MxcImage from "@/components/media/MxcImage";
import { Gear, Headphones, Microphone, MicrophoneSlash, ShieldCheck } from "@phosphor-icons/react";

export interface UserBarProps {
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
}

/**
 * Dock Inferior Persistente ("___") do Echo:
 * Corre por toda a extensão horizontal inferior do app, complementando o trilho lateral ("|___").
 * Contém o perfil do usuário, indicador contextual e central de áudio/conectividade/configurações.
 */
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

  const syncStatus = useSyncStore((s) => s.status);
  const guilds = useSyncStore((s) => s.guilds);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);

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

  const isHome = activeGuildId === "home" || !activeGuildId;
  const activeGuild = guilds.find((g) => g.guildId === activeGuildId);
  const activeChannel = activeGuildId && activeChannelId
    ? (channelsByGuild[activeGuildId] ?? []).find((c) => c.channelId === activeChannelId)
    : null;

  return (
    <footer
      data-testid="user-bar"
      className="flex h-14 w-full shrink-0 items-center justify-between bg-rail text-txt z-30 select-none relative"
    >
      {/* Linha divisória superior que começa a partir de 72px (onde o conteúdo começa, fundindo o rail e a dock em uma só peça) */}
      <div className="absolute top-0 left-[72px] right-0 h-[1px] bg-bd/60" aria-hidden="true" />

      {/* Lado Esquerdo: Cápsula de Perfil ocupando exatamente a largura do rail + sidebar (304px) com borda divisória */}
      <div className="w-auto max-w-[calc(100vw-180px)] sm:w-[304px] shrink-0 h-full flex items-center min-w-0 border-r border-bd/60 relative">
        <button
          type="button"
          onClick={onOpenProfile}
          title="Abrir perfil"
          className="cursor-pointer group flex h-full w-full items-center text-left transition-colors hover:bg-surf2/40 active:scale-[0.99] rounded-lg my-1 mr-1"
        >
          {/* Avatar perfeitamente centralizado no eixo vertical do rail de 72px */}
          <div className="w-[72px] shrink-0 flex items-center justify-center">
            <div className="relative">
              {effectiveAvatar ? (
                <MxcImage
                  mxcUrl={effectiveAvatar}
                  alt={effectiveName}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-transparent group-hover:ring-acc/60 transition-all shadow-sm"
                  width={36}
                  height={36}
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-acc font-display text-xs font-bold text-bg shadow-sm">
                  {initial}
                </div>
              )}
              {/* Anel de presença com corte */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-rail ${presenceColor}`}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Nome e @tag preenchendo a coluna da sidebar (232px) com conforto e sem corte */}
          <div className="flex-1 min-w-0 pr-3 leading-tight">
            <p className="truncate text-xs font-semibold text-txt group-hover:text-acc transition-colors">
              {effectiveName}
            </p>
            <p className="truncate text-[10px] text-mut font-mono">{userTag}</p>
          </div>
        </button>
      </div>

      {/* Centro: Indicador Contextual (Home vs Guilda/Canal) */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-surf2/30 border border-bd/30 text-xs text-mut max-w-sm truncate">
        {isHome ? (
          <div className="flex items-center gap-1.5 truncate">
            <ShieldCheck size={14} className="text-acc shrink-0" />
            <span className="font-medium text-txt/90 truncate">Echo</span>
            <span className="text-bd shrink-0">•</span>
            <span className="text-mut text-[11px] truncate">Rede Segura & Descentralizada</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-txt truncate">{activeGuild?.name ?? "Guilda"}</span>
            {activeChannel && (
              <>
                <span className="text-bd shrink-0">/</span>
                <span className="text-acc font-mono font-medium truncate">#{activeChannel.name}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Lado Direito: Controles de Áudio, Conexão e Configurações */}
      <div className="flex items-center gap-1 px-3 shrink-0">
        <button
          type="button"
          aria-label={microphoneEnabled ? "Silenciar microfone" : "Ativar microfone"}
          title={microphoneEnabled ? "Silenciar microfone" : "Ativar microfone"}
          onClick={() => setMicrophoneEnabled(!microphoneEnabled)}
          className={`cursor-pointer flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
            microphoneEnabled
              ? "text-mut hover:bg-surf2 hover:text-txt"
              : "text-err bg-err/15 hover:bg-err/25"
          }`}
        >
          {microphoneEnabled ? <Microphone size={18} /> : <MicrophoneSlash size={18} />}
        </button>

        <button
          type="button"
          aria-label={headphonesEnabled ? "Desativar áudio" : "Ativar áudio"}
          title={headphonesEnabled ? "Desativar áudio" : "Ativar áudio"}
          onClick={() => setHeadphonesEnabled(!headphonesEnabled)}
          className={`cursor-pointer flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
            headphonesEnabled
              ? "text-mut hover:bg-surf2 hover:text-txt"
              : "text-err bg-err/15 hover:bg-err/25"
          }`}
        >
          <Headphones size={18} />
        </button>

        <div className="h-4 w-[1px] bg-bd/60 mx-1" aria-hidden="true" />

        {/* Indicador de Status Matrix integrado ao Dock */}
        <div
          title={`Status da rede: ${syncStatus}`}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surf2/40 text-[11px] text-mut border border-bd/30 select-none"
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
          <span className="font-mono text-[10px] text-txt/70">
            {syncStatus === "syncing" ? "Matrix Sync" : syncStatus === "connecting" ? "Syncing…" : "Offline"}
          </span>
        </div>

        <div className="h-4 w-[1px] bg-bd/60 mx-1" aria-hidden="true" />

        <button
          type="button"
          aria-label="Configurações"
          title="Configurações"
          onClick={onOpenSettings}
          className="cursor-pointer group flex h-9 w-9 items-center justify-center rounded-lg text-mut hover:bg-surf2 hover:text-txt transition-all"
        >
          <Gear size={18} className="transition-transform duration-300 group-hover:rotate-45" />
        </button>
      </div>
    </footer>
  );
}


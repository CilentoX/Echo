import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSyncStore } from "@/stores/syncStore";
import { startSyncWiring } from "@/lib/matrix/wiring";
import MxcImage from "@/components/media/MxcImage";
import { Gear, Headphones, Microphone, MicrophoneSlash, ShieldCheck } from "@phosphor-icons/react";

export interface UserBarProps {
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
}

/**
 * Dock Inferior Persistente ("___") do Echo:
 * Integrada com harmonia geométrica sob o trilho e a barra lateral.
 * Superfície contínua com borda ultra-sutil e transições suaves.
 */
export default function UserBar({ onOpenProfile, onOpenSettings }: UserBarProps) {
  const myUserId = useUiStore((s) => s.myUserId);
  const username = useProfileStore((s) => s.username);
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
  const effectiveHandle = username || myUserId?.replace(/^@/, "").split(":")[0] || "";
  const effectiveName = nickname || displayName || effectiveHandle || "Usuário";
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
      className="flex h-14 w-full shrink-0 items-center justify-between bg-[#0e121a]/95 backdrop-blur-md text-txt z-30 select-none border-t border-white/[0.06]"
    >
      {/* Lado Esquerdo: Alinhamento natural com o Rail (72px) e Sidebar (232px) */}
      <div className="w-auto max-w-[calc(100vw-180px)] sm:w-[304px] shrink-0 h-full flex items-center min-w-0">
        {/* Extensão sutil da coluna do Rail (72px) com divisor discreto */}
        <div className="w-[72px] shrink-0 h-full flex items-center justify-center border-r border-white/[0.04]" aria-hidden="true">
          <div className="h-1.5 w-1.5 rounded-full bg-acc/40" />
        </div>

        {/* Cápsula de Perfil sob a sidebar */}
        <div className="flex-1 min-w-0 h-full flex items-center px-2">
          <button
            type="button"
            onClick={onOpenProfile}
            title="Abrir perfil"
            className="cursor-pointer group flex h-10 w-full items-center gap-2.5 px-2 rounded-xl text-left transition-all hover:bg-white/[0.05] active:scale-[0.98]"
          >
            {/* Foto / Avatar do usuário com anel de presença */}
            <div className="relative shrink-0">
              {effectiveAvatar ? (
                <MxcImage
                  mxcUrl={effectiveAvatar}
                  alt={effectiveName}
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10 group-hover:ring-acc/60 transition-all shadow-sm"
                  width={32}
                  height={32}
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acc font-display text-xs font-bold text-bg shadow-sm">
                  {initial}
                </div>
              )}
              {/* Anel de presença com corte */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0e121a] ${presenceColor}`}
                aria-hidden="true"
              />
            </div>

            {/* Nome e @tag */}
            <div className="flex-1 min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold text-txt group-hover:text-acc transition-colors">
                {effectiveName}
              </p>
              <p className="truncate text-[10px] text-mut/80 font-mono">{userTag}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Centro: Indicador Contextual refinado */}
      <div className="hidden md:flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-mut max-w-sm truncate shadow-inner">
        {isHome ? (
          <div className="flex items-center gap-2 truncate">
            <ShieldCheck size={14} className="text-acc shrink-0" />
            <span className="font-medium text-txt/90 truncate">Echo</span>
            <span className="text-white/20 shrink-0">•</span>
            <span className="text-mut/70 text-[11px] truncate">Rede Segura & Descentralizada</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-txt truncate">{activeGuild?.name ?? "Guilda"}</span>
            {activeChannel && (
              <>
                <span className="text-white/20 shrink-0">/</span>
                <span className="text-acc font-mono font-medium truncate">#{activeChannel.name}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Lado Direito: Controles de Áudio, Conexão e Configurações */}
      <div className="flex items-center gap-1.5 px-3.5 shrink-0">
        <button
          type="button"
          aria-label={microphoneEnabled ? "Silenciar microfone" : "Ativar microfone"}
          title={microphoneEnabled ? "Silenciar microfone" : "Ativar microfone"}
          onClick={() => setMicrophoneEnabled(!microphoneEnabled)}
          className={`cursor-pointer flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            microphoneEnabled
              ? "text-mut hover:bg-white/[0.06] hover:text-txt"
              : "text-err bg-err/10 hover:bg-err/20"
          }`}
        >
          {microphoneEnabled ? <Microphone size={18} /> : <MicrophoneSlash size={18} />}
        </button>

        <button
          type="button"
          aria-label={headphonesEnabled ? "Desativar áudio" : "Ativar áudio"}
          title={headphonesEnabled ? "Desativar áudio" : "Ativar áudio"}
          onClick={() => setHeadphonesEnabled(!headphonesEnabled)}
          className={`cursor-pointer flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            headphonesEnabled
              ? "text-mut hover:bg-white/[0.06] hover:text-txt"
              : "text-err bg-err/10 hover:bg-err/20"
          }`}
        >
          <Headphones size={18} />
        </button>

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
          className="cursor-pointer hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-[11px] text-mut border border-white/[0.06] select-none transition-all active:scale-95 ml-1"
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
          className="cursor-pointer group flex h-9 w-9 items-center justify-center rounded-xl text-mut hover:bg-white/[0.06] hover:text-txt transition-all ml-0.5"
        >
          <Gear size={18} className="transition-transform duration-300 group-hover:rotate-45" />
        </button>
      </div>
    </footer>
  );
}

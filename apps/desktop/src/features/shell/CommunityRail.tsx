import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { Gear, User } from "@phosphor-icons/react";

/** Iniciais do nome da guilda (até 2 palavras) — guildas sem avatar (avatarUrl vem de mxc://, render na Fase 2). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export interface CommunityRailProps {
  onOpenProfile: () => void;
  onOpenSettings: () => void;
}

/** Community rail: the leftmost 72px column. It never disappears. */
export default function CommunityRail({ onOpenProfile, onOpenSettings }: CommunityRailProps) {
  const guilds = useSyncStore((state) => state.guilds);
  const activeGuildId = useUiStore((state) => state.activeGuildId);
  const setActiveGuild = useUiStore((state) => state.setActiveGuild);

  return (
    <nav
      data-column="rail"
      aria-label="Comunidades"
      className="flex h-full w-[72px] shrink-0 flex-col items-center gap-3 border-r border-bd bg-rail py-4"
    >
      {guilds.map((guild) => {
        const active = guild.guildId === activeGuildId;
        return (
          <div key={guild.guildId} className="relative">
            <button
              type="button"
              title={guild.name}
              aria-label={guild.name}
              aria-current={active ? "true" : undefined}
              onClick={() => setActiveGuild(guild.guildId)}
              className={`flex h-12 w-12 items-center justify-center rounded-full font-display text-sm transition-colors ${
                active
                  ? "bg-acc text-bg"
                  : "bg-surf2 text-mut hover:bg-acc-press hover:text-txt"
              }`}
            >
              {initials(guild.name)}
            </button>
            {guild.unreadCount > 0 && (
              <span
                aria-label={`${guild.unreadCount} não lidas em ${guild.name}`}
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-err px-1 text-[11px] font-bold text-bg"
              >
                {guild.unreadCount}
              </span>
            )}
          </div>
        );
      })}

      {/* Espaço empurra os itens de fundo para baixo */}
      <div className="flex-1" />

      <div className="flex flex-col items-center gap-2 px-2 pb-4">
        <button
          type="button"
          aria-label="Perfil"
          onClick={onOpenProfile}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surf2 text-mut hover:bg-acc hover:text-txt transition-colors"
        >
          <User size={16} weight="bold" />
        </button>
        <button
          type="button"
          aria-label="Configurações"
          onClick={onOpenSettings}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surf2 text-mut hover:bg-acc hover:text-txt transition-colors"
        >
          <Gear size={16} weight="bold" />
        </button>
      </div>
    </nav>
  );
}

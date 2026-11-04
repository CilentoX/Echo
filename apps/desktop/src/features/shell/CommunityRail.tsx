import { useState } from "react";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { Compass, Plus, SignIn } from "@phosphor-icons/react";
import CreateGuildModal from "@/features/guild/CreateGuildModal";
import JoinGuildModal from "@/features/guild/JoinGuildModal";
import GuildDropdownContent from "@/features/guild/GuildDropdownContent";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { matrixService } from "@/lib/matrix/instance";
import MxcImage from "@/components/media/MxcImage";

/** Iniciais do nome da guilda (até 2 palavras) — guildas sem avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Botão de guilda individual com dropdown próprio (estilo Discord: clique direito abre). */
function GuildButton({
  guild,
  active,
  onSelect,
}: {
  guild: { guildId: string; name: string; avatarUrl: string | null; unreadCount: number };
  active: boolean;
  onSelect: (guildId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleClick = () => {
    // Left-click: apenas seleciona a guilda, NÃO abre o dropdown
    onSelect(guild.guildId);
  };

  return (
    <div className="relative group flex items-center justify-center w-full">
      {/* Pill indicador ativo/hover */}
      <span
        className={`absolute left-0 w-1 rounded-r-full bg-white transition-all duration-200 ${
          active
            ? "h-10 opacity-100"
            : "h-0 opacity-0 group-hover:h-5 group-hover:opacity-100"
        }`}
      />

      <Popover open={open} onOpenChange={setOpen}>
        {/* Botão SEM PopoverTrigger — clique esquerdo só seleciona, clique direito abre dropdown */}
        <button
          type="button"
          title={guild.name}
          aria-label={guild.name}
          aria-current={active ? "true" : undefined}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          className={`cursor-pointer flex h-12 w-12 items-center justify-center font-display text-sm transition-all duration-200 overflow-hidden ${
            active
              ? "rounded-2xl bg-acc text-bg shadow-md shadow-acc/20"
              : "rounded-full bg-white/[0.04] text-mut hover:rounded-2xl hover:bg-white/[0.08] hover:text-txt"
          }`}
        >
          {guild.avatarUrl ? (
            <MxcImage
              mxcUrl={guild.avatarUrl}
              alt={guild.name}
              className="w-full h-full object-cover"
              width={48}
              height={48}
            />
          ) : (
            <span>{initials(guild.name)}</span>
          )}
        </button>

        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          className="w-64 p-2 bg-surf2 border border-bd text-txt shadow-2xl rounded-xl z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <GuildDropdownContent
            guildId={guild.guildId}
            guildName={guild.name}
            avatarUrl={guild.avatarUrl}
            unreadCount={guild.unreadCount}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>

      {guild.unreadCount > 0 && (
        <span
          aria-label={`${guild.unreadCount} não lidas em ${guild.name}`}
          className="absolute right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-err px-1 text-[11px] font-bold text-bg shadow-sm"
        >
          {guild.unreadCount}
        </span>
      )}
    </div>
  );
}

export interface CommunityRailProps {
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenCreate?: () => void;
  onOpenJoin?: () => void;
}

export default function CommunityRail({
  onOpenProfile: _onOpenProfile,
  onOpenSettings: _onOpenSettings,
  onOpenCreate,
  onOpenJoin,
}: CommunityRailProps) {
  const guilds = useSyncStore((s) => s.guilds);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const setActiveGuild = useUiStore((s) => s.setActiveGuild);
  const setActiveChannel = useUiStore((s) => s.setActiveChannel);
  const myUserId = useUiStore((s) => s.myUserId);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const handleCreated = (guild: { guildId: string; name: string; avatarUrl?: string | null; bannerUrl?: string | null }) => {
    useSyncStore.getState().setGuilds([
      ...guilds,
      {
        ...guild,
        avatarUrl: guild.avatarUrl ?? null,
        bannerUrl: guild.bannerUrl ?? null,
        unreadCount: 0,
      },
    ]);
    setActiveGuild(guild.guildId);
  };

  const handleJoined = (guild: { guildId: string; name: string }) => {
    if (!guilds.some((g) => g.guildId === guild.guildId)) {
      useSyncStore.getState().setGuilds([
        ...guilds,
        { guildId: guild.guildId, name: guild.name, avatarUrl: null, unreadCount: 0 },
      ]);
    }
    setActiveGuild(guild.guildId);
    setActiveChannel(null);
  };

  return (
    <nav
      data-column="rail"
      aria-label="Comunidades"
      className="flex h-full w-[72px] shrink-0 flex-col items-center gap-3 border-r border-white/[0.04] bg-[#0b0e14] py-3.5"
    >
      {/* Botão Home — fixo no topo da rail com pill indicador */}
      <div className="relative group flex items-center justify-center w-full">
        <span
          className={`absolute left-0 w-1 rounded-r-full bg-white transition-all duration-200 ${
            activeGuildId === "home"
              ? "h-10 opacity-100"
              : "h-0 opacity-0 group-hover:h-5 group-hover:opacity-100"
          }`}
        />
        <button
          type="button"
          aria-label="Home"
          title="Home"
          onClick={() => {
            setActiveGuild("home");
            setActiveChannel(null);
          }}
          className={`cursor-pointer flex h-12 w-12 items-center justify-center font-display text-sm transition-all duration-200 ${
            activeGuildId === "home"
              ? "rounded-2xl bg-acc text-bg shadow-md shadow-acc/20"
              : "rounded-full bg-white/[0.04] text-mut hover:rounded-2xl hover:bg-white/[0.08] hover:text-txt"
          }`}
        >
          <Compass size={20} aria-hidden />
        </button>
      </div>

      {/* Separador sutil */}
      <div className="w-8 h-[2px] bg-white/[0.06] rounded-full shrink-0 my-0.5" />

      {guilds.map((guild) => {
        const active = guild.guildId === activeGuildId;
        return (
          <GuildButton
            key={guild.guildId}
            guild={guild}
            active={active}
            onSelect={setActiveGuild}
          />
        );
      })}

      {/* Botão + cria guilda própria */}
      <button
        type="button"
        aria-label="Criar guilda"
        title="Criar guilda"
        onClick={() => (onOpenCreate ? onOpenCreate() : setCreateOpen(true))}
        className="cursor-pointer flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/[0.12] text-mut hover:border-acc hover:text-acc hover:bg-acc/5 transition-all active:scale-95"
      >
        <Plus size={20} aria-hidden />
      </button>

      {/* Botão entrar em guilda existente com convite */}
      <button
        type="button"
        aria-label="Entrar em uma guilda"
        title="Entrar em uma guilda (link ou código)"
        onClick={() => (onOpenJoin ? onOpenJoin() : setJoinOpen(true))}
        className="cursor-pointer flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/[0.12] text-mut hover:border-acc hover:text-acc hover:bg-acc/5 transition-all active:scale-95"
      >
        <SignIn size={20} aria-hidden />
      </button>

      {/* Espaço empurra os itens de fundo para baixo */}
      <div className="flex-1" />

      {/* Fallback de modais internos quando não controlados por parent */}
      {!onOpenCreate && (
        <CreateGuildModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreate={(data) =>
            matrixService.createGuild(data, myUserId || matrixService.getUserId() || "")
          }
          onCreated={handleCreated}
          onOpenJoin={() => {
            setCreateOpen(false);
            setJoinOpen(true);
          }}
        />
      )}

      {!onOpenJoin && (
        <JoinGuildModal
          open={joinOpen}
          onClose={() => setJoinOpen(false)}
          onJoined={handleJoined}
          onOpenCreate={() => {
            setJoinOpen(false);
            setCreateOpen(true);
          }}
        />
      )}
    </nav>
  );
}

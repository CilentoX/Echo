import { useState } from "react";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { Compass, Gear, Plus, User } from "@phosphor-icons/react";
import CreateGuildModal from "@/features/guild/CreateGuildModal";
import GuildDropdownContent from "@/features/guild/GuildDropdownContent";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { matrixService } from "@/lib/matrix/instance";

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
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        {/* Botão SEM PopoverTrigger — clique esquerdo só seleciona, clique direito abre dropdown */}
        <button
          type="button"
          title={guild.name}
          aria-label={guild.name}
          aria-current={active ? "true" : undefined}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          className={`cursor-pointer flex h-12 w-12 items-center justify-center rounded-full font-display text-sm transition-colors ${
            active
              ? "bg-acc text-bg"
              : "bg-surf2 text-mut hover:bg-acc-press hover:text-txt"
          }`}
        >
          {initials(guild.name)}
        </button>
        <PopoverContent
          side="right"
          sideOffset={8}
          align="start"
          className="w-auto p-0"
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
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-err px-1 text-[11px] font-bold text-bg"
        >
          {guild.unreadCount}
        </span>
      )}
    </div>
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
  const setActiveChannel = useUiStore((state) => state.setActiveChannel);
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreated = (guild: { guildId: string; name: string }) => {
    // Adiciona ao store (sem perder as existentes) e seleciona a nova guilda.
    useSyncStore.getState().setGuilds([...guilds, { ...guild, avatarUrl: null, unreadCount: 0 }]);
    setActiveGuild(guild.guildId);
  };

  return (
    <nav
      data-column="rail"
      aria-label="Comunidades"
      className="flex h-full w-[72px] shrink-0 flex-col items-center gap-3 border-r border-bd bg-rail py-4"
    >
      {/* Botão Home — fixo no topo da rail */}
      <button
        type="button"
        aria-label="Home"
        title="Home"
        onClick={() => {
          setActiveGuild("home");
          setActiveChannel(null);
        }}
        className={`cursor-pointer flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
          activeGuildId === "home"
            ? "bg-acc text-bg"
            : "bg-surf2 text-mut hover:bg-acc-press hover:text-txt"
        }`}
      >
        <Compass size={20} aria-hidden />
      </button>

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
        onClick={() => setCreateOpen(true)}
        className="cursor-pointer flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-bd text-mut transition-colors hover:border-acc hover:text-acc active:scale-95"
      >
        <Plus size={20} aria-hidden />
      </button>

      {/* Espaço empurra os itens de fundo para baixo */}
      <div className="flex-1" />

      <div className="flex flex-col items-center gap-2 px-2 pb-4">
        <button
          type="button"
          aria-label="Perfil"
          onClick={onOpenProfile}
          className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-full bg-surf2 text-mut hover:bg-acc hover:text-txt transition-colors active:scale-95"
        >
          <User size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Configurações"
          onClick={onOpenSettings}
          className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-full bg-surf2 text-mut hover:bg-acc hover:text-txt transition-colors active:scale-95"
        >
          <Gear size={16} aria-hidden />
        </button>
      </div>

      <CreateGuildModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(data) => matrixService.createGuild(data)}
        onCreated={handleCreated}
      />
    </nav>
  );
}

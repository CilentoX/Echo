import { useState } from "react";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { Compass, Gear, Plus, User } from "@phosphor-icons/react";
import CreateGuildModal from "@/features/guild/CreateGuildModal";
import GuildDropdownContent from "@/features/guild/GuildDropdownContent";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { matrixService } from "@/lib/matrix/instance";
import MxcImage from "@/components/media/MxcImage";

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
              ? "rounded-2xl bg-acc text-bg shadow-md"
              : "rounded-full bg-surf2 text-mut hover:rounded-2xl hover:bg-acc-press hover:text-txt"
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
            initials(guild.name)
          )}
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
          className="absolute right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-err px-1 text-[11px] font-bold text-bg shadow-sm"
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
  const myUserId = useUiStore((state) => state.myUserId);
  const nickname = useProfileStore((s) => s.nickname);
  const displayName = useProfileStore((s) => s.displayName);
  const avatarUrl = useProfileStore((s) => s.avatarUrl);
  const appwriteAvatarUrl = useProfileStore((s) => s.appwriteAvatarUrl);
  const presence = useProfileStore((s) => s.presence);

  const effectiveAvatar = appwriteAvatarUrl ?? avatarUrl;
  const effectiveName =
    nickname || displayName || (myUserId ? myUserId.replace(/^@/, "").split(":")[0] : "") || "Perfil";
  const userTag = myUserId ? `@${myUserId.replace(/^@/, "").split(":")[0]}` : "";
  const initial = (effectiveName || "U").charAt(0).toUpperCase();

  const presenceColor =
    presence === "dnd"
      ? "bg-dnd"
      : presence === "idle"
        ? "bg-idle"
        : presence === "offline"
          ? "bg-offline"
          : "bg-online";

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
              ? "rounded-2xl bg-acc text-bg shadow-md"
              : "rounded-full bg-surf2 text-mut hover:rounded-2xl hover:bg-acc-press hover:text-txt"
          }`}
        >
          <Compass size={20} aria-hidden />
        </button>
      </div>

      {/* Separador sutil */}
      <div className="w-8 h-[2px] bg-bd/60 rounded-full shrink-0 my-0.5" />

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
        {/* Trigger de Perfil estilo Discord com foto, presença e nome */}
        <div className="group/profile relative flex flex-col items-center">
          <button
            type="button"
            aria-label="Perfil"
            title={`${effectiveName} (${userTag})`}
            onClick={onOpenProfile}
            className="group relative cursor-pointer flex h-11 w-11 items-center justify-center rounded-full bg-surf2 transition-all duration-200 hover:ring-2 hover:ring-acc/80 hover:shadow-lg hover:shadow-acc/20 active:scale-95 overflow-visible"
          >
            {effectiveAvatar ? (
              <MxcImage
                mxcUrl={effectiveAvatar}
                alt={effectiveName}
                className="h-11 w-11 rounded-full object-cover"
                width={44}
                height={44}
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-acc font-display text-sm font-bold text-bg shadow-sm">
                {initial}
              </div>
            )}

            {/* Indicador de presença estilo Discord */}
            <span
              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-rail ${presenceColor} shadow-sm`}
              aria-hidden="true"
            />
          </button>

          {/* Nome de exibição sob o avatar */}
          <span className="mt-1 truncate max-w-[62px] text-[10px] font-medium text-txt/70 group-hover/profile:text-acc transition-colors text-center select-none leading-none">
            {effectiveName}
          </span>

          {/* Tooltip flutuante lateral estilo Discord */}
          <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-50 hidden rounded-md bg-surf px-2.5 py-1.5 shadow-xl border border-bd group-hover/profile:flex flex-col whitespace-nowrap">
            <span className="text-xs font-semibold text-txt">{effectiveName}</span>
            <span className="text-[10px] text-mut">{userTag} • Clique para ver perfil</span>
          </div>
        </div>

        {/* Botão de Configurações */}
        <button
          type="button"
          aria-label="Configurações"
          title="Configurações"
          onClick={onOpenSettings}
          className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-full bg-surf2 text-mut hover:bg-surf3 hover:text-txt transition-colors active:scale-95"
        >
          <Gear size={18} aria-hidden />
        </button>
      </div>

      <CreateGuildModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(data) => matrixService.createGuild(data, myUserId ?? "")}
        onCreated={handleCreated}
      />
    </nav>
  );
}

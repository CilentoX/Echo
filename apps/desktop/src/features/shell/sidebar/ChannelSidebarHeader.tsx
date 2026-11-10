import { useState } from "react";
import {
  Bell,
  BellSlash,
  CaretDown,
  Check,
  Copy,
  FolderSimplePlus,
  Gear,
  Pencil,
  Plus,
  SignOut,
  Trash,
  UserPlus,
  X,
} from "@phosphor-icons/react";
import MxcImage from "@/components/media/MxcImage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useUiStore } from "@/stores/uiStore";
import type { GuildSummary } from "@/lib/matrix/types";

interface ChannelSidebarHeaderProps {
  activeGuild: GuildSummary | null;
  canManageGuild: boolean;
  canManageChannels: boolean;
  isGuildOwner: boolean;
  overlay?: boolean;
  onClose?: () => void;
  onOpenCreateCategory: () => void;
  onOpenCreateChannel: () => void;
  onOpenInvite: () => void;
  onOpenSettings: () => void;
  isGuildMuted: (guildId: string) => boolean;
  muteGuild: (guildId: string, minutes?: number) => void;
  unmuteGuild: (guildId: string) => void;
  onDeleteGuild: () => void;
  onLeaveGuild: () => void;
}

export function ChannelSidebarHeader({
  activeGuild,
  canManageGuild,
  canManageChannels,
  isGuildOwner,
  overlay = false,
  onClose,
  onOpenCreateCategory,
  onOpenCreateChannel,
  onOpenInvite,
  onOpenSettings,
  isGuildMuted,
  muteGuild,
  unmuteGuild,
  onDeleteGuild,
  onLeaveGuild,
}: ChannelSidebarHeaderProps) {
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerCopied, setHeaderCopied] = useState(false);

  const handleCopyId = async () => {
    if (!activeGuild) return;
    try {
      await navigator.clipboard.writeText(activeGuild.guildId);
      setHeaderCopied(true);
      setTimeout(() => setHeaderCopied(false), 2000);
    } catch {}
  };

  if (!activeGuild) {
    return (
      <header className="flex h-12 items-center justify-between border-b border-bd-subtle px-4 group">
        <h1 className="truncate font-display text-sm font-semibold text-txt">
          Echo
        </h1>
      </header>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-bd-subtle bg-surf px-3 select-none z-10 cursor-context-menu">
          <div className="flex items-center gap-2 min-w-0 pr-1">
            {activeGuild.avatarUrl ? (
              <MxcImage
                mxcUrl={activeGuild.avatarUrl}
                alt={`Ícone de ${activeGuild.name}`}
                className="h-7 w-7 rounded-lg object-cover ring-1 ring-bd-subtle shadow-sm shrink-0"
                width={28}
                height={28}
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-acc text-bg font-display font-bold text-xs shadow-sm shrink-0">
                {activeGuild.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <h1 className="truncate font-display text-sm font-bold text-txt">
              {activeGuild.name}
            </h1>
            {isGuildMuted(activeGuild.guildId) && (
              <span title="Servidor Silenciado">
                <BellSlash size={13} className="shrink-0 text-amber-400" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canManageChannels && !overlay && (
              <button
                type="button"
                aria-label="Criar categoria"
                title="Criar categoria"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCreateCategory();
                }}
                className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] transition-all active:scale-95"
              >
                <FolderSimplePlus size={15} aria-hidden />
              </button>
            )}
            {!overlay && canManageChannels && (
              <button
                type="button"
                aria-label="Criar canal"
                title="Criar canal"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCreateChannel();
                }}
                className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] transition-all active:scale-95"
              >
                <Plus size={15} aria-hidden />
              </button>
            )}
            <Popover open={headerMenuOpen} onOpenChange={setHeaderMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Opções do servidor"
                  title="Opções do servidor"
                  className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] transition-all active:scale-95"
                >
                  <CaretDown
                    size={14}
                    weight="bold"
                    className={`transition-transform duration-200 ${
                      headerMenuOpen ? "rotate-180 text-txt" : ""
                    }`}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-56 p-1.5 rounded-2xl border border-white/[0.08] bg-[#12161f]/95 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 z-50"
              >
                <div className="px-2.5 py-1.5 font-semibold text-xs text-txt truncate border-b border-white/[0.06] mb-1">
                  {activeGuild.name}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    onOpenInvite();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-acc font-semibold hover:bg-acc/10 hover:text-acc-press transition-all cursor-pointer text-left"
                >
                  <UserPlus size={15} weight="bold" />
                  <span>Convidar Pessoas</span>
                </button>

                {(canManageGuild || canManageChannels) && (
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-mut hover:bg-white/[0.08] hover:text-txt transition-all cursor-pointer text-left"
                  >
                    <Gear size={15} weight="bold" />
                    <span>Configurações do Servidor</span>
                  </button>
                )}

                {canManageChannels && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        onOpenCreateChannel();
                      }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-mut hover:bg-white/[0.08] hover:text-txt transition-all cursor-pointer text-left"
                    >
                      <Plus size={15} weight="bold" />
                      <span>Criar Canal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        onOpenCreateCategory();
                      }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-mut hover:bg-white/[0.08] hover:text-txt transition-all cursor-pointer text-left"
                    >
                      <FolderSimplePlus size={15} weight="bold" />
                      <span>Criar Categoria</span>
                    </button>
                  </>
                )}

                <div className="h-[1px] bg-white/[0.06] my-1" />

                {/* Silenciar Servidor */}
                {isGuildMuted(activeGuild.guildId) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      unmuteGuild(activeGuild.guildId);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-online hover:bg-online/10 transition-all cursor-pointer text-left"
                  >
                    <Bell size={15} weight="bold" />
                    <span>Reativar Notificações</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      muteGuild(activeGuild.guildId);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-mut hover:bg-white/[0.08] hover:text-txt transition-all cursor-pointer text-left"
                  >
                    <BellSlash size={15} weight="bold" />
                    <span>Silenciar Servidor</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    useUiStore.getState().setProfileOpen(true, "profile");
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-mut hover:bg-white/[0.08] hover:text-txt transition-all cursor-pointer text-left"
                >
                  <Pencil size={15} weight="bold" />
                  <span>Editar Perfil no Servidor</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyId}
                  className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-mut hover:bg-white/[0.08] hover:text-txt transition-all cursor-pointer text-left"
                >
                  {headerCopied ? (
                    <>
                      <Check size={15} weight="bold" className="text-online" />
                      <span className="text-online font-medium">ID Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={15} weight="bold" />
                      <span>Copiar ID do Servidor</span>
                    </>
                  )}
                </button>

                <div className="h-[1px] bg-white/[0.06] my-1" />

                {isGuildOwner ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      onDeleteGuild();
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-err hover:bg-err/10 transition-all cursor-pointer font-medium text-left"
                  >
                    <Trash size={15} weight="bold" />
                    <span>Excluir Servidor</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      onLeaveGuild();
                    }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-err hover:bg-err/10 transition-all cursor-pointer font-medium text-left"
                  >
                    <SignOut size={15} weight="bold" />
                    <span>Sair do Servidor</span>
                  </button>
                )}
              </PopoverContent>
            </Popover>
            {overlay && (
              <button
                type="button"
                aria-label="Fechar canais"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose?.();
                }}
                className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] transition-all active:scale-95"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </header>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="truncate text-txt font-semibold">{activeGuild.name}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onOpenInvite}>
          <UserPlus size={15} weight="bold" className="text-acc" />
          <span>Convidar Pessoas</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onOpenSettings}>
          <Gear size={15} weight="bold" />
          <span>Configurações do Servidor</span>
        </ContextMenuItem>
        {canManageChannels && (
          <>
            <ContextMenuItem onClick={onOpenCreateChannel}>
              <Plus size={15} weight="bold" />
              <span>Criar Canal</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={onOpenCreateCategory}>
              <FolderSimplePlus size={15} weight="bold" />
              <span>Criar Categoria</span>
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        {isGuildMuted(activeGuild.guildId) ? (
          <ContextMenuItem
            onClick={() => unmuteGuild(activeGuild.guildId)}
            className="flex items-center gap-2 cursor-pointer text-online focus:text-online"
          >
            <Bell size={15} weight="bold" />
            <span>Reativar Notificações</span>
          </ContextMenuItem>
        ) : (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
              <BellSlash size={15} weight="bold" className="text-mut" />
              <span>Silenciar Servidor</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem onClick={() => muteGuild(activeGuild.guildId, 15)}>Por 15 minutos</ContextMenuItem>
              <ContextMenuItem onClick={() => muteGuild(activeGuild.guildId, 60)}>Por 1 hora</ContextMenuItem>
              <ContextMenuItem onClick={() => muteGuild(activeGuild.guildId, 480)}>Por 8 horas</ContextMenuItem>
              <ContextMenuItem onClick={() => muteGuild(activeGuild.guildId, 1440)}>Por 24 horas</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => muteGuild(activeGuild.guildId)}>Até eu reativar</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuItem onClick={() => useUiStore.getState().setProfileOpen(true, "profile")}>
          <Pencil size={15} weight="bold" />
          <span>Editar Perfil no Servidor</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => navigator.clipboard.writeText(activeGuild.guildId)}>
          <Copy size={15} weight="bold" />
          <span>Copiar ID do Servidor</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        {isGuildOwner ? (
          <ContextMenuItem
            destructive
            onClick={onDeleteGuild}
            className="flex items-center gap-2 cursor-pointer text-err focus:text-err"
          >
            <Trash size={15} weight="bold" />
            <span>Excluir Servidor</span>
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            destructive
            onClick={onLeaveGuild}
            className="flex items-center gap-2 cursor-pointer text-err focus:text-err"
          >
            <SignOut size={15} weight="bold" />
            <span>Sair do Servidor</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

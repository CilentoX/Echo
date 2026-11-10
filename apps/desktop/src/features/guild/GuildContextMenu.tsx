"use client";

import React, { useMemo, useState } from "react";
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
import {
  Bell,
  BellSlash,
  Checks,
  Copy,
  FolderSimplePlus,
  Gear,
  Pencil,
  PushPin,
  PushPinSlash,
  Plus,
  SignOut,
  Trash,
  UserPlus,
  Check,
} from "@phosphor-icons/react";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore, selectGuildRoles, selectUserGuildRoles } from "@/stores/syncStore";
import { matrixService } from "@/lib/matrix/instance";
import InviteModal from "./InviteModal";
import GuildSettingsModal from "./GuildSettingsModal";
import CreateChannelModal from "./CreateChannelModal";
import CreateCategoryModal from "./CreateCategoryModal";

export interface GuildContextMenuProps {
  guild: {
    guildId: string;
    name: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    description?: string | null;
    createdBy?: string | null;
    unreadCount?: number;
  };
  children: React.ReactNode;
}

/**
 * Menu de contexto (botão direito) completo para guildas/servidores (Padrão Discord).
 * Permite marcar como lida, convidar pessoas, silenciar notificações com sub-opções,
 * criar canais e categorias, abrir configurações, editar perfil e ações críticas (sair/excluir).
 */
export default function GuildContextMenu({ guild, children }: GuildContextMenuProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const myUserId = useUiStore((s) => s.myUserId);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const setActiveGuild = useUiStore((s) => s.setActiveGuild);
  const setActiveChannel = useUiStore((s) => s.setActiveChannel);
  const setProfileOpen = useUiStore((s) => s.setProfileOpen);

  const guilds = useSyncStore((s) => s.guilds);
  const setGuilds = useSyncStore((s) => s.setGuilds);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);
  const setChannels = useSyncStore((s) => s.setChannels);
  const createCategory = useSyncStore((s) => s.createCategory);
  const isGuildMuted = useSyncStore((s) => s.isGuildMuted);
  const muteGuild = useSyncStore((s) => s.muteGuild);
  const unmuteGuild = useSyncStore((s) => s.unmuteGuild);
  const pinGuild = useUiStore((s) => s.pinGuild);
  const unpinGuild = useUiStore((s) => s.unpinGuild);
  const pinnedGuilds = useUiStore((s) => s.pinnedGuilds);
  const isPinned = pinnedGuilds.includes(guild.guildId);

  // Informações completas em cache da guilda
  const storeGuild = guilds.find((g) => g.guildId === guild.guildId);
  const effectiveGuild = storeGuild ?? guild;
  const isMuted = isGuildMuted(guild.guildId);

  const effectiveUserId =
    myUserId || (typeof matrixService?.getUserId === "function" ? matrixService.getUserId() : "") || "";

  const guildRoles = useSyncStore(
    useMemo(() => selectGuildRoles(guild.guildId), [guild.guildId]),
  );
  const userRoleIds = useSyncStore(
    useMemo(() => selectUserGuildRoles(guild.guildId, effectiveUserId), [guild.guildId, effectiveUserId]),
  );

  const isGuildOwner = Boolean(
    effectiveGuild.createdBy &&
      effectiveUserId &&
      effectiveGuild.createdBy.toLowerCase() === effectiveUserId.toLowerCase()
  );

  const canManageChannels = Boolean(
    isGuildOwner ||
    ((guildRoles as any[]) || []).some((r) =>
      ((userRoleIds as string[]) || []).includes((r as any).roleId || r.id) &&
      (r.permissions?.includes("MANAGE_CHANNELS") ||
       r.permissions?.includes("MANAGE_GUILD") ||
       r.permissions?.includes("ADMINISTRATOR"))
    )
  );

  const unreadCount = effectiveGuild.unreadCount ?? guild.unreadCount ?? 0;

  const handleMarkAsRead = () => {
    // 1. Zera unreads da guilda
    setGuilds(
      guilds.map((g) => (g.guildId === guild.guildId ? { ...g, unreadCount: 0 } : g)),
    );
    // 2. Zera unreads dos canais da guilda
    const channels = channelsByGuild[guild.guildId] ?? [];
    if (channels.length > 0) {
      setChannels(
        guild.guildId,
        channels.map((c) => ({ ...c, unreadCount: 0 })),
      );
    }
  };

  const handleMute = (minutes?: number) => {
    muteGuild(guild.guildId, minutes);
  };

  const handleUnmute = () => {
    unmuteGuild(guild.guildId);
  };

  const handleEditServerProfile = () => {
    setActiveGuild(guild.guildId);
    setProfileOpen(true, "profile");
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(guild.guildId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleLeaveGuild = async () => {
    if (!window.confirm(`Tem certeza que deseja sair do servidor "${guild.name}"?`)) {
      return;
    }
    try {
      await matrixService.leaveGuild(guild.guildId);
      setGuilds(guilds.filter((g) => g.guildId !== guild.guildId));
      if (activeGuildId === guild.guildId) {
        setActiveGuild("home");
        setActiveChannel(null);
      }
    } catch (err) {
      console.error("Falha ao sair do servidor:", err);
    }
  };

  const handleDeleteGuild = async () => {
    if (
      !window.confirm(
        `Atenção: Tem certeza absoluta que deseja excluir permanentemente o servidor "${guild.name}"?`,
      )
    ) {
      return;
    }
    try {
      await matrixService.deleteGuild(guild.guildId);
      setGuilds(guilds.filter((g) => g.guildId !== guild.guildId));
      if (activeGuildId === guild.guildId) {
        setActiveGuild("home");
        setActiveChannel(null);
      }
    } catch (err) {
      console.error("Falha ao excluir o servidor:", err);
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

        <ContextMenuContent className="w-60">
          <ContextMenuLabel className="truncate text-txt font-semibold">
            {guild.name}
          </ContextMenuLabel>

          {unreadCount > 0 && (
            <ContextMenuItem
              onClick={handleMarkAsRead}
              className="flex items-center gap-2.5 cursor-pointer text-acc hover:text-acc-press focus:text-acc focus:bg-acc/10"
            >
              <Checks size={16} weight="bold" />
              <span className="font-medium">Marcar como lida</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {/* Convidar Pessoas com destaque Discord / Echo */}
          <ContextMenuItem
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2.5 cursor-pointer text-acc hover:text-acc-press focus:text-acc focus:bg-acc/10"
          >
            <UserPlus size={16} weight="bold" />
            <span className="font-semibold">Convidar Pessoas</span>
          </ContextMenuItem>

          {/* Silenciar Servidor */}
          {isMuted ? (
            <ContextMenuItem
              onClick={handleUnmute}
              className="flex items-center gap-2.5 cursor-pointer text-online focus:text-online"
            >
              <Bell size={16} weight="bold" />
              <span>Reativar Notificações</span>
            </ContextMenuItem>
          ) : (
            <ContextMenuSub>
              <ContextMenuSubTrigger className="flex items-center gap-2.5 cursor-pointer">
                <BellSlash size={16} weight="bold" className="text-mut" />
                <span>Silenciar Servidor</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44">
                <ContextMenuItem onClick={() => handleMute(15)}>Por 15 minutos</ContextMenuItem>
                <ContextMenuItem onClick={() => handleMute(60)}>Por 1 hora</ContextMenuItem>
                <ContextMenuItem onClick={() => handleMute(480)}>Por 8 horas</ContextMenuItem>
                <ContextMenuItem onClick={() => handleMute(1440)}>Por 24 horas</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleMute()}>Até eu reativar</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          {/* Criação de Canais, Categorias e Configurações da Guilda (apenas se for dono ou tiver permissão de gerenciar canais) */}
          {canManageChannels && (
            <>
              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => setCreateChannelOpen(true)}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <Plus size={16} weight="bold" className="text-mut" />
                <span>Criar Canal</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => setCreateCategoryOpen(true)}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <FolderSimplePlus size={16} weight="bold" className="text-mut" />
                <span>Criar Categoria</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <Gear size={16} weight="bold" className="text-mut" />
                <span>Configurações do Servidor</span>
              </ContextMenuItem>
            </>
          )}

          {/* Editar Perfil no Servidor */}
          <ContextMenuItem
            onClick={handleEditServerProfile}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <Pencil size={16} weight="bold" className="text-mut" />
            <span>Editar Perfil no Servidor</span>
          </ContextMenuItem>

          {/* Copiar ID do Servidor */}
          <ContextMenuItem
            onClick={handleCopyId}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={16} weight="bold" className="text-online" />
                <span className="text-online font-medium">ID Copiado!</span>
              </>
            ) : (
              <>
                <Copy size={16} weight="bold" className="text-mut" />
                <span>Copiar ID do Servidor</span>
              </>
            )}
          </ContextMenuItem>

          {/* Fixar/Desafixar na Dock de Acesso Rápido */}
          <ContextMenuItem
            onClick={() => isPinned ? unpinGuild(guild.guildId) : pinGuild(guild.guildId)}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            {isPinned ? (
              <>
                <PushPinSlash size={16} weight="bold" className="text-amber-400" />
                <span>Desafixar da Dock</span>
              </>
            ) : (
              <>
                <PushPin size={16} weight="bold" className="text-acc" />
                <span>Fixar na Dock</span>
              </>
            )}
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Ações Destrutivas (Sair ou Excluir) */}
          {isGuildOwner ? (
            <ContextMenuItem
              destructive
              onClick={handleDeleteGuild}
              className="flex items-center gap-2.5 cursor-pointer text-err focus:text-err focus:bg-err/10"
            >
              <Trash size={16} weight="bold" />
              <span>Excluir Servidor</span>
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              destructive
              onClick={handleLeaveGuild}
              className="flex items-center gap-2.5 cursor-pointer text-err focus:text-err focus:bg-err/10"
            >
              <SignOut size={16} weight="bold" />
              <span>Sair do Servidor</span>
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Modais de suporte da guilda */}
      <InviteModal
        open={inviteOpen}
        guildId={guild.guildId}
        guildName={guild.name}
        onClose={() => setInviteOpen(false)}
      />

      <GuildSettingsModal
        open={settingsOpen}
        guild={{
          guildId: guild.guildId,
          name: guild.name,
          avatarUrl: effectiveGuild.avatarUrl,
          bannerUrl: effectiveGuild.bannerUrl,
          description: effectiveGuild.description,
          createdBy: (effectiveGuild as any).createdBy,
        }}
        onClose={() => setSettingsOpen(false)}
      />

      <CreateChannelModal
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        guildId={guild.guildId}
        onCreate={(data) => matrixService.createChannel(guild.guildId, data)}
        onCreated={(channel) => {
          setCreateChannelOpen(false);
          const current = channelsByGuild[guild.guildId] ?? [];
          setChannels(guild.guildId, [{ ...channel, unreadCount: 0 }, ...current]);
          setActiveGuild(guild.guildId);
          setActiveChannel(channel.channelId);
        }}
      />

      <CreateCategoryModal
        open={createCategoryOpen}
        guildId={guild.guildId}
        onClose={() => setCreateCategoryOpen(false)}
        onCreateCategory={(catName) => {
          setCreateCategoryOpen(false);
          createCategory(guild.guildId, catName);
        }}
      />
    </>
  );
}


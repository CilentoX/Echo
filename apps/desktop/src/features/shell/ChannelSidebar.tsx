import { Hash, MagnifyingGlass, Gear, Plus, SpeakerHigh, UserPlus, X } from "@phosphor-icons/react";
import { useMemo, useState, useEffect } from "react";
import EmptyState from "./EmptyState";
import {
  selectChannels,
  selectGuilds,
  useSyncStore,
} from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { matrixService } from "@/lib/matrix/instance";
import CreateChannelModal from "@/features/guild/CreateChannelModal";
import GuildSettingsModal from "@/features/guild/GuildSettingsModal";
import InviteModal from "@/features/guild/InviteModal";
import MxcImage from "@/components/media/MxcImage";

export interface ChannelSidebarProps {
  /** `overlay` floats above the chat below 900px; `static` is the docked column. */
  variant?: "static" | "overlay";
  onClose?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
}

/** Channel sidebar: 232px column listing the active community's text channels. */
export default function ChannelSidebar({
  variant = "static",
  onClose,
  onOpenProfile: _onOpenProfile,
  onOpenSettings: _onOpenSettings,
}: ChannelSidebarProps) {
  const overlay = variant === "overlay";

  const guilds = useSyncStore(selectGuilds);
  const activeGuildId = useUiStore((state) => state.activeGuildId);
  const activeChannelId = useUiStore((state) => state.activeChannelId);
  const setActiveChannel = useUiStore((state) => state.setActiveChannel);
  const setChannels = useSyncStore((state) => state.setChannels);

  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [editGuildOpen, setEditGuildOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");

  // Seletores devolvem snapshot vazio estável em miss (sem loop no useSyncExternalStore).
  const allChannels = useSyncStore(
    useMemo(() => selectChannels(activeGuildId ?? ""), [activeGuildId]),
  );

  // Filtra canais pela busca (sem criar funções de negócio novas — só filtro de UI).
  const channels = useMemo(() => {
    const q = channelSearch.toLowerCase().trim();
    if (!q) return allChannels;
    return allChannels.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.topic ?? "").toLowerCase().includes(q),
    );
  }, [allChannels, channelSearch]);

  const activeGuild = guilds.find((g) => g.guildId === activeGuildId) ?? null;

  // Busca o banner e detalhes adicionais da guilda caso ainda não estejam em cache
  useEffect(() => {
    if (!activeGuildId || activeGuildId === "home") return;
    if (activeGuild && activeGuild.bannerUrl === undefined) {
      if (typeof matrixService.getGuildProfile === "function") {
        void matrixService
          .getGuildProfile(activeGuildId)
          .then((profile) => {
            if (profile?.bannerUrl) {
              useSyncStore.getState().setGuilds(
                useSyncStore.getState().guilds.map((g) =>
                  g.guildId === activeGuildId
                    ? {
                        ...g,
                        bannerUrl: profile.bannerUrl,
                        avatarUrl: profile.avatarUrl ?? g.avatarUrl,
                        description: profile.description ?? g.description,
                      }
                    : g,
                ),
              );
            }
          })
          .catch(() => {});
      }
    }
  }, [activeGuildId, activeGuild]);

  const handleEditGuild = async (
    updates: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ) => {
    if (!activeGuildId) return;
    await matrixService.editGuild(activeGuildId, updates);
    // Atualiza os dados localmente no store para feedback imediato.
    useSyncStore.getState().setGuilds(
      guilds.map((g) => {
        if (g.guildId !== activeGuildId) return g;
        return {
          ...g,
          name: updates.name,
          avatarUrl: updates.iconUrl !== undefined ? updates.iconUrl : g.avatarUrl,
          bannerUrl: updates.bannerUrl !== undefined ? updates.bannerUrl : g.bannerUrl,
          description: updates.description !== undefined ? updates.description : g.description,
        };
      }),
    );
  };

  return (
    <aside
      data-column="sidebar"
      aria-label="Canais"
      className={`flex w-[232px] shrink-0 flex-col border-r border-white/[0.04] bg-[#10141d] ${
        overlay
          ? "fixed inset-y-0 left-[72px] z-20 shadow-2xl shadow-black/80"
          : "h-full"
      }`}
    >
      {/* Header com Banner da Guilda quando houver bannerUrl */}
      {activeGuild?.bannerUrl ? (
        <div className="relative h-32 w-full shrink-0 overflow-hidden border-b border-white/[0.04] group/banner">
          {/* Imagem do Banner com Zoom Suave no Hover */}
          <MxcImage
            mxcUrl={activeGuild.bannerUrl}
            alt={activeGuild.name}
            className="h-full w-full object-cover group-hover/banner:scale-105 transition-transform duration-500"
            width={232}
            height={128}
          />

          {/* Gradientes de Fusão e Legibilidade */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10141d] via-[#10141d]/50 to-transparent pointer-events-none" />

          {/* Botão Fechar em Modo Overlay */}
          {overlay && (
            <button
              type="button"
              aria-label="Fechar canais"
              onClick={onClose}
              className="cursor-pointer absolute top-2 right-2 rounded-lg p-1 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-md active:scale-95 transition-all z-10"
            >
              <X size={16} />
            </button>
          )}

          {/* Conteúdo Sobreposto na Base do Banner */}
          <div className="absolute inset-x-0 bottom-0 p-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-2 min-w-0 pr-1">
              {activeGuild.avatarUrl ? (
                <MxcImage
                  mxcUrl={activeGuild.avatarUrl}
                  alt={activeGuild.name}
                  className="h-7 w-7 rounded-lg object-cover ring-2 ring-[#10141d] shadow-md shrink-0"
                  width={28}
                  height={28}
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-acc text-bg font-display font-bold text-xs shadow-md shrink-0 ring-2 ring-[#10141d]">
                  {activeGuild.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <h1 className="truncate font-display text-sm font-bold text-white drop-shadow-md">
                {activeGuild.name}
              </h1>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                aria-label="Convidar pessoas"
                title="Convidar pessoas"
                onClick={() => setInviteOpen(true)}
                className="cursor-pointer flex items-center rounded-lg p-1 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all active:scale-95 border border-white/10"
              >
                <UserPlus size={13} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Configurações do servidor"
                title="Configurações do servidor"
                onClick={() => setEditGuildOpen(true)}
                className="cursor-pointer flex items-center rounded-lg p-1 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all active:scale-95 border border-white/10"
              >
                <Gear size={13} aria-hidden />
              </button>
              {!overlay && (
                <button
                  type="button"
                  aria-label="Criar canal"
                  title="Criar canal"
                  onClick={() => setCreateChannelOpen(true)}
                  className="cursor-pointer flex items-center rounded-lg p-1 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all active:scale-95 border border-white/10"
                >
                  <Plus size={13} aria-hidden />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <header className="flex h-14 items-center justify-between border-b border-white/[0.04] px-4 group">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-sm font-semibold text-txt">
              {activeGuild ? activeGuild.name : "Echo"}
            </h1>
            {activeGuild && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Convidar pessoas"
                  title="Convidar pessoas"
                  onClick={() => setInviteOpen(true)}
                  className="cursor-pointer flex items-center rounded-lg p-1 text-mut/70 hover:bg-white/[0.06] hover:text-txt transition-colors active:scale-95"
                >
                  <UserPlus size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Configurações do servidor"
                  title="Configurações do servidor"
                  onClick={() => setEditGuildOpen(true)}
                  className="cursor-pointer flex items-center rounded-lg p-1 text-mut/70 hover:bg-white/[0.06] hover:text-txt transition-colors active:scale-95"
                >
                  <Gear size={14} aria-hidden />
                </button>
              </div>
            )}
          </div>
          {overlay && (
            <button
              type="button"
              aria-label="Fechar canais"
              onClick={onClose}
              className="cursor-pointer flex items-center rounded-lg p-1 text-mut hover:bg-white/[0.06] hover:text-txt transition-colors active:scale-95"
            >
              <X size={18} />
            </button>
          )}
          {!overlay && activeGuild && (
            <button
              type="button"
              aria-label="Criar canal"
              title="Criar canal"
              onClick={() => setCreateChannelOpen(true)}
              className="cursor-pointer flex items-center rounded-lg p-1.5 text-mut/70 hover:bg-white/[0.06] hover:text-txt transition-colors active:scale-95"
            >
              <Plus size={15} aria-hidden />
            </button>
          )}
        </header>
      )}

      {guilds.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="border-b border-white/[0.04] px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5 text-mut/70 group focus-within:bg-white/[0.06] focus-within:border-acc/40 transition-all">
              <MagnifyingGlass size={13} aria-hidden />
              <input
                type="search"
                placeholder="Buscar canais"
                aria-label="Buscar canais"
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-txt outline-none placeholder:text-mut/50 group-focus-within:text-txt"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            <section>
              <h2 className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mut/60">
                Canais de texto
              </h2>
              <ul className="space-y-0.5 mt-1">
                {channels.map((channel) => {
                  const active = channel.channelId === activeChannelId;
                  return (
                    <li key={channel.channelId}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setActiveChannel(channel.channelId)}
                        className={`cursor-pointer flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-all ${
                          active
                            ? "bg-white/[0.08] text-txt font-semibold shadow-sm"
                            : "text-mut hover:bg-white/[0.04] hover:text-txt"
                        }`}
                      >
                        <Hash size={15} className={`shrink-0 ${active ? "text-acc" : "text-mut/60"}`} aria-hidden />
                        <span className={`truncate ${active ? "text-txt" : "text-mut"}`}>
                          {channel.name}
                        </span>
                        {channel.type === "voice" && (
                          <span
                            className="ml-1 text-[10px] font-medium text-acc bg-acc/10 px-1.5 py-0.5 rounded border border-acc/20"
                            aria-label="Canal de voz"
                          >
                            <SpeakerHigh size={10} aria-hidden />
                          </span>
                        )}
                        {channel.category && (
                          <span
                            className="ml-1 text-[10px] text-mut/60"
                            aria-label={`Categoria: ${channel.category}`}
                          >
                            • {channel.category}
                          </span>
                        )}
                        {channel.unreadCount > 0 && (
                          <span
                            aria-label={`${channel.unreadCount} não lidas em ${channel.name}`}
                            className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-err px-1 text-[10px] font-bold text-bg"
                          >
                            {channel.unreadCount}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </>
      )}

      <CreateChannelModal
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        guildId={activeGuildId ?? ""}
        onCreate={(data) =>
          matrixService.createChannel(activeGuildId ?? "", data)
        }
        onCreated={(channel) => {
          setActiveChannel(channel.channelId);
          const currentChannels = useSyncStore.getState().channelsByGuild[activeGuildId ?? ""] ?? [];
          setChannels(activeGuildId ?? "", [
            { ...channel, unreadCount: 0 },
            ...currentChannels,
          ]);
        }}
      />
      <GuildSettingsModal
        open={editGuildOpen}
        onClose={() => setEditGuildOpen(false)}
        guild={{
          guildId: activeGuild?.guildId ?? "",
          name: activeGuild?.name ?? "",
          avatarUrl: activeGuild?.avatarUrl ?? null,
          bannerUrl: activeGuild?.bannerUrl ?? null,
          description: activeGuild?.description ?? null,
          createdBy: (activeGuild as any)?.createdBy ?? null,
        }}
        onSave={handleEditGuild}
      />

      {activeGuild && (
        <InviteModal
          open={inviteOpen}
          guildId={activeGuild.guildId}
          guildName={activeGuild.name}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </aside>
  );
}

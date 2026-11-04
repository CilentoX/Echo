import { Hash, MagnifyingGlass, Pencil, Plus, SpeakerHigh, UserPlus, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import EmptyState from "./EmptyState";
import {
  selectChannels,
  selectGuilds,
  useSyncStore,
} from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { matrixService } from "@/lib/matrix/instance";
import CreateChannelModal from "@/features/guild/CreateChannelModal";
import EditGuildModal from "@/features/guild/EditGuildModal";
import InviteModal from "@/features/guild/InviteModal";

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
          avatarUrl: updates.iconUrl ?? g.avatarUrl,
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
                aria-label="Editar guilda"
                title="Editar guilda"
                onClick={() => setEditGuildOpen(true)}
                className="cursor-pointer flex items-center rounded-lg p-1 text-mut/70 hover:bg-white/[0.06] hover:text-txt transition-colors active:scale-95"
              >
                <Pencil size={14} aria-hidden />
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
      <EditGuildModal
        open={editGuildOpen}
        onClose={() => setEditGuildOpen(false)}
        guild={{
          guildId: activeGuild?.guildId ?? "",
          name: activeGuild?.name ?? "",
          avatarUrl: activeGuild?.avatarUrl ?? null,
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

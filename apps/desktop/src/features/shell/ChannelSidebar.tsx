import { Hash, MagnifyingGlass, Pencil, Plus, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import EmptyState from "./EmptyState";
import { selectChannels, selectGuilds, useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { matrixService } from "@/lib/matrix/instance";
import CreateChannelModal from "@/features/guild/CreateChannelModal";
import EditGuildModal from "@/features/guild/EditGuildModal";

export interface ChannelSidebarProps {
  /** `overlay` floats above the chat below 900px; `static` is the docked column. */
  variant?: "static" | "overlay";
  onClose?: () => void;
}

/** Channel sidebar: 232px column listing the active community's text channels. */
export default function ChannelSidebar({
  variant = "static",
  onClose,
}: ChannelSidebarProps) {
  const overlay = variant === "overlay";

  const guilds = useSyncStore(selectGuilds);
  const activeGuildId = useUiStore((state) => state.activeGuildId);
  const activeChannelId = useUiStore((state) => state.activeChannelId);
  const setActiveChannel = useUiStore((state) => state.setActiveChannel);

  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [editGuildOpen, setEditGuildOpen] = useState(false);

  // Seletores devolvem snapshot vazio estável em miss (sem loop no useSyncExternalStore).
  const channels = useSyncStore(
    useMemo(() => selectChannels(activeGuildId ?? ""), [activeGuildId]),
  );

  const activeGuild = guilds.find((g) => g.guildId === activeGuildId) ?? null;

  const handleEditGuild = async (updates: { name: string }) => {
    if (!activeGuildId) return;
    await matrixService.editGuild(activeGuildId, updates.name);
    // Atualiza o nome localmente no store para feedback imediato.
    useSyncStore.getState().setGuilds(
      guilds.map((g) =>
        g.guildId === activeGuildId ? { ...g, name: updates.name } : g,
      ),
    );
  };

  return (
    <aside
      data-column="sidebar"
      aria-label="Canais"
      className={`flex w-[232px] shrink-0 flex-col border-r border-bd bg-rail ${
        overlay
          ? "fixed inset-y-0 left-[72px] z-20 shadow-lg shadow-black/60"
          : "h-full"
      }`}
    >
      <header className="flex items-center justify-between border-b border-bd px-4 py-3 group">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-display text-base font-semibold text-txt">
            {activeGuild ? activeGuild.name : "Echo"}
          </h1>
          {activeGuild && (
            <button
              type="button"
              aria-label="Editar guilda"
              title="Editar guilda"
              onClick={() => setEditGuildOpen(true)}
              className="cursor-pointer flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt transition-colors active:scale-95"
            >
              <Pencil size={14} weight="bold" aria-hidden />
            </button>
          )}
        </div>
        {overlay && (
          <button
            type="button"
            aria-label="Fechar canais"
            onClick={onClose}
            className="cursor-pointer flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt transition-colors active:scale-95"
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
            className="cursor-pointer flex items-center rounded p-1.5 text-mut hover:bg-surf2 hover:text-txt transition-colors active:scale-95"
          >
            <Plus size={16} weight="bold" aria-hidden />
          </button>
        )}
      </header>

      {guilds.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="border-b border-bd px-3 py-2">
            <div className="flex items-center gap-2 rounded bg-surf2 px-2 py-1.5 text-mut group">
              <MagnifyingGlass size={14} aria-hidden />
              <input
                type="search"
                placeholder="Buscar canais"
                aria-label="Buscar canais"
                className="w-full bg-transparent text-sm text-txt outline-none placeholder:text-mut group-focus-within:text-txt"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            {/* Fase 1: só canais de texto (sem prefixo de tipo); voz chega na Fase 2. */}
            <section>
              <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-mut">
                Canais de texto
              </h2>
              <ul>
                {channels.map((channel) => {
                  const active = channel.channelId === activeChannelId;
                  return (
                    <li key={channel.channelId}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setActiveChannel(channel.channelId)}
                        className={`cursor-pointer flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-all duration-200 ${
                          active
                            ? "bg-surf2 text-txt"
                            : "text-mut hover:bg-surf2 hover:text-txt"
                        }`}
                      >
                        <Hash size={16} className="shrink-0 text-mut" aria-hidden />
                        <span className="truncate">{channel.name}</span>
                        {channel.unreadCount > 0 && (
                          <span
                            aria-label={`${channel.unreadCount} não lidas em ${channel.name}`}
                            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-err px-1 text-[11px] font-bold text-bg"
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
        onCreate={(name) => matrixService.createChannel(activeGuildId ?? "", name)}
        onCreated={(channel) => {
          setActiveChannel(channel.channelId);
        }}
      />
      <EditGuildModal
        open={editGuildOpen}
        onClose={() => setEditGuildOpen(false)}
        guild={activeGuild ?? { guildId: "", name: "" }}
        onSave={handleEditGuild}
      />
    </aside>
  );
}

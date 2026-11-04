import { Camera, Hash, MagnifyingGlass, Gear, Plus, Sparkle, SpeakerHigh, UserPlus, X } from "@phosphor-icons/react";
import { useMemo, useState, useEffect } from "react";
import EmptyState from "./EmptyState";
import { useSyncStore, selectChannels, selectGuilds } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useThemeStore } from "@/stores/themeStore";
import { useVoiceStore } from "@/stores/voiceStore";
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

  const themeId = useThemeStore((state) => state.themeId);
  const mode = useThemeStore((state) => state.mode);

  const bannerFallbackGradient = useMemo(() => {
    if (mode === "light") {
      switch (themeId) {
        case "sakura":
          return "bg-gradient-to-br from-pink-200/70 via-rose-100/60 to-pink-50";
        case "sunset":
          return "bg-gradient-to-br from-amber-200/70 via-orange-100/60 to-amber-50";
        case "ocean":
          return "bg-gradient-to-br from-sky-200/70 via-blue-100/60 to-indigo-50";
        case "echo":
        default:
          return "bg-gradient-to-br from-teal-200/70 via-emerald-100/60 to-teal-50";
      }
    }

    switch (themeId) {
      case "sakura":
        return "bg-gradient-to-br from-[#2a1424] via-[#1c0f1c] to-[#120a16]";
      case "sunset":
        return "bg-gradient-to-br from-[#2b170e] via-[#1c110f] to-[#120d0d]";
      case "ocean":
        return "bg-gradient-to-br from-[#101e30] via-[#0d1522] to-[#080d16]";
      case "echo":
      default:
        return "bg-gradient-to-br from-[#122226] via-[#0f171e] to-[#0c1017]";
    }
  }, [mode, themeId]);

  const activeVoiceChannelId = useVoiceStore((state) => state.activeVoiceChannelId);
  const voiceParticipants = useVoiceStore((state) => state.participants);
  const connectVoice = useVoiceStore((state) => state.connectVoice);

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

  const textChannels = useMemo(
    () => channels.filter((c) => c.type !== "voice"),
    [channels],
  );
  const voiceChannels = useMemo(
    () => channels.filter((c) => c.type === "voice"),
    [channels],
  );

  const activeGuild = guilds.find((g) => g.guildId === activeGuildId) ?? null;

  // Busca canais da guilda e garante seleção automática do primeiro canal
  useEffect(() => {
    if (!activeGuildId || activeGuildId === "home") return;

    let isMounted = true;
    void matrixService
      .listChannels(activeGuildId)
      .then((channelList) => {
        if (!isMounted) return;
        useSyncStore.getState().setChannels(activeGuildId, channelList);

        const curActive = useUiStore.getState().activeChannelId;
        const exists = channelList.some((c) => c.channelId === curActive);
        if ((!curActive || !exists) && channelList.length > 0) {
          useUiStore.getState().setActiveChannel(channelList[0].channelId);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [activeGuildId]);

  // Se canais já estiverem em cache e nenhum canal estiver ativo, seleciona o primeiro
  useEffect(() => {
    if (!activeChannelId && allChannels.length > 0) {
      setActiveChannel(allChannels[0].channelId);
    }
  }, [activeChannelId, allChannels, setActiveChannel]);

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
      className={`flex w-[232px] shrink-0 flex-col border-r border-bd-subtle bg-surf ${
        overlay
          ? "fixed inset-y-0 left-[72px] z-20 shadow-2xl shadow-black/80"
          : "h-full"
      }`}
    >
      {/* Top Header Bar da Guilda (Ergonomia Discord, texto nítido em text-txt, botões táteis) */}
      {activeGuild ? (
        <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-bd-subtle bg-surf px-3 select-none z-10">
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
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              aria-label="Convidar pessoas"
              title="Convidar pessoas"
              onClick={() => setInviteOpen(true)}
              className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] transition-all active:scale-95"
            >
              <UserPlus size={15} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Configurações do servidor"
              title="Configurações do servidor"
              onClick={() => setEditGuildOpen(true)}
              className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] transition-all active:scale-95"
            >
              <Gear size={15} aria-hidden />
            </button>
            {!overlay && (
              <button
                type="button"
                aria-label="Criar canal"
                title="Criar canal"
                onClick={() => setCreateChannelOpen(true)}
                className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] transition-all active:scale-95"
              >
                <Plus size={15} aria-hidden />
              </button>
            )}
            {overlay && (
              <button
                type="button"
                aria-label="Fechar canais"
                onClick={onClose}
                className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] transition-all active:scale-95"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </header>
      ) : (
        <header className="flex h-12 items-center justify-between border-b border-bd-subtle px-4 group">
          <h1 className="truncate font-display text-sm font-semibold text-txt">
            Echo
          </h1>
        </header>
      )}

      {/* Banner Card da Guilda (Abaixo do Header, com imagem ou cover generativo adaptativo) */}
      {activeGuild && (
        <div className="px-2.5 pt-2.5 pb-1 shrink-0">
          {activeGuild.bannerUrl ? (
            <div className="relative h-28 w-full overflow-hidden rounded-2xl border border-bd-subtle shadow-sm group/banner select-none">
              <MxcImage
                mxcUrl={activeGuild.bannerUrl}
                alt={activeGuild.name}
                className="h-full w-full object-cover group-hover/banner:scale-105 transition-transform duration-500"
                width={212}
                height={112}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              <button
                type="button"
                onClick={() => setEditGuildOpen(true)}
                title="Alterar banner"
                aria-label="Alterar banner"
                className="cursor-pointer absolute top-2 right-2 rounded-lg p-1.5 text-white/90 bg-black/40 hover:bg-black/60 backdrop-blur-md opacity-0 group-hover/banner:opacity-100 transition-all border border-white/10"
              >
                <Camera size={13} />
              </button>
            </div>
          ) : (
            <div
              data-testid="guild-banner-fallback"
              className={`relative h-24 w-full overflow-hidden rounded-2xl border border-bd-subtle shadow-sm select-none group/banner transition-colors duration-300 ${bannerFallbackGradient}`}
            >
              {/* Glows sutis e dinâmicos */}
              <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-acc/15 blur-xl pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-acc/10 blur-xl pointer-events-none" />

              {/* Marca d'água sutil com a inicial da guilda */}
              <div className="absolute right-3 -bottom-2 font-display text-6xl font-black text-txt/[0.05] select-none pointer-events-none tracking-tighter">
                {activeGuild.name.slice(0, 1).toUpperCase()}
              </div>

              {/* Badge elegante de Comunidade */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-surf/80 dark:bg-black/30 backdrop-blur-md border border-bd-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mut shadow-xs">
                <Sparkle size={10} className="text-acc" weight="fill" />
                <span>Comunidade</span>
              </div>

              {/* Atalho rápido no hover para personalizar banner */}
              <button
                type="button"
                onClick={() => setEditGuildOpen(true)}
                title="Personalizar banner da guilda"
                aria-label="Personalizar banner da guilda"
                className="cursor-pointer absolute top-2 right-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-mut hover:text-txt bg-surf/80 dark:bg-black/40 hover:bg-surf backdrop-blur-md border border-bd-subtle opacity-0 group-hover/banner:opacity-100 transition-all"
              >
                <Camera size={12} />
                <span>Banner</span>
              </button>
            </div>
          )}
        </div>
      )}

      {guilds.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="border-b border-bd-subtle px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl dark:bg-white/[0.03] bg-card-bg/70 border border-bd-subtle px-2.5 py-1.5 text-mut/70 group focus-within:bg-card-bg focus-within:border-acc/40 transition-all">
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

          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
            {/* Canais de Texto */}
            <section>
              <h2 className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mut/60">
                Canais de texto
              </h2>
              <ul className="space-y-0.5 mt-1">
                {textChannels.map((channel) => {
                  const active = channel.channelId === activeChannelId;
                  return (
                    <li key={channel.channelId}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setActiveChannel(channel.channelId)}
                        className={`cursor-pointer flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-all ${
                          active
                            ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt font-semibold shadow-sm"
                            : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
                        }`}
                      >
                        <Hash size={15} className={`shrink-0 ${active ? "text-acc" : "text-mut/60"}`} aria-hidden />
                        <span className={`truncate ${active ? "text-txt" : "text-mut"}`}>
                          {channel.name}
                        </span>
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

            {/* Canais de Voz */}
            {voiceChannels.length > 0 && (
              <section>
                <h2 className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mut/60">
                  Canais de voz
                </h2>
                <ul className="space-y-0.5 mt-1">
                  {voiceChannels.map((channel) => {
                    const active = channel.channelId === activeChannelId;
                    const connected = channel.channelId === activeVoiceChannelId;

                    return (
                      <li key={channel.channelId}>
                        <button
                          type="button"
                          aria-current={connected ? "true" : undefined}
                          onClick={() => {
                            connectVoice(
                              activeGuild?.guildId ?? "",
                              activeGuild?.name ?? "",
                              channel.channelId,
                              channel.name,
                            );
                            setActiveChannel(channel.channelId);
                          }}
                          className={`cursor-pointer flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-all ${
                            connected
                              ? "bg-online/10 text-online font-semibold border border-online/20 shadow-xs"
                              : active
                                ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt font-semibold shadow-sm"
                                : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
                          }`}
                        >
                          <SpeakerHigh
                            size={15}
                            className={`shrink-0 ${connected ? "text-online animate-pulse" : active ? "text-acc" : "text-mut/60"}`}
                            aria-hidden
                          />
                          <span className={`truncate ${connected ? "text-online" : active ? "text-txt" : "text-mut"}`}>
                            {channel.name}
                          </span>
                          {connected && (
                            <span className="ml-auto flex h-2 w-2 rounded-full bg-online animate-ping" />
                          )}
                        </button>

                        {/* Participantes conectados na chamada */}
                        {connected && voiceParticipants.length > 0 && (
                          <div className="ml-5 mt-1 mb-2 space-y-1 animate-in fade-in-0 duration-150">
                            {voiceParticipants.map((p) => (
                              <div
                                key={p.userId}
                                className="flex items-center gap-2 py-1 px-2 rounded-lg bg-black/5 dark:bg-white/[0.03] text-xs"
                              >
                                <div
                                  className={`relative h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-acc text-bg shrink-0 ${
                                    p.isSpeaking ? "ring-2 ring-online animate-pulse" : ""
                                  }`}
                                >
                                  {p.username.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[11px] text-txt truncate flex-1">
                                  {p.username}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
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

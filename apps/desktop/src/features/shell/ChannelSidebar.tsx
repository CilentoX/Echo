import { Camera, Hash, MagnifyingGlass, Gear, Plus, Sparkle, SpeakerHigh, UserPlus, X, Lock } from "@phosphor-icons/react";
import { useMemo, useState, useEffect } from "react";
import EmptyState from "./EmptyState";
import { useSyncStore, selectChannels, selectGuilds, selectGuildRoles, selectUserGuildRoles } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useThemeStore } from "@/stores/themeStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { matrixService } from "@/lib/matrix/instance";
import CreateChannelModal from "@/features/guild/CreateChannelModal";
import GuildSettingsModal from "@/features/guild/GuildSettingsModal";
import ChannelSettingsModal from "@/features/guild/ChannelSettingsModal";
import InviteModal from "@/features/guild/InviteModal";
import MxcImage from "@/components/media/MxcImage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MemberDropdownContent from "./MemberDropdownContent";
import { hasChannelPermission } from "@/lib/permissions/channelPermissions";
import type { ChannelSummary } from "@/lib/matrix/types";

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
  const [channelSettingsTarget, setChannelSettingsTarget] = useState<ChannelSummary | null>(null);
  const [channelSearch, setChannelSearch] = useState("");
  const [openVoiceMemberId, setOpenVoiceMemberId] = useState<string | null>(null);

  const themeId = useThemeStore((state) => state.themeId);
  const mode = useThemeStore((state) => state.mode);

  const myUserId = useUiStore((state) => state.myUserId);
  const profileDisplayName = useProfileStore((state) => state.displayName);
  const profileAvatarUrl = useProfileStore((state) => state.avatarUrl);
  const myAppwriteAvatarUrl = useProfileStore((state) => state.appwriteAvatarUrl);
  const microphoneEnabled = useSettingsStore((state) => state.microphoneEnabled);
  const headphonesEnabled = useSettingsStore((state) => state.headphonesEnabled);
  const speakingMembers = useVoiceStore((state) => state.speakingMembers);
  const isSpeaking = useVoiceStore((state) => state.isSpeaking);

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
  const guildProfiles = useSyncStore((state) =>
    activeGuildId && activeGuildId !== "home" ? state.guildMemberProfiles[activeGuildId] : undefined,
  );

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

  const effectiveUserId =
    myUserId || (typeof matrixService?.getUserId === "function" ? matrixService.getUserId() : "") || "";
  const isGuildOwner = Boolean(
    activeGuild && (activeGuild as any).createdBy && effectiveUserId && (activeGuild as any).createdBy === effectiveUserId,
  );
  const guildRoles = useSyncStore(
    useMemo(() => selectGuildRoles(activeGuildId ?? ""), [activeGuildId]),
  );
  const userRoleIds = useSyncStore(
    useMemo(() => selectUserGuildRoles(activeGuildId ?? "", effectiveUserId), [activeGuildId, effectiveUserId]),
  );
  const channelPermissions = useSyncStore((state) => state.channelPermissions);

  const canViewChannel = (channel: { channelId: string; type?: string }) => {
    const config = channelPermissions[channel.channelId];
    return hasChannelPermission("VIEW_CHANNEL", {
      userId: effectiveUserId,
      isGuildOwner,
      userRoleIds: (userRoleIds as string[]) || [],
      guildRoles: (guildRoles as any[]) || [],
      channelConfig: config,
      channelType: channel.type === "voice" ? "voice" : "text",
    });
  };

  const canManageChannel = (channel: { channelId: string; type?: string }) => {
    const config = channelPermissions[channel.channelId];
    return hasChannelPermission("MANAGE_CHANNELS", {
      userId: effectiveUserId,
      isGuildOwner,
      userRoleIds: (userRoleIds as string[]) || [],
      guildRoles: (guildRoles as any[]) || [],
      channelConfig: config,
      channelType: channel.type === "voice" ? "voice" : "text",
    });
  };

  const visibleTextChannels = useMemo(
    () => textChannels.filter((c) => canViewChannel(c)),
    [textChannels, channelPermissions, effectiveUserId, isGuildOwner, userRoleIds, guildRoles],
  );
  const visibleVoiceChannels = useMemo(
    () => voiceChannels.filter((c) => canViewChannel(c)),
    [voiceChannels, channelPermissions, effectiveUserId, isGuildOwner, userRoleIds, guildRoles],
  );

  const settingsGuildData = useMemo(
    () => ({
      guildId: activeGuild?.guildId ?? "",
      name: activeGuild?.name ?? "",
      avatarUrl: activeGuild?.avatarUrl ?? null,
      bannerUrl: activeGuild?.bannerUrl ?? null,
      description: activeGuild?.description ?? null,
      createdBy: (activeGuild as any)?.createdBy ?? null,
    }),
    [
      activeGuild?.guildId,
      activeGuild?.name,
      activeGuild?.avatarUrl,
      activeGuild?.bannerUrl,
      activeGuild?.description,
      (activeGuild as any)?.createdBy,
    ],
  );

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

    // Carrega dados e apelidos dos membros da guilda em cache
    if (typeof matrixService.getGuildMembersData === "function") {
      void matrixService
        .getGuildMembersData(activeGuildId)
        .then((data) => {
          if (!isMounted || !data) return;
          if (Array.isArray(data.memberProfiles)) {
            useSyncStore.getState().setGuildMemberProfiles(activeGuildId, data.memberProfiles);
          }
          if (Array.isArray(data.roles)) {
            useSyncStore.getState().setGuildRoles(activeGuildId, data.roles);
          }
          if (Array.isArray(data.memberRoles)) {
            useSyncStore.getState().setGuildMemberRoles(activeGuildId, data.memberRoles);
          }
        })
        .catch(() => {});
    }

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
                {visibleTextChannels.map((channel) => {
                  const active = channel.channelId === activeChannelId;
                  const isPrivate = Boolean(channelPermissions[channel.channelId]?.isPrivate);
                  const canManage = canManageChannel(channel) || isGuildOwner;

                  return (
                    <li key={channel.channelId} className="group relative flex items-center">
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setActiveChannel(channel.channelId)}
                        className={`cursor-pointer flex flex-1 min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-all ${
                          active
                            ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt font-semibold shadow-sm"
                            : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
                        }`}
                      >
                        <Hash size={15} className={`shrink-0 ${active ? "text-acc" : "text-mut/60"}`} aria-hidden />
                        <span className={`truncate ${active ? "text-txt" : "text-mut"}`}>
                          {channel.name}
                        </span>
                        {isPrivate && (
                          <span title="Canal Privado">
                            <Lock size={12} className="shrink-0 text-amber-400/80" />
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
                      {canManage && (
                        <button
                          type="button"
                          title="Configurações do canal"
                          aria-label={`Configurações de ${channel.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setChannelSettingsTarget(channel);
                          }}
                          className={`cursor-pointer p-1 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-all shrink-0 ml-1 ${
                            active ? "opacity-80 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <Gear size={13} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Canais de Voz */}
            {visibleVoiceChannels.length > 0 && (
              <section>
                <h2 className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mut/60">
                  Canais de voz
                </h2>
                <ul className="space-y-0.5 mt-1">
                  {visibleVoiceChannels.map((channel) => {
                    const active = channel.channelId === activeChannelId;
                    const connected = channel.channelId === activeVoiceChannelId;
                    const isPrivate = Boolean(channelPermissions[channel.channelId]?.isPrivate);
                    const canManage = canManageChannel(channel) || isGuildOwner;

                    return (
                      <li key={channel.channelId} className="group relative">
                        <div className="flex items-center">
                          <button
                            type="button"
                            aria-current={connected ? "true" : undefined}
                            onClick={() => {
                              const effectiveUserId =
                                myUserId || (typeof matrixService?.getUserId === "function" ? matrixService.getUserId() : "") || "me";
                              const myGuildNick = effectiveUserId ? guildProfiles?.[effectiveUserId]?.nickname : undefined;
                              const myEffectiveName =
                                myGuildNick || profileDisplayName || effectiveUserId.split(":")[0].replace("@", "") || "Você";
                              const myEffectiveAvatar =
                                (effectiveUserId ? guildProfiles?.[effectiveUserId]?.avatarUrl : null) ||
                                profileAvatarUrl ||
                                myAppwriteAvatarUrl ||
                                null;

                              connectVoice(
                                activeGuild?.guildId ?? "",
                                activeGuild?.name ?? "",
                                channel.channelId,
                                channel.name,
                                [
                                  {
                                    userId: effectiveUserId,
                                    username: myEffectiveName,
                                    avatarUrl: myEffectiveAvatar,
                                    isMuted: !microphoneEnabled,
                                    isDeafened: !headphonesEnabled,
                                    isSpeaking: false,
                                    volume: 100,
                                  },
                                ],
                              );
                              setActiveChannel(channel.channelId);
                            }}
                            className={`cursor-pointer flex flex-1 min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-all ${
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
                            {isPrivate && (
                              <span title="Canal Privado">
                                <Lock size={12} className="shrink-0 text-amber-400/80" />
                              </span>
                            )}
                            {connected && (
                              <span className="flex h-2 w-2 rounded-full bg-online animate-ping shrink-0 ml-auto" />
                            )}
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              title="Configurações do canal de voz"
                              aria-label={`Configurações de ${channel.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setChannelSettingsTarget(channel);
                              }}
                              className={`cursor-pointer p-1 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-all shrink-0 ml-1 ${
                                active || connected ? "opacity-80 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              <Gear size={13} />
                            </button>
                          )}
                        </div>

                        {/* Participantes conectados na chamada */}
                        {connected && voiceParticipants.length > 0 && (
                          <ul className="ml-4 mt-1 mb-2 space-y-1 animate-in fade-in-0 duration-150">
                            {voiceParticipants.map((p) => {
                              const isMe =
                                p.userId === "me" ||
                                p.userId === myUserId ||
                                (myUserId ? p.userId === myUserId : false);
                              const effectiveUserId = p.userId === "me" ? (myUserId || "") : p.userId;
                              const effectiveNick = guildProfiles?.[effectiveUserId]?.nickname || p.username;
                              const effectiveAvatar =
                                p.avatarUrl ||
                                guildProfiles?.[effectiveUserId]?.avatarUrl ||
                                (isMe ? (myAppwriteAvatarUrl || profileAvatarUrl) : null);
                              const participantSpeaking =
                                p.isSpeaking ||
                                speakingMembers.includes(p.userId) ||
                                (isMe &&
                                  (isSpeaking ||
                                    speakingMembers.includes("me") ||
                                    (effectiveUserId ? speakingMembers.includes(effectiveUserId) : false)));

                              return (
                                <li key={p.userId} className="relative">
                                  <Popover
                                    open={openVoiceMemberId === p.userId}
                                    onOpenChange={(open) => setOpenVoiceMemberId(open ? p.userId : null)}
                                  >
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        aria-label={`Perfil de ${effectiveNick}`}
                                        className={`cursor-pointer flex w-full items-center gap-2 py-1 px-2 rounded-xl text-xs transition-all active:scale-[0.98] group ${
                                          openVoiceMemberId === p.userId
                                            ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt"
                                            : participantSpeaking
                                              ? "bg-online/10 text-online border border-online/20"
                                              : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
                                        }`}
                                      >
                                        <div className="relative h-5 w-5 shrink-0">
                                          {effectiveAvatar ? (
                                            <MxcImage
                                              mxcUrl={effectiveAvatar}
                                              alt={effectiveNick}
                                              className={`h-5 w-5 rounded-full object-cover transition-all ${
                                                participantSpeaking
                                                  ? "ring-2 ring-online shadow-sm shadow-online/60 animate-pulse"
                                                  : "ring-1 ring-bd-subtle group-hover:ring-acc/40"
                                              }`}
                                              width={20}
                                              height={20}
                                            />
                                          ) : (
                                            <div
                                              className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-acc text-bg shadow-sm transition-all ${
                                                participantSpeaking
                                                  ? "ring-2 ring-online shadow-sm shadow-online/60 animate-pulse"
                                                  : "ring-1 ring-bd-subtle group-hover:ring-acc/40"
                                              }`}
                                            >
                                              {effectiveNick.charAt(0).toUpperCase()}
                                            </div>
                                          )}
                                          {p.isMuted && (
                                            <span
                                              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-err ring-1 ring-surf"
                                              title="Mutado"
                                            />
                                          )}
                                        </div>

                                        <span
                                          className={`text-[11px] truncate flex-1 text-left ${
                                            participantSpeaking ? "text-online font-semibold" : "text-txt/90"
                                          }`}
                                        >
                                          {effectiveNick}
                                        </span>

                                        {/* Equalizer Waveform quando Falando */}
                                        {participantSpeaking && (
                                          <div className="flex items-center gap-0.5 shrink-0" title="Falando...">
                                            <span className="h-2 w-0.5 rounded-full bg-online animate-[pulse_0.6s_ease-in-out_infinite]" />
                                            <span className="h-3 w-0.5 rounded-full bg-online animate-[pulse_0.4s_ease-in-out_infinite_150ms]" />
                                            <span className="h-1.5 w-0.5 rounded-full bg-online animate-[pulse_0.5s_ease-in-out_infinite_300ms]" />
                                          </div>
                                        )}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      side="right"
                                      align="start"
                                      sideOffset={8}
                                      collisionPadding={16}
                                      className="w-auto p-0 border-0 bg-transparent shadow-none max-w-none outline-none z-50"
                                    >
                                      <MemberDropdownContent
                                        userId={effectiveUserId || (myUserId ?? "")}
                                        onClose={() => setOpenVoiceMemberId(null)}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </li>
                              );
                            })}
                          </ul>
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
        guild={settingsGuildData}
        onSave={handleEditGuild}
      />

      {channelSettingsTarget && (
        <ChannelSettingsModal
          open={Boolean(channelSettingsTarget)}
          onClose={() => setChannelSettingsTarget(null)}
          channel={channelSettingsTarget}
          guildId={activeGuildId ?? ""}
          onSave={async (updates) => {
            const currentList = allChannels.map((c) =>
              c.channelId === channelSettingsTarget.channelId
                ? { ...c, name: updates.name, topic: updates.topic ?? c.topic }
                : c,
            );
            useSyncStore.getState().setChannels(activeGuildId ?? "", currentList);
          }}
          onDelete={async (deletedId) => {
            const nextList = allChannels.filter((c) => c.channelId !== deletedId);
            useSyncStore.getState().setChannels(activeGuildId ?? "", nextList);
            if (activeChannelId === deletedId && nextList.length > 0) {
              useUiStore.getState().setActiveChannel(nextList[0].channelId);
            }
          }}
        />
      )}

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

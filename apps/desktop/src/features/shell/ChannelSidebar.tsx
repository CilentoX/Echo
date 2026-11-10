import {
  BellSlash,
  BellSimple,
  CaretDown,
  CaretRight,
  Copy,
  DotsSixVertical,
  Gear,
  Hash,
  Lock,
  Plus,
  SpeakerHigh,
  Television,
  Trash,
} from "@phosphor-icons/react";
import { useMemo, useState, useEffect, useRef } from "react";
import EmptyState from "./EmptyState";
import { useSyncStore, selectChannels, selectGuilds, selectGuildRoles, selectUserGuildRoles, selectGuildCategories } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useThemeStore } from "@/stores/themeStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useProfileStore } from "@/stores/profileStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { matrixService } from "@/lib/matrix/instance";
import CreateChannelModal from "@/features/guild/CreateChannelModal";
import CreateCategoryModal from "@/features/guild/CreateCategoryModal";
import GuildSettingsModal from "@/features/guild/GuildSettingsModal";
import ChannelSettingsModal from "@/features/guild/ChannelSettingsModal";
import InviteModal from "@/features/guild/InviteModal";
import ChannelMutePopover from "@/features/channels/ChannelMutePopover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { hasChannelPermission } from "@/lib/permissions/channelPermissions";
import type { ChannelSummary } from "@/lib/matrix/types";
import { ECHO_API_CONFIG } from "@/lib/api/config";
import { useEchoApi } from "@/lib/api/echoApi";
import {
  ChannelSidebarHeader,
  GuildBannerHeader,
  ChannelSearchInput,
  VoiceParticipantItem,
} from "./sidebar";

export interface ChannelSidebarProps {
  /** `overlay` floats above the chat below 900px; `static` is the docked column. */
  variant?: "static" | "overlay";
  onClose?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  footer?: import("react").ReactNode;
}

/** Channel sidebar: 232px column listing the active community's text channels. */
export default function ChannelSidebar({
  variant = "static",
  onClose,
  onOpenProfile: _onOpenProfile,
  onOpenSettings: _onOpenSettings,
  footer,
}: ChannelSidebarProps) {
  const overlay = variant === "overlay";

  const guilds = useSyncStore(selectGuilds);
  const activeGuildId = useUiStore((state) => state.activeGuildId);
  const activeChannelId = useUiStore((state) => state.activeChannelId);
  const setActiveChannel = useUiStore((state) => state.setActiveChannel);
  const setActiveGuild = useUiStore((state) => state.setActiveGuild);
  const setChannels = useSyncStore((state) => state.setChannels);

  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [targetCategoryForChannel, setTargetCategoryForChannel] = useState<string | undefined>(undefined);
  const [targetTypeForChannel, setTargetTypeForChannel] = useState<"text" | "voice">("text");
  const [editGuildOpen, setEditGuildOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [channelSettingsTarget, setChannelSettingsTarget] = useState<ChannelSummary | null>(null);
  const [channelSearch, setChannelSearch] = useState("");
  const [openVoiceMemberId, setOpenVoiceMemberId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [guildVoiceState, setGuildVoiceState] = useState<Record<string, any[]>>({});

  const guildCategories = useSyncStore(
    useMemo(() => selectGuildCategories(activeGuildId ?? ""), [activeGuildId]),
  );
  const createCategory = useSyncStore((state) => state.createCategory);
  const deleteCategory = useSyncStore((state) => state.deleteCategory);
  const reorderCategories = useSyncStore((state) => state.reorderCategories);
  const moveChannelCategory = useSyncStore((state) => state.moveChannelCategory);
  const muteChannel = useSyncStore((state) => state.muteChannel);
  const unmuteChannel = useSyncStore((state) => state.unmuteChannel);
  const muteGuild = useSyncStore((state) => state.muteGuild);
  const unmuteGuild = useSyncStore((state) => state.unmuteGuild);
  const moveParticipantToChannel = useVoiceStore((state) => state.moveParticipantToChannel);
  const addParticipant = useVoiceStore((state) => state.addParticipant);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

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
  const isVoiceConnected = useVoiceStore((state) => state.isConnected);
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
  const myGuildNick = effectiveUserId ? guildProfiles?.[effectiveUserId]?.nickname : undefined;
  const myEffectiveName =
    myGuildNick || profileDisplayName || effectiveUserId.split(":")[0].replace("@", "") || "Você";
  const myEffectiveAvatar =
    (effectiveUserId ? guildProfiles?.[effectiveUserId]?.avatarUrl : null) ||
    profileAvatarUrl ||
    myAppwriteAvatarUrl ||
    null;

  const guildRoles = useSyncStore(
    useMemo(() => selectGuildRoles(activeGuildId ?? ""), [activeGuildId]),
  );
  const userRoleIds = useSyncStore(
    useMemo(() => selectUserGuildRoles(activeGuildId ?? "", effectiveUserId), [activeGuildId, effectiveUserId]),
  );
  const channelPermissions = useSyncStore((state) => state.channelPermissions);
  const isChannelMuted = useSyncStore((state) => state.isChannelMuted);
  const isGuildMuted = useSyncStore((state) => state.isGuildMuted);

  const isGuildOwner = Boolean(
    activeGuild?.createdBy &&
      effectiveUserId &&
      activeGuild.createdBy.toLowerCase() === effectiveUserId.toLowerCase()
  );

  const canManageGuild = Boolean(
    isGuildOwner ||
    ((guildRoles as any[]) || []).some((r) =>
      ((userRoleIds as string[]) || []).includes((r as any).roleId || r.id) &&
      (r.permissions?.includes("ADMINISTRATOR") || r.permissions?.includes("MANAGE_GUILD"))
    )
  );

  const canManageChannels = Boolean(
    canManageGuild ||
    ((guildRoles as any[]) || []).some((r) =>
      ((userRoleIds as string[]) || []).includes((r as any).roleId || r.id) &&
      r.permissions?.includes("MANAGE_CHANNELS")
    )
  );

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

  const handleDeleteChannel = async (channel: ChannelSummary) => {
    if (!activeGuildId) return;
    try {
      await matrixService.deleteChannel(channel.channelId);
    } catch (err) {
      console.error("Erro ao deletar canal:", err);
    }
    const updated = allChannels.filter((c) => c.channelId !== channel.channelId);
    setChannels(activeGuildId, updated);
    if (activeChannelId === channel.channelId) {
      const next = updated.find((c) => c.type !== "voice");
      setActiveChannel(next?.channelId ?? null);
    }
  };

  const handleConnectVoice = (channel: ChannelSummary) => {
    const effId = effectiveUserId || "me";

    // Pega participantes que já estavam na sala destino para conexão instantânea sem sumir ninguém
    const existingInTarget = Array.isArray(guildVoiceState[channel.channelId])
      ? guildVoiceState[channel.channelId]
      : [];
    const othersInTarget = existingInTarget.filter(
      (p) => p.userId !== effId && p.userId !== "me" && p.userId !== myUserId,
    );

    const initialParticipants = [
      {
        userId: effId,
        username: myEffectiveName,
        avatarUrl: myEffectiveAvatar,
        isMuted: !microphoneEnabled,
        isDeafened: !headphonesEnabled,
        isSpeaking: false,
        volume: 100,
      },
      ...othersInTarget,
    ];

    // Atualização otimista imediata para transição instantânea de canais de voz sem lag
    setGuildVoiceState((prev) => {
      const next: Record<string, any[]> = {};
      const myId = effId;
      for (const [cid, list] of Object.entries(prev)) {
        next[cid] = Array.isArray(list)
          ? list.filter((p) => p.userId !== myId && p.userId !== "me" && p.userId !== myUserId)
          : [];
      }
      next[channel.channelId] = initialParticipants;
      return next;
    });

    connectVoice(
      activeGuild?.guildId ?? "",
      activeGuild?.name ?? "",
      channel.channelId,
      channel.name,
      initialParticipants,
    );
    setActiveChannel(channel.channelId);
    useFriendsStore.getState().setSelectedFriendId(null);
  };

  // Drag and drop states & synchronous ref
  const activeDragRef = useRef<{ type: "channel" | "category" | "member"; id: string; category?: string } | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [dragOverCategoryPosition, setDragOverCategoryPosition] = useState<"before" | "after" | null>(null);

  const [draggedChannelId, setDraggedChannelId] = useState<string | null>(null);
  const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(null);
  const [dragOverChannelPosition, setDragOverChannelPosition] = useState<"before" | "after" | null>(null);

  const [dragOverCategoryForChannel, setDragOverCategoryForChannel] = useState<string | null>(null);
  const [dragOverVoiceChannelId, setDragOverVoiceChannelId] = useState<string | null>(null);

  const handleReorderCategories = (
    sourceCat: string,
    targetCat: string,
    position: "before" | "after" = "after"
  ) => {
    if (!activeGuildId || sourceCat === targetCat) return;
    const currentCats = channelGroups.map((g) => g.name);
    const fromIdx = currentCats.indexOf(sourceCat);
    if (fromIdx === -1) return;

    const updated = [...currentCats];
    const [moved] = updated.splice(fromIdx, 1);
    let targetIdx = updated.indexOf(targetCat);
    if (targetIdx === -1) return;

    if (position === "after") {
      targetIdx += 1;
    }
    updated.splice(targetIdx, 0, moved);

    reorderCategories(activeGuildId, updated);
  };

  const handleMoveChannelToCategory = (channelId: string, targetCategory: string) => {
    if (!activeGuildId) return;
    moveChannelCategory(activeGuildId, channelId, targetCategory);
  };

  const handleDropChannelOnChannel = (
    sourceChannelId: string,
    targetChannelId: string,
    targetCategory: string,
    position: "before" | "after" = "after"
  ) => {
    if (!activeGuildId || sourceChannelId === targetChannelId) return;
    const sourceIdxInAll = allChannels.findIndex((c) => c.channelId === sourceChannelId);
    let targetIdxInAll = allChannels.findIndex((c) => c.channelId === targetChannelId);
    if (targetIdxInAll === -1) return;

    if (position === "after") {
      targetIdxInAll += 1;
    }
    if (sourceIdxInAll !== -1 && sourceIdxInAll < targetIdxInAll) {
      targetIdxInAll -= 1;
    }
    moveChannelCategory(activeGuildId, sourceChannelId, targetCategory, targetIdxInAll);
  };

  const handleMoveVoiceMemberToChannel = (
    userId: string,
    _username: string,
    targetChannel: ChannelSummary,
    isMePayload?: boolean,
  ) => {
    if (!activeGuildId) return;
    const isMe =
      isMePayload === true ||
      userId === "me" ||
      userId === effectiveUserId ||
      (myUserId ? userId === myUserId : false) ||
      (activeVoiceChannelId && voiceParticipants.length === 1);

    if (isMe) {
      // Se for o próprio usuário, transfere a chamada de áudio imediatamente para a nova sala
      handleConnectVoice(targetChannel);
    } else {
      // Se for outro membro, move o participante para o canal destino
      moveParticipantToChannel(
        userId,
        targetChannel.channelId,
        targetChannel.name,
        effectiveUserId,
      );
    }
  };

  const handleAddMemberToVoiceChannel = (
    userId: string,
    username: string,
    targetChannel: ChannelSummary,
  ) => {
    if (!activeGuildId) return;
    if (activeVoiceChannelId === targetChannel.channelId) {
      addParticipant({
        userId,
        username,
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
        volume: 100,
      });
    } else {
      handleConnectVoice(targetChannel);
      setTimeout(() => {
        addParticipant({
          userId,
          username,
          avatarUrl: guildProfiles?.[userId]?.avatarUrl ?? null,
          isMuted: false,
          isDeafened: false,
          isSpeaking: false,
          volume: 100,
        });
      }, 50);
    }
  };

  const visibleTextChannels = useMemo(
    () => textChannels.filter((c) => canViewChannel(c)),
    [textChannels, channelPermissions, effectiveUserId, isGuildOwner, userRoleIds, guildRoles],
  );
  const visibleVoiceChannels = useMemo(
    () => voiceChannels.filter((c) => canViewChannel(c)),
    [voiceChannels, channelPermissions, effectiveUserId, isGuildOwner, userRoleIds, guildRoles],
  );

  const channelGroups = useMemo(() => {
    const defaultText = "Canais de texto";
    const defaultVoice = "Canais de voz";
    const map = new Map<string, ChannelSummary[]>();

    // 1. Registra categorias criadas explicitamente para a guilda
    for (const customCat of (guildCategories as string[])) {
      const trimmed = customCat.trim();
      if (trimmed && !map.has(trimmed)) {
        map.set(trimmed, []);
      }
    }

    // 2. Agrupa canais visíveis preservando a ordem exata da lista da guilda
    for (const c of channels) {
      if (!canViewChannel(c)) continue;
      const defaultCat = c.type === "voice" ? defaultVoice : defaultText;
      const cat = c.category?.trim() || defaultCat;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(c);
    }

    const entries = Array.from(map.entries());
    const customOrder = (guildCategories as string[]) || [];
    entries.sort(([a], [b]) => {
      const idxA = customOrder.indexOf(a);
      const idxB = customOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      if (a === defaultText) return -1;
      if (b === defaultText) return 1;
      if (a === defaultVoice) return 1;
      if (b === defaultVoice) return -1;
      return a.localeCompare(b);
    });

    return entries.map(([name, groupChannels]) => ({ name, channels: groupChannels }));
  }, [allChannels, channelSearch, visibleTextChannels, visibleVoiceChannels, guildCategories]);

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

  const handleCreateDynamicVoiceRoom = () => {
    if (!activeGuildId || !activeGuild) return;

    const myGuildNick = effectiveUserId ? guildProfiles?.[effectiveUserId]?.nickname : undefined;
    const myEffectiveName =
      myGuildNick || profileDisplayName || effectiveUserId.split(":")[0].replace("@", "") || "Você";
    const myEffectiveAvatar =
      (effectiveUserId ? guildProfiles?.[effectiveUserId]?.avatarUrl : null) ||
      profileAvatarUrl ||
      myAppwriteAvatarUrl ||
      null;

    const tempId = `temp-voice-${Date.now()}`;
    const tempName = `🔊 Sala de ${myEffectiveName}`;

    const newChannel: ChannelSummary = {
      channelId: tempId,
      name: tempName,
      type: "voice",
      category: "Canais de voz",
      unreadCount: 0,
      isTemporary: true,
    };

    const currentChannels = (allChannels as ChannelSummary[]) || [];
    setChannels(activeGuildId, [...currentChannels, newChannel]);

    connectVoice(
      activeGuild.guildId,
      activeGuild.name,
      tempId,
      tempName,
      [
        {
          userId: effectiveUserId || "me",
          username: myEffectiveName,
          avatarUrl: myEffectiveAvatar,
          isMuted: !microphoneEnabled,
          isDeafened: !headphonesEnabled,
          isSpeaking: false,
          volume: 100,
        },
      ],
    );
    setActiveChannel(tempId);

    // Persiste a sala de voz no servidor em segundo plano para que todos os membros a vejam
    void matrixService
      .createChannel(activeGuildId, {
        name: tempName,
        type: "voice",
        category: "Canais de voz",
      })
      .then((created) => {
        if (created?.channelId) {
          const latest = useSyncStore.getState().channelsByGuild[activeGuildId] || [];
          useSyncStore.getState().setChannels(
            activeGuildId,
            latest.map((c) =>
              c.channelId === tempId ? { ...c, channelId: created.channelId, isTemporary: true } : c,
            ),
          );
          if (useUiStore.getState().activeChannelId === tempId) {
            useUiStore.getState().setActiveChannel(created.channelId);
          }
        }
      })
      .catch(() => {});
  };

  // Busca canais da guilda e garante seleção automática do primeiro canal (com atualização periódica)
  useEffect(() => {
    if (!activeGuildId || activeGuildId === "home") return;

    let isMounted = true;
    const fetchChannels = () => {
      void matrixService
        .listChannels(activeGuildId)
        .then((channelList) => {
          if (!isMounted) return;
          useSyncStore.getState().setChannels(activeGuildId, channelList);

          const curActive = useUiStore.getState().activeChannelId;
          const exists = channelList.some((c) => c.channelId === curActive);
          if ((!curActive || !exists) && channelList.length > 0) {
            const firstText = channelList.find((c) => c.type !== "voice");
            useUiStore.getState().setActiveChannel(firstText?.channelId ?? null);
          }
        })
        .catch(() => {});
    };

    fetchChannels();
    // Atualização em segundo plano suave a cada 60s + sincronização imediata no foco da janela
    const interval = setInterval(fetchChannels, 60000);
    const onWindowFocus = () => fetchChannels();
    window.addEventListener("focus", onWindowFocus);

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
      clearInterval(interval);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [activeGuildId]);

  // Sincroniza participantes de salas de voz da guilda em tempo real via SSE (sem polling HTTP!)
  useEffect(() => {
    if (!activeGuildId || activeGuildId === "home") return;
    let isMounted = true;

    const handleVoiceChannelsUpdate = (channels: Record<string, any[]>) => {
      if (!isMounted || !channels) return;
      const currentVoiceChannelId = useVoiceStore.getState().activeVoiceChannelId;
      const currentVoiceGuildId = useVoiceStore.getState().activeVoiceGuildId;
      const myId = effectiveUserId || "me";

      // Preserva a presença otimista do usuário local para evitar atraso ou reversão visual
      if (currentVoiceChannelId && currentVoiceGuildId === activeGuildId) {
        const merged: Record<string, any[]> = {};
        for (const [cid, pList] of Object.entries(channels)) {
          const list = Array.isArray(pList) ? pList : [];
          if (cid === currentVoiceChannelId) {
            const hasMe = list.some(
              (p) => p.userId === myId || p.userId === "me" || (myUserId ? p.userId === myUserId : false),
            );
            if (!hasMe) {
              merged[cid] = [
                ...list,
                {
                  userId: myId,
                  username: myEffectiveName,
                  avatarUrl: myEffectiveAvatar,
                  isMuted: !microphoneEnabled,
                  isDeafened: !headphonesEnabled,
                  isSpeaking: false,
                  volume: 100,
                },
              ];
            } else {
              merged[cid] = list;
            }
          } else {
            merged[cid] = list.filter(
              (p) => p.userId !== myId && p.userId !== "me" && p.userId !== myUserId,
            );
          }
        }
        // Se o canal atual não constar no snapshot do backend (ex: recém-conectado), garante presença local
        if (!merged[currentVoiceChannelId]) {
          merged[currentVoiceChannelId] = [
            {
              userId: myId,
              username: myEffectiveName,
              avatarUrl: myEffectiveAvatar,
              isMuted: !microphoneEnabled,
              isDeafened: !headphonesEnabled,
              isSpeaking: false,
              volume: 100,
            },
          ];
        }
        setGuildVoiceState(merged);
      } else {
        // Se o usuário local NÃO está conectado à voz no app,
        // remove qualquer vestígio do usuário local dos canais para evitar ghosting visual de sessão anterior
        const sanitized: Record<string, any[]> = {};
        let hasStaleSelf = false;
        for (const [cid, pList] of Object.entries(channels)) {
          const list = Array.isArray(pList) ? pList : [];
          const withoutMe = list.filter(
            (p) => p.userId !== myId && p.userId !== "me" && p.userId !== myUserId,
          );
          if (withoutMe.length !== list.length) {
            hasStaleSelf = true;
          }
          sanitized[cid] = withoutMe;
        }
        if (hasStaleSelf) {
          const api = useEchoApi();
          void api.leaveVoiceChannel("current").catch(() => {});
        }
        setGuildVoiceState(sanitized);
      }
    };

    // 1. Snapshot inicial imediato
    const fetchVoiceSnapshot = async () => {
      try {
        const api = useEchoApi();
        const res = await api.getGuildVoiceState(activeGuildId);
        if (isMounted && res?.channels) {
          handleVoiceChannelsUpdate(res.channels);
        }
      } catch {}
    };

    void fetchVoiceSnapshot();

    // 2. Conexão SSE em tempo real: elimina completamente o polling periódico de 1.5s
    let sseSource: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    if (typeof window !== "undefined" && typeof EventSource !== "undefined") {
      try {
        const api = useEchoApi();
        const token = typeof api?.getAccessToken === "function" ? api.getAccessToken() : "";
        const baseUrl = typeof api?.getBaseUrl === "function" ? api.getBaseUrl() : ECHO_API_CONFIG.baseUrl;
        const url = `${baseUrl}/api/guilds/${encodeURIComponent(activeGuildId)}/voice/events${token ? `?token=${encodeURIComponent(token)}` : ""}`;
        sseSource = new EventSource(url);

        sseSource.addEventListener("voice_state", (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.channels) {
              handleVoiceChannelsUpdate(data.channels);
            }
          } catch {}
        });

        sseSource.onerror = () => {
          // Fallback silencioso do SSE se desconectar temporariamente
        };
      } catch {
        // Fallback defensivo com intervalo longo (30s) caso SSE não esteja disponível
        fallbackInterval = setInterval(fetchVoiceSnapshot, 30000);
      }
    } else {
      fallbackInterval = setInterval(fetchVoiceSnapshot, 30000);
    }

    // Ao focar a janela, garante sincronização instantânea
    const onWindowFocusVoice = () => {
      void fetchVoiceSnapshot();
    };
    window.addEventListener("focus", onWindowFocusVoice);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", onWindowFocusVoice);
      if (sseSource) {
        sseSource.close();
        sseSource = null;
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [activeGuildId]);

  // Se canais já estiverem em cache e o canal ativo não pertencer à guilda, seleciona o primeiro canal de texto
  useEffect(() => {
    if (allChannels.length > 0) {
      const channelExists = allChannels.some((c) => c.channelId === activeChannelId);
      if (!channelExists) {
        const firstText = allChannels.find((c) => c.type !== "voice");
        setActiveChannel(firstText?.channelId ?? null);
        useFriendsStore.getState().setSelectedFriendId(null);
      }
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
      {/* Top Header Bar da Guilda */}
      <ChannelSidebarHeader
        activeGuild={activeGuild}
        canManageGuild={canManageGuild}
        canManageChannels={canManageChannels}
        isGuildOwner={isGuildOwner}
        overlay={overlay}
        onClose={onClose}
        onOpenCreateCategory={() => setCreateCategoryOpen(true)}
        onOpenCreateChannel={() => {
          setTargetCategoryForChannel(undefined);
          setTargetTypeForChannel("text");
          setCreateChannelOpen(true);
        }}
        onOpenInvite={() => setInviteOpen(true)}
        onOpenSettings={() => setEditGuildOpen(true)}
        isGuildMuted={isGuildMuted}
        muteGuild={muteGuild}
        unmuteGuild={unmuteGuild}
        onDeleteGuild={async () => {
          if (!activeGuild) return;
          if (!window.confirm(`Atenção: Tem certeza absoluta que deseja excluir o servidor "${activeGuild.name}"?`)) return;
          try {
            await matrixService.deleteGuild(activeGuild.guildId);
            useSyncStore.getState().setGuilds(guilds.filter((g) => g.guildId !== activeGuild.guildId));
            setActiveGuild("home");
            setActiveChannel(null);
          } catch (err) {
            console.error("Falha ao excluir o servidor:", err);
          }
        }}
        onLeaveGuild={async () => {
          if (!activeGuild) return;
          if (!window.confirm(`Tem certeza que deseja sair do servidor "${activeGuild.name}"?`)) return;
          try {
            await matrixService.leaveGuild(activeGuild.guildId);
            useSyncStore.getState().setGuilds(guilds.filter((g) => g.guildId !== activeGuild.guildId));
            setActiveGuild("home");
            setActiveChannel(null);
          } catch (err) {
            console.error("Falha ao sair do servidor:", err);
          }
        }}
      />

      {/* Banner Card da Guilda */}
      {activeGuild && (
        <GuildBannerHeader
          activeGuild={activeGuild}
          bannerFallbackGradient={bannerFallbackGradient}
          onOpenSettings={() => setEditGuildOpen(true)}
        />
      )}

      {guilds.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ChannelSearchInput
            value={channelSearch}
            onChange={setChannelSearch}
          />

          <div
            className="flex-1 overflow-y-auto px-2 py-3 space-y-4"
            onDragOver={(e) => {
              if (activeDragRef.current || (window as any).__ECHO_ACTIVE_DRAG__) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }
            }}
          >
            {channelGroups.map((group) => {
              const isCollapsed = Boolean(collapsedCategories[group.name]);
              const isDefaultCategory = group.name === "Canais de texto" || group.name === "Canais de voz";

              return (
                <section
                  key={group.name}
                  onDragOver={(e) => {
                    const activeDrag = activeDragRef.current || (window as any).__ECHO_ACTIVE_DRAG__;
                    if (activeDrag) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }

                    const isCat =
                      activeDrag?.type === "category" ||
                      e.dataTransfer.types.includes("application/x-echo-category");
                    const isChannel =
                      !isCat &&
                      (activeDrag?.type === "channel" ||
                        e.dataTransfer.types.includes("application/x-echo-channel") ||
                        e.dataTransfer.types.includes("text/plain"));

                    if (isCat) {
                      if (activeDrag?.id === group.name) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const midY = rect.top + rect.height / 2;
                      const pos = e.clientY < midY ? "before" : "after";
                      if (dragOverCategory !== group.name || dragOverCategoryPosition !== pos) {
                        setDragOverCategory(group.name);
                        setDragOverCategoryPosition(pos);
                      }
                    } else if (isChannel) {
                      if (dragOverCategoryForChannel !== group.name) {
                        setDragOverCategoryForChannel(group.name);
                      }
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dragOverCategoryForChannel === group.name) setDragOverCategoryForChannel(null);
                    if (dragOverCategory === group.name) {
                      setDragOverCategory(null);
                      setDragOverCategoryPosition(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const pos = dragOverCategoryPosition ?? "after";
                    setDragOverCategoryForChannel(null);
                    setDragOverCategory(null);
                    setDragOverCategoryPosition(null);
                    const catData =
                      (activeDragRef.current?.type === "category" ? activeDragRef.current.id : "") ||
                      e.dataTransfer.getData("application/x-echo-category") ||
                      (() => {
                        try {
                          const plain = e.dataTransfer.getData("text/plain");
                          const parsed = plain ? JSON.parse(plain) : null;
                          return parsed?.type === "category" ? parsed.id : "";
                        } catch {
                          return "";
                        }
                      })();
                    const chanData =
                      (activeDragRef.current?.type === "channel"
                        ? JSON.stringify({
                            channelId: activeDragRef.current.id,
                            sourceCategory: activeDragRef.current.category,
                          })
                        : "") ||
                      e.dataTransfer.getData("application/x-echo-channel") ||
                      e.dataTransfer.getData("text/plain");
                    activeDragRef.current = null;

                    if (catData && catData !== group.name) {
                      handleReorderCategories(catData, group.name, pos);
                    } else if (chanData) {
                      try {
                        const parsed = JSON.parse(chanData);
                        const channelId = parsed.channelId || (parsed.type === "channel" ? parsed.id : null);
                        if (channelId) {
                          handleMoveChannelToCategory(channelId, group.name);
                        }
                      } catch {}
                    }
                  }}
                  className={`transition-all rounded-xl relative ${
                    draggedCategory === group.name ? "opacity-30 scale-[0.98]" : ""
                  } ${
                    dragOverCategoryForChannel === group.name ? "bg-acc/[0.08] ring-1 ring-acc/40" : ""
                  }`}
                >
                  {/* Linha indicadora de drop de categoria estilo Discord */}
                  {dragOverCategory === group.name && dragOverCategoryPosition === "before" && (
                    <div className="absolute left-1 right-1 -top-1 h-[2px] bg-acc rounded-full z-30 pointer-events-none shadow-[0_0_8px_#0fb9a8] flex items-center">
                      <div className="w-3 h-3 -ml-1.5 rounded-full bg-acc shadow-[0_0_8px_#0fb9a8]" />
                    </div>
                  )}
                  {dragOverCategory === group.name && dragOverCategoryPosition === "after" && (
                    <div className="absolute left-1 right-1 -bottom-1 h-[2px] bg-acc rounded-full z-30 pointer-events-none shadow-[0_0_8px_#0fb9a8] flex items-center">
                      <div className="w-3 h-3 -ml-1.5 rounded-full bg-acc shadow-[0_0_8px_#0fb9a8]" />
                    </div>
                  )}

                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        role="button"
                        tabIndex={0}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/x-echo-category", group.name);
                          e.dataTransfer.setData("text/plain", JSON.stringify({ type: "category", id: group.name }));
                          e.dataTransfer.effectAllowed = "move";
                          activeDragRef.current = { type: "category", id: group.name };
                          (window as any).__ECHO_ACTIVE_DRAG__ = { type: "category", id: group.name };
                          setDraggedCategory(group.name);
                        }}
                        onDragEnd={() => {
                          activeDragRef.current = null;
                          (window as any).__ECHO_ACTIVE_DRAG__ = null;
                          setDraggedCategory(null);
                          setDragOverCategory(null);
                          setDragOverCategoryPosition(null);
                        }}
                        onDragOver={(e) => {
                          const activeDrag = activeDragRef.current || (window as any).__ECHO_ACTIVE_DRAG__;
                          if (activeDrag) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }
                        }}
                        onClick={() => toggleCategory(group.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleCategory(group.name);
                          }
                        }}
                        className="cursor-pointer group flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mut/60 hover:text-txt transition-colors select-none"
                        aria-expanded={!isCollapsed}
                        aria-label={`${group.name} ${isCollapsed ? "recolhido" : "expandido"}`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <DotsSixVertical
                            size={12}
                            weight="bold"
                            className="opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing text-mut hover:text-txt shrink-0"
                          />
                          {isCollapsed ? (
                            <CaretRight size={11} weight="bold" className="shrink-0 text-mut/60 group-hover:text-txt transition-transform" />
                          ) : (
                            <CaretDown size={11} weight="bold" className="shrink-0 text-mut/60 group-hover:text-txt transition-transform" />
                          )}
                          <span className="truncate">{group.name}</span>
                        </div>

                        <div className="flex items-center gap-0.5">
                          {canManageChannels && !isDefaultCategory && (
                            <span
                              role="button"
                              tabIndex={0}
                              title={`Excluir categoria ${group.name}`}
                              aria-label={`Excluir categoria ${group.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeGuildId) {
                                  deleteCategory(activeGuildId, group.name);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  if (activeGuildId) {
                                    deleteCategory(activeGuildId, group.name);
                                  }
                                }
                              }}
                              className="cursor-pointer opacity-0 group-hover:opacity-100 p-0.5 rounded text-mut hover:text-err hover:bg-err/10 transition-all"
                            >
                              <Trash size={12} />
                            </span>
                          )}

                          {canManageChannels && (
                            <span
                              role="button"
                              tabIndex={0}
                              title={`Criar canal em ${group.name}`}
                              aria-label={`Criar canal em ${group.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetCategoryForChannel(group.name);
                                setTargetTypeForChannel(group.name === "Canais de voz" ? "voice" : "text");
                                setCreateChannelOpen(true);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  setTargetCategoryForChannel(group.name);
                                  setTargetTypeForChannel(group.name === "Canais de voz" ? "voice" : "text");
                                  setCreateChannelOpen(true);
                                }
                              }}
                              className="cursor-pointer opacity-0 group-hover:opacity-100 p-0.5 rounded text-mut hover:text-txt hover:bg-white/[0.08] transition-all"
                            >
                              <Plus size={12} weight="bold" />
                            </span>
                          )}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuLabel className="truncate text-txt font-semibold">
                        {group.name}
                      </ContextMenuLabel>
                      <ContextMenuSeparator />

                      {canManageChannels && (
                        <>
                          <ContextMenuItem
                            onClick={() => {
                              setTargetCategoryForChannel(group.name);
                              setTargetTypeForChannel("text");
                              setCreateChannelOpen(true);
                            }}
                          >
                            <Hash size={14} weight="bold" className="text-acc" />
                            <span>Criar Canal de Texto</span>
                          </ContextMenuItem>

                          <ContextMenuItem
                            onClick={() => {
                              setTargetCategoryForChannel(group.name);
                              setTargetTypeForChannel("voice");
                              setCreateChannelOpen(true);
                            }}
                          >
                            <SpeakerHigh size={14} weight="bold" className="text-online" />
                            <span>Criar Canal de Voz</span>
                          </ContextMenuItem>

                          <ContextMenuSeparator />
                        </>
                      )}

                      <ContextMenuItem onClick={() => toggleCategory(group.name)}>
                        {isCollapsed ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
                        <span>{isCollapsed ? "Expandir Categoria" : "Recolher Categoria"}</span>
                      </ContextMenuItem>

                      <ContextMenuItem onClick={() => navigator.clipboard.writeText(group.name)}>
                        <Copy size={14} weight="bold" />
                        <span>Copiar Nome da Categoria</span>
                      </ContextMenuItem>

                      {canManageChannels && !isDefaultCategory && (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            destructive
                            onClick={() => {
                              if (activeGuildId) {
                                deleteCategory(activeGuildId, group.name);
                              }
                            }}
                          >
                            <Trash size={14} weight="bold" />
                            <span>Excluir Categoria</span>
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>

                  {!isCollapsed && (
                    group.channels.length === 0 ? (
                      <div className="mx-2 my-1 px-2.5 py-2 rounded-xl border border-dashed border-bd-subtle dark:bg-white/[0.01] bg-black/[0.01] flex items-center justify-between text-[11px] text-mut/60">
                        <span>Nenhum canal</span>
                        {canManageChannels && (
                          <button
                            type="button"
                            onClick={() => {
                              setTargetCategoryForChannel(group.name);
                              setTargetTypeForChannel("text");
                              setCreateChannelOpen(true);
                            }}
                            className="cursor-pointer text-[10px] text-acc hover:underline font-semibold"
                          >
                            + Criar canal
                          </button>
                        )}
                      </div>
                    ) : (
                      <ul className={`space-y-0.5 mt-1 ${draggedCategory ? "pointer-events-none" : ""}`}>
                      {group.channels.map((channel) => {
                        const isVoice = channel.type === "voice";
                        const active = channel.channelId === activeChannelId;
                        const isPrivate = Boolean(channelPermissions[channel.channelId]?.isPrivate);
                        const canManage = canManageChannel(channel) || isGuildOwner;

                        if (!isVoice) {
                          const isMuted = isChannelMuted(channel.channelId, activeGuild?.guildId);
                          return (
                            <ContextMenu key={channel.channelId}>
                              <ContextMenuTrigger asChild>
                                <li
                                  className={`group relative flex items-center transition-all ${
                                    draggedChannelId === channel.channelId ? "opacity-30 scale-[0.98]" : ""
                                  }`}
                                  draggable={true}
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    const payload = JSON.stringify({ channelId: channel.channelId, sourceCategory: group.name });
                                    e.dataTransfer.setData("application/x-echo-channel", payload);
                                    e.dataTransfer.setData("text/plain", payload);
                                    e.dataTransfer.effectAllowed = "move";
                                    activeDragRef.current = { type: "channel", id: channel.channelId, category: group.name };
                                    (window as any).__ECHO_ACTIVE_DRAG__ = { type: "channel", id: channel.channelId, category: group.name };
                                    setDraggedChannelId(channel.channelId);
                                  }}
                                  onDragOver={(e) => {
                                    const activeDrag = activeDragRef.current || (window as any).__ECHO_ACTIVE_DRAG__;
                                    if (activeDrag) {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = "move";
                                    }

                                    const isChannelDrag =
                                      activeDrag?.type === "channel" ||
                                      (!activeDrag && (
                                        e.dataTransfer.types.includes("application/x-echo-channel") ||
                                        e.dataTransfer.types.includes("text/plain")
                                      ));

                                    if (!isChannelDrag) return;
                                    e.stopPropagation();
                                    if (activeDrag?.id === channel.channelId) return;

                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const midY = rect.top + rect.height / 2;
                                    const pos = e.clientY < midY ? "before" : "after";
                                    if (dragOverChannelId !== channel.channelId || dragOverChannelPosition !== pos) {
                                      setDragOverChannelId(channel.channelId);
                                      setDragOverChannelPosition(pos);
                                    }
                                  }}
                                  onDragLeave={(e) => {
                                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                    if (dragOverChannelId === channel.channelId) {
                                      setDragOverChannelId(null);
                                      setDragOverChannelPosition(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const raw =
                                      (activeDragRef.current?.type === "channel"
                                        ? JSON.stringify({
                                            channelId: activeDragRef.current.id,
                                            sourceCategory: activeDragRef.current.category,
                                          })
                                        : "") ||
                                      e.dataTransfer.getData("application/x-echo-channel") ||
                                      e.dataTransfer.getData("text/plain");
                                    const pos = dragOverChannelPosition ?? "after";
                                    activeDragRef.current = null;
                                    (window as any).__ECHO_ACTIVE_DRAG__ = null;
                                    setDraggedChannelId(null);
                                    setDragOverChannelId(null);
                                    setDragOverChannelPosition(null);

                                    if (raw) {
                                      try {
                                        const parsed = JSON.parse(raw);
                                        const sourceId = parsed.channelId || (parsed.type === "channel" ? parsed.id : null);
                                        if (sourceId && sourceId !== channel.channelId) {
                                          handleDropChannelOnChannel(sourceId, channel.channelId, group.name, pos);
                                        }
                                      } catch {}
                                    }
                                  }}
                                  onDragEnd={() => {
                                    activeDragRef.current = null;
                                    (window as any).__ECHO_ACTIVE_DRAG__ = null;
                                    setDraggedChannelId(null);
                                    setDragOverChannelId(null);
                                    setDragOverChannelPosition(null);
                                  }}
                                >
                                  {/* Linha indicadora de posição estilo Discord */}
                                  {dragOverChannelId === channel.channelId && dragOverChannelPosition === "before" && (
                                    <div className="absolute left-1 right-1 -top-[2px] h-[2px] bg-acc rounded-full z-30 pointer-events-none shadow-[0_0_8px_#0fb9a8] flex items-center">
                                      <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-acc shadow-[0_0_6px_#0fb9a8]" />
                                    </div>
                                  )}
                                  {dragOverChannelId === channel.channelId && dragOverChannelPosition === "after" && (
                                    <div className="absolute left-1 right-1 -bottom-[2px] h-[2px] bg-acc rounded-full z-30 pointer-events-none shadow-[0_0_8px_#0fb9a8] flex items-center">
                                      <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-acc shadow-[0_0_6px_#0fb9a8]" />
                                    </div>
                                  )}
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    aria-current={active ? "true" : undefined}
                                    onClick={() => setActiveChannel(channel.channelId)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setActiveChannel(channel.channelId);
                                      }
                                    }}
                                    className={`cursor-pointer flex flex-1 min-w-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left text-xs transition-all ${
                                      active
                                        ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt font-semibold shadow-sm"
                                        : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
                                    }`}
                                  >
                                    <DotsSixVertical size={11} className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing text-mut shrink-0 -ml-1 mr-0.5" />
                                    <Hash size={15} className={`shrink-0 ${active ? "text-acc" : "text-mut/60"}`} aria-hidden />
                                    <span className={`truncate ${active ? "text-txt" : "text-mut"}`}>
                                      {channel.name}
                                    </span>
                                    {isPrivate && (
                                      <span title="Canal Privado">
                                        <Lock size={12} className="shrink-0 text-amber-400/80" />
                                      </span>
                                    )}
                                    {isMuted && (
                                      <span title="Canal Silenciado">
                                        <BellSlash size={12} className="shrink-0 text-amber-400/80" />
                                      </span>
                                    )}
                                    {channel.unreadCount > 0 && !isMuted && (
                                      <span
                                        aria-label={`${channel.unreadCount} não lidas em ${channel.name}`}
                                        className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-err px-1 text-[10px] font-bold text-bg"
                                      >
                                        {channel.unreadCount}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-0.5 ml-1 shrink-0">
                                    <ChannelMutePopover
                                      channelId={channel.channelId}
                                      channelName={channel.name}
                                      guildId={activeGuild?.guildId}
                                    />
                                    {canManage && (
                                      <button
                                        type="button"
                                        title="Configurações do canal"
                                        aria-label={`Configurações de ${channel.name}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setChannelSettingsTarget(channel);
                                        }}
                                        className={`cursor-pointer p-1 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-all ${
                                          active ? "opacity-80 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                                        }`}
                                      >
                                        <Gear size={13} />
                                      </button>
                                    )}
                                  </div>
                                </li>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56">
                                <ContextMenuLabel className="truncate text-txt font-semibold flex items-center gap-1.5">
                                  <Hash size={14} className="text-acc" />
                                  <span className="truncate">{channel.name}</span>
                                </ContextMenuLabel>
                                <ContextMenuSeparator />

                                <ContextMenuItem onClick={() => setActiveChannel(channel.channelId)}>
                                  <Hash size={14} weight="bold" className="text-acc" />
                                  <span>Abrir Canal</span>
                                </ContextMenuItem>

                                {canManage && (
                                  <ContextMenuItem onClick={() => setChannelSettingsTarget(channel)}>
                                    <Gear size={14} weight="bold" />
                                    <span>Configurações do Canal</span>
                                  </ContextMenuItem>
                                )}

                                <ContextMenuSeparator />

                                <ContextMenuSub>
                                  <ContextMenuSubTrigger>
                                    <BellSlash size={14} weight="bold" />
                                    <span>{isMuted ? "Canal Silenciado" : "Silenciar Canal"}</span>
                                  </ContextMenuSubTrigger>
                                  <ContextMenuSubContent className="w-48">
                                    {isMuted ? (
                                      <ContextMenuItem onClick={() => unmuteChannel(channel.channelId)}>
                                        <BellSimple size={14} weight="bold" className="text-online" />
                                        <span>Reativar Notificações</span>
                                      </ContextMenuItem>
                                    ) : (
                                      <>
                                        <ContextMenuItem onClick={() => muteChannel(channel.channelId, 15)}>
                                          <span>Por 15 minutos</span>
                                        </ContextMenuItem>
                                        <ContextMenuItem onClick={() => muteChannel(channel.channelId, 60)}>
                                          <span>Por 1 hora</span>
                                        </ContextMenuItem>
                                        <ContextMenuItem onClick={() => muteChannel(channel.channelId, 480)}>
                                          <span>Por 8 horas</span>
                                        </ContextMenuItem>
                                        <ContextMenuItem onClick={() => muteChannel(channel.channelId, 1440)}>
                                          <span>Por 24 horas</span>
                                        </ContextMenuItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem onClick={() => muteChannel(channel.channelId)}>
                                          <span>Até eu reativar</span>
                                        </ContextMenuItem>
                                      </>
                                    )}
                                  </ContextMenuSubContent>
                                </ContextMenuSub>

                                <ContextMenuItem onClick={() => navigator.clipboard.writeText(channel.channelId)}>
                                  <Copy size={14} weight="bold" />
                                  <span>Copiar ID do Canal</span>
                                </ContextMenuItem>

                                {canManage && (
                                  <>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      destructive
                                      onClick={() => handleDeleteChannel(channel)}
                                    >
                                      <Trash size={14} weight="bold" />
                                      <span>Excluir Canal</span>
                                    </ContextMenuItem>
                                  </>
                                )}
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        }

                        // Canal de voz
                        const connected = channel.channelId === activeVoiceChannelId && isVoiceConnected;

                        return (
                          <ContextMenu key={channel.channelId}>
                            <ContextMenuTrigger asChild>
                              <li
                                className={`group relative transition-all ${
                                  draggedChannelId === channel.channelId ? "opacity-30 scale-[0.98]" : ""
                                }`}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  const payload = JSON.stringify({ channelId: channel.channelId, sourceCategory: group.name });
                                  e.dataTransfer.setData("application/x-echo-channel", payload);
                                  e.dataTransfer.setData("text/plain", payload);
                                  e.dataTransfer.effectAllowed = "move";
                                  activeDragRef.current = { type: "channel", id: channel.channelId, category: group.name };
                                  (window as any).__ECHO_ACTIVE_DRAG__ = { type: "channel", id: channel.channelId, category: group.name };
                                  setDraggedChannelId(channel.channelId);
                                }}
                                onDragOver={(e) => {
                                  const activeDrag = activeDragRef.current || (window as any).__ECHO_ACTIVE_DRAG__;
                                  if (activeDrag) {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                  }

                                  const isMemberDrag =
                                    activeDrag?.type === "member" ||
                                    activeDrag?.type === "voice-member" ||
                                    e.dataTransfer.types.includes("application/x-echo-voice-member") ||
                                    e.dataTransfer.types.includes("application/x-echo-member");

                                  if (isMemberDrag) {
                                    e.stopPropagation();
                                    if (dragOverVoiceChannelId !== channel.channelId) {
                                      setDragOverVoiceChannelId(channel.channelId);
                                    }
                                    return;
                                  }

                                  const isChannelDrag =
                                    activeDrag?.type === "channel" ||
                                    (!activeDrag && (
                                      e.dataTransfer.types.includes("application/x-echo-channel") ||
                                      e.dataTransfer.types.includes("text/plain")
                                    ));

                                  if (!isChannelDrag) return;
                                  e.stopPropagation();
                                  if (activeDrag?.id === channel.channelId) return;

                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const midY = rect.top + rect.height / 2;
                                  const pos = e.clientY < midY ? "before" : "after";
                                  if (dragOverChannelId !== channel.channelId || dragOverChannelPosition !== pos) {
                                    setDragOverChannelId(channel.channelId);
                                    setDragOverChannelPosition(pos);
                                  }
                                }}
                                onDragLeave={(e) => {
                                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                  if (dragOverVoiceChannelId === channel.channelId) {
                                    setDragOverVoiceChannelId(null);
                                  }
                                  if (dragOverChannelId === channel.channelId) {
                                    setDragOverChannelId(null);
                                    setDragOverChannelPosition(null);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const pos = dragOverChannelPosition ?? "after";
                                  if (dragOverVoiceChannelId === channel.channelId) {
                                    setDragOverVoiceChannelId(null);
                                  }

                                  const activeDrag = (window as any).__ECHO_ACTIVE_DRAG__;
                                  if (activeDrag?.type === "member") {
                                    const { userId, username } = activeDrag.data;
                                    const isMe = userId === "me" || userId === effectiveUserId || (myUserId ? userId === myUserId : false);
                                    if (isMe) {
                                      handleConnectVoice(channel);
                                    } else {
                                      handleAddMemberToVoiceChannel(userId, username, channel);
                                    }
                                    (window as any).__ECHO_ACTIVE_DRAG__ = null;
                                    return;
                                  }
                                  if (activeDrag?.type === "voice-member") {
                                    const { userId, username, isMe } = activeDrag.data;
                                    handleMoveVoiceMemberToChannel(userId, username, channel, isMe);
                                    (window as any).__ECHO_ACTIVE_DRAG__ = null;
                                    return;
                                  }

                                  const voiceMemberRaw = e.dataTransfer.getData("application/x-echo-voice-member");
                                  const memberRaw = e.dataTransfer.getData("application/x-echo-member");

                                  if (voiceMemberRaw) {
                                    try {
                                      const { userId, username, isMe } = JSON.parse(voiceMemberRaw);
                                      handleMoveVoiceMemberToChannel(userId, username, channel, isMe);
                                      return;
                                    } catch {}
                                  }

                                  if (memberRaw) {
                                    try {
                                      const { userId, username } = JSON.parse(memberRaw);
                                      const isMe = userId === "me" || userId === effectiveUserId || (myUserId ? userId === myUserId : false);
                                      if (isMe) {
                                        handleConnectVoice(channel);
                                      } else {
                                        handleAddMemberToVoiceChannel(userId, username, channel);
                                      }
                                      return;
                                    } catch {}
                                  }

                                  const chanRaw =
                                    (activeDragRef.current?.type === "channel"
                                      ? JSON.stringify({
                                          channelId: activeDragRef.current.id,
                                          sourceCategory: activeDragRef.current.category,
                                        })
                                      : "") ||
                                    e.dataTransfer.getData("application/x-echo-channel") ||
                                    e.dataTransfer.getData("text/plain");
                                  activeDragRef.current = null;
                                  (window as any).__ECHO_ACTIVE_DRAG__ = null;
                                  setDraggedChannelId(null);
                                  setDragOverChannelId(null);
                                  setDragOverChannelPosition(null);

                                  if (chanRaw) {
                                    try {
                                      const parsed = JSON.parse(chanRaw);
                                      const sourceId = parsed.channelId || (parsed.type === "channel" ? parsed.id : null);
                                      if (sourceId && sourceId !== channel.channelId) {
                                        handleDropChannelOnChannel(sourceId, channel.channelId, group.name, pos);
                                      }
                                    } catch {}
                                  }
                                }}
                                onDragEnd={() => {
                                  activeDragRef.current = null;
                                  (window as any).__ECHO_ACTIVE_DRAG__ = null;
                                  setDraggedChannelId(null);
                                  setDragOverChannelId(null);
                                  setDragOverChannelPosition(null);
                                  setDragOverVoiceChannelId(null);
                                }}
                              >
                                {/* Linha indicadora de posição estilo Discord */}
                                {dragOverChannelId === channel.channelId && dragOverChannelPosition === "before" && (
                                  <div className="absolute left-1 right-1 -top-[2px] h-[2px] bg-acc rounded-full z-30 pointer-events-none shadow-[0_0_8px_#0fb9a8] flex items-center">
                                    <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-acc shadow-[0_0_6px_#0fb9a8]" />
                                  </div>
                                )}
                                {dragOverChannelId === channel.channelId && dragOverChannelPosition === "after" && (
                                  <div className="absolute left-1 right-1 -bottom-[2px] h-[2px] bg-acc rounded-full z-30 pointer-events-none shadow-[0_0_8px_#0fb9a8] flex items-center">
                                    <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-acc shadow-[0_0_6px_#0fb9a8]" />
                                  </div>
                                )}
                                <div className="flex items-center">
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    aria-current={connected ? "true" : undefined}
                                    onClick={() => handleConnectVoice(channel)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        handleConnectVoice(channel);
                                      }
                                    }}
                                    className={`cursor-pointer flex flex-1 min-w-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left text-xs transition-all ${
                                      dragOverVoiceChannelId === channel.channelId
                                        ? "ring-2 ring-online bg-online/20 text-online font-bold shadow-md shadow-online/20 scale-[1.02]"
                                        : connected
                                          ? "bg-online/10 text-online font-semibold border border-online/20 shadow-xs"
                                          : active
                                            ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt font-semibold shadow-sm"
                                            : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
                                    }`}
                                  >
                                    <DotsSixVertical size={11} className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing text-mut shrink-0 -ml-1 mr-0.5" />
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
                                    {isChannelMuted(channel.channelId, activeGuild?.guildId) && (
                                      <span title="Canal Silenciado">
                                        <BellSlash size={12} className="shrink-0 text-amber-400/80" />
                                      </span>
                                    )}
                                    {dragOverVoiceChannelId === channel.channelId ? (
                                      <span className="ml-auto text-[9px] uppercase font-bold text-online bg-online/25 px-1.5 py-0.5 rounded-full animate-pulse">
                                        Mover para cá
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                        {(() => {
                                          const channelParts = connected
                                            ? voiceParticipants
                                            : (guildVoiceState[channel.channelId] ?? []);
                                          const hasLive = Array.isArray(channelParts) && channelParts.some((p: any) => p.isScreenSharing);
                                          if (!hasLive) return null;
                                          return (
                                            <span
                                              className="flex items-center gap-1 rounded bg-err/20 px-1.5 py-0.5 text-[9px] font-bold text-err shrink-0 tracking-wider shadow-xs animate-pulse"
                                              title="Transmissão ao vivo em andamento"
                                            >
                                              <Television size={10} weight="fill" />
                                              AO VIVO
                                            </span>
                                          );
                                        })()}
                                        {connected && (
                                          <span className="flex h-2 w-2 rounded-full bg-online animate-ping shrink-0" />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-0.5 ml-1 shrink-0">
                                    <ChannelMutePopover
                                      channelId={channel.channelId}
                                      channelName={channel.name}
                                      guildId={activeGuild?.guildId}
                                    />
                                    {canManage && (
                                      <button
                                        type="button"
                                        title="Configurações do canal de voz"
                                        aria-label={`Configurações de ${channel.name}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setChannelSettingsTarget(channel);
                                        }}
                                        className={`cursor-pointer p-1 rounded-lg text-mut hover:text-txt hover:bg-white/[0.08] transition-all ${
                                          active || connected ? "opacity-80 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                                        }`}
                                      >
                                        <Gear size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Participantes conectados na chamada */}
                                {(() => {
                                  const channelParticipants = connected
                                    ? (() => {
                                        const fromServer = Array.isArray(guildVoiceState[channel.channelId])
                                          ? guildVoiceState[channel.channelId]
                                          : [];
                                        const map = new Map<string, any>();
                                        for (const p of fromServer) {
                                          const id = p.userId === "me" ? (myUserId || "me") : p.userId;
                                          map.set(id, p);
                                        }
                                        for (const p of voiceParticipants) {
                                          const id = p.userId === "me" ? (myUserId || "me") : p.userId;
                                          map.set(id, p);
                                        }
                                        return Array.from(map.values());
                                      })()
                                    : (guildVoiceState[channel.channelId] ?? []);
                                  if (!channelParticipants || channelParticipants.length === 0) return null;
                                  return (
                                    <ul className="ml-4 mt-1 mb-2 space-y-1 animate-in fade-in-0 duration-150">
                                      {channelParticipants.map((p) => (
                                        <VoiceParticipantItem
                                          key={p.userId}
                                          participant={p}
                                          channelId={channel.channelId}
                                          connected={connected}
                                          guildProfiles={guildProfiles}
                                          myUserId={myUserId}
                                          myAppwriteAvatarUrl={myAppwriteAvatarUrl}
                                          profileAvatarUrl={profileAvatarUrl}
                                          microphoneEnabled={microphoneEnabled}
                                          headphonesEnabled={headphonesEnabled}
                                          activeVoiceChannelId={activeVoiceChannelId}
                                          speakingMembers={speakingMembers}
                                          isSpeaking={isSpeaking}
                                          isVoiceConnected={isVoiceConnected}
                                          isOpen={openVoiceMemberId === p.userId}
                                          onOpenChange={(open) => setOpenVoiceMemberId(open ? p.userId : null)}
                                        />
                                      ))}
                                    </ul>
                                  );
                                })()}
                              </li>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56">
                              <ContextMenuLabel className="truncate text-txt font-semibold flex items-center gap-1.5">
                                <SpeakerHigh size={14} className="text-online" />
                                <span className="truncate">{channel.name}</span>
                              </ContextMenuLabel>
                              <ContextMenuSeparator />

                              <ContextMenuItem onClick={() => handleConnectVoice(channel)}>
                                <SpeakerHigh size={14} weight="bold" className="text-online" />
                                <span>{connected ? "Conectado ao Canal" : "Conectar ao Canal"}</span>
                              </ContextMenuItem>

                              {canManage && (
                                <ContextMenuItem onClick={() => setChannelSettingsTarget(channel)}>
                                  <Gear size={14} weight="bold" />
                                  <span>Configurações do Canal</span>
                                </ContextMenuItem>
                              )}

                              <ContextMenuSeparator />

                              <ContextMenuItem onClick={() => navigator.clipboard.writeText(channel.channelId)}>
                                <Copy size={14} weight="bold" />
                                <span>Copiar ID do Canal</span>
                              </ContextMenuItem>

                              {canManage && (
                                <>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    destructive
                                    onClick={() => handleDeleteChannel(channel)}
                                  >
                                    <Trash size={14} weight="bold" />
                                    <span>Excluir Canal</span>
                                  </ContextMenuItem>
                                </>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                      {canManageChannels && group.channels.some((c) => c.type === "voice") && (
                        <li className="mt-1">
                          <button
                            type="button"
                            onClick={handleCreateDynamicVoiceRoom}
                            aria-label="Criar sala de voz temporária"
                            className="cursor-pointer flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs text-mut/80 hover:text-acc hover:bg-acc/10 border border-dashed border-bd-subtle hover:border-acc/30 transition-all active:scale-[0.98]"
                          >
                            <Plus size={13} weight="bold" className="text-acc" />
                            <span className="font-medium truncate">Criar Sala de Voz Temporária</span>
                          </button>
                        </li>
                      )}
                    </ul>
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}

      <CreateChannelModal
        open={createChannelOpen}
        onClose={() => {
          setCreateChannelOpen(false);
          setTargetCategoryForChannel(undefined);
          setTargetTypeForChannel("text");
        }}
        guildId={activeGuildId ?? ""}
        initialCategory={targetCategoryForChannel}
        initialType={targetTypeForChannel}
        existingCategories={Array.from(
          new Set([
            ...(guildCategories as string[]),
            ...channelGroups.map((g) => g.name),
          ]),
        ).filter((c) => c !== "Canais de texto" && c !== "Canais de voz")}
        onCreate={(data) =>
          matrixService.createChannel(activeGuildId ?? "", data)
        }
        onCreated={(channel) => {
          setActiveChannel(channel.channelId);
    useFriendsStore.getState().setSelectedFriendId(null);
          const currentChannels = useSyncStore.getState().channelsByGuild[activeGuildId ?? ""] ?? [];
          setChannels(activeGuildId ?? "", [
            {
              ...channel,
              unreadCount: 0,
              type: (channel as any).type ?? targetTypeForChannel,
              category: (channel as any).category ?? targetCategoryForChannel,
            },
            ...currentChannels,
          ]);
        }}
      />
      <CreateCategoryModal
        open={createCategoryOpen}
        guildId={activeGuildId ?? ""}
        onClose={() => setCreateCategoryOpen(false)}
        onCreateCategory={(catName) => {
          if (activeGuildId) {
            createCategory(activeGuildId, catName);
          }
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
            try {
              await matrixService.editChannel(channelSettingsTarget.channelId, {
                name: updates.name,
                topic: updates.topic,
              });
            } catch (err) {
              console.error("Erro ao salvar canal:", err);
            }
            const currentList = allChannels.map((c) =>
              c.channelId === channelSettingsTarget.channelId
                ? { ...c, name: updates.name, topic: updates.topic ?? c.topic }
                : c,
            );
            useSyncStore.getState().setChannels(activeGuildId ?? "", currentList);
          }}
          onDelete={async (deletedId) => {
            try {
              await matrixService.deleteChannel(deletedId);
            } catch (err) {
              console.error("Erro ao deletar canal:", err);
            }
            const nextList = allChannels.filter((c) => c.channelId !== deletedId);
            useSyncStore.getState().setChannels(activeGuildId ?? "", nextList);
            if (activeChannelId === deletedId && nextList.length > 0) {
              const firstText = nextList.find((c) => c.type !== "voice");
              useUiStore.getState().setActiveChannel(firstText?.channelId ?? nextList[0].channelId);
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

      {footer}
    </aside>
  );
}

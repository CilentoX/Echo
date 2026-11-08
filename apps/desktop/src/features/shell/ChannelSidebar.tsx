import {
  Camera,
  Hash,
  MagnifyingGlass,
  Gear,
  Plus,
  Sparkle,
  SpeakerHigh,
  UserPlus,
  X,
  Lock,
  CaretDown,
  CaretRight,
  Bell,
  BellSlash,
  FolderSimplePlus,
  Trash,
  Copy,
  Check,
  Pencil,
  SignOut,
  BellSimple,
  DotsSixVertical,
  Television,
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
import MxcImage from "@/components/media/MxcImage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import MemberDropdownContent from "./MemberDropdownContent";
import MemberContextMenu from "./MemberContextMenu";
import { hasChannelPermission } from "@/lib/permissions/channelPermissions";
import type { ChannelSummary } from "@/lib/matrix/types";
import { ECHO_API_CONFIG } from "@/lib/api/config";
import { useEchoApi } from "@/lib/api/echoApi";

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
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerCopied, setHeaderCopied] = useState(false);

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
      {/* Top Header Bar da Guilda (Ergonomia Discord, texto nítido em text-txt, botões táteis) */}
      {activeGuild ? (
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
                      setCreateCategoryOpen(true);
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
                      setTargetCategoryForChannel(undefined);
                      setTargetTypeForChannel("text");
                      setCreateChannelOpen(true);
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
                        setInviteOpen(true);
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
                          setEditGuildOpen(true);
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
                            setTargetCategoryForChannel(undefined);
                            setTargetTypeForChannel("text");
                            setCreateChannelOpen(true);
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
                            setCreateCategoryOpen(true);
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
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(activeGuild.guildId);
                          setHeaderCopied(true);
                          setTimeout(() => setHeaderCopied(false), 2000);
                        } catch {}
                      }}
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
                        onClick={async () => {
                          setHeaderMenuOpen(false);
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
                        className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-err hover:bg-err/10 transition-all cursor-pointer font-medium text-left"
                      >
                        <Trash size={15} weight="bold" />
                        <span>Excluir Servidor</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          setHeaderMenuOpen(false);
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
            <ContextMenuItem onClick={() => setInviteOpen(true)}>
              <UserPlus size={15} weight="bold" className="text-acc" />
              <span>Convidar Pessoas</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setEditGuildOpen(true)}>
              <Gear size={15} weight="bold" />
              <span>Configurações do Servidor</span>
            </ContextMenuItem>
            {canManageChannels && (
              <>
                <ContextMenuItem
                  onClick={() => {
                    setTargetCategoryForChannel(undefined);
                    setTargetTypeForChannel("text");
                    setCreateChannelOpen(true);
                  }}
                >
                  <Plus size={15} weight="bold" />
                  <span>Criar Canal</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setCreateCategoryOpen(true)}>
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
                onClick={async () => {
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
                className="flex items-center gap-2 cursor-pointer text-err focus:text-err"
              >
                <Trash size={15} weight="bold" />
                <span>Excluir Servidor</span>
              </ContextMenuItem>
            ) : (
              <ContextMenuItem
                destructive
                onClick={async () => {
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
                className="flex items-center gap-2 cursor-pointer text-err focus:text-err"
              >
                <SignOut size={15} weight="bold" />
                <span>Sair do Servidor</span>
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
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
                                      {channelParticipants.map((p) => {
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
                                      const isParticipantMuted = Boolean(
                                        p.isMuted ||
                                        p.isDeafened ||
                                        (isMe && (!microphoneEnabled || !headphonesEnabled))
                                      );
                                      const isThisActiveVoiceChannel = channel.channelId === activeVoiceChannelId;
                                      const participantSpeaking =
                                        isThisActiveVoiceChannel &&
                                        !isParticipantMuted &&
                                        (p.isSpeaking ||
                                          speakingMembers.includes(p.userId) ||
                                          (isMe &&
                                            connected &&
                                            isVoiceConnected &&
                                            (isSpeaking ||
                                              speakingMembers.includes("me") ||
                                              (effectiveUserId ? speakingMembers.includes(effectiveUserId) : false))));

                                      return (
                                        <MemberContextMenu
                                          key={p.userId}
                                          userId={effectiveUserId || p.userId}
                                          displayName={effectiveNick}
                                          avatarUrl={effectiveAvatar}
                                          onOpenProfile={() => setOpenVoiceMemberId(p.userId)}
                                        >
                                          <li
                                            className="relative cursor-grab active:cursor-grabbing"
                                            draggable={true}
                                            onDragStart={(e) => {
                                              e.stopPropagation();
                                              const payload = JSON.stringify({ userId: effectiveUserId || p.userId || "me", username: effectiveNick, isMe });
                                              e.dataTransfer.setData("application/x-echo-voice-member", payload);
                                              e.dataTransfer.setData("text/plain", effectiveUserId || p.userId || "me");
                                              e.dataTransfer.effectAllowed = "move";
                                              (window as any).__ECHO_ACTIVE_DRAG__ = {
                                                type: "voice-member",
                                                id: effectiveUserId || p.userId || "me",
                                                data: { userId: effectiveUserId || p.userId || "me", username: effectiveNick, isMe },
                                              };
                                            }}
                                            onDragEnd={() => {
                                              (window as any).__ECHO_ACTIVE_DRAG__ = null;
                                            }}
                                          >
                                            <Popover
                                              open={openVoiceMemberId === p.userId}
                                              onOpenChange={(open) => setOpenVoiceMemberId(open ? p.userId : null)}
                                            >
                                              <PopoverTrigger asChild>
                                                <div
                                                  role="button"
                                                  tabIndex={0}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                      e.preventDefault();
                                                      setOpenVoiceMemberId(openVoiceMemberId === p.userId ? null : p.userId);
                                                    }
                                                  }}
                                                  aria-label={`Perfil de ${effectiveNick}`}
                                                  className={`cursor-pointer flex w-full items-center gap-1.5 py-1 px-2 rounded-xl text-xs transition-all active:scale-[0.98] group ${
                                                    openVoiceMemberId === p.userId
                                                      ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt"
                                                      : participantSpeaking
                                                        ? "bg-online/10 text-online border border-online/20"
                                                        : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
                                                  }`}
                                                >
                                                  <DotsSixVertical
                                                    size={11}
                                                    className="opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing text-mut shrink-0 -ml-1 mr-0.5"
                                                  />
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

                                                  {/* Badge de Live/Transmissão de Tela */}
                                                  {p.isScreenSharing && (
                                                    <span
                                                      className="flex items-center gap-0.5 rounded bg-err/15 px-1.5 py-0.5 text-[9px] font-bold text-err shrink-0 tracking-wider shadow-xs animate-pulse"
                                                      title="Transmitindo tela"
                                                    >
                                                      <Television size={10} weight="fill" />
                                                      AO VIVO
                                                    </span>
                                                  )}

                                                  {/* Equalizer Waveform quando Falando */}
                                                  {participantSpeaking && (
                                                    <div className="flex items-center gap-0.5 shrink-0" title="Falando...">
                                                      <span className="h-2 w-0.5 rounded-full bg-online animate-[pulse_0.6s_ease-in-out_infinite]" />
                                                      <span className="h-3 w-0.5 rounded-full bg-online animate-[pulse_0.4s_ease-in-out_infinite_150ms]" />
                                                      <span className="h-1.5 w-0.5 rounded-full bg-online animate-[pulse_0.5s_ease-in-out_infinite_300ms]" />
                                                    </div>
                                                  )}
                                                </div>
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
                                                  initialDisplayName={effectiveNick}
                                                  initialAvatarUrl={effectiveAvatar}
                                                  onClose={() => setOpenVoiceMemberId(null)}
                                                />
                                              </PopoverContent>
                                            </Popover>
                                          </li>
                                        </MemberContextMenu>
                                      );
                                    })}
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

import { create } from "zustand";
import type {
  ChannelSummary,
  GuildSummary,
  MemberSummary,
  NormalizedEvent,
  NormalizedReaction,
  SyncStatus,
} from "@/lib/matrix/types";
import type { GuildMemberProfile, GuildRole, GuildMemberRole } from "@/lib/api/echoApi";
import type { ChannelPermissionsConfig } from "@/lib/permissions/channelPermissions";
import { desktopCache } from "@/lib/storage/desktopConfig";

export interface MuteEntry {
  until: number | "indefinite";
  mutedAt: number;
}

export interface CustomGuildEmoji {
  id: string;
  guildId: string;
  name: string;
  url: string;
  createdBy?: string;
  createdAt: number;
}

export interface SyncState {
  status: SyncStatus;
  guilds: GuildSummary[];
  channelsByGuild: Record<string, ChannelSummary[]>;
  timelineByChannel: Record<string, NormalizedEvent[]>;
  reactionsByEvent: Record<string, NormalizedReaction[]>;
  membersByRoom: Record<string, MemberSummary[]>;
  guildMemberProfiles: Record<string, Record<string, GuildMemberProfile>>;
  guildRoles: Record<string, GuildRole[]>;
  guildMemberRoles: Record<string, Record<string, string[]>>; // guildId -> userId -> roleIds[]
  channelPermissions: Record<string, ChannelPermissionsConfig>;
  readByChannel: Record<string, { userId: string; eventId: string }[]>;
  pinnedByRoom: Record<string, string[]>;
  mutedChannels: Record<string, MuteEntry>;
  mutedGuilds: Record<string, MuteEntry>;
  guildEmojis: Record<string, CustomGuildEmoji[]>;
  guildCategories: Record<string, string[]>;
  setGuilds(list: GuildSummary[]): void;
  setChannels(guildId: string, list: ChannelSummary[]): void;
  setMembers(roomId: string, members: MemberSummary[]): void;
  setGuildMemberProfiles(guildId: string, profiles: GuildMemberProfile[]): void;
  setMemberGuildNickname(guildId: string, userId: string, nickname: string | null): void;
  setGuildRoles(guildId: string, roles: GuildRole[]): void;
  setGuildMemberRoles(guildId: string, memberRoles: GuildMemberRole[]): void;
  setChannelPermissions(channelId: string, config: ChannelPermissionsConfig): void;
  applyEvent(e: NormalizedEvent): void;
  prependEvents(channelId: string, events: NormalizedEvent[]): void;
  applyReaction(r: NormalizedReaction): void;
  markRead(roomId: string, userId: string, eventId: string): void;
  pinMessage(roomId: string, eventId: string): void;
  unpinMessage(roomId: string, eventId: string): void;
  muteChannel(channelId: string, durationMinutes?: number): void;
  unmuteChannel(channelId: string): void;
  muteGuild(guildId: string, durationMinutes?: number): void;
  unmuteGuild(guildId: string): void;
  isChannelMuted(channelId: string, guildId?: string): boolean;
  isGuildMuted(guildId: string): boolean;
  addGuildEmoji(guildId: string, emoji: { name: string; url: string; createdBy?: string }): void;
  removeGuildEmoji(guildId: string, emojiId: string): void;
  createCategory(guildId: string, name: string): void;
  deleteCategory(guildId: string, name: string): void;
  reorderCategories(guildId: string, orderedCategories: string[]): void;
  moveChannelCategory(guildId: string, channelId: string, targetCategory: string, targetIndex?: number): void;
  reorderChannels(guildId: string, orderedChannels: ChannelSummary[]): void;
  setStatus(s: SyncStatus): void;
  /** Volta ao estado inicial (logout/troca de conta; usado pelo wiring). */
  reset(): void;
  /** Anexa placeholder otimista (id local `pending-*`) na timeline. */
  addPendingEvent(e: NormalizedEvent): void;
  /** Troca o placeholder `localId` pelo evento real quando sendMessage resolve (R2). */
  resolvePending(localId: string, event: NormalizedEvent): void;
  /** Remove o placeholder `localId` (rollback de envio que falhou); no-op se ausente. */
  removePending(roomId: string, localId: string): void;
}

/** Snapshot vazio compartilhado e congelado: useSyncExternalStore (zustand v5)
 *  exige referência estável — `?? []` por chamada causaria loop infinito. */
const EMPTY: readonly never[] = Object.freeze([]);

function emptyOr<T>(list: T[] | undefined): T[] | readonly never[] {
  return list ?? EMPTY;
}

/**
 * Store de dados vindos do sync loop. Não fala com o SDK: quem liga
 * MatrixService ↔ store é o SessionGate/bootstrap
 * (startSyncHandlers → applyEvent / applyReaction / markRead / setMembers).
 */
export const useSyncStore = create<SyncState>()((set, get) => {
  // Dedupe por eventId cobre os ecos do sync; placeholders pend-* nunca
  // colidem com eventIds reais — são trocados/removidos via resolvePending/
  // removePending (R2).
  const appendEvent = (e: NormalizedEvent) =>
    set((state) => {
      const timeline = state.timelineByChannel[e.roomId] ?? [];
      if (timeline.some((m) => m.eventId === e.eventId)) return state;
      // Se este evento real é do próprio usuário e corresponde a um placeholder pendente recente:
      const pendingIdx = timeline.findIndex(
        (m) =>
          m.eventId.startsWith("pending-") &&
          m.sender === e.sender &&
          (m.body === e.body || (m.msgtype === e.msgtype && Math.abs(m.originServerTs - e.originServerTs) < 60000)),
      );
      if (pendingIdx !== -1) {
        const nextTimeline = [...timeline];
        nextTimeline[pendingIdx] = e;
        return {
          timelineByChannel: { ...state.timelineByChannel, [e.roomId]: nextTimeline },
        };
      }
      return {
        timelineByChannel: { ...state.timelineByChannel, [e.roomId]: [...timeline, e] },
      };
    });

  return {
    status: "connecting",
    guilds: [],
    channelsByGuild: {},
    timelineByChannel: {},
    reactionsByEvent: {},
    membersByRoom: {},
    guildMemberProfiles: {},
    guildRoles: {},
    guildMemberRoles: {},
    channelPermissions: desktopCache.get("channelPermissions") || {},
    readByChannel: {},
    pinnedByRoom: (() => {
      try {
        const raw = localStorage.getItem("echo:pinnedMessages");
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })(),
    mutedChannels: (() => {
      try {
        const raw = localStorage.getItem("echo:mutedChannels");
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })(),
    mutedGuilds: (() => {
      try {
        const raw = localStorage.getItem("echo:mutedGuilds");
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })(),
    guildEmojis: (() => {
      try {
        const raw = localStorage.getItem("echo:guildEmojis");
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })(),
    guildCategories: (() => {
      try {
        const raw = localStorage.getItem("echo:guildCategories");
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })(),

    muteChannel: (channelId, durationMinutes) =>
      set((state) => {
        const until: number | "indefinite" = durationMinutes
          ? Date.now() + durationMinutes * 60 * 1000
          : "indefinite";
        const updated: Record<string, MuteEntry> = {
          ...state.mutedChannels,
          [channelId]: { until, mutedAt: Date.now() },
        };
        try {
          localStorage.setItem("echo:mutedChannels", JSON.stringify(updated));
        } catch {}
        return { mutedChannels: updated };
      }),

    unmuteChannel: (channelId) =>
      set((state) => {
        const updated = { ...state.mutedChannels };
        delete updated[channelId];
        try {
          localStorage.setItem("echo:mutedChannels", JSON.stringify(updated));
        } catch {}
        return { mutedChannels: updated };
      }),

    muteGuild: (guildId, durationMinutes) =>
      set((state) => {
        const until: number | "indefinite" = durationMinutes
          ? Date.now() + durationMinutes * 60 * 1000
          : "indefinite";
        const updated: Record<string, MuteEntry> = {
          ...state.mutedGuilds,
          [guildId]: { until, mutedAt: Date.now() },
        };
        try {
          localStorage.setItem("echo:mutedGuilds", JSON.stringify(updated));
        } catch {}
        return { mutedGuilds: updated };
      }),

    unmuteGuild: (guildId) =>
      set((state) => {
        const updated = { ...state.mutedGuilds };
        delete updated[guildId];
        try {
          localStorage.setItem("echo:mutedGuilds", JSON.stringify(updated));
        } catch {}
        return { mutedGuilds: updated };
      }),

    isChannelMuted: (channelId, guildId) => {
      const state = get();
      const channelMute = state.mutedChannels[channelId];
      if (channelMute) {
        if (channelMute.until === "indefinite" || Date.now() < channelMute.until) {
          return true;
        }
      }
      if (guildId) {
        const guildMute = state.mutedGuilds[guildId];
        if (guildMute) {
          if (guildMute.until === "indefinite" || Date.now() < guildMute.until) {
            return true;
          }
        }
      }
      return false;
    },

    isGuildMuted: (guildId) => {
      const state = get();
      const guildMute = state.mutedGuilds[guildId];
      if (!guildMute) return false;
      return guildMute.until === "indefinite" || Date.now() < guildMute.until;
    },

    addGuildEmoji: (guildId, emoji) =>
      set((state) => {
        const list = state.guildEmojis[guildId] ?? [];
        const newEmoji: CustomGuildEmoji = {
          id: `emoji-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          guildId,
          name: emoji.name.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || "emoji",
          url: emoji.url,
          createdBy: emoji.createdBy,
          createdAt: Date.now(),
        };
        const updated = {
          ...state.guildEmojis,
          [guildId]: [...list, newEmoji],
        };
        try {
          localStorage.setItem("echo:guildEmojis", JSON.stringify(updated));
        } catch {}
        return { guildEmojis: updated };
      }),

    removeGuildEmoji: (guildId, emojiId) =>
      set((state) => {
        const list = state.guildEmojis[guildId] ?? [];
        const updated = {
          ...state.guildEmojis,
          [guildId]: list.filter((e) => e.id !== emojiId),
        };
        try {
          localStorage.setItem("echo:guildEmojis", JSON.stringify(updated));
        } catch {}
        return { guildEmojis: updated };
      }),

    createCategory: (guildId, name) =>
      set((state) => {
        const trimmed = name.trim();
        if (!trimmed) return state;
        const list = state.guildCategories[guildId] ?? [];
        if (list.includes(trimmed)) return state;
        const updated = {
          ...state.guildCategories,
          [guildId]: [...list, trimmed],
        };
        try {
          localStorage.setItem("echo:guildCategories", JSON.stringify(updated));
        } catch {}
        return { guildCategories: updated };
      }),

    deleteCategory: (guildId, name) =>
      set((state) => {
        const list = state.guildCategories[guildId] ?? [];
        const updated = {
          ...state.guildCategories,
          [guildId]: list.filter((c) => c !== name),
        };
        try {
          localStorage.setItem("echo:guildCategories", JSON.stringify(updated));
        } catch {}
        return { guildCategories: updated };
      }),

    reorderCategories: (guildId, orderedCategories) =>
      set((state) => {
        const updated = {
          ...state.guildCategories,
          [guildId]: [...orderedCategories],
        };
        try {
          localStorage.setItem("echo:guildCategories", JSON.stringify(updated));
        } catch {}
        return { guildCategories: updated };
      }),

    moveChannelCategory: (guildId, channelId, targetCategory, targetIndex) =>
      set((state) => {
        const channels = state.channelsByGuild[guildId] ? [...state.channelsByGuild[guildId]] : [];
        const channelIndex = channels.findIndex((c) => c.channelId === channelId);
        if (channelIndex === -1) return state;

        const [channel] = channels.splice(channelIndex, 1);
        const updatedChannel = { ...channel, category: targetCategory };

        if (typeof targetIndex === "number" && targetIndex >= 0 && targetIndex <= channels.length) {
          channels.splice(targetIndex, 0, updatedChannel);
        } else {
          channels.push(updatedChannel);
        }

        const updatedChannels = {
          ...state.channelsByGuild,
          [guildId]: channels,
        };

        try {
          const raw = localStorage.getItem("echo:channelOverrides");
          const map = raw ? JSON.parse(raw) : {};
          const guildMap = map[guildId] || {};
          guildMap[channelId] = { category: targetCategory };
          map[guildId] = guildMap;
          localStorage.setItem("echo:channelOverrides", JSON.stringify(map));
        } catch {}

        return { channelsByGuild: updatedChannels };
      }),

    reorderChannels: (guildId, orderedChannels) =>
      set((state) => {
        const updatedChannels = {
          ...state.channelsByGuild,
          [guildId]: [...orderedChannels],
        };
        try {
          localStorage.setItem(
            `echo:channelOrder:${guildId}`,
            JSON.stringify(orderedChannels.map((c) => c.channelId))
          );
        } catch {}
        return { channelsByGuild: updatedChannels };
      }),

    pinMessage: (roomId, eventId) =>
      set((state) => {
        const current = state.pinnedByRoom[roomId] ?? [];
        if (current.includes(eventId)) return state;
        const updated = {
          ...state.pinnedByRoom,
          [roomId]: [...current, eventId],
        };
        try {
          localStorage.setItem("echo:pinnedMessages", JSON.stringify(updated));
        } catch {}
        return { pinnedByRoom: updated };
      }),

    unpinMessage: (roomId, eventId) =>
      set((state) => {
        const current = state.pinnedByRoom[roomId] ?? [];
        if (!current.includes(eventId)) return state;
        const updated = {
          ...state.pinnedByRoom,
          [roomId]: current.filter((id) => id !== eventId),
        };
        try {
          localStorage.setItem("echo:pinnedMessages", JSON.stringify(updated));
        } catch {}
        return { pinnedByRoom: updated };
      }),

    setGuilds: (list) => set({ guilds: [...list] }),

    setChannels: (guildId, list) =>
      set((state) => {
        let channels = [...list];
        try {
          const raw = localStorage.getItem("echo:channelOverrides");
          if (raw) {
            const map = JSON.parse(raw);
            const guildMap = map[guildId];
            if (guildMap) {
              channels = channels.map((c) => {
                if (guildMap[c.channelId]?.category !== undefined) {
                  return { ...c, category: guildMap[c.channelId].category };
                }
                return c;
              });
            }
          }
          const orderRaw = localStorage.getItem(`echo:channelOrder:${guildId}`);
          if (orderRaw) {
            const order: string[] = JSON.parse(orderRaw);
            channels.sort((a, b) => {
              const idxA = order.indexOf(a.channelId);
              const idxB = order.indexOf(b.channelId);
              if (idxA === -1 && idxB === -1) return 0;
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });
          }
        } catch {}
        return {
          channelsByGuild: { ...state.channelsByGuild, [guildId]: channels },
        };
      }),

    setMembers: (roomId, members) =>
      set((state) => ({
        membersByRoom: { ...state.membersByRoom, [roomId]: [...members] },
      })),

    setGuildMemberProfiles: (guildId, profiles) =>
      set((state) => {
        const currentMap = state.guildMemberProfiles[guildId] || {};
        const nextMap = { ...currentMap };
        for (const p of profiles) {
          nextMap[p.userId] = p;
        }
        return {
          guildMemberProfiles: {
            ...state.guildMemberProfiles,
            [guildId]: nextMap,
          },
        };
      }),

    setMemberGuildNickname: (guildId, userId, nickname) =>
      set((state) => {
        const currentMap = state.guildMemberProfiles[guildId] || {};
        const existing = currentMap[userId] || {
          id: `local-${Date.now()}`,
          guildId,
          userId,
          nickname,
          avatarUrl: null,
        };
        return {
          guildMemberProfiles: {
            ...state.guildMemberProfiles,
            [guildId]: {
              ...currentMap,
              [userId]: { ...existing, nickname },
            },
          },
        };
      }),

    setGuildRoles: (guildId, roles) =>
      set((state) => ({
        guildRoles: {
          ...state.guildRoles,
          [guildId]: [...roles],
        },
      })),

    setGuildMemberRoles: (guildId, memberRoles) =>
      set((state) => {
        const userRoleMap: Record<string, string[]> = {};
        for (const mr of memberRoles) {
          if (!userRoleMap[mr.userId]) {
            userRoleMap[mr.userId] = [];
          }
          if (!userRoleMap[mr.userId].includes(mr.roleId)) {
            userRoleMap[mr.userId].push(mr.roleId);
          }
        }
        return {
          guildMemberRoles: {
            ...state.guildMemberRoles,
            [guildId]: userRoleMap,
          },
        };
      }),

    setChannelPermissions: (channelId, config) => {
      desktopCache.cacheChannelPermissions(channelId, config);
      set((state) => ({
        channelPermissions: {
          ...state.channelPermissions,
          [channelId]: config,
        },
      }));
    },

    setStatus: (status) => set({ status }),

    reset: () =>
      set({
        status: "connecting",
        guilds: [],
        channelsByGuild: {},
        timelineByChannel: {},
        reactionsByEvent: {},
        membersByRoom: {},
        guildMemberProfiles: {},
        guildRoles: {},
        guildMemberRoles: {},
        channelPermissions: desktopCache.get("channelPermissions") || {},
        readByChannel: {},
        pinnedByRoom: {},
        guildCategories: {},
      }),

    addPendingEvent: appendEvent,

    applyEvent: appendEvent,

    prependEvents: (channelId, events) =>
      set((state) => {
        const timeline = state.timelineByChannel[channelId] ?? [];
        const existingIds = new Set(timeline.map((m) => m.eventId));
        const newestFirst = [...events].reverse(); // eventos antigos primeiro → novos depois
        // Keep existing timeline, prepend only new events not already present
        const newEvents = newestFirst.filter((e) => !existingIds.has(e.eventId));
        const merged = [...newEvents, ...timeline];
        return {
          timelineByChannel: { ...state.timelineByChannel, [channelId]: merged },
        };
      }),

    applyReaction: (r) =>
      set((state) => {
        const byEvent = state.reactionsByEvent[r.targetEventId] ?? [];
        if (byEvent.some((x) => x.eventId === r.eventId)) return state;
        return {
          reactionsByEvent: {
            ...state.reactionsByEvent,
            [r.targetEventId]: [...byEvent, r],
          },
        };
      }),

    markRead: (roomId, userId, eventId) =>
      set((state) => {
        const reads = state.readByChannel[roomId] ?? [];
        if (reads.some((x) => x.userId === userId && x.eventId === eventId)) return state;
        return {
          readByChannel: {
            ...state.readByChannel,
            [roomId]: [...reads, { userId, eventId }],
          },
        };
      }),

    resolvePending: (localId, event) =>
      set((state) => {
        const timeline = state.timelineByChannel[event.roomId] ?? [];
        const idx = timeline.findIndex((m) => m.eventId === localId);
        if (idx === -1) {
          if (timeline.some((m) => m.eventId === event.eventId)) return state;
          return {
            timelineByChannel: { ...state.timelineByChannel, [event.roomId]: [...timeline, event] },
          };
        }
        const nextTimeline = [...timeline];
        if (nextTimeline.some((m) => m.eventId === event.eventId)) {
          nextTimeline.splice(idx, 1);
        } else {
          nextTimeline[idx] = event;
        }
        return {
          timelineByChannel: { ...state.timelineByChannel, [event.roomId]: nextTimeline },
        };
      }),

    removePending: (roomId, localId) =>
      set((state) => {
        const timeline = state.timelineByChannel[roomId];
        if (!timeline || !timeline.some((m) => m.eventId === localId)) return state;
        return {
          timelineByChannel: {
            ...state.timelineByChannel,
            [roomId]: timeline.filter((m) => m.eventId !== localId),
          },
        };
      }),
  };
});

export const selectGuilds = (state: SyncState): GuildSummary[] => state.guilds;

export const selectChannels =
  (guildId: string) =>
    (state: SyncState): ChannelSummary[] | readonly never[] =>
      emptyOr(state.channelsByGuild[guildId]);

export const selectTimeline =
  (channelId: string) =>
    (state: SyncState): NormalizedEvent[] | readonly never[] =>
      emptyOr(state.timelineByChannel[channelId]);

export const selectReactions =
  (eventId: string) =>
    (state: SyncState): NormalizedReaction[] | readonly never[] =>
      emptyOr(state.reactionsByEvent[eventId]);

export const selectMembers =
  (roomId: string) =>
    (state: SyncState): MemberSummary[] | readonly never[] =>
      emptyOr(state.membersByRoom[roomId]);

export const selectReadByChannel =
  (roomId: string) =>
    (state: SyncState): { userId: string; eventId: string }[] | readonly never[] =>
      emptyOr(state.readByChannel[roomId]);

export const selectChannelPermissions =
  (channelId: string) =>
    (state: SyncState): ChannelPermissionsConfig | undefined =>
      state.channelPermissions[channelId];

export const selectGuildRoles =
  (guildId: string) =>
    (state: SyncState): GuildRole[] | readonly never[] =>
      emptyOr(state.guildRoles[guildId]);

export const selectUserGuildRoles =
  (guildId: string, userId: string) =>
    (state: SyncState): string[] | readonly never[] =>
      emptyOr(state.guildMemberRoles[guildId]?.[userId]);

export const selectGuildEmojis =
  (guildId: string) =>
    (state: SyncState): CustomGuildEmoji[] | readonly never[] =>
      emptyOr(state.guildEmojis[guildId]);

const EMPTY_CATEGORIES: readonly string[] = Object.freeze([]);

export const selectGuildCategories =
  (guildId: string) =>
    (state: SyncState): readonly string[] =>
      state.guildCategories[guildId] ?? EMPTY_CATEGORIES;

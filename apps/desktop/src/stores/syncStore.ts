import { create } from "zustand";
import type {
  ChannelSummary,
  GuildSummary,
  MemberSummary,
  NormalizedEvent,
  NormalizedReaction,
  SyncStatus,
} from "@/lib/matrix/types";
import type { GuildMemberProfile } from "@/lib/api/echoApi";

export interface SyncState {
  status: SyncStatus;
  guilds: GuildSummary[];
  channelsByGuild: Record<string, ChannelSummary[]>;
  timelineByChannel: Record<string, NormalizedEvent[]>;
  reactionsByEvent: Record<string, NormalizedReaction[]>;
  membersByRoom: Record<string, MemberSummary[]>;
  guildMemberProfiles: Record<string, Record<string, GuildMemberProfile>>;
  readByChannel: Record<string, { userId: string; eventId: string }[]>;
  setGuilds(list: GuildSummary[]): void;
  setChannels(guildId: string, list: ChannelSummary[]): void;
  setMembers(roomId: string, members: MemberSummary[]): void;
  setGuildMemberProfiles(guildId: string, profiles: GuildMemberProfile[]): void;
  setMemberGuildNickname(guildId: string, userId: string, nickname: string | null): void;
  applyEvent(e: NormalizedEvent): void;
  prependEvents(channelId: string, events: NormalizedEvent[]): void;
  applyReaction(r: NormalizedReaction): void;
  markRead(roomId: string, userId: string, eventId: string): void;
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
export const useSyncStore = create<SyncState>()((set) => {
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
    readByChannel: {},

    setGuilds: (list) => set({ guilds: [...list] }),

    setChannels: (guildId, list) =>
      set((state) => ({
        channelsByGuild: { ...state.channelsByGuild, [guildId]: [...list] },
      })),

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
        readByChannel: {},
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

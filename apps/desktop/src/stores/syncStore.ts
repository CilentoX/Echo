import { create } from "zustand";
import type { ChannelSummary, GuildSummary, NormalizedEvent, SyncStatus } from "@/lib/matrix/types";

export interface SyncState {
  status: SyncStatus;
  guilds: GuildSummary[];
  channelsByGuild: Record<string, ChannelSummary[]>;
  timelineByChannel: Record<string, NormalizedEvent[]>;
  setGuilds(list: GuildSummary[]): void;
  setChannels(guildId: string, list: ChannelSummary[]): void;
  applyEvent(e: NormalizedEvent): void;
  setStatus(s: SyncStatus): void;
  /** Anexa placeholder otimista (id local `pending-*`) na timeline. */
  addPendingEvent(e: NormalizedEvent): void;
  /** Troca o placeholder `localId` pelo evento real quando sendMessage resolve (R2). */
  resolvePending(localId: string, event: NormalizedEvent): void;
}

/**
 * Store de dados vindos do sync loop. Não fala com o SDK: quem liga
 * MatrixService ↔ store é o SessionGate/bootstrap
 * (startSync(onEvent → applyEvent, onStatus → setStatus)).
 */
export const useSyncStore = create<SyncState>()((set) => ({
  status: "connecting",
  guilds: [],
  channelsByGuild: {},
  timelineByChannel: {},

  setGuilds: (list) => set({ guilds: [...list] }),

  setChannels: (guildId, list) =>
    set((state) => ({
      channelsByGuild: { ...state.channelsByGuild, [guildId]: [...list] },
    })),

  setStatus: (status) => set({ status }),

  // Dedupe por eventId cobre os ecos do sync; placeholders pend-* nunca
  // colidem com eventIds reais — são trocados via resolvePending (R2).
  applyEvent: (e) =>
    set((state) => {
      const timeline = state.timelineByChannel[e.roomId] ?? [];
      if (timeline.some((m) => m.eventId === e.eventId)) return state;
      return {
        timelineByChannel: { ...state.timelineByChannel, [e.roomId]: [...timeline, e] },
      };
    }),

  addPendingEvent: (e) =>
    set((state) => {
      const timeline = state.timelineByChannel[e.roomId] ?? [];
      if (timeline.some((m) => m.eventId === e.eventId)) return state;
      return {
        timelineByChannel: { ...state.timelineByChannel, [e.roomId]: [...timeline, e] },
      };
    }),

  resolvePending: (localId, event) =>
    set((state) => {
      const timeline = state.timelineByChannel[event.roomId] ?? [];
      const idx = timeline.findIndex((m) => m.eventId === localId);
      const withoutPending = idx === -1 ? timeline : timeline.filter((_, i) => i !== idx);
      const merged = withoutPending.some((m) => m.eventId === event.eventId)
        ? withoutPending
        : [...withoutPending, event];
      return {
        timelineByChannel: { ...state.timelineByChannel, [event.roomId]: merged },
      };
    }),
}));

export const selectGuilds = (state: SyncState): GuildSummary[] => state.guilds;

export const selectChannels =
  (guildId: string) =>
  (state: SyncState): ChannelSummary[] =>
    state.channelsByGuild[guildId] ?? [];

export const selectTimeline =
  (channelId: string) =>
  (state: SyncState): NormalizedEvent[] =>
    state.timelineByChannel[channelId] ?? [];

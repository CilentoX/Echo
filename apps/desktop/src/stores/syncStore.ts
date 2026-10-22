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
 * (startSync(onEvent → applyEvent, onStatus → setStatus)).
 */
export const useSyncStore = create<SyncState>()((set) => {
  // Dedupe por eventId cobre os ecos do sync; placeholders pend-* nunca
  // colidem com eventIds reais — são trocados/removidos via resolvePending/
  // removePending (R2). Corpo idêntico ao de addPendingEvent.
  const appendEvent = (e: NormalizedEvent) =>
    set((state) => {
      const timeline = state.timelineByChannel[e.roomId] ?? [];
      if (timeline.some((m) => m.eventId === e.eventId)) return state;
      return {
        timelineByChannel: { ...state.timelineByChannel, [e.roomId]: [...timeline, e] },
      };
    });

  return {
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

    reset: () =>
      set({ status: "connecting", guilds: [], channelsByGuild: {}, timelineByChannel: {} }),

    addPendingEvent: appendEvent,

    applyEvent: appendEvent,

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

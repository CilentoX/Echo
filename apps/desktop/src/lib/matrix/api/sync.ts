import { createClient } from "matrix-js-sdk";
import type {
  MatrixClientLike,
  ClientFactory,
  SyncHandlers,
  SyncStatus,
  SyncErrorInfo,
  NormalizedEvent,
  TimelineEventLike,
  PresenceState,
  MemberSummary,
} from "../types";

const DEFAULT_START_CLIENT_OPTS = { initialSyncLimit: 20, threadSupport: true };

export { DEFAULT_START_CLIENT_OPTS };

const SYNC_STATE_STATUS: Record<string, SyncStatus> = {
  PREPARING: "connecting",
  PREPARED: "syncing",
  SYNCING: "syncing",
  CATCHING_UP: "connecting",
  RECONNECTING: "connecting",
  ERROR: "error",
};

function defaultClientFactory(opts: Parameters<typeof createClient>[0]): MatrixClientLike {
  return createClient(opts) as unknown as MatrixClientLike;
}

/**
 * Sync API for MatrixService.
 * Handles the sync loop, event listeners, and connection state.
 */
export class SyncApi {
  private client: MatrixClientLike | null;
  private readonly clientFactory: ClientFactory;

  private syncListener: ((...args: unknown[]) => void) | null = null;
  private timelineListener: ((...args: unknown[]) => void) | null = null;
  private typingListener: ((...args: unknown[]) => void) | null = null;
  private presenceListener: ((...args: unknown[]) => void) | null = null;
  private membersListener: ((...args: unknown[]) => void) | null = null;

  private started = false;

  constructor(client: MatrixClientLike | null, clientFactory: ClientFactory = defaultClientFactory) {
    this.client = client;
    this.clientFactory = clientFactory;
  }

  /** Update the client instance (called after login/restoreSession). */
  setClient(client: MatrixClientLike): void {
    this.client = client;
  }

  private requireClient(): MatrixClientLike {
    if (!this.client) {
      throw new Error("SyncApi: no client set — call setClient after login");
    }
    return this.client;
  }

  /** Liga o sync loop aos handlers. Chamar uma única vez por sessão ativa. */
  startSyncHandlers(handlers: SyncHandlers): void {
    if (this.started) return;
    this.started = true;

    const client = this.requireClient();

    this.syncListener = (...args: unknown[]) => {
      const status = SYNC_STATE_STATUS[args[0] as string];
      if (!status) return;
      const error = extractSyncError(args[2]);
      if (error) handlers.onStatus(status, error);
      else handlers.onStatus(status);
    };

    this.timelineListener = (...args: unknown[]) => {
      const normalized = normalizeTimelineEvent(args[0] as TimelineEventLike);
      if (normalized) handlers.onEvent(normalized);
    };

    this.typingListener = (...args: unknown[]) => {
      // RoomMember.typing: (event, member) — event.getRoomId() + member.typing + member.userId
      const event = args[0] as { getRoomId?: () => string | null } | undefined;
      const member = args[1] as { userId?: string; typing?: boolean } | undefined;
      const roomId = event?.getRoomId?.() ?? null;
      if (!roomId || !member || !member.userId || typeof member.typing !== "boolean") return;
      if (handlers.onTyping) {
        handlers.onTyping(roomId, member.userId, member.typing);
      }
    };

    this.presenceListener = (...args: unknown[]) => {
      // User.presence: (event, user) — user.presence string + user.userId
      const user = args[1] as { userId?: string; presence?: string } | undefined;
      if (!user || !user.userId || !user.presence) return;
      if (handlers.onPresence) handlers.onPresence(user.userId, mapPresence(user.presence));
    };

    this.membersListener = (...args: unknown[]) => {
      // RoomStateEvent.Members: (event, member) — membro mudou de sala
      const member = args[1] as {
        userId?: string;
        name?: string;
        membership?: string;
        user?: { presence?: string } | null;
      } | undefined;
      if (!member || !member.userId) return;
      if (handlers.onMembers) {
        handlers.onMembers(member.userId, [
          {
            userId: member.userId,
            displayName: member.name ?? member.userId,
            presence: mapPresence(member.user?.presence ?? "offline"),
          },
        ]);
      }
    };

    client.on("sync", this.syncListener);
    client.on("Room.timeline", this.timelineListener);
    client.on("RoomMember.typing", this.typingListener);
    client.on("User.presence", this.presenceListener);
    client.on("RoomStateEvent.Members", this.membersListener);
    client.startClient(DEFAULT_START_CLIENT_OPTS);
  }

  stopSync(): void {
    if (!this.started) return;
    this.started = false;

    const client = this.client;
    if (!client) return;

    if (this.syncListener) client.removeListener("sync", this.syncListener);
    if (this.timelineListener) client.removeListener("Room.timeline", this.timelineListener);
    if (this.typingListener) client.removeListener("RoomMember.typing", this.typingListener);
    if (this.presenceListener) client.removeListener("User.presence", this.presenceListener);
    if (this.membersListener)
      client.removeListener("RoomStateEvent.Members", this.membersListener);

    client.stopClient();

    this.syncListener = null;
    this.timelineListener = null;
    this.typingListener = null;
    this.presenceListener = null;
    this.membersListener = null;
  }

  /** Reset internal state (for tests). */
  __resetState(): void {
    this.started = false;
    this.syncListener = null;
    this.timelineListener = null;
    this.typingListener = null;
    this.presenceListener = null;
    this.membersListener = null;
  }
}

function extractSyncError(data: unknown): SyncErrorInfo | undefined {
  if (!data || typeof data !== "object") return undefined;
  const container = data as { error?: unknown; errcode?: unknown };
  const err =
    container.error && typeof container.error === "object"
      ? (container.error as { errcode?: unknown }).errcode
      : container.errcode;
  return typeof err === "string" ? { errcode: err } : undefined;
}

function normalizeTimelineEvent(event: TimelineEventLike): NormalizedEvent | null {
  // Ignora eventos de reação (vem pelo handler próprio) e redactados.
  if (event.getType() !== "m.room.message") return null;
  if (event.isRedacted?.()) return null;
  const body = event.getContent().body;
  const eventId = event.getId();
  const roomId = event.getRoomId();
  if (typeof body !== "string" || !eventId || !roomId) return null;
  return {
    eventId,
    roomId,
    sender: event.getSender(),
    body,
    originServerTs: event.getTs(),
  };
}

function mapPresence(presence: string): PresenceState {
  switch (presence) {
    case "online":
      return "online";
    case "offline":
      return "offline";
    case "unavailable":
      return "unavailable";
    default:
      return "offline";
  }
}
import { createClient, Preset, Visibility } from "matrix-js-sdk";
import type {
  ChannelSummary,
  GuildSummary,
  MatrixClientLike,
  NormalizedEvent,
  RoomLike,
  SendEventResponseLike,
  Session,
  SyncErrorInfo,
  SyncStatus,
  TimelineEventLike,
} from "./types";

/**
 * Injection point for tests: by default we build a real SDK client,
 * but tests can provide a fake client factory.
 */
export type ClientFactory = (opts: Parameters<typeof createClient>[0]) => MatrixClientLike;

const DEFAULT_START_CLIENT_OPTS = { initialSyncLimit: 20, threadSupport: true };

const SYNC_STATE_STATUS: Record<string, SyncStatus> = {
  PREPARING: "connecting",
  PREPARED: "syncing",
  SYNCING: "syncing",
  CATCHING_UP: "connecting",
  RECONNECTING: "connecting",
  ERROR: "error",
};

function defaultClientFactory(opts: Parameters<typeof createClient>[0]): MatrixClientLike {
  return createClient(opts);
}

export class MatrixService {
  private readonly baseUrl: string;
  private readonly clientFactory: ClientFactory;
  private client: MatrixClientLike | null = null;
  private syncListener: ((...args: unknown[]) => void) | null = null;
  private timelineListener: ((...args: unknown[]) => void) | null = null;

  constructor(baseUrl: string, clientFactory: ClientFactory = defaultClientFactory) {
    this.baseUrl = baseUrl;
    this.clientFactory = clientFactory;
  }

  /** Login with an SSO loginToken (m.login.token); the returned Session is
   *  also applied immediately, so the active client is credentialled. */
  async loginWithSsoToken(loginToken: string): Promise<Session> {
    const client = this.createClient({ baseUrl: this.baseUrl });
    const res = await client.loginRequest({ type: "m.login.token", token: loginToken });
    if (!res.access_token || !res.user_id) {
      throw new Error("matrix login failed: missing access_token or user_id");
    }
    const session: Session = {
      baseUrl: this.baseUrl,
      accessToken: res.access_token,
      userId: res.user_id,
      deviceId: res.device_id ?? null,
      ...(res.refresh_token ? { refreshToken: res.refresh_token } : {}),
    };
    // loginRequest is a raw POST /login and does not store credentials on the
    // client instance; discard the anonymous client and create a credentialled one.
    this.restoreSession(session);
    return session;
  }

  /** Recreate a client from a persisted session (no request is made). */
  restoreSession(session: Session): void {
    this.client = this.createClient({
      baseUrl: session.baseUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      ...(session.deviceId ? { deviceId: session.deviceId } : {}),
    });
  }

  /**
   * SSO redirect URL, wrapping the SDK client. Used by services/sso.ts, which
   * must not import matrix-js-sdk directly. The URL is built before any login,
   * so a temp anonymous client is created when there is no active session.
   */
  getSsoLoginUrl(redirectUrl: string, idpId?: string): string {
    const client = this.client ?? this.createClient({ baseUrl: this.baseUrl });
    return idpId
      ? client.getSsoLoginUrl(redirectUrl, "sso", idpId)
      : client.getSsoLoginUrl(redirectUrl);
  }

  startSync(
    onEvent: (e: NormalizedEvent) => void,
    onStatus: (s: SyncStatus, error?: SyncErrorInfo) => void,
  ): void {
    const client = this.requireClient();

    this.syncListener = (...args: unknown[]) => {
      const status = SYNC_STATE_STATUS[args[0] as string];
      if (!status) return;
      // O SDK entrega (state, prevState, data) no evento "sync"; em ERROR,
      // data.error.errcode identifica falha de auth vs. rede.
      const error = extractSyncError(args[2]);
      if (error) onStatus(status, error);
      else onStatus(status);
    };
    this.timelineListener = (...args: unknown[]) => {
      const normalized = normalizeTimelineEvent(args[0] as TimelineEventLike);
      if (normalized) onEvent(normalized);
    };

    client.on("sync", this.syncListener);
    client.on("Room.timeline", this.timelineListener);
    client.startClient(DEFAULT_START_CLIENT_OPTS);
  }

  stopSync(): void {
    if (!this.client) return;
    if (this.syncListener) this.client.removeListener("sync", this.syncListener);
    if (this.timelineListener) this.client.removeListener("Room.timeline", this.timelineListener);
    this.client.stopClient();
    this.syncListener = null;
    this.timelineListener = null;
  }

  /** Send an m.text message; resolves with the resulting event id. */
  async sendMessage(roomId: string, body: string): Promise<string> {
    const res: SendEventResponseLike = await this.requireClient().sendMessage(roomId, {
      msgtype: "m.text",
      body,
    });
    if (typeof res === "string") return res;
    if (!res?.event_id) throw new Error("sendMessage failed: missing event_id");
    return res.event_id;
  }

  /** Joined Spaces (m.space) as guild summaries. */
  async listGuilds(): Promise<GuildSummary[]> {
    const client = this.requireClient();
    return client
      .getRooms()
      .filter((room) => room.getMyMembership() === "join" && isSpace(room))
      .map((room) => ({
        guildId: room.roomId,
        name: stateEventName(room, "m.space.name") ?? room.roomId,
        avatarUrl: room.getMxcAvatarUrl() ?? null,
        unreadCount: room.getUnreadNotificationCount() ?? 0,
      }));
  }

  /**
   * Cria uma nova guilda (Space m.space) com o nome dado.
   * Retorna o resumo da guilda criada para o chamador adicionar ao store.
   */
  async createGuild(name: string): Promise<GuildSummary> {
    const client = this.requireClient();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("createGuild: nome é obrigatório");
    const res = await client.createRoom({
      name: trimmed,
      creation_content: { type: "m.space" },
      visibility: Visibility.Private,
      preset: Preset.PrivateChat,
    });
    if (!res?.room_id) throw new Error("createGuild: resposta sem room_id");
    return { guildId: res.room_id, name: trimmed, avatarUrl: null, unreadCount: 0 };
  }

  /** Channels (children declared via m.space.child) of a Space. */
  async listChannels(guildId: string): Promise<ChannelSummary[]> {
    const client = this.requireClient();
    const space = client.getRoom(guildId);
    if (!space) return [];

    const childIds = space.currentState
      .getStateEvents("m.space.child")
      .filter((ev) => {
        const via = ev.getContent().via;
        return Array.isArray(via) && via.length > 0;
      })
      .map((ev) => ev.getStateKey())
      .filter((stateKey): stateKey is string => typeof stateKey === "string");

    return childIds.map((childId) => {
      const room = client.getRoom(childId);
      return {
        channelId: childId,
        name: (room && stateEventName(room, "m.room.name")) ?? childId,
        unreadCount: room?.getUnreadNotificationCount() ?? 0,
      };
    });
  }

  private createClient(opts: Parameters<typeof createClient>[0]): MatrixClientLike {
    return this.clientFactory(opts);
  }

  private requireClient(): MatrixClientLike {
    if (!this.client) {
      throw new Error("MatrixService: no active session — call loginWithSsoToken or restoreSession first");
    }
    return this.client;
  }
}

function isSpace(room: RoomLike): boolean {
  return room.getType() === "m.space";
}

function stateEventName(room: RoomLike, eventType: string): string | null {
  const ev = room.currentState.getStateEvents(eventType)[0];
  const name = ev?.getContent().name;
  return typeof name === "string" && name.length > 0 ? name : null;
}

/**
 * Extrai o errcode do payload do evento "sync" em estado ERROR.
 * Formato do SDK: `data.error.errcode` (fallback: `data.errcode`).
 * undefined quando não há erro identificável (ex.: ERROR sem data).
 */
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
  if (event.getType() !== "m.room.message") return null;
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

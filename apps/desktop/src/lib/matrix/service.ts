import { createClient, Preset, Visibility } from "matrix-js-sdk";
import type {
  ChannelSummary,
  GuildSummary,
  MatrixClientLike,
  NormalizedEvent,
  NormalizedReaction,
  RoomLike,
  SendEventResponseLike,
  Session,
  SyncErrorInfo,
  SyncStatus,
  TimelineEventLike,
  PresenceState,
  UserProfile,
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
  return createClient(opts) as unknown as MatrixClientLike;
}

export interface SyncHandlers {
  onEvent: (e: NormalizedEvent) => void;
  onStatus: (s: SyncStatus, error?: SyncErrorInfo) => void;
  onTyping?: (roomId: string, userId: string, isTyping: boolean) => void;
  onPresence?: (userId: string, state: PresenceState) => void;
  onMembers?: (roomId: string, members: import("./types").MemberSummary[]) => void;
  onReaction?: (r: NormalizedReaction) => void;
  onReadReceipt?: (roomId: string, userId: string, eventId: string) => void;
}

export class MatrixService {
  private readonly baseUrl: string;
  private readonly clientFactory: ClientFactory;
  private client: MatrixClientLike | null = null;
  private syncListener: ((...args: unknown[]) => void) | null = null;
  private timelineListener: ((...args: unknown[]) => void) | null = null;
  private typingListener: ((...args: unknown[]) => void) | null = null;
  private presenceListener: ((...args: unknown[]) => void) | null = null;
  private membersListener: ((...args: unknown[]) => void) | null = null;

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

  /** SSO redirect URL, wrapping the SDK client. Used by services/sso.ts, which
   *  must not import matrix-js-sdk directly. The URL is built before any login,
   *  so a temp anonymous client is created when there is no active session. */
  getSsoLoginUrl(redirectUrl: string, idpId?: string): string {
    const client = this.client ?? this.createClient({ baseUrl: this.baseUrl });
    return idpId
      ? client.getSsoLoginUrl(redirectUrl, "sso", idpId)
      : client.getSsoLoginUrl(redirectUrl);
  }

  /**
   * Liga o sync loop aos handlers. Chamar uma única vez por sessão ativa.
   * Handlers:
   * - onEvent → cada m.room.message ao vivo
   * - onStatus → estado do sync (connecting/syncing/error)
   * - onTyping → quem está digitando em cada sala
   * - onPresence → presença de cada usuário
   * - onMembers → membros de uma sala (mudança de membro join)
   * - onReaction → cada evento m.reaction
   * - onReadReceipt → cada recibo de leitura
   */
  startSyncHandlers(handlers: SyncHandlers): void {
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
    if (!this.client) return;
    if (this.syncListener) this.client.removeListener("sync", this.syncListener);
    if (this.timelineListener) this.client.removeListener("Room.timeline", this.timelineListener);
    if (this.typingListener) this.client.removeListener("RoomMember.typing", this.typingListener);
    if (this.presenceListener) this.client.removeListener("User.presence", this.presenceListener);
    if (this.membersListener)
      this.client.removeListener("RoomStateEvent.Members", this.membersListener);
    this.client.stopClient();
    this.syncListener = null;
    this.timelineListener = null;
    this.typingListener = null;
    this.presenceListener = null;
    this.membersListener = null;
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

  /** Sends an m.file message: uploads the file, then sends m.message with m.file content. */
  async sendFile(roomId: string, file: File, body?: string): Promise<string> {
    const url = await this.uploadMedia(file);
    const res: SendEventResponseLike = await this.requireClient().sendEvent(roomId, "m.message", {
      msgtype: "m.file",
      body: body ?? file.name,
      url,
      info: {
        mimetype: file.type,
        size: file.size,
      },
    } as Record<string, unknown>);
    if (typeof res === "string") return res;
    if (!res?.event_id) throw new Error("sendFile failed: missing event_id");
    return res.event_id;
  }

  /** Envia uma reação m.reaction (m.annotation com m.relates_to) a um evento. */
  async sendReaction(roomId: string, targetEventId: string, emoji: string): Promise<string> {
    const res = await this.requireClient().sendEvent(roomId, "m.reaction", {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: targetEventId,
      },
      "m.annotation": {
        emoji,
      },
    });
    if (!res?.event_id) throw new Error("sendReaction failed: missing event_id");
    return res.event_id;
  }

  /** Remove a própria reação de um evento (redige o evento de reação). */
  async removeReaction(roomId: string, reactionEventId: string): Promise<void> {
    await this.requireClient().redactEvent(roomId, reactionEventId);
  }

  /** Marca o canal como lido até o evento dado (recibo de leitura real no server). */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    await this.requireClient().sendReadReceipt(
      { getId: () => eventId, getRoomId: () => roomId } as unknown as Parameters<
        MatrixClientLike["sendReadReceipt"]
      >[0],
    );
  }

  /** Redige (exclui) um evento próprio. */
  async redact(roomId: string, eventId: string): Promise<void> {
    await this.requireClient().redactEvent(roomId, eventId);
  }

  /** Define o estado de digitação em uma sala (m.typing ephemeral). */
  async setTyping(roomId: string, isTyping: boolean): Promise<void> {
    await this.requireClient().sendTyping(roomId, isTyping);
  }

  /** Carrega histórico antigo de uma sala (scrollback) e retorna os eventos. */
  async loadOlder(roomId: string, limit = 20): Promise<NormalizedEvent[]> {
    const client = this.requireClient();
    const room = client.getRoom(roomId);
    if (!room) return [];
    const scrollbacked = await client.scrollback(room, limit);
    const events = (scrollbacked as { getLiveTimeline: () => { getEvents: () => TimelineEventLike[] } }).getLiveTimeline().getEvents();
    return events
      .map((e) => normalizeTimelineEvent(e))
      .filter((e): e is NormalizedEvent => e !== null);
  }

  /** Perfil de um usuário (sem args = próprio usuário). */
  async getDisplayName(userId?: string): Promise<string | null> {
    const resolvedUserId = userId ?? this.requireClient().getUserId() ?? undefined;
    const res = await this.requireClient().getProfileInfo(resolvedUserId);
    return res.displayname ?? null;
  }

  /** Altera o nome de exibição da própria conta. */
  async setDisplayName(name: string): Promise<void> {
    await this.requireClient().setDisplayName(name);
  }

  /** Envia um arquivo de mídia (avatar, banner, anexo) e devolve o mxc:// URI. */
  async uploadMedia(file: File): Promise<string> {
    const res = await this.requireClient().uploadContent(file, {
      name: file.name,
      type: file.type,
    });
    if (!res?.content_uri) throw new Error("uploadMedia: resposta sem content_uri");
    return res.content_uri;
  }

  /** Define o avatar do próprio usuário (mxc:// URI ou null para remover). */
  async setAvatarUrl(url: string | null): Promise<void> {
    if (!url) {
      await this.requireClient().setAvatarUrl("");
      return;
    }
    await this.requireClient().setAvatarUrl(url);
  }

  /** Devolve o avatar_url de um usuário (sem args = próprio usuário). */
  async getAvatarUrl(userId?: string): Promise<string | null> {
    const resolvedUserId = userId ?? this.requireClient().getUserId() ?? undefined;
    const res = await this.requireClient().getProfileInfo(resolvedUserId);
    return res.avatar_url ?? null;
  }

  /** Devolve o banner_url de um usuário (sem args = próprio usuário). */
  async getBannerUrl(userId?: string): Promise<string | null> {
    const resolvedUserId = userId ?? this.requireClient().getUserId() ?? undefined;
    const res = await this.requireClient().getProfileInfo(resolvedUserId);
    return (res as { banner_url?: string }).banner_url ?? null;
  }

  /** Busca todo o perfil de um usuário em uma única chamada ao servidor Matrix. */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const res = await this.requireClient().getProfileInfo(userId);
    console.debug("[getUserProfile] raw response:", res);
    return {
      displayName: res.displayname ?? null,
      avatarUrl: res.avatar_url ?? null,
      bannerUrl: (res as { banner_url?: string }).banner_url ?? null,
      bio: null,
      role: null,
    };
  }

  /** Devolve o MXID do usuário logado. */
  getUserId(): string | null {
    return this.requireClient().getUserId();
  }

  /** Devolve o banner do perfil de um usuário (estado custom echo.user.banner no quarto DM direto). */
  async getUserBanner(userId: string): Promise<string | null> {
    const client = this.requireClient();
    // Buscar quarto DM direto com o usuário
    const rooms = client.getRooms();
    for (const room of rooms) {
      if (room.getType() !== "m.direct") continue;
      const members = room.getJoinedMembers();
      const hasUser = members.some((m) => m.userId === userId);
      if (!hasUser) continue;
      // Buscar estado custom do banner
      const bannerEv = room.currentState.getStateEvents("echo.user.banner")[0];
      const url = bannerEv?.getContent().url;
      return typeof url === "string" && url.length > 0 ? url : null;
    }
    return null;
  }

  /** Define o banner do perfil do usuário (estado custom echo.user.banner no quarto DM direto). */
  async setUserBanner(userId: string, bannerUrl: string | null): Promise<void> {
    const client = this.requireClient();
    // Buscar ou criar quarto DM direto com o usuário
    const rooms = client.getRooms();
    let dmRoom: RoomLike | null = rooms.find((r) => {
      if (r.getType() !== "m.direct") return false;
      return r.getJoinedMembers().some((m) => m.userId === userId);
    }) ?? null;

    if (!dmRoom) {
      // Criar quarto DM direto
      const res = await client.createRoom({
        preset: "private_chat" as any,
        is_direct: true,
        invite: [userId],
        visibility: "private" as any,
      });
      dmRoom = client.getRoom(res.room_id);
    }

    if (dmRoom) {
      if (bannerUrl) {
        await client.sendStateEvent(dmRoom.roomId, "echo.user.banner", { url: bannerUrl });
      } else {
        // Para remover, enviar evento vazio ou redigir
        await client.redactEvent(dmRoom.roomId, await this._findBannerEventId(dmRoom.roomId));
      }
    }
  }

  private async _findBannerEventId(roomId: string): Promise<string> {
    const room = this.requireClient().getRoom(roomId);
    if (!room) return "";
    const ev = room.currentState.getStateEvents("echo.user.banner")[0];
    return ev?.getId() ?? "";
  }

  /** Joined Spaces (m.space) como resumos de guildas. Nome lido de m.room.name. */
  async listGuilds(): Promise<GuildSummary[]> {
    const client = this.requireClient();
    return client
      .getRooms()
      .filter((room) => room.getMyMembership() === "join" && isSpace(room))
      .map((room) => ({
        guildId: room.roomId,
        name: stateEventName(room, "m.room.name") ?? room.roomId,
        avatarUrl: room.getMxcAvatarUrl() ?? null,
        unreadCount: room.getUnreadNotificationCount() ?? 0,
      }));
  }

  /** Cria uma nova guilda (Space m.space) com nome, ícone, banner e descrição. */
  async createGuild(
    data: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ): Promise<GuildSummary> {
    const client = this.requireClient();
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error("createGuild: nome é obrigatório");
    const res = await client.createRoom({
      name: trimmed,
      creation_content: { type: "m.space" },
      visibility: Visibility.Private,
      preset: Preset.PrivateChat,
    });
    if (!res?.room_id) throw new Error("createGuild: resposta sem room_id");
    // Criar canal # geral automaticamente dentro da guilda (P5)
    try {
      const geralRes = await client.createRoom({
        name: "geral",
        visibility: Visibility.Private,
        preset: Preset.PrivateChat,
        creation_content: { "m.federate": false },
      });
      if (geralRes?.room_id) {
        await client.sendStateEvent(res.room_id, "m.space.child", { via: [res.room_id] }, geralRes.room_id);
      }
    } catch {
      // Se falhar criar o # geral, a guilda já existe — não bloqueia
    }
    // Definir ícone, banner e descrição da guilda (state events)
    if (data.iconUrl) {
      await client.sendStateEvent(res.room_id, "m.room.avatar", { url: data.iconUrl });
    }
    if (data.bannerUrl) {
      await client.sendStateEvent(res.room_id, "echo.room.banner", { url: data.bannerUrl });
    }
    if (data.description) {
      await client.sendStateEvent(res.room_id, "m.room.topic", { topic: data.description });
    }
    return {
      guildId: res.room_id,
      name: trimmed,
      avatarUrl: data.iconUrl ?? null,
      unreadCount: 0,
    };
  }

  /** Sai (deleta) uma guilda própria. */
  async deleteGuild(guildId: string): Promise<void> {
    const client = this.requireClient();
    await client.leave(guildId);
  }

  /** Sai de uma guilda (sem excluí-la). */
  async leaveGuild(guildId: string): Promise<void> {
    const client = this.requireClient();
    await client.leave(guildId);
  }

  /** Cria um canal dentro de uma guilda (Space). Aceita tipo, tópico e categoria. */
  async createChannel(
    guildId: string,
    data: { name: string; type: string; topic?: string; category?: string }
  ): Promise<ChannelSummary> {
    const client = this.requireClient();
    const trimmed = data.name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!trimmed) throw new Error("createChannel: nome é obrigatório");
    const space = client.getRoom(guildId);
    if (!space || !isSpace(space)) throw new Error("createChannel: guilda não encontrada");
    const res = await client.createRoom({
      name: trimmed,
      topic: data.topic || undefined,
      visibility: Visibility.Private,
      preset: Preset.PrivateChat,
      creation_content: {
        "m.federate": false,
      },
    });
    if (!res?.room_id) throw new Error("createChannel: resposta sem room_id");
    await client.sendStateEvent(guildId, "m.space.child", { via: [guildId] }, res.room_id);
    return {
      channelId: res.room_id,
      name: trimmed,
      topic: data.topic || undefined,
      type: data.type,
      category: data.category || undefined,
      unreadCount: 0,
    };
  }

  /** Edita uma guilda própria individualmente (nome, ícone, banner, descrição). */
  async editGuild(
    guildId: string,
    data: {
      name: string;
      iconUrl?: string | null;
      bannerUrl?: string | null;
      description?: string | null;
    },
  ): Promise<void> {
    const client = this.requireClient();
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error("editGuild: nome é obrigatório");
    // Nome da guilda (m.room.name — spec Matrix)
    await client.sendStateEvent(guildId, "m.room.name", { name: trimmed });
    // Ícone da guilda (m.room.avatar — mxc:// URI)
    if (data.iconUrl !== undefined) {
      await client.sendStateEvent(guildId, "m.room.avatar", {
        url: data.iconUrl,
      });
    }
    // Banner da guilda (evento de estado customizado)
    if (data.bannerUrl !== undefined) {
      await client.sendStateEvent(guildId, "echo.room.banner", {
        url: data.bannerUrl,
      });
    }
    // Descrição da guilda (m.room.topic)
    if (data.description !== undefined) {
      await client.sendStateEvent(guildId, "m.room.topic", {
        topic: data.description,
      });
    }
  }

  /** Canais (filhos declarados via m.space.child) de um Space. */
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

  /** Membros com membership "join" de uma sala, com presença. */
  async listMembers(roomId: string): Promise<import("./types").MemberSummary[]> {
    const client = this.requireClient();
    const room = client.getRoom(roomId);
    if (!room) return [];
    const members = room.getJoinedMembers();
    const out: import("./types").MemberSummary[] = [];
    for (const m of members) {
      out.push({
        userId: m.userId,
        displayName: m.name ?? m.userId,
        presence: m.user?.presence ? mapPresence(m.user.presence) : "offline",
      });
    }
    return out;
  }

  private createClient(opts: Parameters<typeof createClient>[0]): MatrixClientLike {
    return this.clientFactory(opts);
  }

  private requireClient(): MatrixClientLike {
    if (!this.client) {
      throw new Error("MatrixService: no active session — call loginWithSsoToken or restoreSession first");
    }
    return this.client as unknown as MatrixClientLike;
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

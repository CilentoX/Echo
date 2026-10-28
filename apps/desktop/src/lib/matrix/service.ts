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
import { AuthApi } from "./api/auth";
import { SyncApi } from "./api/sync";
import { MessagesApi } from "./api/messages";

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
  private readonly authApi: AuthApi;
  private readonly syncApi: SyncApi;
  private readonly messagesApi: MessagesApi;

  constructor(baseUrl: string, clientFactory: ClientFactory = defaultClientFactory) {
    this.baseUrl = baseUrl;
    this.clientFactory = clientFactory;
    this.authApi = new AuthApi(baseUrl, clientFactory);
    this.syncApi = new SyncApi(null, clientFactory);
    this.messagesApi = new MessagesApi(this.client!, clientFactory);
  }

  /** Login with an SSO loginToken (m.login.token); the returned Session is
   *  also applied immediately, so the active client is credentialled. */
  async loginWithSsoToken(loginToken: string): Promise<Session> {
    const session = await this.authApi.loginWithSsoToken(loginToken);
    // Sync the client instance from AuthApi
    this.client = this.authApi.getClient();
    // Update SyncApi and MessagesApi with the credentialled client
    this.syncApi.setClient(this.client);
    this.messagesApi.setClient(this.client);
    return session;
  }

  /** Recreate a client from a persisted session (no request is made). */
  restoreSession(session: Session): void {
    this.authApi.restoreSession(session);
    this.client = this.authApi.getClient();
    this.syncApi.setClient(this.client);
    this.messagesApi.setClient(this.client);
  }

  /** SSO redirect URL, wrapping the SDK client. Used by services/sso.ts, which
   *  must not import matrix-js-sdk directly. The URL is built before any login,
   *  so a temp anonymous client is created when there is no active session. */
  getSsoLoginUrl(redirectUrl: string, idpId?: string): string {
    return this.authApi.getSsoLoginUrl(redirectUrl, idpId);
  }

  /** Logout: clear session and disconnect client. */
  async logout(): Promise<void> {
    await this.authApi.logout();
    this.syncApi.stopSync();
    this.client = null;
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
    this.syncApi.startSyncHandlers(handlers);
  }

  stopSync(): void {
    this.syncApi.stopSync();
  }

  /** Send an m.text message; resolves with the resulting event id. */
  async sendMessage(roomId: string, body: string): Promise<string> {
    return this.messagesApi.sendMessage(roomId, body);
  }

  /** Sends an m.file message: uploads the file, then sends m.message with m.file content. */
  async sendFile(roomId: string, file: File, body?: string): Promise<string> {
    return this.messagesApi.sendFile(roomId, file, body);
  }

  /** Envia uma reação m.reaction (m.annotation com m.relates_to) a um evento. */
  async sendReaction(roomId: string, targetEventId: string, emoji: string): Promise<string> {
    return this.messagesApi.sendReaction(roomId, targetEventId, emoji);
  }

  /** Remove a própria reação de um evento (redige o evento de reação). */
  async removeReaction(roomId: string, reactionEventId: string): Promise<void> {
    return this.messagesApi.removeReaction(roomId, reactionEventId);
  }

  /** Marca o canal como lido até o evento dado (recibo de leitura real no server). */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    return this.messagesApi.markAsRead(roomId, eventId);
  }

  /** Redige (exclui) um evento próprio. */
  async redact(roomId: string, eventId: string): Promise<void> {
    return this.messagesApi.redact(roomId, eventId);
  }

  /** Define o estado de digitação em uma sala (m.typing ephemeral). */
  async setTyping(roomId: string, isTyping: boolean): Promise<void> {
    return this.messagesApi.setTyping(roomId, isTyping);
  }

  /** Edita uma mensagem existente (m.replace). */
  async editMessage(roomId: string, eventId: string, newBody: string): Promise<void> {
    return this.messagesApi.editMessage(roomId, eventId, newBody);
  }

  /** Carrega histórico antigo de uma sala (scrollback) e retorna os eventos. */
  async loadOlder(roomId: string, limit = 20): Promise<NormalizedEvent[]> {
    return this.messagesApi.loadOlder(roomId, limit);
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
    return this.messagesApi.uploadMedia(file);
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

  /** Devolve o access token do usuário logado. */
  getAccessToken(): string | null {
    return this.requireClient().getAccessToken();
  }

  /** Devolve a base URL do homeserver. */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Converte mxc:// URL para HTTP (suporta autenticação para evitar M_FORBIDDEN). */
  mxcUrlToHttp(mxcUrl: string, width?: number, height?: number, resizeMethod?: string, _allowDirectLinks?: boolean, _allowRedirects?: boolean, useAuthentication?: boolean): string | null {
    return this.requireClient().mxcUrlToHttp(mxcUrl, width, height, resizeMethod, true, true, useAuthentication ?? true);
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

  /** Membros com membership "join" de uma sala, com presença e avatar. */
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
        avatarUrl: m.avatarUrl ?? null,
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

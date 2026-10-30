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
import { GuildsApi } from "./api/guilds";
import { ChannelsApi } from "./api/channels";
import { MembersApi } from "./api/members";
import { ProfileApi } from "./api/profile";
import { MediaApi } from "./api/media";

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
  private readonly guildsApi: GuildsApi;
  private readonly channelsApi: ChannelsApi;
  private readonly membersApi: MembersApi;
  private readonly profileApi: ProfileApi;
  private readonly mediaApi: MediaApi;

  constructor(baseUrl: string, clientFactory: ClientFactory = defaultClientFactory) {
    this.baseUrl = baseUrl;
    this.clientFactory = clientFactory;
    this.authApi = new AuthApi(baseUrl, clientFactory);
    this.syncApi = new SyncApi(null, clientFactory);
    this.messagesApi = new MessagesApi(this.client!, clientFactory);
    this.guildsApi = new GuildsApi(this.client!, clientFactory);
    this.channelsApi = new ChannelsApi(this.client!, clientFactory);
    this.membersApi = new MembersApi(this.client!, clientFactory);
    this.profileApi = new ProfileApi(this.client!, clientFactory);
    this.mediaApi = new MediaApi(this.client!, clientFactory);
  }

  /** Login with an SSO loginToken (m.login.token); the returned Session is
   *  also applied immediately, so the active client is credentialled. */
  async loginWithSsoToken(loginToken: string): Promise<Session> {
    const session = await this.authApi.loginWithSsoToken(loginToken);
    // Sync the client instance from AuthApi
    this.client = this.authApi.getClient();
    // Update all APIs with the credentialled client
    this.syncApi.setClient(this.client);
    this.messagesApi.setClient(this.client);
    this.guildsApi.setClient(this.client);
    this.channelsApi.setClient(this.client);
    this.membersApi.setClient(this.client);
    this.profileApi.setClient(this.client);
    this.mediaApi.setClient(this.client);
    return session;
  }

  /** Recreate a client from a persisted session (no request is made). */
  restoreSession(session: Session): void {
    this.authApi.restoreSession(session);
    this.client = this.authApi.getClient();
    this.syncApi.setClient(this.client);
    this.messagesApi.setClient(this.client);
    this.guildsApi.setClient(this.client);
    this.channelsApi.setClient(this.client);
    this.membersApi.setClient(this.client);
    this.profileApi.setClient(this.client);
    this.mediaApi.setClient(this.client);
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
    return this.profileApi.getDisplayName(userId);
  }

  /** Altera o nome de exibição da própria conta. */
  async setDisplayName(name: string): Promise<void> {
    return this.profileApi.setDisplayName(name);
  }

  /** Envia um arquivo de mídia (avatar, banner, anexo) e devolve o mxc:// URI. */
  async uploadMedia(file: File): Promise<string> {
    return this.mediaApi.uploadMedia(file);
  }

  /** Define o avatar do próprio usuário (mxc:// URI ou null para remover). */
  async setAvatarUrl(url: string | null): Promise<void> {
    return this.profileApi.setAvatarUrl(url);
  }

  /** Devolve o avatar_url de um usuário (sem args = próprio usuário). */
  async getAvatarUrl(userId?: string): Promise<string | null> {
    return this.profileApi.getAvatarUrl(userId);
  }

  /** Devolve o banner_url de um usuário (sem args = próprio usuário). */
  async getBannerUrl(userId?: string): Promise<string | null> {
    return this.profileApi.getBannerUrl(userId);
  }

  /** Busca todo o perfil de um usuário em uma única chamada ao servidor Matrix. */
  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.profileApi.getUserProfile(userId);
  }

  /** Busca o perfil global do usuário no Appwrite Database (avatar, banner, bio, links). */
  async getGlobalProfile(userId: string) {
    return this.profileApi.getGlobalProfile(userId);
  }

  /** Atualiza parcialmente o perfil global no Profile API (avatar, banner, bio, links). */
  async patchGlobalProfile(userId: string, data: { avatarUrl?: string | null; bannerUrl?: string | null; bio?: string | null; links?: Array<{ label: string; url: string }> }): Promise<void> {
    return this.profileApi.patchGlobalProfile(userId, data);
  }

  /** Atualiza completamente o perfil global no Profile API (avatar, banner, bio, links). */
  async updateGlobalProfile(userId: string, data: { avatarUrl?: string | null; bannerUrl?: string | null; bio?: string | null; links?: Array<{ label: string; url: string }> }): Promise<void> {
    return this.profileApi.updateGlobalProfile(userId, data);
  }

  // ── Perfil de guilda (Profile API) ──

  /** Busca o perfil de uma guilda no Profile API pelo guildId. */
  async getGuildProfile(guildId: string) {
    return this.profileApi.getGuildProfile(guildId);
  }

  /** Cria ou atualiza o perfil de uma guilda no Profile API (avatar, banner, descrição). */
  async upsertGuildProfile(guildId: string, data: { name: string; description?: string | null; avatarUrl?: string | null; bannerUrl?: string | null; createdBy: string }) {
    return this.profileApi.upsertGuildProfile(guildId, data);
  }

  /** Atualiza parcialmente o perfil de uma guilda no Profile API. */
  async patchGuildProfile(guildId: string, data: { name?: string; description?: string | null; avatarUrl?: string | null; bannerUrl?: string | null }) {
    return this.profileApi.patchGuildProfile(guildId, data);
  }

  /** Remove o perfil de uma guilda do Profile API. */
  async deleteGuildProfile(guildId: string): Promise<void> {
    return this.profileApi.deleteGuildProfile(guildId);
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
  getHomeserverUrl(): string {
    return this.baseUrl;
  }

  /** Converte mxc:// URL para HTTP (suporta autenticação para evitar M_FORBIDDEN). */
  mxcUrlToHttp(mxcUrl: string, width?: number, height?: number, resizeMethod?: string, _allowDirectLinks?: boolean, _allowRedirects?: boolean, useAuthentication?: boolean): string | null {
    return this.mediaApi.mxcUrlToHttp(mxcUrl, width, height, resizeMethod, true, true, useAuthentication ?? true);
  }

  /** Joined Spaces (m.space) como resumos de guildas. Nome lido de m.room.name. */
  async listGuilds(): Promise<GuildSummary[]> {
    return this.guildsApi.listGuilds();
  }

  /** Cria uma nova guilda (Space m.space) com nome, ícone, banner e descrição. */
  async createGuild(
    data: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ): Promise<GuildSummary> {
    return this.guildsApi.createGuild(data);
  }

  /** Sai (deleta) uma guilda própria. */
  async deleteGuild(guildId: string): Promise<void> {
    return this.guildsApi.deleteGuild(guildId);
  }

  /** Sai de uma guilda (sem excluí-la). */
  async leaveGuild(guildId: string): Promise<void> {
    return this.guildsApi.leaveGuild(guildId);
  }

  /** Cria um canal dentro de uma guilda (Space). Aceita tipo, tópico e categoria. */
  async createChannel(
    guildId: string,
    data: { name: string; type: string; topic?: string; category?: string }
  ): Promise<ChannelSummary> {
    return this.channelsApi.createChannel(guildId, data);
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
    return this.guildsApi.editGuild(guildId, data);
  }

  /** Canais (filhos declarados via m.space.child) de um Space. */
  async listChannels(guildId: string): Promise<ChannelSummary[]> {
    return this.channelsApi.listChannels(guildId);
  }

  /** Edita um canal (nome, tópico, categoria). */
  async editChannel(
    channelId: string,
    data: {
      name?: string;
      topic?: string | null;
      category?: string | null;
    }
  ): Promise<void> {
    return this.channelsApi.editChannel(channelId, data);
  }

  /** Sai (deleta) um canal próprio. */
  async deleteChannel(channelId: string): Promise<void> {
    return this.channelsApi.deleteChannel(channelId);
  }

  /** Membros com membership "join" de uma sala, com presença e avatar. */
  async listMembers(roomId: string): Promise<import("./types").MemberSummary[]> {
    return this.membersApi.listMembers(roomId);
  }

  /** Convida um usuário para uma sala. Retorna o event ID do convite. */
  async inviteUser(roomId: string, userId: string): Promise<string> {
    return this.membersApi.inviteUser(roomId, userId);
  }

  /** Expulsa (kick) um usuário de uma sala. Retorna o event ID. */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<string> {
    return this.membersApi.kickUser(roomId, userId, reason);
  }

  /** Bane um usuário de uma sala. Retorna o event ID. */
  async banUser(roomId: string, userId: string, reason?: string): Promise<string> {
    return this.membersApi.banUser(roomId, userId, reason);
  }

  /**
   * Define o power level de um usuário em uma sala (0-100).
   * Retorna o event ID da mudança de power level.
   */
  async setPowerLevel(roomId: string, userId: string, level: number): Promise<string> {
    return this.membersApi.setPowerLevel(roomId, userId, level);
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

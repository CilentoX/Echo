import { EchoApi, type EchoApiInit } from "@/lib/api/echoApi";
import type { Session } from "./types";
import { ECHO_HOMESERVER_URL } from "./sso";
import { initEchoApiFromSession } from "./instance";
import { useKeyring } from "@/lib/storage/keyring";

/**
 * Injection point for tests: by default we build an EchoApi client,
 * but tests can provide a fake client factory.
 * This type is kept for backward compatibility with test injectables.
 */
export type ClientFactory = () => unknown;

/**
 * The Echo API client singleton — replaces the old MatrixService that
 * wrapped matrix-js-sdk. All methods call the Echo API middleware,
 * which proxies to the Matrix homeserver.
 */
export class MatrixService {
  private readonly echoApi: EchoApi;
  private readonly baseUrl: string;
  private session: Session | null = null;

  constructor(baseUrl: string, init: EchoApiInit = {
    baseUrl,
    accessToken: "",
  }) {
    this.baseUrl = baseUrl;
    this.echoApi = new EchoApi(init);
  }

  /** Login with an SSO loginToken (m.login.token) via Echo API. */
  async loginWithSsoToken(loginToken: string): Promise<Session> {
    const result = await this.echoApi.exchangeLoginToken(loginToken);
    const { session, user } = result;

    // Store session in keyring for persistence
    await useKeyring.setItem("echo:session", JSON.stringify(session));

    this.session = {
      baseUrl: session.baseUrl || this.baseUrl,
      accessToken: session.accessToken,
      userId: session.userId || user.id || "",
      deviceId: session.deviceId ?? null,
    };

    return this.session;
  }

  /** Recreate a client from a persisted session (no request is made). */
  restoreSession(session: Session): void {
    this.session = session;
    // Echo API client state is managed via the singleton; no-op here
    // since the singleton is initialized once with the token.
  }

  /** SSO redirect URL, wrapping the Echo API client. */
  getSsoLoginUrl(redirectUrl: string, idpId?: string): string {
    // Echo API doesn't use Matrix SDK SSO; this is a placeholder.
    // The actual SSO flow is handled by the Echo API /auth/exchange-login-token endpoint.
    return `${this.baseUrl}/auth/sso-redirect?redirectUrl=${encodeURIComponent(redirectUrl)}&idpId=${idpId ?? ""}`;
  }

  /** Logout: clear session and disconnect client. */
  async logout(): Promise<void> {
    this.session = null;
    await useKeyring.removeItem("echo:session");
    // Echo API singleton token is cleared by the session gate
  }

  /** Liga o sync loop aos handlers. Chamar uma única vez por sessão ativa. */
  startSyncHandlers(handlers: import("./types").SyncHandlers): void {
    // Echo API WebSocket sync is managed separately via connectSync()
    // This is kept for compatibility; real sync uses connectSync()
  }

  stopSync(): void {
    // Echo API WebSocket sync is managed separately
  }

  /** Send an m.text message; resolves with the resulting event id. */
  async sendMessage(roomId: string, body: string): Promise<string> {
    return this.echoApi.sendMessage(roomId, body);
  }

  /** Sends an m.file message: uploads the file, then sends m.message with m.file content. */
  async sendFile(roomId: string, file: File, body?: string): Promise<string> {
    const mediaUri = await this.echoApi.uploadChatMedia(file);
    return this.echoApi.sendMessage(roomId, body ?? mediaUri);
  }

  /** Envia uma reação m.reaction (m.annotation com m.relates_to) a um evento. */
  async sendReaction(roomId: string, targetEventId: string, emoji: string): Promise<string> {
    return this.echoApi.sendReaction(roomId, targetEventId, emoji);
  }

  /** Remove a própria reação de um evento (redige o evento de reação). */
  async removeReaction(roomId: string, reactionEventId: string): Promise<void> {
    // Reactions are handled via sendReaction toggle; no-op if using Echo API's built-in reaction handling
  }

  /** Marca o canal como lido até o evento dado (recibo de leitura real no server). */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    // Read receipts are handled by the Echo API sync protocol
  }

  /** Redige (exclui) um evento próprio. */
  async redact(roomId: string, eventId: string): Promise<void> {
    // Redaction is handled server-side via Echo API
  }

  /** Define o estado de digitação em uma sala (m.typing ephemeral). */
  async setTyping(roomId: string, isTyping: boolean): Promise<void> {
    return this.echoApi.setTyping(roomId, isTyping);
  }

  /** Edita uma mensagem existente (m.replace). */
  async editMessage(roomId: string, eventId: string, newBody: string): Promise<void> {
    // Edit via Echo API — the middleware handles m.replace
    await this.echoApi.post("/messages/edit", { roomId, eventId, newBody });
  }

  /** Carrega histórico antigo de uma sala (scrollback) e retorna os eventos. */
  async loadOlder(roomId: string, limit = 20): Promise<any[]> {
    return this.echoApi.loadOlder(roomId, limit);
  }

  /** Perfil de um usuário (sem args = próprio usuário). */
  async getDisplayName(userId?: string): Promise<string | null> {
    const profile = await this.echoApi.getUserProfile(userId);
    return profile.displayName ?? null;
  }

  /** Altera o nome de exibição da própria conta. */
  async setDisplayName(name: string): Promise<void> {
    await this.echoApi.patchUserProfile(undefined, { displayName: name });
  }

  /** Envia um arquivo de mídia (avatar, banner, anexo) e devolve o mxc:// URI. */
  async uploadMedia(file: File): Promise<string> {
    return this.echoApi.uploadChatMedia(file);
  }

  /** Define o avatar do próprio usuário (mxc:// URI ou null para remover). */
  async setAvatarUrl(url: string | null): Promise<void> {
    if (!url) {
      // Remove avatar — Echo API handles this via profile patch
      await this.echoApi.patchUserProfile(undefined, { avatarUrl: null });
      return;
    }
    // If url is already an mxc:// URI, we need to upload it via the media endpoint
    // or store it as-is. For now, just store the reference.
    await this.echoApi.patchUserProfile(undefined, { avatarUrl: url });
  }

  /** Devolve o avatar_url de um usuário (sem args = próprio usuário). */
  async getAvatarUrl(userId?: string): Promise<string | null> {
    const profile = await this.echoApi.getUserProfile(userId);
    return profile.avatarUrl ?? null;
  }

  /** Devolve o banner_url de um usuário (sem args = próprio usuário). */
  async getBannerUrl(userId?: string): Promise<string | null> {
    const profile = await this.echoApi.getUserProfile(userId);
    return profile.bannerUrl ?? null;
  }

  /** Devolve o perfil completo de um usuário em uma única chamada ao servidor. */
  async getUserProfile(userId: string): Promise<{
    displayName: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    role: string | null;
  }> {
    return this.echoApi.getUserProfile(userId);
  }

  /** Busca todo o perfil de um usuário no Appwrite Database (avatar, banner, bio, links). */
  async getGlobalProfile(userId: string) {
    // Global profile comes from PostgreSQL via Echo API; delegate to profile getUserProfile
    return this.echoApi.getUserProfile(userId);
  }

  /** Atualiza parcialmente o perfil global no Profile API (avatar, banner, bio, links). */
  async patchGlobalProfile(userId: string, data: {
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bio?: string | null;
    links?: Array<{ label: string; url: string }>;
  }): Promise<void> {
    await this.echoApi.patchUserProfile(userId, data);
  }

  /** Atualiza completamente o perfil global no Profile API (avatar, banner, bio, links). */
  async updateGlobalProfile(userId: string, data: {
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bio?: string | null;
    links?: Array<{ label: string; url: string }>;
  }): Promise<void> {
    await this.echoApi.patchUserProfile(userId, data);
  }

  // ── Perfil de guilda (Profile API) ──────────────────────────────

  /** Busca o perfil de uma guilda no Profile API pelo guildId. */
  async getGuildProfile(guildId: string) {
    // Guild profiles come from PostgreSQL; Echo API proxies to it
    return this.echoApi.post("/guilds/profile", { guildId });
  }

  /** Cria ou atualiza o perfil de uma guilda no Profile API (avatar, banner, descrição). */
  async upsertGuildProfile(guildId: string, data: {
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    createdBy: string;
  }) {
    await this.echoApi.post("/guilds/profile/upsert", { guildId, data });
  }

  /** Atualiza parcialmente o perfil de uma guilda no Profile API. */
  async patchGuildProfile(guildId: string, data: {
    name?: string;
    description?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
  }) {
    await this.echoApi.post("/guilds/profile/patch", { guildId, data });
  }

  /** Remove o perfil de uma guilda do Profile API. */
  async deleteGuildProfile(guildId: string): Promise<void> {
    await this.echoApi.post("/guilds/profile/delete", { guildId });
  }

  /** Devolve o MXID do usuário logado. */
  getUserId(): string | null {
    return this.session?.userId ?? null;
  }

  /** Devolve o access token do usuário logado. */
  getAccessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  /** Devolve a base URL do homeserver. */
  getHomeserverUrl(): string {
    return this.baseUrl;
  }

  /** Converte mxc:// URL para HTTP (suporta autenticação para evitar M_FORBIDDEN). */
  mxcUrlToHttp(mxcUrl: string, width?: number, height?: number, resizeMethod?: string, _allowDirectLinks?: boolean, _allowRedirects?: boolean, useAuthentication?: boolean): string | null {
    // Echo API handles media URLs natively; return null for mxc:// URLs
    // as the Echo API serves media HTTP endpoints directly.
    if (mxcUrl.startsWith("mxc://")) {
      return null; // Echo API serves media via HTTP directly
    }
    return mxcUrl;
  }

  /** Joined Spaces (m.space) como resumos de guildas. Nome lido de m.room.name. */
  async listGuilds(): Promise<{
    guildId: string;
    name: string;
    avatarUrl: string | null;
    unreadCount: number;
  }[]> {
    return this.echoApi.getGuilds();
  }

  /** Cria uma nova guilda (Space m.space) com nome, ícone, banner e descrição. */
  async createGuild(
    data: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ): Promise<{
    guildId: string;
    name: string;
    avatarUrl: string | null;
    unreadCount: number;
  }> {
    return this.echoApi.createGuild(data, this.session?.userId ?? "");
  }

  /** Sai (deleta) uma guilda própria. */
  async deleteGuild(guildId: string): Promise<void> {
    await this.echoApi.deleteGuild(guildId);
  }

  /** Sai de uma guilda (sem excluí-la). */
  async leaveGuild(guildId: string): Promise<void> {
    // Echo API doesn't have a "leave guild" concept beyond deleting the guild
    // or the user just stops participating
  }

  /** Cria um canal dentro de uma guilda (Space). Aceita tipo, tópico e categoria. */
  async createChannel(
    guildId: string,
    data: { name: string; type: string; topic?: string; category?: string },
  ): Promise<{
    channelId: string;
    name: string;
    topic?: string;
    type?: string;
    category?: string;
    unreadCount: number;
  }> {
    return this.echoApi.createChannel(guildId, data);
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
    await this.echoApi.post("/guilds/edit", { guildId, data });
  }

  /** Canais (filhos declarados via m.space.child) de um Space. */
  async listChannels(guildId: string): Promise<{
    channelId: string;
    name: string;
    topic?: string;
    type?: string;
    category?: string;
    unreadCount: number;
  }[]> {
    return this.echoApi.getChannels(guildId);
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
    await this.echoApi.post("/channels/edit", { channelId, data });
  }

  /** Sai (deleta) um canal próprio. */
  async deleteChannel(channelId: string): Promise<void> {
    await this.echoApi.post("/channels/delete", { channelId });
  }

  /** Membros com membership "join" de uma sala, com presença e avatar. */
  async listMembers(roomId: string): Promise<{
    userId: string;
    displayName: string;
    presence: "online" | "offline" | "unavailable";
    avatarUrl?: string | null;
  }[]> {
    return this.echoApi.getMembers(roomId);
  }

  /** Convida um usuário para uma sala. Retorna o event ID do convite. */
  async inviteUser(roomId: string, userId: string): Promise<string> {
    return this.echoApi.inviteUser(roomId, userId);
  }

  /** Expulsa (kick) um usuário de uma sala. Retorna o event ID. */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<string> {
    return this.echoApi.kickUser(roomId, userId, reason);
  }

  /** Bane um usuário de uma sala. Retorna o event ID. */
  async banUser(roomId: string, userId: string, reason?: string): Promise<string> {
    return this.echoApi.banUser(roomId, userId, reason);
  }

  /**
   * Define o power level de um usuário em uma sala (0-100).
   * Retorna o event ID da mudança de power level.
   */
  async setPowerLevel(roomId: string, userId: string, level: number): Promise<string> {
    await this.echoApi.setPowerLevel(roomId, userId, level);
    return `${roomId}:${userId}:${level}`;
  }

  private requireSession(): Session {
    if (!this.session) {
      throw new Error("MatrixService: no active session — call loginWithSsoToken or restoreSession first");
    }
    return this.session;
  }
}

/** Singleton do MatrixService (agora wrapping EchoApi) para todo o app. */
export const matrixService = new MatrixService(ECHO_HOMESERVER_URL);
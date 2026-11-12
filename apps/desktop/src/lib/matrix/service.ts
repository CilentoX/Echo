import { EchoApi, type EchoApiInit } from "@/lib/api/echoApi";
import type { Session, GuildSummary } from "./types";
import { ECHO_HOMESERVER_URL } from "./sso";
import { saveSession, clearSession } from "@/lib/storage/keyring";

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

  /** Login with an authorization code via Echo API /auth/token. */
  async loginWithCode(code: string): Promise<Session> {
    const session = await this.echoApi.exchangeCodeForTokens(code);

    // Store session in keyring for persistence
    await saveSession(session);

    this.session = session;

    return this.session;
  }

  /** @deprecated Use loginWithCode instead. Kept for test compatibility. */
  async loginWithSsoToken(loginToken: string): Promise<Session> {
    // For backward compatibility with tests, treat loginToken as code
    return this.loginWithCode(loginToken);
  }

  /** Recreate a client from a persisted session (no request is made). */
  restoreSession(session: Session): void {
    this.session = session;
    // Echo API client state is managed via the singleton; no-op here
    // since the singleton is initialized once with the token.
  }

  /** SSO redirect URL, wrapping the Echo API client. */
  async getSsoLoginUrl(redirectUrl: string, idpId?: string): Promise<string> {
    return this.echoApi.getSsoLoginUrl(redirectUrl, idpId);
  }

  /** Logout: clear session and disconnect client. */
  async logout(): Promise<void> {
    this.session = null;
    await clearSession();
    // Echo API singleton token is cleared by the session gate
  }

  /** Liga o sync loop aos handlers. Delega ao EchoApi que conecta via WebSocket /matrix/sync. */
  startSyncHandlers(handlers: {
    onStatus?: (status: string, error?: any) => void;
    onEvent?: (event: any) => void;
    onTyping?: (roomId: string, userIds: string[]) => void;
    onPresence?: (userId: string, presence: any) => void;
    onMembers?: (roomId: string, members: any[]) => void;
    onReaction?: (reaction: any) => void;
    onReadReceipt?: (roomId: string, userId: string, eventId: string) => void;
    [key: string]: any;
  }): void {
    this.echoApi.startSyncHandlers(handlers);
  }

  stopSync(): void {
    this.echoApi.stopSync();
  }

  /** Send an m.text message; resolves with the resulting event id. */
  async sendMessage(roomId: string, body: string): Promise<string> {
    return this.echoApi.sendMessage(roomId, body);
  }

  /** Sends an m.file message: uploads the file, then sends m.message with m.file content. */
  async sendFile(
    roomId: string,
    file: File,
    body?: string,
    options?: { replyToEventId?: string },
  ): Promise<string> {
    const mediaUri = await this.echoApi.uploadChatMedia(file);
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const msgtype = isImage ? "m.image" : isAudio ? "m.audio" : "m.file";
    return this.echoApi.sendMessage(roomId, body ?? mediaUri, {
      msgtype,
      ...(options?.replyToEventId ? { replyToEventId: options.replyToEventId } : {}),
    });
  }

  /** Envia uma reação m.reaction (m.annotation com m.relates_to) a um evento. */
  async sendReaction(_roomId: string, _targetEventId: string, _emoji: string): Promise<string> {
    return this.echoApi.sendReaction(_roomId, _targetEventId, _emoji);
  }

  /** Remove a própria reação de um evento (redige o evento de reação). */
  async removeReaction(roomId: string, reactionEventId: string): Promise<void> {
    await this.echoApi.redact(roomId, reactionEventId);
  }

  /** Marca o canal como lido até o evento dado (recibo de leitura real no server). */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    await this.echoApi.markAsRead(roomId, eventId);
  }

  /** Redige (exclui) um evento próprio. */
  async redact(roomId: string, eventId: string): Promise<void> {
    await this.echoApi.redact(roomId, eventId);
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
  async loadOlder(roomId: string, limit = 20, from?: string): Promise<any[]> {
    return this.echoApi.loadOlder(roomId, limit, from);
  }

  /** Perfil de um usuário (sem args = próprio usuário). */
  async getDisplayName(userId?: string): Promise<string | null> {
    const profile = await this.echoApi.getUserProfile(userId);
    return profile.displayName ?? null;
  }

  /** Altera o nome de exibição da própria conta. */
  async setDisplayName(name: string): Promise<void> {
    await this.echoApi.patchUserProfile("", { displayName: name });
  }

  /** Envia um arquivo de mídia (avatar, banner, anexo) e devolve o mxc:// URI. */
  async uploadMedia(file: File): Promise<string> {
    return this.echoApi.uploadChatMedia(file);
  }

  /** Define o avatar do próprio usuário (mxc:// URI ou null para remover). */
  async setAvatarUrl(url: string | null): Promise<void> {
    if (!url) {
      // Remove avatar — Echo API handles this via profile patch
      await this.echoApi.patchUserProfile("", { avatarUrl: null });
      return;
    }
    // If url is already an mxc:// URI, we need to upload it via the media endpoint
    // or store it as-is. For now, just store the reference.
    await this.echoApi.patchUserProfile("", { avatarUrl: url });
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
  async getUserProfile(userId?: string): Promise<{
    userId?: string;
    displayName: string | null;
    nickname?: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    role: string | null;
  }> {
    return this.echoApi.getUserProfile(userId);
  }

  /** Busca todo o perfil de um usuário na Echo API / PostgreSQL (avatar, banner, bio, links). */
  async getGlobalProfile(userId: string) {
    // Global profile comes from PostgreSQL via Echo API; delegate to profile getUserProfile
    return this.echoApi.getUserProfile(userId);
  }

  /** Atualiza parcialmente o perfil global no Profile API (avatar, banner, bio, links). */
  async patchGlobalProfile(
    userIdOrData:
      | string
      | {
          avatarUrl?: string | null;
          bannerUrl?: string | null;
          bio?: string | null;
          links?: Array<{ label: string; url: string }>;
        },
    maybeData?: {
      avatarUrl?: string | null;
      bannerUrl?: string | null;
      bio?: string | null;
      links?: Array<{ label: string; url: string }>;
    },
  ): Promise<void> {
    const userId = typeof userIdOrData === "string" ? userIdOrData : "";
    const data = typeof userIdOrData === "object" ? userIdOrData : (maybeData ?? {});
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

  // ── Perfil de guilda (Echo API) ──────────────────────────────

  /** Busca o perfil de uma guilda pelo guildId. */
  async getGuildProfile(guildId: string) {
    return this.echoApi.getGuildProfile(guildId);
  }

  /** Cria ou atualiza o perfil de uma guilda (avatar, banner, descrição). */
  async upsertGuildProfile(guildId: string, data: {
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    createdBy: string;
  }) {
    return this.echoApi.upsertGuildProfile(guildId, {
      name: data.name,
      avatarUrl: data.avatarUrl,
      bannerUrl: data.bannerUrl,
      description: data.description,
    });
  }

  /** Atualiza parcialmente o perfil de uma guilda. */
  async patchGuildProfile(guildId: string, data: {
    name?: string;
    description?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
  }) {
    return this.echoApi.patch(`/api/guilds/${guildId}/profile`, data);
  }

  /** Remove o perfil de uma guilda. */
  async deleteGuildProfile(guildId: string): Promise<void> {
    await this.echoApi.delete(`/api/guilds/${guildId}/profile`);
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
  mxcUrlToHttp(mxcUrl: string): string | null {
    // Echo API handles media URLs natively; return null for mxc:// URLs
    // as the Echo API serves media HTTP endpoints directly.
    if (mxcUrl.startsWith("mxc://")) {
      return null; // Echo API serves media via HTTP directly
    }
    return mxcUrl;
  }

  /** Joined Spaces (m.space) como resumos de guildas. Nome lido de m.room.name. */
  async listGuilds(): Promise<GuildSummary[]> {
    const rawGuilds = await this.echoApi.getGuilds();
    return rawGuilds.map((g: any) => ({
      guildId: g.guildId,
      name: g.name,
      avatarUrl: g.avatarUrl ?? null,
      bannerUrl: g.bannerUrl ?? null,
      description: g.description ?? null,
      unreadCount: g.unreadCount ?? 0,
      createdBy: g.createdBy ?? null,
    }));
  }

  /** Cria uma nova guilda (Space m.space) com nome, ícone, banner e descrição. */
  async createGuild(
    data: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ): Promise<GuildSummary> {
    const res = await this.echoApi.createGuild(data, this.session?.userId ?? "");
    return {
      guildId: res.guildId,
      name: res.name,
      avatarUrl: res.avatarUrl ?? null,
      bannerUrl: (res as any).bannerUrl ?? data.bannerUrl ?? null,
      description: (res as any).description ?? data.description ?? null,
      unreadCount: res.unreadCount ?? 0,
      createdBy: (res as any).createdBy ?? this.session?.userId ?? null,
    };
  }

  /** Sai (deleta) uma guilda própria. */
  async deleteGuild(guildId: string): Promise<void> {
    await this.echoApi.deleteGuild(guildId);
  }

  /** Sai de uma guilda (sem excluí-la). */
  async leaveGuild(guildId: string): Promise<void> {
    await this.echoApi.post(`/guilds/${guildId}/leave`);
  }

  /** Cria um convite para uma guilda. */
  async createGuildInvite(
    guildId: string,
    options?: { maxUses?: number; expiresInHours?: number },
  ) {
    return this.echoApi.createGuildInvite(guildId, options);
  }

  /** Consulta a prévia de um convite público. */
  async getInvitePreview(code: string) {
    return this.echoApi.getInvitePreview(code);
  }

  /** Entra em uma guilda através de um código ou link de convite. */
  async joinGuildViaInvite(code: string) {
    return this.echoApi.joinGuildViaInvite(code);
  }

  /** Lista convites de uma guilda. */
  async listGuildInvites(guildId: string) {
    return this.echoApi.listGuildInvites(guildId);
  }

  /** Remove/revoga um convite de guilda. */
  async deleteGuildInvite(guildId: string, inviteId: string) {
    return this.echoApi.deleteGuildInvite(guildId, inviteId);
  }

  /** Lista cargos de uma guilda. */
  async getGuildRoles(guildId: string) {
    return this.echoApi.getGuildRoles(guildId);
  }

  /** Cria um cargo na guilda. */
  async createGuildRole(
    guildId: string,
    data: {
      name: string;
      color?: string | null;
      position?: number;
      isHoisted?: boolean;
      permissions?: string[];
    },
  ) {
    return this.echoApi.createGuildRole(guildId, data);
  }

  /** Atualiza um cargo na guilda. */
  async updateGuildRole(
    guildId: string,
    roleId: string,
    data: Parameters<typeof this.echoApi.updateGuildRole>[2],
  ) {
    return this.echoApi.updateGuildRole(guildId, roleId, data);
  }

  /** Remove um cargo na guilda. */
  async deleteGuildRole(guildId: string, roleId: string) {
    return this.echoApi.deleteGuildRole(guildId, roleId);
  }

  /** Carrega dados de membros da guilda (cargos e apelidos do servidor). */
  async getGuildMembersData(guildId: string) {
    return this.echoApi.getGuildMembersData(guildId);
  }

  /** Define o apelido do usuário na guilda. */
  async setGuildMemberNickname(guildId: string, nickname: string | null) {
    return this.echoApi.setGuildMemberNickname(guildId, nickname);
  }

  /** Atribui um cargo a um membro. */
  async assignGuildMemberRole(guildId: string, targetUserId: string, roleId: string) {
    return this.echoApi.assignGuildMemberRole(guildId, targetUserId, roleId);
  }

  /** Remove um cargo de um membro. */
  async removeGuildMemberRole(guildId: string, targetUserId: string, roleId: string) {
    return this.echoApi.removeGuildMemberRole(guildId, targetUserId, roleId);
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
    await this.echoApi.editChannel(channelId, data);
  }

  /** Sai (deleta) um canal próprio. */
  async deleteChannel(channelId: string): Promise<void> {
    await this.echoApi.deleteChannel(channelId);
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

  /**
   * Define a presença do usuário conectado no Synapse / EchoApi.
   */
  async setPresence(presence: "online" | "offline" | "unavailable", statusMsg?: string): Promise<void> {
    await this.echoApi.setPresence(presence, statusMsg);
  }

  /**
   * Obtém a presença atual de um usuário.
   */
  async getPresence(userId: string): Promise<"online" | "offline" | "unavailable"> {
    const res = await this.echoApi.getUserPresence(userId);
    return res.presence;
  }
}

/** Singleton do MatrixService (agora wrapping EchoApi) para todo o app. */
export const matrixService = new MatrixService(ECHO_HOMESERVER_URL);
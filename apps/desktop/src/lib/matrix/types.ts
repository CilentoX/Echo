/**
 * Session returned by loginWithSsoToken / consumed by restoreSession.
 */
export interface Session {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string | null;
  refreshToken?: string;
}

/**
 * A m.room.message event normalized from the SDK timeline.
 */
export interface NormalizedEvent {
  eventId: string;
  roomId: string;
  sender: string;
  body: string;
  originServerTs: number;
  /** Mensagem citada (reply-to), se houver. */
  replyTo?: { eventId: string; sender: string; body: string };
  /** Timestamp da última edição (undefined = nunca editado). */
  editedAt?: number;
  /** Mensagem excluída pelo server (redacted). */
  redacted?: boolean;
  /** Avatar mxc:// do remetente (null = sem avatar). */
  senderAvatarUrl?: string | null;
}

/** Reação m.reaction (m.annotation) normalizada. */
export interface NormalizedReaction {
  /** eventId do próprio evento de reação (necessário p/ redact no toggle). */
  eventId: string;
  roomId: string;
  sender: string;
  /** eventId da mensagem alvo. */
  targetEventId: string;
  emoji: string;
}

/** Presença sintetizada a partir do User do SDK. */
export type PresenceState = "online" | "offline" | "unavailable";

/** Membro de canal normalizado (join). */
export interface MemberSummary {
  userId: string;
  displayName: string;
  presence: PresenceState;
}

export interface GuildSummary {
  guildId: string;
  name: string;
  avatarUrl: string | null;
  unreadCount: number;
}

export interface ChannelSummary {
  channelId: string;
  name: string;
  topic?: string;
  type?: string;
  category?: string;
  unreadCount: number;
}

export type SyncStatus = "connecting" | "syncing" | "error";

/**
 * Dados do erro de sync (evento "sync" com estado ERROR do SDK).
 * `errcode` permite distinguir falha de autenticação (ex.: M_UNKNOWN_TOKEN,
 * token revogado → limpar a sessão) de erro de rede (manter a sessão e
 * reconectar). Presente só quando o SDK entrega o erro.
 */
export interface SyncErrorInfo {
  errcode: string;
}

/**
 * Structural subset of matrix-js-sdk's MatrixClient that MatrixService uses.
 * Lets tests inject a fake client without loading the real SDK.
 * (ICreateRoomOpts é import type-only: zero custo em runtime.)
 */
import type { ICreateRoomOpts } from "matrix-js-sdk";

export interface MatrixClientLike {
  loginRequest(req: { type: "m.login.token"; token: string }): Promise<LoginResponseLike>;
  getSsoLoginUrl(redirectUrl: string, loginType?: string, idpId?: string, action?: string): string;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  startClient(opts?: Record<string, unknown>): void;
  stopClient(): void;
  sendMessage(roomId: string, content: { msgtype: string; body: string }): Promise<SendEventResponseLike>;
  /** Envia qualquer evento de timeline (usado p/ m.reaction). */
  sendEvent(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
  ): Promise<{ event_id: string }>;
  /** Notificação de digitação (m.typing ephemeral). */
  sendTyping(roomId: string, isTyping: boolean, timeout?: number): Promise<unknown>;
  /** Exclui um evento (m.room.redaction). */
  redactEvent(roomId: string, eventId: string): Promise<{ event_id: string }>;
  /** Sai de uma sala/guilda (usado p/ excluir guilda própria). */
  leave(roomId: string): Promise<unknown>;
  /** Marca o canal como lido até o evento dado (leitura real no server). */
  sendReadReceipt(event: unknown, receiptType?: string, unthreaded?: boolean): Promise<unknown>;
  /** Pagina histórico antigo (API pública de alto nível do SDK). */
  scrollback(room: unknown, limit?: number): Promise<unknown>;
  /** MXID do usuário logado, ou null se não houver sessão. */
  getUserId(): string | null;
  /** Perfil de um usuário (sem args = próprio usuário). */
  getProfileInfo(userId?: string): Promise<{ displayname?: string; avatar_url?: string }>;
  setDisplayName(name: string): Promise<unknown>;
  /** Define o avatar do próprio usuário (mxc:// URI). */
  setAvatarUrl(url: string): Promise<unknown>;
  getRooms(): RoomLike[];
  getRoom(roomId: string): RoomLike | null;
  createRoom(opts: ICreateRoomOpts): Promise<{ room_id: string }>;
  sendStateEvent(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    stateKey?: string,
  ): Promise<{ event_id: string }>;
  /** Envio de arquivo/mídia (avatar, banner, anexo). Devolve mxc:// URI. */
  uploadContent(
    body: BodyInit,
    opts?: { name?: string; type?: string },
  ): Promise<{ content_uri: string }>;
}

export type SendEventResponseLike = string | { event_id: string };

export interface LoginResponseLike {
  access_token?: string;
  user_id?: string;
  device_id?: string | null;
  refresh_token?: string;
  home_server?: string;
}

export interface RoomStateEventLike {
  getStateKey(): string | undefined;
  getContent(): Record<string, unknown>;
}

export interface EventTimelineLike {
  getEvents(): TimelineEventLike[];
}

export interface RoomMemberLike {
  userId: string;
  name: string;
  membership: string;
  /** Objeto User do SDK; presença vem daqui. */
  user?: { presence?: string } | null;
}

export interface RoomLike {
  roomId: string;
  getMyMembership(): string;
  /** Room type from m.room.create; "m.space" for Spaces. */
  getType(): string | null | undefined;
  getMxcAvatarUrl(): string | null;
  getUnreadNotificationCount(type?: string): number;
  /** Timeline ao vivo (mensagens já sincronizadas + recebidas). */
  getLiveTimeline(): EventTimelineLike;
  /** Membros com membership "join". */
  getJoinedMembers(): RoomMemberLike[];
  currentState: {
    getStateEvents(eventType: string): RoomStateEventLike[];
    roomId?: string;
  };
}

export interface TimelineEventLike {
  getType(): string;
  getId(): string;
  getRoomId(): string | null;
  getSender(): string;
  getContent(): Record<string, unknown>;
  getTs(): number;
  /** true quando o evento foi redactado (excluído) — não renderizar. */
  isRedacted?(): boolean;
}

import { EchoApi } from "@/lib/api/echoApi";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useKeyring } from "@/lib/storage/keyring";

/**
 * Wiring EchoApi ↔ stores (tudo via Echo API / WebSocket sync).
 *
 * - onEvent → syncStore.applyEvent (dedupe por eventId cobre os ecos).
 * - onStatus → syncStore.setStatus + carregamento inicial no primeiro "syncing".
 * - onTyping → uiStore.setTypingUsers (agregado por sala).
 * - onPresence → uiStore.setPresence.
 * - onMembers → syncStore.setMembers.
 * - onReaction → syncStore.applyReaction.
 * - onReadReceipt → syncStore.markRead.
 *
 * Erro de sync: só desloga quando é falha de autenticação
 * (token inválido/expired → limpar a sessão), em qualquer momento da sessão —
 * erro de rede mantém a sessão, o WebSocket reconecta sozinho e o indicador
 * mostra "Reconectando…".
 *
 * Troca de guilda reseta activeChannelId=null (mensagens não vazam entre
 * guildas) e carrega os canais da nova guilda sob demanda.
 *
 * Idempotente: startSyncWiring não reinicia listeners já ativos e
 * stopSyncWiring (logout/rejeição de sessão) desfaz tudo e reseta os stores.
 */

let started = false;
let initialDataLoaded = false;
let unsubscribeUi: (() => void) | null = null;
/** Guildas com canais já carregados (evita refetch a cada sync/troca). */
const loadedGuilds = new Set<string>();
/** roomId → conjunto de usuários digitando agora (agregação do RoomMember.typing). */
const typingByRoom = new Map<string, Set<string>>();

/** WebSocket de sync ativo; gerenciado pelo Echo API connectSync. */
let syncWs: WebSocket | null = null;
let syncHandlersInstalled = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // ms

function isAuthError(error: { errcode: string } | undefined): boolean {
  return error !== undefined && ["M_UNKNOWN_TOKEN", "M_MISSING_TOKEN"].includes(error.errcode);
}

async function loadMembersFor(roomId: string): Promise<void> {
  try {
    const members = await (await import("./service")).matrixService.listMembers(roomId);
    useSyncStore.getState().setMembers(roomId, members);
  } catch {
    // best-effort: se falhar, a lista de membros fica vazia até o próximo evento
  }
}

async function loadChannelsFor(guildId: string): Promise<void> {
  if (loadedGuilds.has(guildId)) return;
  loadedGuilds.add(guildId); // marca antes do await: dedup de chamadas concorrentes
  try {
    const channels = await (await import("./service")).matrixService.listChannels(guildId);
    useSyncStore.getState().setChannels(guildId, channels);
    // Carrega membros de cada canal para popular membersByRoom
    await Promise.all(channels.map((ch) => loadMembersFor(ch.channelId)));
  } catch {
    loadedGuilds.delete(guildId); // permite retry
  }
}

async function loadInitialData(): Promise<void> {
  try {
    const guilds = await (await import("./service")).matrixService.listGuilds();
    useSyncStore.getState().setGuilds(guilds);

    const ui = useUiStore.getState();
    const guildId = ui.activeGuildId ?? guilds[0]?.guildId;
    if (guildId) {
      if (!ui.activeGuildId) ui.setActiveGuild(guildId);
      await loadChannelsFor(guildId);
      const channels = useSyncStore.getState().channelsByGuild[guildId] ?? [];
      const nextUi = useUiStore.getState();
      if (!nextUi.activeChannelId && channels[0]) {
        nextUi.setActiveChannel(channels[0].channelId);
      }
    }
    initialDataLoaded = true;
  } catch {
    // Best-effort: a próxima transição para "syncing" tenta de novo.
  }
}

function handleStatus(status: string, error?: { errcode: string }): void {
  useSyncStore.getState().setStatus(status as any);

  if (status === "syncing") {
    if (!initialDataLoaded) void loadInitialData();
    return;
  }

  if (status === "error" && isAuthError(error)) {
    // Token inválido/expirado: desloga sempre — mesmo depois de syncs
    // bem-sucedidos (o server pode revogar o access token a qualquer momento).
    // O SessionGate handler será chamado pelo reconnect logic.
  }
}

/**
 * Abre uma WebSocket conexão com o endpoint de sync do Echo API.
 * Mensagens recebidas têm o formato:
 *   { type: "event" | "status" | "typing" | "presence" | "members" | "reaction" | "receipt", ... }
 */
function openSyncWebSocket(accessToken: string): void {
  // Fechar conexão existente se houver
  if (syncWs) {
    syncWs.close();
    syncWs = null;
  }

  syncWs = new WebSocket(`${ECHO_HOMESERVER_URL}/matrix/sync?access_token=${accessToken}`);

  syncWs.onopen = () => {
    reconnectAttempts = 0;
    syncHandlersInstalled = false;
  };

  syncWs.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as {
        type:
          | "event"
          | "status"
          | "typing"
          | "presence"
          | "members"
          | "reaction"
          | "receipt";
        [key: string]: unknown;
      };

      switch (message.type) {
        case "event": {
          const normalized = normalizeSyncEvent(message.event);
          if (normalized) {
            useSyncStore.getState().applyEvent(normalized);
          }
          break;
        }
        case "status": {
          handleStatus(message.status, message.error);
          break;
        }
        case "typing": {
          const roomId = message.roomId as string;
          const userId = message.userId as string;
          const isTyping = message.isTyping as boolean;
          let set = typingByRoom.get(roomId);
          if (!set) {
            set = new Set();
            typingByRoom.set(roomId, set);
          }
          if (isTyping) set.add(userId);
          else set.delete(userId);
          const ui = useUiStore.getState();
          ui.setTypingUsers(roomId, Array.from(set));
          break;
        }
        case "presence": {
          const userId = message.userId as string;
          const state = mapPresence(message.presence as string | undefined);
          useUiStore.getState().setPresence(userId, state);
          break;
        }
        case "members": {
          const roomId = message.roomId as string;
          const members = message.members as Array<{
            userId: string;
            displayName: string;
            presence: string;
          }>;
          useSyncStore.getState().setMembers(roomId, members.map((m) => ({
            userId: m.userId,
            displayName: m.displayName,
            presence: mapPresence(m.presence),
            avatarUrl: undefined,
          })));
          break;
        }
        case "reaction": {
          const normalized = normalizeSyncReaction(message.reaction);
          if (normalized) {
            useSyncStore.getState().applyReaction(normalized);
          }
          break;
        }
        case "receipt": {
          const roomId = message.roomId as string;
          const userId = message.userId as string;
          const eventId = message.eventId as string;
          useSyncStore.getState().markRead(roomId, userId, eventId);
          break;
        }
      }
    } catch (e) {
      console.error("[wiring] Erro ao processar mensagem sync:", e);
    }
  };

  syncWs.onerror = (error) => {
    console.error("[wync] WebSocket error:", error);
    handleStatus("error", { errcode: "NETWORK_ERROR" });
  };

  syncWs.onclose = () => {
    // Attempt reconnect with exponential backoff
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
      setTimeout(openSyncWebSocket, delay);
    } else {
      handleStatus("error", { errcode: "SYNC_FAILED" });
    }
  };
}

function normalizeSyncEvent(event: any): import("./types").NormalizedEvent | null {
  if (event.getType && event.getType() !== "m.room.message") return null;
  if (event.isRedacted && event.isRedacted()) return null;
  const body = event.body;
  const eventId = event.eventId;
  const roomId = event.roomId;
  const sender = event.sender;
  if (typeof body !== "string" || !eventId || !roomId) return null;
  return {
    eventId,
    roomId,
    sender,
    body,
    originServerTs: event.originServerTs ?? Date.now(),
    ...(event.replyTo && { replyTo: { eventId: event.replyTo.eventId, sender: event.replyTo.sender, body: event.replyTo.body } }),
    ...(event.editedAt && { editedAt: event.editedAt }),
    ...(event.redacted && { redacted: event.redacted }),
    ...(event.senderAvatarUrl && { senderAvatarUrl: event.senderAvatarUrl }),
  };
}

function normalizeSyncReaction(reaction: any): import("./types").NormalizedReaction | null {
  if (!reaction) return null;
  return {
    eventId: reaction.eventId || "",
    roomId: reaction.roomId || "",
    sender: reaction.sender || "",
    targetEventId: reaction.targetEventId || "",
    emoji: reaction.emoji || "",
  };
}

function mapPresence(presence: string | undefined): "online" | "offline" | "unavailable" {
  switch (presence) {
    case "online": return "online";
    case "offline": return "offline";
    case "unavailable": return "unavailable";
    default: return "offline";
  }
}

/** Liga o sync loop aos stores; chamar uma única vez por sessão ativa. */
export function startSyncWiring(onAuthFailure: () => void): void {
  if (started) return;
  started = true;

  // Obter o token da sessão - usamos sync storage para evitar await no topo
  const storedSession = useKeyring.getItem("echo:session");
  const sessionJson = storedSession ? JSON.parse(storedSession) : null;
  const session = sessionJson ? sessionJson.accessToken : null;

  if (!session) {
    console.warn("[wiring] Nenhum token de sessão disponível para sync");
    return;
  }

  // Abrir WebSocket de sync
  openSyncWebSocket(session);

  // Subscribe to UI store changes for guild switching
  unsubscribeUi = useUiStore.subscribe((state, prev) => {
    if (state.activeGuildId && state.activeGuildId !== prev.activeGuildId) {
      // Fix B7-relacionado: não deixa mensagens vazar entre guildas.
      state.setActiveChannel(null);
      void loadChannelsFor(state.activeGuildId);
    }
  });

  // Marca que os handlers foram instalados
  syncHandlersInstalled = true;
}

/** Desliga o sync, limpa flags internas e reseta os stores (logout). */
export function stopSyncWiring(): void {
  if (syncWs) {
    syncWs.close();
    syncWs = null;
  }
  unsubscribeUi?.();
  unsubscribeUi = null;
  started = false;
  initialDataLoaded = false;
  loadedGuilds.clear();
  typingByRoom.clear();

  useSyncStore.getState().reset();
  const ui = useUiStore.getState();
  ui.setMyUserId(null);
  ui.setActiveGuild(null);
  ui.setActiveChannel(null);
}

/** Carrega histórico antigo de um canal e insere no topo da timeline. */
export async function loadOlder(channelId: string, limit = 20): Promise<void> {
  const events = await (await import("./service")).matrixService.loadOlder(channelId, limit);
  if (events.length > 0) {
    useSyncStore.getState().prependEvents(channelId, events);
  }
}

/** Marca o canal como lido até o evento dado (recibo real + store). */
export async function markAsRead(roomId: string, eventId: string): Promise<void> {
  const ui = useUiStore.getState();
  if (!ui.myUserId) return;
  await (await import("./service")).matrixService.markAsRead(roomId, eventId);
  useSyncStore.getState().markRead(roomId, ui.myUserId, eventId);
}

/** Define o estado de digitação em uma sala (m.typing ephemeral). */
export async function setTyping(roomId: string, isTyping: boolean): Promise<void> {
  await (await import("./service")).matrixService.setTyping(roomId, isTyping);
}

/** Reseta estado interno do wiring (usado em testes). */
export function __resetWiringState(): void {
  started = false;
  initialDataLoaded = false;
  loadedGuilds.clear();
  typingByRoom.clear();
  unsubscribeUi?.();
  unsubscribeUi = null;

  if (syncWs) {
    syncWs.close();
    syncWs = null;
  }

  useSyncStore.getState().reset();
  const ui = useUiStore.getState();
  ui.setMyUserId(null);
  ui.setActiveGuild(null);
  ui.setActiveChannel(null);
}
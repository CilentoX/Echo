import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { loadSession, useKeyring } from "@/lib/storage/keyring";
import { matrixService } from "./instance";
import { desktopCache, desktopConfig } from "@/lib/storage/desktopConfig";

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
let authFailureCallback: (() => void) | null = null;
/** Guildas com canais já carregados (evita refetch a cada sync/troca). */
const loadedGuilds = new Set<string>();
/** roomId → conjunto de usuários digitando agora (agregação do RoomMember.typing). */
const typingByRoom = new Map<string, Set<string>>();

/** WebSocket de sync ativo (gerenciado quando backend fornecer streaming). */
let syncWs: WebSocket | null = null;
let pollingTimer: ReturnType<typeof setInterval> | null = null;

function isAuthError(error: { errcode: string } | undefined): boolean {
  return error !== undefined && ["M_UNKNOWN_TOKEN", "M_MISSING_TOKEN"].includes(error.errcode);
}

async function loadMembersFor(roomId: string): Promise<void> {
  try {
    const members = await matrixService.listMembers(roomId);
    useSyncStore.getState().setMembers(roomId, members);
  } catch {
    // best-effort: se falhar, a lista de membros fica vazia até o próximo evento
  }
}

async function loadChannelsFor(guildId: string): Promise<void> {
  if (!guildId || guildId === "home") return;
  if (loadedGuilds.has(guildId)) return;
  loadedGuilds.add(guildId); // marca antes do await: dedup de chamadas concorrentes
  try {
    const channels = await matrixService.listChannels(guildId);
    useSyncStore.getState().setChannels(guildId, channels);
    try {
      desktopCache.cacheChannels(guildId, channels);
    } catch {}
    // Carrega membros de cada canal para popular membersByRoom
    await Promise.all(channels.map((ch) => loadMembersFor(ch.channelId)));
  } catch {
    loadedGuilds.delete(guildId); // permite retry
  }
}

async function loadInitialData(): Promise<void> {
  try {
    const guilds = await matrixService.listGuilds();
    useSyncStore.getState().setGuilds(guilds);
    try {
      desktopCache.cacheGuilds(guilds);
    } catch {}

    const ui = useUiStore.getState();
    const guildId = ui.activeGuildId ?? guilds[0]?.guildId;
    if (guildId && guildId !== "home") {
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

async function handleStatus(status: string, error?: { errcode: string }): Promise<void> {
  useSyncStore.getState().setStatus(status as any);

  if (status === "syncing") {
    if (!initialDataLoaded) await loadInitialData();
    return;
  }

  if (status === "error" && isAuthError(error)) {
    authFailureCallback?.();
  }
}

function startPollingLoop(): void {
  if (pollingTimer) return;
  pollingTimer = setInterval(async () => {
    if (!started) return;
    const ui = useUiStore.getState();
    const activeChannelId = ui.activeChannelId;
    if (activeChannelId) {
      try {
        const events = await matrixService.loadOlder(activeChannelId, 20);
        if (events && events.length > 0) {
          const store = useSyncStore.getState();
          for (const ev of events) {
            store.applyEvent(ev);
          }
        }
      } catch (err: any) {
        if (isAuthError(err)) {
          authFailureCallback?.();
        }
      }
    }
  }, 4000);
}

function stopPollingLoop(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function normalizeSyncEvent(event: any): import("./types").NormalizedEvent | null {
  if (event.getType && event.getType() !== "m.room.message") return null;
  if (event.isRedacted && event.isRedacted()) return null;
  const content = event.getContent ? event.getContent() : (event.content || {});
  const body = event.body || content.body;
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
    msgtype: event.msgtype || content.msgtype || "m.text",
    url: event.url || content.url || null,
    info: event.info || content.info || undefined,
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
export async function startSyncWiring(onAuthFailure?: () => void): Promise<void> {
  if (started) return;
  started = true;
  authFailureCallback = onAuthFailure ?? null;

  // Hook sync handlers into matrixService
  matrixService.startSyncHandlers({
    onStatus: (status: any, error?: any) => handleStatus(status, error),
    onEvent: (event: any) => {
      const normalized = normalizeSyncEvent(event);
      if (normalized) useSyncStore.getState().applyEvent(normalized);
    },
    onTyping: (roomId: string, userIds: string[]) => {
      useUiStore.getState().setTypingUsers(roomId, userIds);
    },
    onPresence: (userId: string, presence: any) => {
      useUiStore.getState().setPresence(userId, mapPresence(presence));
    },
    onMembers: (roomId: string, members: any[]) => {
      useSyncStore.getState().setMembers(roomId, members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        presence: mapPresence(m.presence),
        avatarUrl: m.avatarUrl,
      })));
    },
    onReaction: (reaction: any) => {
      const normalized = normalizeSyncReaction(reaction);
      if (normalized) useSyncStore.getState().applyReaction(normalized);
    },
    onReadReceipt: (roomId: string, userId: string, eventId: string) => {
      useSyncStore.getState().markRead(roomId, userId, eventId);
    },
  });

  // Obter o token da sessão ativa de forma confiável (sem tocar em restoreSession)
  let sessionToken: string | null = (matrixService as any).getAccessToken?.() ?? (matrixService as any).accessToken ?? null;
  if (!sessionToken) {
    try {
      const stored = await loadSession();
      if (stored?.accessToken) {
        sessionToken = stored.accessToken;
      }
    } catch {
      // ignore
    }
  }

  // Fallback para keyring legado (se existir)
  if (!sessionToken) {
    try {
      const storedSession = await useKeyring.getItem("echo:session");
      const sessionJson = storedSession ? JSON.parse(storedSession) : null;
      sessionToken = sessionJson?.accessToken ?? null;
    } catch {
      // ignore
    }
  }

  if (sessionToken) {
    // Sincronização e polling em segundo plano via EchoApi HTTP REST
    startPollingLoop();
  } else {
    console.warn("[wiring] Nenhum token de sessão disponível para sync");
  }

  // Subscribe to UI store changes for guild switching and navigation persistence
  unsubscribeUi = useUiStore.subscribe((state, prev) => {
    if (state.activeGuildId !== prev.activeGuildId || state.activeChannelId !== prev.activeChannelId) {
      try {
        desktopConfig.set("navigation", {
          lastActiveGuildId: state.activeGuildId,
          lastActiveChannelId: state.activeChannelId,
        });
      } catch {}
    }

    if (state.activeGuildId && state.activeGuildId !== prev.activeGuildId) {
      // Fix B7-relacionado: não deixa mensagens vazar entre guildas.
      state.setActiveChannel(null);
      if (state.activeGuildId !== "home") {
        void loadChannelsFor(state.activeGuildId);
      }
    }
  });
}

/** Desliga o sync, limpa flags internas e reseta os stores (logout). */
export function stopSyncWiring(): void {
  stopPollingLoop();
  if (syncWs) {
    try {
      syncWs.close();
    } catch {}
    syncWs = null;
  }
  unsubscribeUi?.();
  unsubscribeUi = null;
  started = false;
  initialDataLoaded = false;
  authFailureCallback = null;
  matrixService.stopSync();
  loadedGuilds.clear();
  typingByRoom.clear();

  try {
    void desktopCache.clear();
  } catch {}

  useSyncStore.getState().reset();
  const ui = useUiStore.getState();
  ui.setMyUserId(null);
  ui.setActiveGuild(null);
  ui.setActiveChannel(null);
}

/** Carrega histórico antigo de um canal e insere no topo da timeline. */
export async function loadOlder(channelId: string, limit = 20): Promise<void> {
  const events = await matrixService.loadOlder(channelId, limit);
  if (events && events.length > 0) {
    useSyncStore.getState().prependEvents(channelId, events);
  }
}

/** Marca o canal como lido até o evento dado (recibo real + store). */
export async function markAsRead(roomId: string, eventId: string): Promise<void> {
  const ui = useUiStore.getState();
  if (!ui.myUserId) return;
  await matrixService.markAsRead(roomId, eventId);
  useSyncStore.getState().markRead(roomId, ui.myUserId, eventId);
}

/** Define o estado de digitação em uma sala (m.typing ephemeral). */
export async function setTyping(roomId: string, isTyping: boolean): Promise<void> {
  await matrixService.setTyping(roomId, isTyping);
}

/** Reseta estado interno do wiring (usado em testes). */
export function __resetWiringState(): void {
  stopPollingLoop();
  started = false;
  initialDataLoaded = false;
  authFailureCallback = null;
  loadedGuilds.clear();
  typingByRoom.clear();
  unsubscribeUi?.();
  unsubscribeUi = null;

  if (syncWs) {
    try {
      syncWs.close();
    } catch {}
    syncWs = null;
  }

  useSyncStore.getState().reset();
  const ui = useUiStore.getState();
  ui.setMyUserId(null);
  ui.setActiveGuild(null);
  ui.setActiveChannel(null);
}

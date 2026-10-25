import { matrixService } from "./instance";
import type { SyncErrorInfo, SyncStatus } from "./types";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

/**
 * Wiring MatrixService ↔ stores (tudo real via Matrix, sem mocks).
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
 * (M_UNKNOWN_TOKEN/M_MISSING_TOKEN), em qualquer momento da sessão —
 * erro de rede mantém a sessão, o SDK reconecta sozinho e o indicador
 * mostra "Reconectando…".
 *
 * Troca de guilda reseta activeChannelId=null (mensagens não vazam entre
 * guildas) e carrega os canais da nova guilda sob demanda.
 *
 * Idempotente: `startSyncWiring` não reinicia listeners já ativos e
 * `stopSyncWiring` (logout/rejeição de sessão) desfaz tudo e reseta os stores.
 */

const AUTH_ERRCODES = new Set(["M_UNKNOWN_TOKEN", "M_MISSING_TOKEN"]);

let started = false;
let initialDataLoaded = false;
let unsubscribeUi: (() => void) | null = null;
/** Guildas com canais já carregados (evita refetch a cada sync/troca). */
const loadedGuilds = new Set<string>();
/** roomId → conjunto de usuários digitando agora (agregação do RoomMember.typing). */
const typingByRoom = new Map<string, Set<string>>();

function isAuthError(error?: SyncErrorInfo): boolean {
  return error !== undefined && AUTH_ERRCODES.has(error.errcode);
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
  if (loadedGuilds.has(guildId)) return;
  loadedGuilds.add(guildId); // marca antes do await: dedup de chamadas concorrentes
  try {
    const channels = await matrixService.listChannels(guildId);
    useSyncStore.getState().setChannels(guildId, channels);
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

async function handleStatus(
  status: SyncStatus,
  error: SyncErrorInfo | undefined,
  onAuthFailure: () => void,
): Promise<void> {
  useSyncStore.getState().setStatus(status);

  if (status === "syncing") {
    if (!initialDataLoaded) await loadInitialData();
    return;
  }

  if (status === "error" && isAuthError(error)) {
    // Token inválido/expirado: desloga sempre — mesmo depois de syncs
    // bem-sucedidos (o server pode revogar o access token a qualquer momento).
    onAuthFailure();
  }
}

/** Liga o sync loop aos stores; chamar uma única vez por sessão ativa. */
export function startSyncWiring(onAuthFailure: () => void): void {
  if (started) return;
  started = true;

  matrixService.startSyncHandlers({
    onEvent: (event: import("./types").NormalizedEvent) =>
      useSyncStore.getState().applyEvent(event),
    onStatus: (status: SyncStatus, error?: SyncErrorInfo) => {
      void handleStatus(status, error, onAuthFailure);
    },
    onTyping: (roomId: string, userId: string, isTyping: boolean) => {
      let set = typingByRoom.get(roomId);
      if (!set) {
        set = new Set();
        typingByRoom.set(roomId, set);
      }
      if (isTyping) set.add(userId);
      else set.delete(userId);
      const ui = useUiStore.getState();
      ui.setTypingUsers(roomId, Array.from(set));
    },
    onPresence: (userId: string, state: import("./types").PresenceState) => {
      useUiStore.getState().setPresence(userId, state);
    },
    onMembers: (roomId: string, members: import("./types").MemberSummary[]) => {
      useSyncStore.getState().setMembers(roomId, members);
    },
    onReaction: (r: import("./types").NormalizedReaction) =>
      useSyncStore.getState().applyReaction(r),
    onReadReceipt: (roomId: string, userId: string, eventId: string) => {
      useSyncStore.getState().markRead(roomId, userId, eventId);
    },
  });

  // Canais da guilda recém-selecionada carregam sob demanda.
  unsubscribeUi = useUiStore.subscribe((state, prev) => {
    if (state.activeGuildId && state.activeGuildId !== prev.activeGuildId) {
      // Fix B7-relacionado: não deixa mensagens vazar entre guildas.
      state.setActiveChannel(null);
      void loadChannelsFor(state.activeGuildId);
    }
  });
}

/** Desliga o sync, limpa flags internas e reseta os stores (logout). */
export function stopSyncWiring(): void {
  matrixService.stopSync();
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
  const events = await matrixService.loadOlder(channelId, limit);
  if (events.length > 0) {
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
export function setTyping(roomId: string, isTyping: boolean): Promise<void> {
  return matrixService.setTyping(roomId, isTyping);
}

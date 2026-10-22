import { matrixService } from "./instance";
import type { NormalizedEvent, SyncErrorInfo, SyncStatus } from "./types";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

/**
 * Wiring MatrixService ↔ stores (plano Task 11 Step 2; revisão da Fase 1).
 *
 * - `onEvent` → `syncStore.applyEvent` (dedupe por eventId cobre os ecos).
 * - `onStatus` → `syncStore.setStatus` + carregamento inicial: no primeiro
 *   "syncing" busca guildas/canais e auto-seleciona o primeiro de cada.
 * - Erro de sync ANTES do primeiro sync: só desloga quando é falha de
 *   autenticação (M_UNKNOWN_TOKEN/M_MISSING_TOKEN) — erro de rede mantém a
 *   sessão, o SDK reconecta sozinho e o indicador mostra "Reconectando…".
 * - Troca de guilda ativa carrega os canais dela sob demanda.
 *
 * Idempotente: `startSyncWiring` não reinicia listeners já ativos (evita o
 * duplo startSync) e `stopSyncWiring` (logout/rejeição de sessão) desfaz
 * tudo e reseta os stores.
 */

const AUTH_ERRCODES = new Set(["M_UNKNOWN_TOKEN", "M_MISSING_TOKEN"]);

let started = false;
let hasSynced = false;
let initialDataLoaded = false;
let unsubscribeUi: (() => void) | null = null;
/** Guildas com canais já carregados (evita refetch a cada sync/troca). */
const loadedGuilds = new Set<string>();

function isAuthError(error?: SyncErrorInfo): boolean {
  return error !== undefined && AUTH_ERRCODES.has(error.errcode);
}

async function loadChannelsFor(guildId: string): Promise<void> {
  if (loadedGuilds.has(guildId)) return;
  loadedGuilds.add(guildId); // marca antes do await: dedup de chamadas concorrentes
  try {
    const channels = await matrixService.listChannels(guildId);
    useSyncStore.getState().setChannels(guildId, channels);
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
    hasSynced = true;
    if (!initialDataLoaded) await loadInitialData();
    return;
  }

  if (status === "error" && !hasSynced && isAuthError(error)) {
    onAuthFailure();
  }
}

/** Liga o sync loop aos stores; chamar uma única vez por sessão ativa. */
export function startSyncWiring(onAuthFailure: () => void): void {
  if (started) return;
  started = true;

  matrixService.startSync(
    (event: NormalizedEvent) => useSyncStore.getState().applyEvent(event),
    (status: SyncStatus, error?: SyncErrorInfo) => {
      void handleStatus(status, error, onAuthFailure);
    },
  );

  // Canais da guilda recém-selecionada carregam sob demanda.
  unsubscribeUi = useUiStore.subscribe((state, prev) => {
    if (state.activeGuildId && state.activeGuildId !== prev.activeGuildId) {
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
  hasSynced = false;
  initialDataLoaded = false;
  loadedGuilds.clear();

  useSyncStore.getState().reset();
  const ui = useUiStore.getState();
  ui.setMyUserId(null);
  ui.setActiveGuild(null);
  ui.setActiveChannel(null);
}

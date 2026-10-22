import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stopSyncWiring } from "@/lib/matrix/wiring";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import App from "@/App";
import type { ChannelSummary, GuildSummary, SyncStatus } from "@/lib/matrix/types";

const { fakeService, loadSession } = vi.hoisted(() => ({
  fakeService: {
    restoreSession: vi.fn(),
    startSync: vi.fn(),
    stopSync: vi.fn(),
    listGuilds: vi.fn(async () => [] as GuildSummary[]),
    listChannels: vi.fn(async () => [] as ChannelSummary[]),
  },
  loadSession: vi.fn(),
}));

vi.mock("@/lib/matrix/instance", () => ({ matrixService: fakeService }));
vi.mock("@/lib/storage/keyring", () => ({
  loadSession,
  saveSession: vi.fn(async () => {}),
  clearSession: vi.fn(async () => {}),
}));

const SESSION = {
  baseUrl: "https://hs.example",
  accessToken: "fake-at",
  userId: "@eu:hs.example",
  deviceId: null,
};

/** Dispara o status capturado pelo wiring (última chamada do startSync fake). */
function emitStatus(status: SyncStatus, error?: { errcode: string }) {
  const calls = fakeService.startSync.mock.calls;
  const onStatus = calls[calls.length - 1][1] as (
    s: SyncStatus,
    e?: { errcode: string },
  ) => void;
  onStatus(status, error);
}

describe("App", () => {
  beforeEach(() => {
    stopSyncWiring();
    useSyncStore.getState().reset();
    useUiStore.setState({ myUserId: null, activeGuildId: null, activeChannelId: null });
    loadSession.mockResolvedValue(null);
  });

  it("sem sessão salva, mostra a tela de login com o Eco", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    expect(screen.getByText("Eco")).toBeTruthy();
  });

  it("com sessão + guildas → shell com rail, sidebar, canal selecionado e composer", async () => {
    loadSession.mockResolvedValue(SESSION);
    fakeService.listGuilds.mockResolvedValue([
      { guildId: "!space:hs", name: "Eco Dev", avatarUrl: null, unreadCount: 0 },
    ]);
    fakeService.listChannels.mockResolvedValue([
      { channelId: "!chan:hs", name: "geral", unreadCount: 0 },
    ]);

    render(<App />);
    expect(await screen.findByLabelText("Comunidades")).toBeTruthy();

    // Wiring Task 11 Step 2: primeiro "syncing" dispara o carregamento inicial.
    emitStatus("syncing");

    expect(await screen.findByRole("button", { name: "Eco Dev" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "geral" })).toBeTruthy();
    expect(screen.getByLabelText("Mensagem")).toBeTruthy();

    // Auto-seleção do primeiro guild/canal.
    expect(useUiStore.getState().activeGuildId).toBe("!space:hs");
    expect(useUiStore.getState().activeChannelId).toBe("!chan:hs");

    // Eventos da timeline caem no store via onEvent → applyEvent.
    const syncCalls = fakeService.startSync.mock.calls;
    const onEvent = syncCalls[syncCalls.length - 1][0] as (e: unknown) => void;
    onEvent({
      eventId: "$evt1",
      roomId: "!chan:hs",
      sender: "@lucas:hs.example",
      body: "olá pelo sync",
      originServerTs: 1_700_000_000_000,
    });
    expect(useSyncStore.getState().timelineByChannel["!chan:hs"][0].body).toBe(
      "olá pelo sync",
    );

    // Indicador de status: "syncing" → Online.
    await waitFor(() => {
      expect(screen.getByText("Online")).toBeTruthy();
    });
  });

  it("erro de rede antes do primeiro sync mantém a sessão e mostra Reconectando…", async () => {
    loadSession.mockResolvedValue(SESSION);

    render(<App />);
    await screen.findByLabelText("Comunidades");

    emitStatus("error", { errcode: "network" });

    await waitFor(() => {
      expect(screen.getByText("Reconectando…")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /Entrar com Google/ })).toBeNull();

    const { clearSession } = await import("@/lib/storage/keyring");
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("erro de autenticação (M_UNKNOWN_TOKEN) antes do primeiro sync limpa a sessão", async () => {
    loadSession.mockResolvedValue(SESSION);

    render(<App />);
    await screen.findByLabelText("Comunidades");

    emitStatus("error", { errcode: "M_UNKNOWN_TOKEN" });

    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    const { clearSession } = await import("@/lib/storage/keyring");
    expect(clearSession).toHaveBeenCalled();
  });

  it("indicador mostra Conectando… enquanto o sync não prepara", async () => {
    loadSession.mockResolvedValue(SESSION);

    render(<App />);
    await screen.findByLabelText("Comunidades");

    expect(screen.getByText("Conectando…")).toBeTruthy();
  });
});

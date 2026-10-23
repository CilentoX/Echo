import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage/keyring", () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    restoreSession: vi.fn(),
    startSyncHandlers: vi.fn(),
    stopSync: vi.fn(),
    listGuilds: vi.fn(async () => []),
    listChannels: vi.fn(async () => []),
  },
}));
vi.mock("@/lib/matrix/sso", () => ({
  runSsoLogin: vi.fn(),
  ECHO_HOMESERVER_URL: "https://echo.litteris.online",
}));

import { matrixService } from "@/lib/matrix/instance";
import { runSsoLogin } from "@/lib/matrix/sso";
import type { Session, SyncStatus } from "@/lib/matrix/types";
import { stopSyncWiring } from "@/lib/matrix/wiring";
import { clearSession, loadSession, saveSession } from "@/lib/storage/keyring";
import { useUiStore } from "@/stores/uiStore";
import SessionGate from "./SessionGate";

const mockedLoadSession = vi.mocked(loadSession);
const mockedSaveSession = vi.mocked(saveSession);
const mockedClearSession = vi.mocked(clearSession);
const mockedRunSsoLogin = vi.mocked(runSsoLogin);
const mockedRestore = vi.mocked(matrixService.restoreSession);
const mockedStartSyncHandlers = vi.mocked(matrixService.startSyncHandlers);
const mockedStopSync = vi.mocked(matrixService.stopSync);

const SESSION: Session = {
  baseUrl: "https://echo.litteris.online",
  accessToken: "syt-at-1",
  userId: "@nina:echo.litteris.online",
  deviceId: null,
};

/** Captura o callback de status passado ao startSyncHandlers (com dados de erro opcionais). */
function captureStatusCallback(): (status: SyncStatus, error?: { errcode: string }) => void {
  let onStatus: ((status: SyncStatus, error?: { errcode: string }) => void) | undefined;
  mockedStartSyncHandlers.mockImplementation((handlers) => {
    onStatus = handlers.onStatus;
  });
  return (status, error) => onStatus?.(status, error);
}

beforeEach(() => {
  // resetAllMocks: descarta também implementações de testes anteriores
  // (ex.: restoreSession que lança), evitando vazamento entre testes.
  vi.resetAllMocks();
  mockedLoadSession.mockResolvedValue(null);
  mockedSaveSession.mockResolvedValue(undefined);
  mockedClearSession.mockResolvedValue(undefined);
  mockedStopSync.mockReturnValue(undefined);
  // Desliga o wiring da sessão anterior (flags internas + stores).
  stopSyncWiring();
  // As asserções sobre stopSync valem para o corpo do teste, não para o reset acima.
  mockedStopSync.mockClear();
  useUiStore.setState({ myUserId: null, activeGuildId: null, activeChannelId: null });
});

describe("SessionGate", () => {
  it("sem sessão salva → tela de login, sem tocar no MatrixService", async () => {
    mockedLoadSession.mockResolvedValueOnce(null);

    render(<SessionGate />);

    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    expect(mockedRestore).not.toHaveBeenCalled();
    expect(mockedStartSyncHandlers).not.toHaveBeenCalled();
  });

  it("sessão salva válida → restoreSession + startSync e renderiza o AppShell", async () => {
    mockedLoadSession.mockResolvedValueOnce(SESSION);

    render(<SessionGate />);

    await waitFor(() => {
      expect(document.querySelector('[data-column="rail"]')).toBeTruthy();
    });
    expect(mockedRestore).toHaveBeenCalledWith(SESSION);
    expect(mockedStartSyncHandlers).toHaveBeenCalledTimes(1);
    expect(mockedRunSsoLogin).not.toHaveBeenCalled();
    // Sessão registrada no uiStore (sender das mensagens otimistas).
    expect(useUiStore.getState().myUserId).toBe(SESSION.userId);
  });

  it("sessão rejeitada pelo Synapse (erro no restore) → login com clearSession", async () => {
    mockedLoadSession.mockResolvedValueOnce(SESSION);
    mockedRestore.mockImplementation(() => {
      throw new Error("invalid token");
    });

    render(<SessionGate />);

    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    await waitFor(() => expect(mockedClearSession).toHaveBeenCalledTimes(1));
    expect(mockedStartSyncHandlers).not.toHaveBeenCalled();
  });

  it("erro de rede no sync antes do primeiro syncing → mantém a sessão (sem logout)", async () => {
    mockedLoadSession.mockResolvedValueOnce(SESSION);
    const emitStatus = captureStatusCallback();

    render(<SessionGate />);
    await waitFor(() => expect(mockedStartSyncHandlers).toHaveBeenCalledTimes(1));

    emitStatus("error", { errcode: "network" });

    // Sessão válida preservada; o indicador mostra Reconectando… e o SDK
    // reconecta sozinho.
    expect(await screen.findByText("Reconectando…")).toBeTruthy();
    expect(mockedClearSession).not.toHaveBeenCalled();
    expect(mockedStopSync).not.toHaveBeenCalled();
  });

  it("M_UNKNOWN_TOKEN antes do primeiro syncing → login com clearSession", async () => {
    mockedLoadSession.mockResolvedValueOnce(SESSION);
    const emitStatus = captureStatusCallback();

    render(<SessionGate />);
    await waitFor(() => expect(mockedStartSyncHandlers).toHaveBeenCalledTimes(1));

    emitStatus("error", { errcode: "M_UNKNOWN_TOKEN" });

    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    await waitFor(() => expect(mockedClearSession).toHaveBeenCalledTimes(1));
    expect(mockedStopSync).toHaveBeenCalled();
  });

  it("'connecting' antes do primeiro sync não desloga a sessão válida", async () => {
    mockedLoadSession.mockResolvedValueOnce(SESSION);
    const emitStatus = captureStatusCallback();

    render(<SessionGate />);

    await waitFor(() => expect(mockedStartSyncHandlers).toHaveBeenCalledTimes(1));
    emitStatus("connecting");
    expect(document.querySelector('[data-column="rail"]')).toBeTruthy();
    expect(mockedClearSession).not.toHaveBeenCalled();
  });

  it("login bem-sucedido → saveSession + AppShell, sem restaurar a sessão de novo", async () => {
    mockedRunSsoLogin.mockResolvedValueOnce(SESSION);

    render(<SessionGate />);
    await userEvent.click(await screen.findByRole("button", { name: /Entrar com Google/ }));

    await waitFor(() => expect(mockedSaveSession).toHaveBeenCalledWith(SESSION));
    await waitFor(() => {
      expect(document.querySelector('[data-column="rail"]')).toBeTruthy();
    });
    // loginWithSsoToken já deixou o client ativo — enterShell NÃO cria um
    // segundo client com restoreSession (twin do duplo startSync).
    expect(mockedRestore).not.toHaveBeenCalled();
    expect(mockedStartSyncHandlers).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().myUserId).toBe(SESSION.userId);
  });

  it("falha ao salvar a sessão após o login → volta ao login com clearSession", async () => {
    mockedRunSsoLogin.mockResolvedValueOnce(SESSION);
    mockedSaveSession.mockRejectedValueOnce(new Error("keyring indisponível"));

    render(<SessionGate />);
    await userEvent.click(await screen.findByRole("button", { name: /Entrar com Google/ }));

    await waitFor(() => expect(mockedClearSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    expect(document.querySelector('[data-column="rail"]')).toBeNull();
  });
});

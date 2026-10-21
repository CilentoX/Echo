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
    startSync: vi.fn(),
    stopSync: vi.fn(),
  },
}));
vi.mock("@/lib/matrix/sso", () => ({
  runSsoLogin: vi.fn(),
  ECO_HOMESERVER_URL: "https://eco.litteris.online",
}));

import { matrixService } from "@/lib/matrix/instance";
import { runSsoLogin } from "@/lib/matrix/sso";
import type { Session, SyncStatus } from "@/lib/matrix/types";
import { clearSession, loadSession, saveSession } from "@/lib/storage/keyring";
import SessionGate from "./SessionGate";

const mockedLoadSession = vi.mocked(loadSession);
const mockedSaveSession = vi.mocked(saveSession);
const mockedClearSession = vi.mocked(clearSession);
const mockedRunSsoLogin = vi.mocked(runSsoLogin);
const mockedRestore = vi.mocked(matrixService.restoreSession);
const mockedStartSync = vi.mocked(matrixService.startSync);
const mockedStopSync = vi.mocked(matrixService.stopSync);

const SESSION: Session = {
  baseUrl: "https://eco.litteris.online",
  accessToken: "syt-at-1",
  userId: "@nina:eco.litteris.online",
  deviceId: null,
};

/** Captura o callback de status passado ao startSync. */
function captureStatusCallback(): (status: SyncStatus) => void {
  let onStatus: ((status: SyncStatus) => void) | undefined;
  mockedStartSync.mockImplementation((_onEvent, callback) => {
    onStatus = callback;
  });
  return (status) => onStatus?.(status);
}

beforeEach(() => {
  // resetAllMocks: descarta também implementações de testes anteriores
  // (ex.: restoreSession que lança), evitando vazamento entre testes.
  vi.resetAllMocks();
  mockedLoadSession.mockResolvedValue(null);
  mockedSaveSession.mockResolvedValue(undefined);
  mockedClearSession.mockResolvedValue(undefined);
  mockedStopSync.mockReturnValue(undefined);
});

describe("SessionGate", () => {
  it("sem sessão salva → tela de login, sem tocar no MatrixService", async () => {
    mockedLoadSession.mockResolvedValueOnce(null);

    render(<SessionGate />);

    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    expect(mockedRestore).not.toHaveBeenCalled();
    expect(mockedStartSync).not.toHaveBeenCalled();
  });

  it("sessão salva válida → restoreSession + startSync e renderiza o AppShell", async () => {
    mockedLoadSession.mockResolvedValueOnce(SESSION);

    render(<SessionGate />);

    await waitFor(() => {
      expect(document.querySelector('[data-column="rail"]')).toBeTruthy();
    });
    expect(mockedRestore).toHaveBeenCalledWith(SESSION);
    expect(mockedStartSync).toHaveBeenCalledTimes(1);
    expect(mockedRunSsoLogin).not.toHaveBeenCalled();
  });

  it("sessão rejeitada pelo Synapse (erro no restore) → login com clearSession", async () => {
    mockedLoadSession.mockResolvedValueOnce(SESSION);
    mockedRestore.mockImplementation(() => {
      throw new Error("invalid token");
    });

    render(<SessionGate />);

    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    await waitFor(() => expect(mockedClearSession).toHaveBeenCalledTimes(1));
    expect(mockedStartSync).not.toHaveBeenCalled();
  });

  it("sync inicial rejeitado (status error antes do primeiro syncing) → login com clearSession", async () => {
    mockedLoadSession.mockResolvedValueOnce(SESSION);
    mockedStartSync.mockImplementation((_onEvent, onStatus) => {
      onStatus("connecting");
      onStatus("error");
    });

    render(<SessionGate />);

    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    await waitFor(() => expect(mockedClearSession).toHaveBeenCalledTimes(1));
    expect(mockedStopSync).toHaveBeenCalled();
  });

  it("'connecting' antes do primeiro sync não desloga a sessão válida", async () => {
    mockedLoadSession.mockResolvedValueOnce(SESSION);
    const emitStatus = captureStatusCallback();

    render(<SessionGate />);

    await waitFor(() => expect(mockedStartSync).toHaveBeenCalledTimes(1));
    emitStatus("connecting");
    expect(document.querySelector('[data-column="rail"]')).toBeTruthy();
    expect(mockedClearSession).not.toHaveBeenCalled();
  });

  it("login bem-sucedido → saveSession + AppShell", async () => {
    mockedRunSsoLogin.mockResolvedValueOnce(SESSION);

    render(<SessionGate />);
    await userEvent.click(await screen.findByRole("button", { name: /Entrar com Google/ }));

    await waitFor(() => expect(mockedSaveSession).toHaveBeenCalledWith(SESSION));
    await waitFor(() => {
      expect(document.querySelector('[data-column="rail"]')).toBeTruthy();
    });
    expect(mockedRestore).toHaveBeenCalledWith(SESSION);
    expect(mockedStartSync).toHaveBeenCalledTimes(1);
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

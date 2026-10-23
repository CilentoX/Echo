import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { useUpdateStore } from "@/stores/updateStore";
import { restartApp, runStartupUpdateCheck } from "@/lib/updater";

vi.mock("@/lib/storage/keyring", () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(async () => {}),
  clearSession: vi.fn(async () => {}),
}));
vi.mock("@/lib/matrix/wiring", () => ({
  startSyncWiring: vi.fn(),
  stopSyncWiring: vi.fn(),
}));
vi.mock("@/lib/matrix/instance", () => ({
  matrixService: { restoreSession: vi.fn() },
}));
vi.mock("@/lib/updater", () => ({
  runStartupUpdateCheck: vi.fn(async () => {}),
  restartApp: vi.fn(async () => {}),
  downloadAndInstall: vi.fn(async () => false),
}));
vi.mock("@/features/auth/logout", () => ({
  registerLogoutHandler: vi.fn(),
}));
vi.mock("@/features/auth/GoogleLoginScreen", () => ({
  default: () => <div>login-mock</div>,
}));

import SessionGate from "@/features/auth/SessionGate";
import { loadSession } from "@/lib/storage/keyring";

const SESSION = {
  userId: "@ preload:echo.litteris.online",
  accessToken: "tok",
  deviceId: "DEV",
  refreshToken: undefined,
  baseUrl: "https://echo.litteris.online",
} as const;

describe("SessionGate — pre-loading com updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks não remove implementações de testes anteriores.
    vi.mocked(runStartupUpdateCheck).mockImplementation(async () => {});
    vi.mocked(restartApp).mockImplementation(async () => {});
    useUpdateStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useUpdateStore.getState().reset();
  });

  it("boot com sessão aguarda o update check concluir antes de abrir o shell", async () => {
    vi.mocked(loadSession).mockResolvedValue({ ...SESSION });
    let resolveUpdate: () => void = () => {};
    vi.mocked(runStartupUpdateCheck).mockImplementation(
      () => new Promise<void>((res) => { resolveUpdate = res; }),
    );

    render(<SessionGate shell={<div>shell-mock</div>} />);

    // O update check foi iniciado...
    await waitFor(() => expect(runStartupUpdateCheck).toHaveBeenCalled());
    // ...mas o shell NÃO abriu enquanto o update não terminou.
    expect(screen.queryByText("shell-mock")).toBeNull();

    resolveUpdate();
    expect(await screen.findByText("shell-mock")).toBeTruthy();
  });

  it("update instalado no pre-loading reinicia o app sem abrir o shell", async () => {
    vi.mocked(loadSession).mockResolvedValue({ ...SESSION });
    vi.mocked(runStartupUpdateCheck).mockImplementation(async () => {
      useUpdateStore.getState().markReady();
    });

    render(<SessionGate shell={<div>shell-mock</div>} />);

    await waitFor(() => expect(restartApp).toHaveBeenCalled());
    expect(screen.queryByText("shell-mock")).toBeNull();
  });

  it("splash mostra o estado do update enquanto baixa", async () => {
    vi.mocked(loadSession).mockImplementation(() => new Promise(() => {}));
    useUpdateStore.getState().beginDownload("9.9.9");

    render(<SessionGate shell={<div>shell-mock</div>} />);

    expect(await screen.findByText("Baixando atualização 9.9.9…")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

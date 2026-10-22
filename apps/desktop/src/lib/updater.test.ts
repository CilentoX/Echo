import { afterEach, describe, expect, it, vi } from "vitest";

const { checkMock } = vi.hoisted(() => ({ checkMock: vi.fn() }));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: checkMock,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(async () => {}),
}));

import { downloadAndInstall, restartApp, runStartupUpdateCheck } from "./updater";
import { useUpdateStore } from "@/stores/updateStore";

type InternalsWindow = { __TAURI_INTERNALS__?: unknown };

function setTauri(value: boolean) {
  if (value) (window as InternalsWindow).__TAURI_INTERNALS__ = {};
  else delete (window as InternalsWindow).__TAURI_INTERNALS__;
}

afterEach(() => {
  vi.clearAllMocks();
  setTauri(false);
});

describe("downloadAndInstall", () => {
  it("update disponível → baixa e instala, devolve true", async () => {
    const update = { downloadAndInstall: vi.fn(async () => {}) };
    checkMock.mockResolvedValue(update);

    await expect(downloadAndInstall()).resolves.toBe(true);
    expect(update.downloadAndInstall).toHaveBeenCalledTimes(1);
  });

  it("sem update (check → null) → false, sem instalar", async () => {
    checkMock.mockResolvedValue(null);

    await expect(downloadAndInstall()).resolves.toBe(false);
  });

  it("falha do plugin → false, sem lançar", async () => {
    checkMock.mockRejectedValue(new Error("endpoint fora do ar"));

    await expect(downloadAndInstall()).resolves.toBe(false);
  });
});

describe("runStartupUpdateCheck", () => {
  it("fora do runtime Tauri nem consulta o plugin (sem rede em testes/web)", async () => {
    setTauri(false);

    await runStartupUpdateCheck();

    expect(checkMock).not.toHaveBeenCalled();
  });

  it("no Tauri, delega ao caminho único do plugin (sem fetch manual duplo)", async () => {
    setTauri(true);
    checkMock.mockResolvedValue(null);

    await runStartupUpdateCheck();

    expect(checkMock).toHaveBeenCalledTimes(1);
  });

  it("update disponível → store anuncia downloading e depois ready com a versão", async () => {
    setTauri(true);
    const update = { version: "0.1.2", downloadAndInstall: vi.fn(async () => {}) };
    checkMock.mockResolvedValue(update);

    await runStartupUpdateCheck();

    const state = useUpdateStore.getState();
    expect(state.status).toBe("ready");
    expect(state.version).toBe("0.1.2");
    useUpdateStore.getState().reset();
  });

  it("falha jamais quebra o boot", async () => {
    setTauri(true);
    checkMock.mockRejectedValue(new Error("boom"));

    await expect(runStartupUpdateCheck()).resolves.toBeUndefined();
    expect(useUpdateStore.getState().status).toBe("idle");
  });

  it("restartApp não lança fora do runtime Tauri", async () => {
    setTauri(false);

    await expect(restartApp()).resolves.toBeUndefined();
  });
});

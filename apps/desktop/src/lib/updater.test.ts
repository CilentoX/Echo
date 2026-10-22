import { afterEach, describe, expect, it, vi } from "vitest";

const { checkMock } = vi.hoisted(() => ({ checkMock: vi.fn() }));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: checkMock,
}));

import { downloadAndInstall, runStartupUpdateCheck } from "./updater";

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

  it("falha jamais quebra o boot", async () => {
    setTauri(true);
    checkMock.mockRejectedValue(new Error("boom"));

    await expect(runStartupUpdateCheck()).resolves.toBeUndefined();
  });
});

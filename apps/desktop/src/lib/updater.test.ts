import { afterEach, describe, expect, it, vi } from "vitest";

import {
  UPDATER_ENDPOINT,
  checkForUpdate,
  fetchLatest,
  isNewerVersion,
} from "./updater";

/** Fetch fake que responde com o manifest informado (ou erro). */
function mockFetchJson(payload: unknown, ok = true, status = ok ? 200 : 500) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isNewerVersion", () => {
  it("versão candidata mais nova que a atual → true", () => {
    expect(isNewerVersion("0.2.0", "0.1.0")).toBe(true);
  });

  it("mesma versão → false", () => {
    expect(isNewerVersion("0.1.0", "0.1.0")).toBe(false);
  });

  it("versão candidata mais antiga (downgrade) → false", () => {
    expect(isNewerVersion("0.0.9", "0.1.0")).toBe(false);
  });

  it("compara componente a componente (major > minor > patch)", () => {
    expect(isNewerVersion("1.0.0", "0.9.9")).toBe(true);
    expect(isNewerVersion("0.2.0", "0.1.9")).toBe(true);
    expect(isNewerVersion("0.1.1", "0.1.0")).toBe(true);
    expect(isNewerVersion("0.1.0", "0.1.1")).toBe(false);
  });

  it("partes ausentes contam como 0", () => {
    expect(isNewerVersion("0.2", "0.1.9")).toBe(true);
    expect(isNewerVersion("0.1", "0.1.0")).toBe(false);
  });

  it("ignora prefixo 'v' e espaços", () => {
    expect(isNewerVersion(" v0.2.0 ", "0.1.0")).toBe(true);
  });
});

describe("fetchLatest", () => {
  it("GET no endpoint de latest.json com fetch injetado", async () => {
    const fetchImpl = mockFetchJson({ version: "0.2.0" });
    const manifest = await fetchLatest(fetchImpl);
    expect(manifest).toEqual({ version: "0.2.0" });
  });

  it("HTTP error → null, sem lançar", async () => {
    const fetchImpl = mockFetchJson({}, false, 503);
    await expect(fetchLatest(fetchImpl)).resolves.toBeNull();
  });

  it("manifest sem version → null", async () => {
    const fetchImpl = mockFetchJson({ notes: "sem versão" });
    await expect(fetchLatest(fetchImpl)).resolves.toBeNull();
  });

  it("aponta para o endpoint publicado da rede Eco", () => {
    expect(UPDATER_ENDPOINT).toBe("https://ecoapp.litteris.online/latest.json");
  });
});

describe("checkForUpdate", () => {
  it("remota mais nova que a atual → update disponível", async () => {
    const fetchImpl = mockFetchJson({ version: "0.2.0" });
    const result = await checkForUpdate({
      currentVersion: "0.1.0",
      fetchImpl,
    });
    expect(result).toEqual({
      updateAvailable: true,
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
    });
  });

  it("mesma versão → sem update", async () => {
    const fetchImpl = mockFetchJson({ version: "0.1.0" });
    const result = await checkForUpdate({
      currentVersion: "0.1.0",
      fetchImpl,
    });
    expect(result).toEqual({
      updateAvailable: false,
      currentVersion: "0.1.0",
      latestVersion: "0.1.0",
    });
  });

  it("remota mais antiga (downgrade) → sem update", async () => {
    const fetchImpl = mockFetchJson({ version: "0.0.9" });
    const result = await checkForUpdate({
      currentVersion: "0.1.0",
      fetchImpl,
    });
    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBe("0.0.9");
  });

  it("falha de rede → sem update e sem lançar", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const result = await checkForUpdate({
      currentVersion: "0.1.0",
      fetchImpl,
    });
    expect(result).toEqual({
      updateAvailable: false,
      currentVersion: "0.1.0",
      latestVersion: null,
    });
  });

  it("endpoint fora do ar (500) → sem update e sem lançar", async () => {
    const fetchImpl = mockFetchJson({}, false, 500);
    const result = await checkForUpdate({
      currentVersion: "0.1.0",
      fetchImpl,
    });
    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBeNull();
  });
});

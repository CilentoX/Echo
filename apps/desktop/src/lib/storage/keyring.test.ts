import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
// sso.ts (fonte do ECHO_HOMESERVER_URL) importa o plugin-opener em módulo.
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { ECHO_HOMESERVER_URL } from "@/lib/matrix/sso";
import type { Session } from "@/lib/matrix/types";
import { clearSession, loadSession, saveSession } from "./keyring";

const mockedInvoke = vi.mocked(invoke);

const SESSION: Session = {
  baseUrl: ECHO_HOMESERVER_URL,
  accessToken: "syt-at-1",
  userId: "@nina:echo.litteris.online",
  deviceId: "DEV123",
};

beforeEach(() => {
  mockedInvoke.mockReset();
});

describe("keyring storage", () => {
  it("saveSession guarda userId e accessToken via store_token", async () => {
    mockedInvoke.mockResolvedValueOnce(null);

    await saveSession(SESSION);

    expect(mockedInvoke).toHaveBeenCalledWith("store_token", {
      userId: SESSION.userId,
      token: SESSION.accessToken,
    });
  });

  it("loadSession reconstrói a Session com o homeserver fixo da rede Eco", async () => {
    mockedInvoke.mockResolvedValueOnce({
      userId: SESSION.userId,
      token: SESSION.accessToken,
    });

    const session = await loadSession();

    expect(mockedInvoke).toHaveBeenCalledWith("load_token");
    expect(session).toEqual({
      baseUrl: ECHO_HOMESERVER_URL,
      accessToken: SESSION.accessToken,
      userId: SESSION.userId,
      deviceId: null,
    });
  });

  it("loadSession devolve null quando não há sessão salva", async () => {
    mockedInvoke.mockResolvedValueOnce(null);

    expect(await loadSession()).toBeNull();
  });

  it("clearSession remove o token via clear_token", async () => {
    mockedInvoke.mockResolvedValueOnce(null);

    await clearSession();

    expect(mockedInvoke).toHaveBeenCalledWith("clear_token");
  });

  it("nenhuma operação registra o access token no console", async () => {
    const spies = ["log", "info", "warn", "error", "debug"].map((method) =>
      vi.spyOn(console, method as "log").mockImplementation(() => {}),
    );
    mockedInvoke.mockResolvedValue({ userId: SESSION.userId, token: SESSION.accessToken });

    await saveSession(SESSION);
    await loadSession();
    await clearSession();

    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(SESSION.accessToken);
      }
      spy.mockRestore();
    }
  });
});

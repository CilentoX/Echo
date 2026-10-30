import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { MatrixService } from "./service";
import { ECHO_HOMESERVER_URL, runSsoLogin, SsoLoginError } from "./sso";
import type { Session } from "./types";

const mockedInvoke = vi.mocked(invoke);
const mockedOpenUrl = vi.mocked(openUrl);

const SESSION: Session = {
  baseUrl: "https://echo.litteris.online",
  accessToken: "syt-at-1",
  userId: "@nina:echo.litteris.online",
  deviceId: "DEV123",
};

/** Service double: só os métodos que o runSsoLogin consome. */
function makeService(): MatrixService {
  return {
    getSsoLoginUrl: vi.fn(
      (redirectUrl: string, idpId?: string) =>
        `https://hs.example/_matrix/client/v3/login/sso/redirect/${idpId ?? ""}?redirectUrl=${encodeURIComponent(redirectUrl)}`,
    ),
    loginWithSsoToken: vi.fn(async () => SESSION),
  } as unknown as MatrixService;
}

beforeEach(() => {
  mockedInvoke.mockReset();
  mockedOpenUrl.mockReset();
});

describe("runSsoLogin", () => {
  it("fluxo completo: listener → URL SSO → browser → token → loginWithSsoToken", async () => {
    mockedInvoke
      .mockResolvedValueOnce(49152) // begin_sso_listener -> porta
      .mockResolvedValueOnce("LT-1"); // finish_sso_listener -> loginToken
    const service = makeService();

    const session = await runSsoLogin(service);

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "begin_sso_listener");
    expect(service.getSsoLoginUrl).toHaveBeenCalledWith(
      "http://127.0.0.1:49152/callback",
      "oidc-google",
    );
    expect(mockedOpenUrl).toHaveBeenCalledWith(
      "https://hs.example/_matrix/client/v3/login/sso/redirect/oidc-google?redirectUrl=http%3A%2F%2F127.0.0.1%3A49152%2Fcallback",
    );
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "finish_sso_listener", { port: 49152 });
    expect(service.loginWithSsoToken).toHaveBeenCalledWith("LT-1");
    expect(session).toEqual(SESSION);
  });

  it("rejeição do finish_sso_listener (timeout) → SsoLoginError tipado, sem tentar login", async () => {
    mockedInvoke
      .mockResolvedValueOnce(49153)
      .mockRejectedValueOnce(new Error("tempo esgotado aguardando o login SSO"));
    const service = makeService();

    const err = await runSsoLogin(service).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SsoLoginError);
    expect((err as SsoLoginError).code).toBe("listener");
    expect((err as SsoLoginError).message).toContain("tempo esgotado");
    expect(service.loginWithSsoToken).not.toHaveBeenCalled();
  });

  it("falha no loginWithSsoToken → SsoLoginError com code 'login'", async () => {
    mockedInvoke.mockResolvedValueOnce(49154).mockResolvedValueOnce("LT-2");
    const service = makeService();
    (service.loginWithSsoToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("matrix login failed"),
    );

    const err = await runSsoLogin(service).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SsoLoginError);
    expect((err as SsoLoginError).code).toBe("login");
  });

  it("expõe o homeserver da rede Eco como constante única", () => {
    expect(ECHO_HOMESERVER_URL).toBe("https://echo.litteris.online");
  });
});

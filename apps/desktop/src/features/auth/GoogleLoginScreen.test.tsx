import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EchoApi } from "@/lib/api/echoApi";
import type { Session } from "@/lib/matrix/types";
import GoogleLoginScreen from "./GoogleLoginScreen";

vi.mock("@/lib/storage/keyring", () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock("@/lib/matrix/sso", () => ({
  runSsoLogin: vi.fn(),
  SsoLoginError: class SsoLoginError extends Error {
    readonly code: "listener" | "login";
    readonly cause?: unknown;
    constructor(message: string, code: "listener" | "login", cause?: unknown) {
      super(message);
      this.name = "SsoLoginError";
      this.code = code;
      this.cause = cause;
    }
  },
}));

const SESSION: Session = {
  baseUrl: "https://echo.litteris.online",
  apiBaseUrl: "https://echo.litteris.online",
  accessToken: "syt-at-1",
  refreshToken: "rt-1",
  userId: "@nina:echo.litteris.online",
  deviceId: "DEV123",
  expiresAt: Date.now() + 3600 * 1000,
};

function makeEchoApi(): EchoApi {
  return {
    baseUrl: "https://echo.litteris.online",
    accessToken: "",
    apiKey: undefined,
    request: async (_init: RequestInit) => new Response(null, { status: 200 }),
  } as unknown as EchoApi;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GoogleLoginScreen", () => {
  it("renderiza a logo Echo e o botão 'Entrar com Google'", () => {
    render(<GoogleLoginScreen service={makeEchoApi()} />);

    expect(screen.getByRole("heading", { name: "Echo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
  });

  it("clicar no botão dispara runSsoLogin e chama onSession", async () => {
    const { runSsoLogin } = await import("@/lib/matrix/sso");
    (runSsoLogin as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SESSION);
    const onSession = vi.fn();
    render(<GoogleLoginScreen service={makeEchoApi()} onSession={onSession} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    await waitFor(() => expect(onSession).toHaveBeenCalledWith(SESSION));
    expect(screen.getByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
  });

  it("enquanto carrega, mostra estado de loading com spinner", async () => {
    const { runSsoLogin } = await import("@/lib/matrix/sso");
    let resolveLogin: (session: Session) => void;
    const loginPromise = new Promise<Session>((resolve) => {
      resolveLogin = resolve;
    });
    (runSsoLogin as ReturnType<typeof vi.fn>).mockReturnValueOnce(loginPromise);

    render(<GoogleLoginScreen service={makeEchoApi()} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    // Novo design: mostra texto de loading em vez de botão desabilitado
    expect(await screen.findByText(/Autenticando com Google/i)).toBeTruthy();

    resolveLogin!(SESSION);
    await waitFor(() => expect(screen.getByRole("button", { name: /Entrar com Google/ })).toBeTruthy());
  });

  it("sucesso → chama onSession com a Session e volta ao estado idle", async () => {
    const { runSsoLogin } = await import("@/lib/matrix/sso");
    (runSsoLogin as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SESSION);
    const onSession = vi.fn();
    render(<GoogleLoginScreen service={makeEchoApi()} onSession={onSession} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    await waitFor(() => expect(onSession).toHaveBeenCalledWith(SESSION));
    expect(screen.getByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
  });

  it("rejeição → mensagem de erro PT-BR + 'Tentar de novo' refaz o fluxo", async () => {
    const { runSsoLogin, SsoLoginError } = await import("@/lib/matrix/sso");
    const onSession = vi.fn();
    (runSsoLogin as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new SsoLoginError("Falha no listener", "listener"));

    render(<GoogleLoginScreen service={makeEchoApi()} onSession={onSession} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    // Novo design: erro mostrado como texto, não como role="alert"
    expect(await screen.findByText(/Falha ao abrir o navegador para login/i)).toBeTruthy();

    (runSsoLogin as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SESSION);
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));

    expect(onSession).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onSession).toHaveBeenCalledWith(SESSION));
  });
});
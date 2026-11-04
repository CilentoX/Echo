import { CircleNotch, GoogleLogo } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { EchoApi } from "@/lib/api/echoApi";
import { runSsoLogin, SsoLoginError } from "@/lib/matrix/sso";
import { echoApi } from "@/lib/matrix/instance";
import type { Session } from "@/lib/matrix/types";

type Status = "idle" | "loading" | "error";

interface GoogleLoginScreenProps {
  /** Injection point for tests; defaults to a live EchoApi instance. */
  service?: EchoApi;
  /** Called with the Session right after a successful login. */
  onSession?: (session: Session) => void;
}

export default function GoogleLoginScreen({ service, onSession }: GoogleLoginScreenProps) {
  const activeService = useMemo(
    () => service ?? echoApi,
    [service],
  );

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      // Fluxo SSO real via Rust loopback listener + Echo API
      const session = await runSsoLogin(activeService);
      echoApi.setAccessToken(session.accessToken ?? "", session.userId ?? undefined);
      await onSession?.(session);
      setStatus("idle");
    } catch (err) {
      const message = err instanceof SsoLoginError
        ? (err.code === "listener" ? "Falha ao abrir o navegador para login. Tente novamente." : "Falha ao autenticar com o Google. Tente novamente.")
        : "Erro inesperado no login. Tente novamente.";
      console.error("[GoogleLoginScreen] Login failed:", err);
      setErrorMessage(message);
      setStatus("error");
    }
  }, [activeService, onSession]);

  const loading = status === "loading";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg font-ui text-txt">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" width={72} height={72} alt="" />
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight">Echo</h1>
          <p className="mt-2 text-sm text-mut">
            Entre para conversar na sua rede privada.
          </p>
        </div>
      </div>

      {status === "error" ? (
        <div className="flex flex-col items-center gap-4">
          <p role="alert" className="text-sm text-err">
            {errorMessage || "Não foi possível concluir o login com o Google. Tente novamente."}
          </p>
          <button
            type="button"
            onClick={handleLogin}
            className="cursor-pointer flex items-center gap-2 rounded-lg bg-acc px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-acc-press active:scale-95"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="cursor-pointer flex items-center gap-2 rounded-lg bg-acc px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-acc-press disabled:opacity-60 active:scale-95"
        >
          {loading ? (
            <CircleNotch size={18} weight="bold" className="animate-spin" />
          ) : (
            <GoogleLogo size={18} weight="bold" />
          )}
          {loading ? "Entrando..." : "Entrar com Google"}
        </button>
      )}
    </main>
  );
}
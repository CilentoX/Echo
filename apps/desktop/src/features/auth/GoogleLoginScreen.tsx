import { CircleNotch, GoogleLogo } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { MatrixService } from "@/lib/matrix/service";
import { ECHO_HOMESERVER_URL, runSsoLogin } from "@/lib/matrix/sso";
import type { Session } from "@/lib/matrix/types";

type Status = "idle" | "loading" | "error";

interface GoogleLoginScreenProps {
  /** Injection point for tests; defaults to a live service on the Echo homeserver. */
  service?: MatrixService;
  /** Called with the Session right after a successful login. */
  onSession?: (session: Session) => void;
}

export default function GoogleLoginScreen({ service, onSession }: GoogleLoginScreenProps) {
  const [status, setStatus] = useState<Status>("idle");
  const activeService = useMemo(
    () => service ?? new MatrixService(ECHO_HOMESERVER_URL),
    [service],
  );

  const handleLogin = useCallback(async () => {
    setStatus("loading");
    try {
      const session = await runSsoLogin(activeService);
      await onSession?.(session);
      setStatus("idle");
    } catch {
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
            Não foi possível concluir o login com o Google. Tente novamente.
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

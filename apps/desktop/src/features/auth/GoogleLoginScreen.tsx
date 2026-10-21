import { CircleNotch, GoogleLogo } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { MatrixService } from "@/lib/matrix/service";
import { ECO_HOMESERVER_URL, runSsoLogin } from "@/lib/matrix/sso";
import type { Session } from "@/lib/matrix/types";

type Status = "idle" | "loading" | "error";

interface GoogleLoginScreenProps {
  /** Injection point for tests; defaults to a live service on the Eco homeserver. */
  service?: MatrixService;
  /** Called with the Session right after a successful login. */
  onSession?: (session: Session) => void;
}

/** Eco logo: concentric waves over the dark background. */
function EcoLogo() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      aria-hidden="true"
      className="text-acc"
    >
      <circle cx="36" cy="36" r="10" stroke="currentColor" strokeWidth="3" />
      <circle cx="36" cy="36" r="20" stroke="currentColor" strokeWidth="3" strokeOpacity="0.6" />
      <circle cx="36" cy="36" r="30" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
      <circle cx="36" cy="36" r="4" fill="currentColor" />
    </svg>
  );
}

export default function GoogleLoginScreen({ service, onSession }: GoogleLoginScreenProps) {
  const [status, setStatus] = useState<Status>("idle");
  const activeService = useMemo(
    () => service ?? new MatrixService(ECO_HOMESERVER_URL),
    [service],
  );

  const handleLogin = useCallback(async () => {
    setStatus("loading");
    try {
      const session = await runSsoLogin(activeService);
      // LOG temporário do userId (validação manual — removido na Task de persistência)
      console.log(`[eco] Sessão iniciada: ${session.userId}`);
      onSession?.(session);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [activeService, onSession]);

  const loading = status === "loading";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg font-ui text-txt">
      <div className="flex flex-col items-center gap-4">
        <EcoLogo />
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight">Eco</h1>
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
            className="flex items-center gap-2 rounded-lg bg-acc px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-acc-press"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-acc px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-acc-press disabled:opacity-60"
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

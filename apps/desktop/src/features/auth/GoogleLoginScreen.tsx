import { CircleNotch, GoogleLogo, LockKey, ShieldCheck } from "@phosphor-icons/react";
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg font-ui text-txt relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-acc/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-acc/3 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full px-6">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center gap-5 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <div className="relative">
            <div className="absolute inset-0 bg-acc/20 rounded-full blur-xl" />
            <img
              src="/logo.png"
              width={88}
              height={88}
              alt="Echo"
              className="relative drop-shadow-lg"
            />
          </div>
          <div className="text-center space-y-2">
            <h1 className="font-display text-5xl font-bold tracking-tight text-txt">
              Echo
            </h1>
            <p className="text-sm text-mut leading-relaxed max-w-xs mx-auto">
              Entre para conversar na sua rede privada.
              Comunicação segura, rápida e descentralizada.
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="w-full rounded-2xl border border-white/[0.06] bg-card-bg/80 backdrop-blur-sm p-8 shadow-2xl shadow-black/30 animate-in fade-in-0 slide-in-from-bottom-6 duration-700 delay-100">
          {status === "error" ? (
            <div className="flex flex-col items-center gap-4 animate-in fade-in-0 zoom-in-95 duration-200">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-err/10 border border-err/20">
                <ShieldCheck size={24} weight="bold" className="text-err" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-err">
                  Não foi possível concluir o login
                </p>
                <p className="text-xs text-mut">
                  {errorMessage || "Tente novamente em alguns instantes."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogin}
                className="cursor-pointer mt-2 flex items-center gap-2 rounded-xl bg-acc px-6 py-3 text-sm font-semibold text-bg transition-all hover:bg-acc-press hover:shadow-lg hover:shadow-acc/20 active:scale-95"
              >
                Tentar de novo
              </button>
            </div>
          ) : loading ? (
            /* Loading Skeleton State */
            <div className="flex flex-col items-center gap-5 animate-in fade-in-0 duration-200">
              <div className="relative">
                <div className="absolute inset-0 bg-acc/30 rounded-full blur-lg animate-pulse" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-acc/10 border border-acc/20">
                  <CircleNotch size={28} weight="bold" className="animate-spin text-acc" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-txt animate-pulse">
                  Autenticando com Google...
                </p>
                <p className="text-xs text-mut">
                  O navegador foi aberto para confirmação
                </p>
              </div>
              {/* Skeleton bars */}
              <div className="w-full space-y-2 mt-2">
                <div className="h-2 w-full rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full w-2/3 bg-acc/30 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
                </div>
                <div className="h-2 w-3/4 mx-auto rounded-full bg-white/[0.03] overflow-hidden">
                  <div className="h-full w-1/2 bg-acc/20 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite_0.2s]" />
                </div>
              </div>
            </div>
          ) : (
            /* Idle State — Login Button */
            <div className="flex flex-col items-center gap-5">
              <button
                type="button"
                onClick={handleLogin}
                className="cursor-pointer group flex w-full items-center justify-center gap-3 rounded-xl bg-acc px-6 py-3.5 text-sm font-semibold text-bg transition-all hover:bg-acc-press hover:shadow-lg hover:shadow-acc/25 active:scale-[0.98]"
              >
                <GoogleLogo size={20} weight="bold" className="transition-transform group-hover:scale-110" />
                Entrar com Google
              </button>

              <div className="flex items-center gap-2 text-[11px] text-mut/60">
                <LockKey size={12} weight="bold" />
                <span>Conexão criptografada de ponta a ponta</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-[11px] text-mut/40 text-center animate-in fade-in-0 duration-1000 delay-300">
          Ao entrar, você concorda com os Termos de Serviço do Echo.
        </p>
      </div>
    </main>
  );
}
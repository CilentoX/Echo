import { CircleNotch, Download } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import GoogleLoginScreen from "@/features/auth/GoogleLoginScreen";
import OnboardingScreen from "@/features/auth/OnboardingScreen";
import { registerLogoutHandler } from "@/features/auth/logout";
import AppShell from "@/features/shell/AppShell";
import { echoApi, initEchoApiFromSession } from "@/lib/matrix/instance";
import type { Session } from "@/lib/matrix/types";
import { startSyncWiring, stopSyncWiring } from "@/lib/matrix/wiring";
import { isOnboardingCompleted, markOnboardingCompleted } from "@/lib/onboarding";
import { useUiStore } from "@/stores/uiStore";
import { clearSession, loadSession, saveSession } from "@/lib/storage/keyring";
import { restartApp, runStartupUpdateCheck } from "@/lib/updater";
import { useUpdateStore } from "@/stores/updateStore";
import { Button } from "@/components/ui/button";

type GateView = "booting" | "update-required" | "login" | "onboarding" | "shell";

export interface SessionGateProps {
  /** Conteúdo renderizado no shell autenticado; omitido, renderiza <AppShell /> vazio. */
  shell?: ReactNode;
}

/**
 * Portão de boot: decide entre splash de atualização, login, onboarding e shell.
 *
 * Fluxo:
 * 1. booting — splash forçada (estilo Discord): checa atualizações em paralelo com a sessão.
 * 2. update-required — atualização pronta; reinicia ou mostra botão "Reiniciar agora".
 * 3. login — sem sessão salva → GoogleLoginScreen.
 * 4. onboarding — primeira vez após login → define nick + foto antes do shell.
 * 5. shell — AppShell autenticado.
 *
 * O login agora usa o Echo API client ao invés de chamar o Matrix SDK diretamente.
 * O fluxo SSO é iniciado via Echo API /auth/exchange-login-token, que por sua vez
 * usa o fluxo Rust de loopback local (mesmo mecanismo do Matrix SSO, mas orquestrado
 * pelo backend Echo API).
 */
export default function SessionGate({ shell }: SessionGateProps) {
  const [view, setView] = useState<GateView>("booting");
  const updateStatus = useUpdateStore((s) => s.status);
  const updateVersion = useUpdateStore((s) => s.version);

  const rejectSession = useCallback(async () => {
    stopSyncWiring();
    await clearSession().catch(() => { });
    setView("login");
  }, []);

  // O botão "Sair da conta" (Settings) executa este handler via logout.ts.
  useEffect(() => {
    registerLogoutHandler(() => rejectSession());
    return () => registerLogoutHandler(null);
  }, [rejectSession]);

  const enterShell = useCallback(
    (session: Session, clientActive = false) => {
      if (!clientActive) initEchoApiFromSession();
      const ui = useUiStore.getState();
      const userId = session.userId ?? "";
      ui.setMyUserId(userId);
      ui.setPresence(userId, "online");
      // Fire-and-forget: startSyncWiring is async but we don't need to wait for it
      void startSyncWiring();
      setView("shell");
    },
    [rejectSession],
  );

  /** Prepara client + uiStore para telas pré-shell (onboarding), sem ligar o sync. */
  const prepareSession = useCallback((session: Session, clientActive = false) => {
    if (!clientActive) initEchoApiFromSession();
    useUiStore.getState().setMyUserId(session.userId ?? "");
  }, []);

  const handleSession = useCallback(
    async (session: Session): Promise<void> => {
      try {
        await saveSession(session);
        // loginWithSsoToken já deixou o client credentialled ativo.
        // Onboarding: mostra se ainda não foi concluído (mesmo que Google SSO
        // tenha pré-preenchido o displayName, o usuário precisa escolher o seu).
        const alreadyCompleted = isOnboardingCompleted(session.userId ?? "");
        if (!alreadyCompleted) {
          prepareSession(session, true);
          setView("onboarding");
        } else {
          enterShell(session, true);
        }
      } catch (err) {
        console.error("[SessionGate] handleSession falhou:", err);
        await rejectSession();
        throw err;
      }
    },
    [enterShell, prepareSession, rejectSession],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Pre-loading (estilo Discord): o check de update roda em paralelo à
      // leitura da sessão. Com sessão salva, esperamos o check terminar antes
      // de abrir o shell — se a atualização ficou pronta, reinicia já;
      // sem sessão, o login abre direto (o banner cobre updates depois).
      const updateDone = Promise.resolve(runStartupUpdateCheck()).catch(() => { });
      try {
        const [session, _updateResult] = await Promise.all([loadSession(), updateDone]);
        if (cancelled) return;
        if (!session) {
          setView("login");
          return;
        }
        // Verificar se a sessão expirou e tentar refresh automático
        const now = Date.now();
        if (session.expiresAt && session.expiresAt < now) {
          try {
            const refreshed = await echoApi.refreshSession(session.refreshToken ?? "");
            // Refresh bem-sucedido: usar a sessão renovada
            session.accessToken = refreshed.accessToken;
            session.refreshToken = refreshed.refreshToken ?? session.refreshToken;
            session.expiresAt = refreshed.expiresAt;
            await saveSession(session);
            // Prosseguir com a sessão renovada
            prepareSession(session);
            const alreadyCompleted = isOnboardingCompleted(session.userId ?? "");
            if (!alreadyCompleted) {
              setView("onboarding");
            } else {
              enterShell(session, true);
            }
            return;
          } catch (refreshErr) {
            // Refresh falhou — limpar sessão e login
            console.error("[SessionGate] Refresh session failed, clearing session:", refreshErr);
            await rejectSession();
            setView("login");
            return;
          }
        }
        // Sessão válida (não expirada) ou refresh bem-sucedido: verifica onboarding.
        prepareSession(session);
        const alreadyCompleted = isOnboardingCompleted(session.userId ?? "");
        if (!alreadyCompleted) {
          setView("onboarding");
        } else {
          enterShell(session, true);
        }
      } catch {
        if (cancelled) return;
        await rejectSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enterShell, prepareSession, rejectSession]);

  // Splash de boot (forçada, estilo Discord)
  if (view === "booting") {
    const isChecking = updateStatus === "checking";
    const isDownloading = updateStatus === "downloading";
    const isReady = updateStatus === "ready";

    const mainLabel = isChecking
      ? "Verificando atualizações…"
      : isDownloading
        ? `Baixando atualização ${updateVersion ?? ""}…`
        : isReady
          ? "Atualização pronta. Reiniciando…"
          : "Iniciando…";

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg font-ui">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <img src="/logo.png" width={96} height={96} alt="" />
            {(isChecking || isDownloading) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <CircleNotch size={34} className="animate-spin text-acc" />
              </div>
            )}
          </div>
          <p className="text-2xl font-bold text-txt">Echo</p>
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-mut tracking-wide uppercase"
          >
            {mainLabel}
          </p>
        </div>
      </main>
    );
  }

  // Tela de update obrigatória (relaunch falhou)
  if (view === "update-required") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg font-ui">
        <div className="flex flex-col items-center gap-4">
          <Download size={48} className="text-acc" />
          <p className="text-xl font-semibold text-txt">Atualização disponível</p>
          <p className="text-sm text-mut text-center max-w-xs">
            Uma nova versão do Echo foi baixada. Reinicie o aplicativo para
            aplicar a atualização.
          </p>
          <Button
            type="button"
            onClick={() => void restartApp()}
            className="mt-6 cursor-pointer flex items-center gap-2 rounded-lg bg-acc px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-acc-press active:scale-95"
          >
            Reiniciar agora
          </Button>
        </div>
      </main>
    );
  }

  if (view === "login") {
    return <GoogleLoginScreen service={echoApi} onSession={handleSession} />;
  }

  if (view === "onboarding") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg font-ui">
        <OnboardingScreen
          onComplete={async () => {
            // Após o onboarding, entra no shell com a sessão já carregada
            const session = await loadSession();
            if (session) {
              markOnboardingCompleted(session.userId);
              enterShell(session, true);
            } else {
              setView("login");
            }
          }}
        />
      </main>
    );
  }

  return shell ?? <AppShell />;
}
import { Download } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import GoogleLoginScreen from "@/features/auth/GoogleLoginScreen";
import OnboardingScreen from "@/features/auth/OnboardingScreen";
import { registerLogoutHandler } from "@/features/auth/logout";
import UpdaterSplash from "@/features/updater/UpdaterSplash";
import AppShell from "@/features/shell/AppShell";
import { echoApi, initEchoApiFromSession, matrixService } from "@/lib/matrix/instance";
import type { Session } from "@/lib/matrix/types";
import { startSyncWiring, stopSyncWiring } from "@/lib/matrix/wiring";
import { isNewAccount, isOnboardingCompleted, markOnboardingCompleted } from "@/lib/onboarding";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { clearSession, loadSession, saveSession } from "@/lib/storage/keyring";
import { isTauri, restartApp, runStartupUpdateCheck, setMainWindowMode } from "@/lib/updater";
import { useUpdateStore } from "@/stores/updateStore";
import { desktopStorage } from "@/lib/storage/desktopStore";
import { Button } from "@/components/ui/button";

type GateView = "booting" | "update-required" | "login" | "onboarding" | "shell";

export interface SessionGateProps {
  /** Conteúdo renderizado no shell autenticado; omitido, renderiza <AppShell /> vazio. */
  shell?: ReactNode;
}

/**
 * Portão de boot: decide entre splash do updater, login, onboarding e shell.
 *
 * Fluxo:
 * 1. booting — splash compacta do auto-updater: checa atualizações em paralelo à sessão.
 * 2. update-required — atualização pronta; reinicia ou mostra botão "Reiniciar agora".
 * 3. login — sem sessão salva → GoogleLoginScreen (janela principal).
 * 4. onboarding — primeira vez após login → define nick + foto antes do shell.
 * 5. shell — AppShell autenticado.
 */
export default function SessionGate({ shell }: SessionGateProps) {
  const [view, setView] = useState<GateView>("booting");

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
      echoApi.setAccessToken?.(session.accessToken ?? "", session.userId ?? undefined);
      if (!clientActive) {
        initEchoApiFromSession();
        matrixService.restoreSession(session);
      }
      const ui = useUiStore.getState();
      const userId = session.userId ?? "";
      ui.setMyUserId(userId);
      ui.setPresence(userId, "online");
      void useProfileStore.getState().loadProfile();
      // Fire-and-forget: startSyncWiring is async but we don't need to wait for it
      void startSyncWiring(() => rejectSession());
      setView("shell");
    },
    [rejectSession],
  );

  /** Prepara client + uiStore para telas pré-shell (onboarding), sem ligar o sync. */
  const prepareSession = useCallback((session: Session, clientActive = false) => {
    echoApi.setAccessToken?.(session.accessToken ?? "", session.userId ?? undefined);
    if (!clientActive) {
      initEchoApiFromSession();
      matrixService.restoreSession(session);
    }
    useUiStore.getState().setMyUserId(session.userId ?? "");
    void useProfileStore.getState().loadProfile();
  }, []);

  const handleSession = useCallback(
    async (session: Session): Promise<void> => {
      try {
        echoApi.setAccessToken?.(session.accessToken ?? "", session.userId ?? undefined);
        await saveSession(session);
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
      console.log("[SessionGate] Boot iniciado. Exibindo splash do updater...");
      const startTime = Date.now();
      const isDesktopApp = isTauri();

      // Inicializa a configuração (config.json) e o cache (cache.json) do disco
      // e hidrata instantaneamente os stores (zero delay, dados offline disponíveis de imediato)
      try {
        await desktopStorage.init();
        desktopStorage.hydrateStoresFromLocal();
      } catch (err) {
        console.warn("[SessionGate] Falha ao inicializar desktopStorage:", err);
      }

      // No app desktop (dev ou exe), garante um tempo agradável de exibição (1.1s).
      // Em testes automatizados (onde isTauri() é false), o tempo é 0 para máxima velocidade.
      const minSplashDuration = isDesktopApp ? 1100 : 0;

      // O check de update roda na janela compacta.
      const updateDone = Promise.resolve(runStartupUpdateCheck()).catch((err) => {
        console.warn("[SessionGate] Falha no update check:", err);
      });

      try {
        const [session] = await Promise.all([loadSession(), updateDone]);
        if (cancelled) return;

        // Se encontrou update e instalou, reinicia imediatamente
        if (useUpdateStore.getState().status === "ready") {
          console.log("[SessionGate] Atualização instalada. Reiniciando Echo...");
          await restartApp();
          return;
        }

        // Garante a exibição mínima da animação e slogan
        const elapsed = Date.now() - startTime;
        if (elapsed < minSplashDuration) {
          await new Promise((r) => setTimeout(r, minSplashDuration - elapsed));
        }
        if (cancelled) return;

        // Fase 'INICIANDO O ECHO...' antes de expandir
        if (isDesktopApp) {
          console.log("[SessionGate] Transicionando status para INICIANDO O ECHO...");
          useUpdateStore.getState().setStatusText("INICIANDO O ECHO...");
          await new Promise((r) => setTimeout(r, 350));
          if (cancelled) return;

          console.log("[SessionGate] Expandindo janela para o aplicativo principal (1200x800)...");
          await setMainWindowMode();
        }

        if (!session) {
          console.log("[SessionGate] Sem sessão salva. Abrindo Google Login...");
          setView("login");
          return;
        }

        // Verificar se a sessão expirou e tentar refresh automático
        const now = Date.now();
        if (session.expiresAt && session.expiresAt < now) {
          try {
            console.log("[SessionGate] Sessão expirada. Renovando via refresh token...");
            const refreshed = await echoApi.refreshSession(session.refreshToken ?? "");
            session.accessToken = refreshed.accessToken;
            session.refreshToken = refreshed.refreshToken ?? session.refreshToken;
            session.expiresAt = refreshed.expiresAt;
            await saveSession(session);
            prepareSession(session);
            const alreadyCompleted = isOnboardingCompleted(session.userId ?? "");
            if (!alreadyCompleted) {
              setView("onboarding");
            } else {
              enterShell(session, true);
            }
            return;
          } catch (refreshErr) {
            console.error("[SessionGate] Refresh session failed, clearing session:", refreshErr);
            await rejectSession();
            setView("login");
            return;
          }
        }

        // Sessão válida: verifica onboarding
        console.log("[SessionGate] Sessão válida carregada:", session.userId);
        prepareSession(session);
        const alreadyCompleted = isOnboardingCompleted(session.userId ?? "");
        const isNew = !alreadyCompleted || (await isNewAccount(matrixService));
        if (isNew) {
          setView("onboarding");
        } else {
          enterShell(session, true);
        }
      } catch (err) {
        console.error("[SessionGate] Erro inesperado durante boot:", err);
        if (cancelled) return;
        await rejectSession();
        setView("login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enterShell, prepareSession, rejectSession]);

  // Splash de boot
  if (view === "booting") {
    return <UpdaterSplash />;
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

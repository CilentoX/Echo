import { Gear, Download } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import GoogleLoginScreen from "@/features/auth/GoogleLoginScreen";
import OnboardingScreen from "@/features/auth/OnboardingScreen";
import { registerLogoutHandler } from "@/features/auth/logout";
import AppShell from "@/features/shell/AppShell";
import { matrixService } from "@/lib/matrix/instance";
import type { Session } from "@/lib/matrix/types";
import { startSyncWiring, stopSyncWiring } from "@/lib/matrix/wiring";
import { isNewAccount, markOnboardingCompleted } from "@/lib/onboarding";
import { useUiStore } from "@/stores/uiStore";
import { clearSession, loadSession, saveSession } from "@/lib/storage/keyring";
import { restartApp, runStartupUpdateCheck } from "@/lib/updater";
import { useUpdateStore } from "@/stores/updateStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
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
 */
export default function SessionGate({ shell }: SessionGateProps) {
  const [view, setView] = useState<GateView>("booting");
  const updateStatus = useUpdateStore((s) => s.status);
  const updateVersion = useUpdateStore((s) => s.version);

  const rejectSession = useCallback(async () => {
    stopSyncWiring();
    await clearSession().catch(() => {});
    setView("login");
  }, []);

  // O botão "Sair da conta" (Settings) executa este handler via logout.ts.
  useEffect(() => {
    registerLogoutHandler(() => void rejectSession());
    return () => registerLogoutHandler(null);
  }, [rejectSession]);

  const enterShell = useCallback(
    (session: Session, clientActive = false) => {
      if (!clientActive) matrixService.restoreSession(session);
      const ui = useUiStore.getState();
      ui.setMyUserId(session.userId);
      ui.setPresence(session.userId, "online");
      startSyncWiring(rejectSession);
      setView("shell");
    },
    [rejectSession],
  );

  /** Prepara client + uiStore para telas pré-shell (onboarding), sem ligar o sync. */
  const prepareSession = useCallback((session: Session, clientActive = false) => {
    if (!clientActive) matrixService.restoreSession(session);
    useUiStore.getState().setMyUserId(session.userId);
  }, []);

  const handleSession = useCallback(
    (session: Session) => {
      void (async () => {
        try {
          await saveSession(session);
          // loginWithSsoToken já deixou o client credentialled ativo.
          // Onboarding só para conta nova (sem perfil no servidor Matrix).
          const isNew = await isNewAccount(matrixService);
          useOnboardingStore.getState().setCompleted(!isNew);
          if (isNew) {
            prepareSession(session, true);
            setView("onboarding");
          } else {
            enterShell(session, true);
          }
        } catch {
          await rejectSession();
        }
      })();
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
      const updateDone = Promise.resolve(runStartupUpdateCheck()).catch(() => {});
      try {
        const [session] = await Promise.all([loadSession(), updateDone]);
        if (cancelled) return;
        if (!session) {
          setView("login");
          return;
        }
        if (useUpdateStore.getState().status === "ready") {
          const relaunched = await restartApp().then(
            () => true,
            () => false,
          );
          if (relaunched) return; // o processo termina com o relaunch
          // relaunch falhou — mostra tela de update exigindo reinício manual
          setView("update-required");
          return;
        }
        // Sessão válida e sem update pendente: verifica onboarding.
        // O client é restaurado ANTES do onboarding — setDisplayName/upload
        // do OnboardingScreen exigem o client credentialled (e o uiStore
        // precisa do myUserId para habilitar o submit).
        // Onboarding só para conta nova (sem perfil no servidor Matrix).
        prepareSession(session);
        const isNew = await isNewAccount(matrixService);
        useOnboardingStore.getState().setCompleted(!isNew);
        if (isNew) {
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
    const updateLabel =
      updateStatus === "checking"
        ? "Verificando atualizações…"
        : updateStatus === "downloading"
          ? `Baixando atualização ${updateVersion ?? ""}…`
          : updateStatus === "ready"
            ? "Atualização pronta. Reiniciando…"
            : null;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg font-ui">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <img src="/logo.png" width={80} height={80} alt="" />
            {updateStatus === "checking" || updateStatus === "downloading" ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Gear size={32} className="animate-spin text-acc" />
              </div>
            ) : null}
          </div>
          <p className="text-xl font-semibold text-txt">Echo</p>
          <p className="text-sm text-mut">
            Preparando para iniciar…
          </p>
          {updateLabel ? (
            <p role="status" aria-live="polite" className="text-sm text-mut mt-2">
              {updateLabel}
            </p>
          ) : null}
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
    return <GoogleLoginScreen service={matrixService} onSession={handleSession} />;
  }

  if (view === "onboarding") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg font-ui">
        <OnboardingScreen
          onComplete={async () => {
            // Após o onboarding, entra no shell com a sessão já carregada
            // (o client já está ativo — preparado no boot/login).
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

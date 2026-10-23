import { CircleNotch } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import GoogleLoginScreen from "@/features/auth/GoogleLoginScreen";
import { registerLogoutHandler } from "@/features/auth/logout";
import AppShell from "@/features/shell/AppShell";
import { matrixService } from "@/lib/matrix/instance";
import type { Session } from "@/lib/matrix/types";
import { startSyncWiring, stopSyncWiring } from "@/lib/matrix/wiring";
import { useUiStore } from "@/stores/uiStore";
import { clearSession, loadSession, saveSession } from "@/lib/storage/keyring";
import { restartApp, runStartupUpdateCheck } from "@/lib/updater";
import { useUpdateStore } from "@/stores/updateStore";

type GateView = "booting" | "shell" | "login";

export interface SessionGateProps {
  /** Conteúdo renderizado no shell autenticado; omitido, renderiza <AppShell /> vazio. */
  shell?: ReactNode;
}

/**
 * Portão de boot: decide entre splash, tela de login e AppShell.
 *
 * - Boot sem sessão salva → tela de login.
 * - Boot com sessão salva → restoreSession + startSyncWiring. Erro de sync
 *   antes do primeiro sync só limpa o keyring quando é falha de
 *   autenticação (M_UNKNOWN_TOKEN/M_MISSING_TOKEN); erro de rede mantém a
 *   sessão — o SDK reconecta sozinho e o indicador mostra "Reconectando…"
 *   (a decisão auth vs. rede é do wiring).
 * - Login bem-sucedido → sessão persistida no keyring antes de entrar;
 *   loginWithSsoToken já deixou o client credentialled ativo, então
 *   enterShell não restaura a sessão de novo.
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
      useUiStore.getState().setMyUserId(session.userId);
      startSyncWiring(rejectSession);
      setView("shell");
    },
    [rejectSession],
  );

  const handleSession = useCallback(
    (session: Session) => {
      void (async () => {
        try {
          await saveSession(session);
          // O client credentialled já está ativo (loginWithSsoToken aplica
          // a sessão) — restaurar de novo criaria um segundo client.
          enterShell(session, true);
        } catch {
          await rejectSession();
        }
      })();
    },
    [enterShell, rejectSession],
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
          // relaunch falhou — cai para o shell; o UpdateBanner mostra o botão
        }
        enterShell(session);
      } catch {
        if (cancelled) return;
        await rejectSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enterShell, rejectSession]);

  if (view === "booting") {
    const updateLabel =
      updateStatus === "checking"
        ? "Verificando atualizações…"
        : updateStatus === "downloading"
          ? `Baixando atualização ${updateVersion ?? ""}…`
          : updateStatus === "ready"
            ? "Reiniciando…"
            : null;
    return (
      <main className="grid min-h-screen place-items-center bg-bg font-ui">
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <CircleNotch size={28} className="animate-spin text-mut" aria-label="Carregando" />
            <p className="text-xs text-mut">Iniciando Echo…</p>
          </div>
          {updateLabel ? (
            <p role="status" aria-live="polite" className="text-sm text-mut">
              {updateLabel}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  if (view === "login") {
    return <GoogleLoginScreen service={matrixService} onSession={handleSession} />;
  }

  return shell ?? <AppShell />;
}

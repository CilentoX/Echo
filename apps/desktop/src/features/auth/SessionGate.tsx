import { CircleNotch } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import GoogleLoginScreen from "@/features/auth/GoogleLoginScreen";
import AppShell from "@/features/shell/AppShell";
import { matrixService } from "@/lib/matrix/instance";
import type { Session } from "@/lib/matrix/types";
import { startSyncWiring, stopSyncWiring } from "@/lib/matrix/wiring";
import { useUiStore } from "@/stores/uiStore";
import { clearSession, loadSession, saveSession } from "@/lib/storage/keyring";

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

  const rejectSession = useCallback(async () => {
    stopSyncWiring();
    await clearSession().catch(() => {});
    setView("login");
  }, []);

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
      try {
        const session = await loadSession();
        if (cancelled) return;
        if (session) {
          enterShell(session);
        } else {
          setView("login");
        }
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
    return (
      <main className="grid min-h-screen place-items-center bg-bg font-ui">
        <CircleNotch size={28} weight="bold" className="animate-spin text-mut" aria-label="Carregando" />
      </main>
    );
  }

  if (view === "login") {
    return <GoogleLoginScreen service={matrixService} onSession={handleSession} />;
  }

  return shell ?? <AppShell />;
}

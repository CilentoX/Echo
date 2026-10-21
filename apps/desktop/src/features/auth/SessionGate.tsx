import { CircleNotch } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import GoogleLoginScreen from "@/features/auth/GoogleLoginScreen";
import AppShell from "@/features/shell/AppShell";
import { matrixService } from "@/lib/matrix/instance";
import type { Session, SyncStatus } from "@/lib/matrix/types";
import { clearSession, loadSession, saveSession } from "@/lib/storage/keyring";

type GateView = "booting" | "shell" | "login";

const NOOP_ON_EVENT = () => {};

/**
 * Portão de boot: decide entre splash, tela de login e AppShell.
 *
 * - Boot sem sessão salva → tela de login.
 * - Boot com sessão salva → restoreSession + startSync; se o Synapse
 *   rejeitar (erro no restore/sync antes do primeiro sync), a sessão é
 *   limpa do keyring e a tela de login volta (Review Focus 1).
 * - Login bem-sucedido → sessão persistida no keyring antes de entrar.
 */
export default function SessionGate() {
  const [view, setView] = useState<GateView>("booting");
  // false após o primeiro sync confirmado; erros antes disso significam
  // credenciais restauradas rejeitadas pelo Synapse.
  const syncedRef = useRef(false);

  const rejectSession = useCallback(async () => {
    matrixService.stopSync();
    await clearSession().catch(() => {});
    setView("login");
  }, []);

  const handleStatus = useCallback(
    (status: SyncStatus) => {
      if (status === "syncing") {
        syncedRef.current = true;
        return;
      }
      if (status === "error" && !syncedRef.current) {
        void rejectSession();
      }
    },
    [rejectSession],
  );

  const enterShell = useCallback(
    (session: Session) => {
      matrixService.restoreSession(session);
      syncedRef.current = false;
      matrixService.startSync(NOOP_ON_EVENT, handleStatus);
      setView("shell");
    },
    [handleStatus],
  );

  const handleSession = useCallback(
    (session: Session) => {
      void (async () => {
        try {
          await saveSession(session);
          enterShell(session);
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

  return <AppShell />;
}

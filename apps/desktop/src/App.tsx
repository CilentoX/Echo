import SessionGate from "@/features/auth/SessionGate";
import AppShell from "@/features/shell/AppShell";
import UpdateBanner from "@/features/shell/UpdateBanner";
import { initNotifications } from "@/lib/notifications/nativeNotify";
import { matrixService } from "@/lib/matrix/instance";
import { useProfileStore } from "@/stores/profileStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { webrtcVoice } from "@/lib/media/webrtcVoice";
import { stopSyncWiring } from "@/lib/matrix/wiring";

/** R2: envio real via MatrixService; o Composer cuida do envio síncrono (P10). */


/** Envio de anexo/mídia real via MatrixService. */


/** BOT_SENDERS: sender IDs tratados como bot (selo BOT teal). */
const BOT_SENDERS = ["@eco:eco"];

/** Shell autenticado: AppShell (T3) com o ChatPane real (T10) no slot de children. */
function Shell() {
  const loadProfile = useProfileStore((s) => s.loadProfile);

  useEffect(() => {
    void initNotifications();
    loadProfile();

    const unlistenPromise = listen("echo://close-requested", () => {
      try {
        void webrtcVoice.leave();
      } catch {}
      try {
        stopSyncWiring();
      } catch {}
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [loadProfile]);

  
  const sendMessage = useCallback((roomId: string, body: string): Promise<string> =>
    matrixService.sendMessage(roomId, body), []);

  const sendFile = useCallback((roomId: string, file: File, body?: string): Promise<string> =>
    matrixService.sendFile(roomId, file, body), []);

  return (
    <AppShell
      sendMessage={sendMessage}
      sendFile={sendFile}
      botSenders={BOT_SENDERS}
    />
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-col">
        <UpdateBanner />
        <div className="min-h-0 flex-1">
          <SessionGate shell={<Shell />} />
        </div>
      </div>
    </TooltipProvider>
  );
}

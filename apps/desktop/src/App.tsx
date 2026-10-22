import { useEffect } from "react";
import SessionGate from "@/features/auth/SessionGate";
import AppShell from "@/features/shell/AppShell";
import ChatPane from "@/features/chat/ChatPane";
import { matrixService } from "@/lib/matrix/instance";
import { runStartupUpdateCheck } from "@/lib/updater";

/** R2: envio real via MatrixService; o Composer cuida do otimismo/rollback. */
const sendMessage = (roomId: string, body: string): Promise<string> =>
  matrixService.sendMessage(roomId, body);

/** Wiring Task 11: stubs store-driven — presence, reações agregadas e threads
 *  chegam com o sync loop completo na Fase 2. */
const TYPING_USERS: string[] = [];
const BOT_SENDERS = ["@eco:eco"];

/** Shell autenticado: AppShell (T3) com o ChatPane real (T10) no slot de children. */
function Shell() {
  return (
    <AppShell>
      <ChatPane
        sendMessage={sendMessage}
        typingUsers={TYPING_USERS}
        botSenders={BOT_SENDERS}
      />
    </AppShell>
  );
}

export default function App() {
  // Task 12: checagem silenciosa de atualização no boot (best-effort, sem UI).
  useEffect(() => {
    void runStartupUpdateCheck();
  }, []);

  return <SessionGate shell={<Shell />} />;
}

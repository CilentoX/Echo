import SessionGate from "@/features/auth/SessionGate";
import AppShell from "@/features/shell/AppShell";
import ChatPane from "@/features/chat/ChatPane";
import UpdateBanner from "@/features/shell/UpdateBanner";
import { matrixService } from "@/lib/matrix/instance";
import { useProfileStore } from "@/stores/profileStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";

/** R2: envio real via MatrixService; o Composer cuida do envio síncrono (P10). */
const sendMessage = (roomId: string, body: string): Promise<string> =>
  matrixService.sendMessage(roomId, body);

/** BOT_SENDERS: sender IDs tratados como bot (selo BOT teal). */
const BOT_SENDERS = ["@eco:eco"];

/** Shell autenticado: AppShell (T3) com o ChatPane real (T10) no slot de children. */
function Shell() {
  const loadProfile = useProfileStore((s) => s.loadProfile);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <AppShell>
      <ChatPane sendMessage={sendMessage} botSenders={BOT_SENDERS} />
    </AppShell>
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

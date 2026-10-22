import { useMemo, type ReactNode } from "react";
import { List, Users } from "@phosphor-icons/react";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

export interface ChatPaneProps {
  children?: ReactNode;
  /** Show the ☰ button that opens the sidebar overlay (below 900px). */
  showSidebarToggle: boolean;
  /** Show the members toggle button (below 1150px). */
  showMembersToggle: boolean;
  onToggleSidebar?: () => void;
  onToggleMembers?: () => void;
}

/** Chat area: the flexible middle column. Header shows the active channel. */
export default function ChatPane({
  children,
  showSidebarToggle,
  showMembersToggle,
  onToggleSidebar,
  onToggleMembers,
}: ChatPaneProps) {
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);

  // Sem canal ativo (ou canal ainda não sincronizado) o header fica vazio —
  // nada de canal falso hardcodado.
  const channelName = useMemo(() => {
    if (!activeChannelId) return null;
    for (const channels of Object.values(channelsByGuild)) {
      const found = channels.find((c) => c.channelId === activeChannelId);
      if (found) return found.name;
    }
    return null;
  }, [channelsByGuild, activeChannelId]);

  return (
    <main
      data-column="chat"
      className="flex min-w-0 flex-1 flex-col bg-bg"
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-bd px-4">
        {showSidebarToggle && (
          <button
            type="button"
            aria-label="Abrir canais"
            onClick={onToggleSidebar}
            className="flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
          >
            <List size={20} />
          </button>
        )}
        {channelName && (
          <h2 className="font-display text-sm font-semibold text-txt">
            #{channelName}
          </h2>
        )}
        <div className="flex-1" />
        {showMembersToggle && (
          <button
            type="button"
            aria-label="Membros"
            onClick={onToggleMembers}
            className="flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
          >
            <Users size={20} />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </main>
  );
}

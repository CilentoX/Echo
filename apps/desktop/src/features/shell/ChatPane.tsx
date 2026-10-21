import type { ReactNode } from "react";
import { List, Users } from "@phosphor-icons/react";

/** Static placeholder messages — real Matrix timelines arrive in Tasks 8-9. */
const PLACEHOLDER_MESSAGES = [
  {
    id: "maria",
    author: "Maria",
    body: "Bem-vinda, galera!",
  },
  {
    id: "lucas",
    author: "Lucas",
    body: "Fase 1: fundação do shell pronta.",
  },
  {
    id: "joao",
    author: "João",
    body: "Adorei o tema escuro.",
  },
];

export interface ChatPaneProps {
  children?: ReactNode;
  /** Show the ☰ button that opens the sidebar overlay (below 900px). */
  showSidebarToggle: boolean;
  /** Show the members toggle button (below 1150px). */
  showMembersToggle: boolean;
  onToggleSidebar?: () => void;
  onToggleMembers?: () => void;
}

/** Chat area: the flexible middle column. */
export default function ChatPane({
  children,
  showSidebarToggle,
  showMembersToggle,
  onToggleSidebar,
  onToggleMembers,
}: ChatPaneProps) {
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
        <h2 className="font-display text-sm font-semibold text-txt">
          # geral
        </h2>
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

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {children ??
          PLACEHOLDER_MESSAGES.map((message) => (
            <div key={message.id} className="mb-3">
              <p className="text-sm font-semibold text-acc">{message.author}</p>
              <p className="text-sm text-txt">{message.body}</p>
            </div>
          ))}
      </div>
    </main>
  );
}

import { useState, useMemo } from "react";
import { useSyncStore, selectMembers } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import MemberDropdown from "./MemberDropdown";

export interface MemberListProps {
  /** `overlay` flutua acima do chat abaixo 1150px; `static` é a coluna dockada. */
  variant?: "static" | "overlay";
  onClose?: () => void;
}

/**
 * Lista de membros da guilda/canal atual.
 * Mostra membros reais vindos de syncStore.membersByRoom, agrupados por
 * presença (online / ausente / não perturbar / offline), com busca por nome.
 * Clicar num membro abre um dropdown tipo Discord com infos e perfil.
 */
export default function MemberList({
  variant = "static",
  onClose,
}: MemberListProps) {
  const overlay = variant === "overlay";
  const activeChannelId = useUiStore((state) => state.activeChannelId);
  const members = useSyncStore(selectMembers(activeChannelId ?? ""));
  const myUserId = useUiStore((state) => state.myUserId ?? "");
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [search, setSearch] = useState("");

  // Agrupa membros por status de presença.
  const grouped = useMemo(() => {
    const query = search.toLowerCase().trim();
    const list = members.filter((m) => {
      if (!query) return true;
      const nome = (m.displayName || m.userId || "").toLowerCase();
      return nome.includes(query);
    });
    const groups: Record<string, typeof list> = {
      online: [],
      offline: [],
      unavailable: [],
    };
    for (const m of list) {
      const key = m.presence ?? "offline";
      if (groups[key]) groups[key].push(m);
      else groups.offline.push(m);
    }
    return groups;
  }, [members, search]);

  const statusOrder: Array<[string, string]> = [
    ["online", "Online"],
    ["unavailable", "Não perturbar"],
    ["offline", "Offline"],
  ];

  const handleMemberClick = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    setDropdownOpen((open) => (open === userId ? null : userId));
  };

  if (!activeChannelId) {
    return (
      <aside
        data-column="members"
        aria-label="Membros"
        className={`flex w-[224px] shrink-0 flex-col border-l border-bd bg-rail ${
          overlay
            ? "fixed inset-y-0 right-0 z-20 shadow-lg shadow-black/60"
            : "h-full"
        }`}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-bd px-4">
          <h2 className="font-display text-sm font-semibold text-txt">Membros</h2>
          {overlay && (
            <button
              type="button"
              aria-label="Fechar membros"
              onClick={onClose}
              className="cursor-pointer flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
            >
              <X size={18} />
            </button>
          )}
        </header>
        <ul className="flex-1 overflow-y-auto px-2 py-3">
          <li className="px-2 py-1.5 text-xs text-mut">
            Selecione um canal para ver os membros.
          </li>
        </ul>
      </aside>
    );
  }

  const totalOnline =
    grouped.online.length + grouped.unavailable.length;
  const totalOffline = grouped.offline.length;

  return (
    <aside
      data-column="members"
      aria-label="Membros"
      className={`flex w-[224px] shrink-0 flex-col border-l border-bd bg-rail ${
        overlay
          ? "fixed inset-y-0 right-0 z-20 shadow-lg shadow-black/60"
          : "h-full"
      }`}
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-bd px-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-semibold text-txt">
            Membros
          </h2>
          <span className="ml-auto text-[10px] font-medium text-acc bg-acc/10 px-2 py-0.5 rounded border border-acc/20">
            {totalOnline} online
          </span>
        </div>
        {overlay && (
          <button
            type="button"
            aria-label="Fechar membros"
            onClick={onClose}
            className="cursor-pointer flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
          >
            <X size={18} />
          </button>
        )}
      </header>

      {/* Busca */}
      <div className="px-3 py-2 border-b border-bd">
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-3 top-2.5 text-mut" aria-hidden />
          <input
            type="search"
            placeholder="Buscar membros…"
            aria-label="Buscar membros"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 bg-transparent text-sm text-txt outline-none placeholder:text-mut focus:border-acc"
          />
        </div>
      </div>

      {/* Lista agrupada por status */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {statusOrder.map(([key, label]) => {
          const items = grouped[key];
          if (items.length === 0) return null;
          return (
            <section key={key} className="mb-2">
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-mut">
                {label} ({items.length})
              </h3>
              <ul>
                {items.map((member) => {
                  const isMe = member.userId === myUserId;
                  const activeDropdown = dropdownOpen === member.userId;
                  return (
                    <li
                      key={member.userId}
                      className="relative"
                    >
                      <button
                        type="button"
                        aria-label={member.displayName || member.userId}
                        onClick={(e) =>
                          handleMemberClick(e, member.userId)
                        }
                        className={`cursor-pointer flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                          activeDropdown
                            ? "bg-surf2 text-txt"
                            : isMe
                              ? "text-mut/70 hover:bg-surf2"
                              : "text-mut hover:bg-surf2 hover:text-txt"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-display text-[10px] font-bold shrink-0 ${
                            member.presence === "online"
                              ? "bg-green-500 text-bg"
                              : member.presence === "unavailable"
                                ? "bg-acc text-bg"
                                : "bg-surf2 text-mut"
                          }`}
                        >
                          {member.displayName
                            ? member.displayName.charAt(0).toUpperCase()
                            : member.userId.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">
                          {member.displayName || member.userId}
                        </span>
                        {isMe && (
                          <span
                            className="ml-auto text-[10px] text-mut"
                            aria-hidden
                          >
                            (você)
                          </span>
                        )}
                        {activeDropdown && (
                          <span className="ml-auto text-[10px] text-acc">
                            ▾
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {totalOffline === 0 && members.length > 0 && (
        <div className="px-2 py-2 text-[11px] text-mut border-t border-bd">
          Todos os membros estão online.
        </div>
      )}

      {/* Dropdown popup tipo Discord */}
      {dropdownOpen && (
        <MemberDropdown
          userId={dropdownOpen}
          top={dropdownPos.top}
          left={dropdownPos.left}
          onClose={() => setDropdownOpen(null)}
        />
      )}
    </aside>
  );
}

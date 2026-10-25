import { useState, useMemo } from "react";
import { useSyncStore, selectMembers } from "@/stores/syncStore";
import type { MemberSummary } from "@/lib/matrix/types";
import { useUiStore } from "@/stores/uiStore";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import MemberDropdownContent from "./MemberDropdownContent";

export interface MemberListProps {
  /** `overlay` flutua acima do chat abaixo 1150px; `static` é a coluna dockada. */
  variant?: "static" | "overlay";
  onClose?: () => void;
}

/**
 * Lista de membros da guilda/canal atual.
 * Quando há um canal ativo, mostra os membros desse canal.
 * Quando não há canal ativo mas há uma guilda ativa, agrega os membros de
 * todos os canais da guilda (deduplicados por userId).
 * Clicar num membro abre um dropdown tipo Discord com infos e perfil.
 */
export default function MemberList({
  variant = "static",
  onClose,
}: MemberListProps) {
  const overlay = variant === "overlay";
  const activeChannelId = useUiStore((state) => state.activeChannelId);
  const activeGuildId = useUiStore((state) => state.activeGuildId);
  const myUserId = useUiStore((state) => state.myUserId ?? "");

  // Canais da guilda ativa (para agregar membros quando não há canal selecionado).
  const channelsByGuild = useSyncStore((state) => state.channelsByGuild);
  const allMembersByRoom = useSyncStore((state) => state.membersByRoom);

  // Membros do canal ativo (se houver), como array mutável.
  const channelMembers = useSyncStore(selectMembers(activeChannelId ?? ""));

  // Membros agregados de todos os canais da guilda ativa.
  const guildMembers = useMemo(() => {
    if (!activeGuildId) return [];
    const channels = channelsByGuild[activeGuildId] ?? [];
    const seen = new Set<string>();
    const merged: MemberSummary[] = [];
    for (const ch of channels) {
      const members = allMembersByRoom[ch.channelId] ?? [];
      for (const m of members) {
        if (!seen.has(m.userId)) {
          seen.add(m.userId);
          merged.push(m);
        }
      }
    }
    // Garante que o próprio usuário apareça, se estiver na guilda.
    if (myUserId && !seen.has(myUserId)) {
      merged.push({
        userId: myUserId,
        displayName: myUserId.replace(/^@/, ''),
        presence: "online",
      });
    }
    return merged;
  }, [channelsByGuild, activeGuildId, allMembersByRoom, myUserId]);

  // Usa membros do canal ativo, ou agregados da guilda, ou vazio.
  const members: MemberSummary[] = activeChannelId
    ? [...channelMembers]
    : guildMembers;

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
      idle: [],
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
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut" aria-hidden />
          <input
            type="search"
            placeholder="Buscar membros…"
            aria-label="Buscar membros"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 rounded bg-transparent text-sm text-txt border border-bd outline-none placeholder:text-mut focus:border-acc focus:ring-1 focus:ring-acc"
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
                  return (
                    <li key={member.userId} className="relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={member.displayName || member.userId}
                            className={`cursor-pointer flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                              isMe
                                ? "text-mut/70 hover:bg-surf2"
                                : "text-mut hover:bg-surf2 hover:text-txt"
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-display text-[10px] font-bold shrink-0 ${
                                member.presence === "online"
                                  ? "bg-online text-bg"
                                  : member.presence === "unavailable"
                                    ? "bg-dnd text-bg"
                                    : "bg-offline text-bg"
                              }`}
                            >
                              {member.displayName
                                ? member.displayName.charAt(0).toUpperCase()
                                : member.userId.replace(/^@/, '').charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">
                              {member.displayName || member.userId}
                            </span>
                            {isMe && (
                              <span
                                className="ml-auto text-xs text-mut"
                                aria-hidden
                              >
                                (você)
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent sideOffset={6} className="w-auto p-0">
                          <MemberDropdownContent
                            userId={member.userId}
                          />
                        </PopoverContent>
                      </Popover>
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
    </aside>
  );
}

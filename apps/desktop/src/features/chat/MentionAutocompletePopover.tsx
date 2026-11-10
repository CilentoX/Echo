import { useEffect, useMemo } from "react";
import { Hash, SpeakerHigh, At } from "@phosphor-icons/react";
import MxcImage from "@/components/media/MxcImage";
import { useSyncStore } from "@/stores/syncStore";

export type MentionItem =
  | {
      kind: "member";
      id: string;
      name: string;
      handle: string;
      avatarUrl?: string | null;
      roleColor?: string;
    }
  | {
      kind: "role";
      id: string;
      name: string;
      color?: string;
    }
  | {
      kind: "special";
      id: "everyone" | "here";
      name: string;
      description: string;
    }
  | {
      kind: "channel";
      id: string;
      name: string;
      channelType: "text" | "voice";
    };

export interface MentionAutocompletePopoverProps {
  type: "mention" | "channel";
  query: string;
  roomId: string;
  guildId?: string | null;
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onItemsChange?: (items: MentionItem[]) => void;
}

export default function MentionAutocompletePopover({
  type,
  query,
  roomId,
  guildId,
  selectedIndex,
  onSelect,
  onItemsChange,
}: MentionAutocompletePopoverProps) {
  const membersByRoom = useSyncStore((s) => s.membersByRoom[roomId] ?? []);
  const guildProfiles = useSyncStore((s) => (guildId ? s.guildMemberProfiles[guildId] : undefined));
  const guildRoles = useSyncStore((s) => (guildId ? s.guildRoles[guildId] ?? [] : []));
  const channels = useSyncStore((s) => (guildId ? s.channelsByGuild[guildId] ?? [] : []));

  const items = useMemo<MentionItem[]>(() => {
    const q = query.toLowerCase().trim();

    if (type === "channel") {
      return channels
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map((c) => ({
          kind: "channel" as const,
          id: c.channelId,
          name: c.name,
          channelType: (c.type === "voice" ? "voice" : "text") as "text" | "voice",
        }));
    }

    // type === "mention"
    const result: MentionItem[] = [];

    // 1. Menções especiais do sistema (@everyone, @here)
    const specials: MentionItem[] = [
      {
        kind: "special",
        id: "everyone",
        name: "everyone",
        description: "Notifica todos os membros do servidor",
      },
      {
        kind: "special",
        id: "here",
        name: "here",
        description: "Notifica apenas os membros ativos e online",
      },
    ];

    for (const sp of specials) {
      if (!q || sp.name.toLowerCase().includes(q)) {
        result.push(sp);
      }
    }

    // 2. Cargos da Guilda
    const matchedRoles = guildRoles
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((r) => ({
        kind: "role" as const,
        id: (r as any).roleId || r.id,
        name: r.name,
        color: r.color || undefined,
      }));
    result.push(...matchedRoles);

    // 3. Membros da Guilda / Sala
    const seenUsers = new Set<string>();
    const memberItems: MentionItem[] = [];

    // Primeiro dos perfis da guilda
    if (guildProfiles) {
      for (const [userId, profile] of Object.entries(guildProfiles)) {
        if (seenUsers.has(userId)) continue;
        const name = profile.nickname || userId.replace(/^@/, "").split(":")[0] || "Usuário";
        const handle = userId.replace(/^@/, "").split(":")[0] || "";
        if (!q || name.toLowerCase().includes(q) || handle.toLowerCase().includes(q)) {
          seenUsers.add(userId);
          memberItems.push({
            kind: "member",
            id: userId,
            name,
            handle,
            avatarUrl: profile.avatarUrl,
          });
        }
      }
    }

    // Complementa com membersByRoom caso algum não esteja no profile da guilda
    for (const m of membersByRoom) {
      if (seenUsers.has(m.userId)) continue;
      const name = m.displayName || m.userId.replace(/^@/, "").split(":")[0] || "Usuário";
      const handle = m.userId.replace(/^@/, "").split(":")[0] || "";
      if (!q || name.toLowerCase().includes(q) || handle.toLowerCase().includes(q)) {
        seenUsers.add(m.userId);
        memberItems.push({
          kind: "member",
          id: m.userId,
          name,
          handle,
          avatarUrl: m.avatarUrl,
        });
      }
    }

    result.push(...memberItems.slice(0, 8));

    return result.slice(0, 10);
  }, [type, query, channels, guildRoles, guildProfiles, membersByRoom]);

  useEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  if (items.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Sugestões de menção"
      className="absolute bottom-full left-0 mb-2 w-72 max-h-72 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#12161f]/95 shadow-2xl backdrop-blur-xl p-1.5 z-50 scrollbar-thin animate-in fade-in-0 zoom-in-95 duration-100"
    >
      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mut/80 border-b border-white/[0.06] mb-1">
        {type === "channel" ? "Canais" : "Membros e Cargos"}
      </div>

      <div className="space-y-0.5">
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;

          if (item.kind === "channel") {
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(item)}
                className={`cursor-pointer w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition-all ${
                  isSelected
                    ? "bg-white/[0.08] text-txt font-semibold"
                    : "text-mut hover:bg-white/[0.04] hover:text-txt"
                }`}
              >
                {item.channelType === "voice" ? (
                  <SpeakerHigh size={14} className="text-acc shrink-0" />
                ) : (
                  <Hash size={14} className="text-acc shrink-0" />
                )}
                <span className="truncate flex-1 font-medium">{item.name}</span>
                <span className="text-[10px] text-mut/60 font-mono">
                  {item.channelType === "voice" ? "voz" : "texto"}
                </span>
              </button>
            );
          }

          if (item.kind === "special") {
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(item)}
                className={`cursor-pointer w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-xs transition-all ${
                  isSelected
                    ? "bg-acc/15 text-txt font-semibold border border-acc/30"
                    : "text-mut hover:bg-white/[0.04] hover:text-txt"
                }`}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-acc/20 text-acc font-bold text-xs">
                  <At size={13} weight="bold" />
                </div>
                <div className="flex flex-col min-w-0 flex-1 leading-tight">
                  <span className="truncate text-txt font-semibold text-xs">@{item.name}</span>
                  <span className="truncate text-mut/70 text-[10px]">{item.description}</span>
                </div>
              </button>
            );
          }

          if (item.kind === "role") {
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(item)}
                className={`cursor-pointer w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition-all ${
                  isSelected
                    ? "bg-white/[0.08] text-txt font-semibold"
                    : "text-mut hover:bg-white/[0.04] hover:text-txt"
                }`}
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0 ring-1 ring-white/20"
                  style={{ backgroundColor: item.color || "#0fb9a8" }}
                />
                <span className="truncate flex-1 font-medium">@{item.name}</span>
                <span className="text-[10px] text-mut/60">cargo</span>
              </button>
            );
          }

          // item.kind === "member"
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(item)}
              className={`cursor-pointer w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left text-xs transition-all ${
                isSelected
                  ? "bg-white/[0.08] text-txt font-semibold shadow-xs"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              <div className="relative h-6 w-6 shrink-0">
                {item.avatarUrl ? (
                  <MxcImage
                    mxcUrl={item.avatarUrl}
                    alt={item.name}
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-bd-subtle"
                    width={24}
                    height={24}
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-acc text-bg text-[10px] font-bold">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1 leading-tight">
                <span className="truncate text-txt font-medium text-xs">{item.name}</span>
                {item.handle && (
                  <span className="truncate text-mut/60 text-[10px]">@{item.handle}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


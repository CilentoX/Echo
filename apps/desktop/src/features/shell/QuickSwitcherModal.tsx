"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  MagnifyingGlass,
  Hash,
  SpeakerHigh,
  ArrowElbowDownLeft,
  Buildings,
} from "@phosphor-icons/react";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useFriendsStore } from "@/stores/friendsStore";
import MxcImage from "@/components/media/MxcImage";

export interface QuickSwitcherModalProps {
  open: boolean;
  onClose: () => void;
}

interface QuickItem {
  id: string;
  type: "text_channel" | "voice_channel" | "friend" | "guild";
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  guildId?: string;
  channelId?: string;
  directRoomId?: string;
  status?: string;
}

export default function QuickSwitcherModal({
  open,
  onClose,
}: QuickSwitcherModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const guilds = useSyncStore((s) => s.guilds);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);
  const friends = useFriendsStore((s) => s.friends);

  const setActiveGuild = useUiStore((s) => s.setActiveGuild);
  const setActiveChannel = useUiStore((s) => s.setActiveChannel);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Aggregate all searchable items
  const allItems = useMemo<QuickItem[]>(() => {
    const list: QuickItem[] = [];

    // 1. Amigos
    for (const f of friends) {
      const handle = f.username || f.nickname || f.userId.replace(/^@/, "").split(":")[0];
      list.push({
        id: `friend-${f.userId}`,
        type: "friend",
        title: f.displayName,
        subtitle: handle ? `@${handle}` : undefined,
        avatarUrl: f.avatarUrl ?? undefined,
        directRoomId: f.directRoomId ?? undefined,
        status: f.presence,
      });
    }

    // 2. Guildas
    for (const g of guilds) {
      list.push({
        id: `guild-${g.guildId}`,
        type: "guild",
        title: g.name,
        subtitle: "Servidor",
        avatarUrl: g.avatarUrl,
        guildId: g.guildId,
      });

      // 3. Canais de cada guilda
      const guildChannels = channelsByGuild[g.guildId] || [];
      for (const c of guildChannels) {
        list.push({
          id: `channel-${c.channelId}`,
          type: c.type === "voice" ? "voice_channel" : "text_channel",
          title: c.name,
          subtitle: g.name,
          guildId: g.guildId,
          channelId: c.channelId,
        });
      }
    }

    return list;
  }, [friends, guilds, channelsByGuild]);

  // Filter items by query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 20); // Top 20 itens recentes / padrão

    const isChannelSearch = q.startsWith("#");
    const isFriendSearch = q.startsWith("@");
    const cleanQ = isChannelSearch || isFriendSearch ? q.slice(1) : q;

    return allItems
      .filter((item) => {
        if (isChannelSearch && item.type !== "text_channel" && item.type !== "voice_channel") {
          return false;
        }
        if (isFriendSearch && item.type !== "friend") {
          return false;
        }

        const matchTitle = item.title.toLowerCase().includes(cleanQ);
        const matchSubtitle = item.subtitle?.toLowerCase().includes(cleanQ);
        return matchTitle || matchSubtitle;
      })
      .slice(0, 30);
  }, [allItems, query]);

  // Keep selection bounded
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Navigation action on selection
  const handleSelectItem = (item: QuickItem) => {
    if (item.type === "friend") {
      setActiveGuild("home");
      if (item.directRoomId) {
        setActiveChannel(item.directRoomId);
      }
    } else if (item.type === "guild") {
      if (item.guildId) {
        setActiveGuild(item.guildId);
      }
    } else if (item.type === "text_channel" || item.type === "voice_channel") {
      if (item.guildId && item.channelId) {
        setActiveGuild(item.guildId);
        setActiveChannel(item.channelId);
      }
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredItems[selectedIndex];
      if (current) {
        handleSelectItem(current);
      }
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full sm:max-w-[560px] p-0 rounded-2xl border border-white/[0.08] bg-[#12161f]/95 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 gap-0 text-txt"
      >
        <DialogTitle className="sr-only">Busca Rápida Global</DialogTitle>
        <DialogDescription className="sr-only">
          Navegue rapidamente para canais, amigos ou servidores.
        </DialogDescription>

        {/* Input de Busca Spotlight */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.02]">
          <MagnifyingGlass size={18} className="text-acc shrink-0 mr-3" weight="bold" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Para onde você quer ir? (#canal, @amigo ou servidor...)"
            className="w-full bg-transparent text-sm text-txt placeholder:text-mut/60 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-mut">
            ESC para fechar
          </kbd>
        </div>

        {/* Lista de Resultados */}
        <div className="max-h-[360px] overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`cursor-pointer w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? "bg-acc/15 text-txt border border-acc/30 shadow-xs"
                      : "text-mut hover:bg-white/[0.03] hover:text-txt"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Ícone ou Avatar */}
                    {item.type === "friend" ? (
                      <div className="relative shrink-0">
                        {item.avatarUrl ? (
                          <MxcImage
                            mxcUrl={item.avatarUrl}
                            alt={item.title}
                            className="w-7 h-7 rounded-full object-cover border border-white/[0.08]"
                            width={28}
                            height={28}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-acc/15 text-acc flex items-center justify-center font-bold text-xs">
                            {item.title[0]?.toUpperCase() || "A"}
                          </div>
                        )}
                        {item.status && (
                          <span
                            className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-[#12161f] ${
                              item.status === "online" ? "bg-online" : "bg-mut/60"
                            }`}
                          />
                        )}
                      </div>
                    ) : item.type === "guild" ? (
                      <div className="w-7 h-7 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 text-acc">
                        <Buildings size={16} weight="bold" />
                      </div>
                    ) : item.type === "voice_channel" ? (
                      <div className="w-7 h-7 rounded-xl bg-online/10 text-online border border-online/20 flex items-center justify-center shrink-0">
                        <SpeakerHigh size={15} weight="bold" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-xl bg-white/[0.06] text-mut flex items-center justify-center shrink-0">
                        <Hash size={15} weight="bold" />
                      </div>
                    )}

                    {/* Texto principal e subtítulo */}
                    <div className="min-w-0">
                      <div className="font-semibold text-txt truncate flex items-center gap-1.5">
                        {item.type === "text_channel" && <span className="text-mut/60">#</span>}
                        <span>{item.title}</span>
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-mut/70 truncate">{item.subtitle}</div>
                      )}
                    </div>
                  </div>

                  {/* Badge de Categoria */}
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-mut/80">
                      {item.type === "text_channel"
                        ? "Canal"
                        : item.type === "voice_channel"
                          ? "Voz"
                          : item.type === "friend"
                            ? "Amigo"
                            : "Servidor"}
                    </span>
                    {isSelected && (
                      <ArrowElbowDownLeft size={14} className="text-acc" weight="bold" />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-mut/60">
              Nenhum canal, amigo ou servidor encontrado para &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="px-4 py-2 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-[11px] text-mut/60 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ navegar</span>
            <span>↵ selecionar</span>
          </div>
          <span>Echo Quick Switcher</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}


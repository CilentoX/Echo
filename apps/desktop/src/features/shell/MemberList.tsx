import { useState, useMemo } from "react";
import { useSyncStore, selectMembers } from "@/stores/syncStore";
import type { MemberSummary } from "@/lib/matrix/types";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import MemberDropdownContent from "./MemberDropdownContent";
import MemberContextMenu from "./MemberContextMenu";
import MxcImage from "@/components/media/MxcImage";

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
  const myUserId = useUiStore((state) => state.myUserId);
  const presenceMap = useUiStore((state) => state.presence);
  const myAppwriteAvatarUrl = useProfileStore((state) => state.appwriteAvatarUrl);
  const myAvatarUrl = useProfileStore((state) => state.avatarUrl);
  const myDisplayName = useProfileStore((state) => state.displayName);
  const myCustomStatus = useProfileStore((state) => state.customStatus);
  const myPresence = useProfileStore((state) => state.presence);
  const speakingMembers = useVoiceStore((state) => state.speakingMembers);
  const isVoiceConnected = useVoiceStore((state) => state.isConnected);
  const activeVoiceGuildId = useVoiceStore((state) => state.activeVoiceGuildId);
  const voiceParticipants = useVoiceStore((state) => state.participants);
  const isMeSpeaking = useVoiceStore((state) => state.isSpeaking);
  const microphoneEnabled = useSettingsStore((state) => state.microphoneEnabled);
  const headphonesEnabled = useSettingsStore((state) => state.headphonesEnabled);

  const getMemberPresence = (m: MemberSummary): "online" | "offline" | "unavailable" => {
    if (m.userId === myUserId) {
      if (myPresence === "offline") return "offline";
      if (myPresence === "unavailable" || myPresence === "dnd" || myPresence === "idle") return "unavailable";
      return "online";
    }
    const live = presenceMap[m.userId];
    if (live !== undefined) return live;
    if (m.presence === "online" || m.presence === "unavailable") return m.presence;
    return "offline";
  };

  // Canais da guilda ativa (para agregar membros quando não há canal selecionado).
  const channelsByGuild = useSyncStore((state) => state.channelsByGuild);
  const allMembersByRoom = useSyncStore((state) => state.membersByRoom);
  const guildProfiles = useSyncStore((state) =>
    activeGuildId && activeGuildId !== "home" ? state.guildMemberProfiles[activeGuildId] : undefined,
  );

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
    if (myUserId != null && !seen.has(myUserId)) {
      merged.push({
        userId: myUserId,
        displayName: myUserId.replace(/^@/, ''),
        presence: "online",
        avatarUrl: myAppwriteAvatarUrl ?? myAvatarUrl ?? null,
      });
    }
    return merged;
  }, [channelsByGuild, activeGuildId, allMembersByRoom, myUserId, myAppwriteAvatarUrl, myAvatarUrl]);

  // Em guildas, exibe os membros da guilda inteira (ergonomia Discord); combina com channelMembers defensivamente.
  const members: MemberSummary[] = useMemo(() => {
    const raw = (() => {
      if (activeGuildId && activeGuildId !== "home") {
        if (channelMembers.length > 0 && guildMembers.length > 0) {
          const map = new Map<string, MemberSummary>();
          for (const m of guildMembers) map.set(m.userId.toLowerCase(), m);
          for (const m of channelMembers) map.set(m.userId.toLowerCase(), m);
          return Array.from(map.values());
        }
        if (guildMembers.length > 0) return guildMembers;
        if (channelMembers.length > 0) return [...channelMembers];
        return guildMembers;
      }
      return activeChannelId ? [...channelMembers] : guildMembers;
    })();
    const seen = new Set<string>();
    const deduplicated: MemberSummary[] = [];

    for (const m of raw) {
      const normalizedId = m.userId?.toLowerCase();
      if (normalizedId && !seen.has(normalizedId)) {
        seen.add(normalizedId);
        deduplicated.push(m);
      }
    }

    if (myUserId && !seen.has(myUserId.toLowerCase())) {
      deduplicated.push({
        userId: myUserId,
        displayName: myDisplayName || myUserId.replace(/^@/, "").split(":")[0],
        presence: "online",
        avatarUrl: myAppwriteAvatarUrl ?? myAvatarUrl ?? null,
      });
    }

    return deduplicated;
  }, [activeChannelId, channelMembers, guildMembers, myUserId, myDisplayName, myAppwriteAvatarUrl, myAvatarUrl]);

  const [search, setSearch] = useState("");
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);

  // Agrupa membros por status de presença em tempo real.
  const grouped = useMemo(() => {
    const query = search.toLowerCase().trim();
    const list = members.filter((m) => {
      if (!query) return true;
      const nick = guildProfiles?.[m.userId]?.nickname?.toLowerCase() ?? "";
      const nome = (m.displayName || m.userId || "").toLowerCase();
      return nome.includes(query) || nick.includes(query);
    });
    const groups: Record<string, typeof list> = {
      online: [],
      offline: [],
      unavailable: [],
      idle: [],
    };
    for (const m of list) {
      const p = getMemberPresence(m);
      const key = p === "unavailable" ? "unavailable" : p === "online" ? "online" : "offline";
      groups[key].push(m);
    }
    return groups;
  }, [members, search, presenceMap, myUserId, myPresence]);

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
      className={`flex w-[224px] shrink-0 flex-col border-l border-bd-subtle bg-surf ${overlay
          ? "fixed inset-y-0 right-0 z-20 shadow-lg shadow-black/60"
          : "h-full"
        }`}
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-bd-subtle px-4">
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
      <div className="px-3 py-2 border-b border-bd-subtle">
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut" aria-hidden />
          <input
            type="search"
            placeholder="Buscar membros…"
            aria-label="Buscar membros"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl dark:bg-white/[0.03] bg-card-bg/70 text-xs text-txt border border-bd-subtle outline-none placeholder:text-mut/60 focus:border-acc/50 focus:bg-card-bg focus:ring-1 focus:ring-acc/30 transition-all"
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
                  const effectivePresence = getMemberPresence(member);
                  const presenceColor =
                    effectivePresence === "online"
                      ? "bg-online"
                      : effectivePresence === "unavailable"
                        ? "bg-dnd"
                        : "bg-offline";
                  const guildProfile = guildProfiles?.[member.userId];
                  const guildNick = guildProfile?.nickname;

                  const baseDisplayName = isMe
                    ? (myDisplayName || member.displayName || member.userId.replace(/^@/, "").split(":")[0])
                    : (member.displayName || member.userId.replace(/^@/, "").split(":")[0]);

                  const cleanDisplayName = guildNick || baseDisplayName;
                  const initial = cleanDisplayName.charAt(0).toUpperCase();

                  // Fallback chain: Guild avatar override → Matrix avatar → Appwrite avatar (my user) → local avatarUrl → initials
                  const effectiveAvatarUrl = isMe
                    ? (guildProfile?.avatarUrl ?? member.avatarUrl ?? myAppwriteAvatarUrl ?? myAvatarUrl ?? null)
                    : (guildProfile?.avatarUrl ?? member.avatarUrl ?? null);

                  const isSpeaking = (() => {
                    if (isMe) {
                      return Boolean(
                        isVoiceConnected &&
                        activeVoiceGuildId === activeGuildId &&
                        microphoneEnabled &&
                        headphonesEnabled &&
                        isMeSpeaking
                      );
                    }

                    if (isVoiceConnected && activeVoiceGuildId === activeGuildId) {
                      const part = voiceParticipants.find((p) => p.userId === member.userId);
                      if (part) {
                        if (part.isMuted || part.isDeafened) return false;
                        return Boolean(part.isSpeaking || speakingMembers.includes(member.userId));
                      }
                    }

                    return false;
                  })();

                  return (
                    <li
                      key={member.userId}
                      className="relative cursor-grab active:cursor-grabbing"
                      draggable={true}
                      onDragStart={(e) => {
                        const payload = JSON.stringify({ userId: member.userId, username: cleanDisplayName });
                        e.dataTransfer.setData("application/x-echo-member", payload);
                        e.dataTransfer.setData("text/plain", payload);
                        e.dataTransfer.effectAllowed = "move";
                        (window as any).__ECHO_ACTIVE_DRAG__ = {
                          type: "member",
                          id: member.userId,
                          data: { userId: member.userId, username: cleanDisplayName },
                        };
                      }}
                      onDragEnd={() => {
                        (window as any).__ECHO_ACTIVE_DRAG__ = null;
                      }}
                    >
                      <MemberContextMenu
                        userId={member.userId}
                        displayName={cleanDisplayName}
                        avatarUrl={effectiveAvatarUrl}
                        onOpenProfile={() => setOpenMemberId(member.userId)}
                      >
                        <Popover
                          open={openMemberId === member.userId}
                          onOpenChange={(open) => setOpenMemberId(open ? member.userId : null)}
                        >
                          <PopoverTrigger asChild>
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label={cleanDisplayName}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setOpenMemberId(openMemberId === member.userId ? null : member.userId);
                                }
                              }}
                              className={`cursor-pointer flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition-all active:scale-[0.99] group ${
                                openMemberId === member.userId
                                  ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt"
                                  : isMe
                                  ? "text-mut/70 dark:hover:bg-white/[0.05] hover:bg-black/[0.05] hover:text-txt"
                                  : "text-mut dark:hover:bg-white/[0.05] hover:bg-black/[0.05] hover:text-txt"
                              }`}
                            >
                              <div className="relative w-8 h-8 shrink-0">
                                {effectiveAvatarUrl ? (
                                  <MxcImage
                                    key={`${member.userId}-${effectiveAvatarUrl}`}
                                    mxcUrl={effectiveAvatarUrl}
                                    alt="Avatar"
                                    className={`w-8 h-8 rounded-full object-cover border border-bd-subtle bg-surf2 ring-1 transition-all ${
                                      isSpeaking
                                        ? "ring-2 ring-online shadow-sm shadow-online/30 animate-pulse"
                                        : "ring-bd-subtle group-hover:ring-acc/40"
                                    }`}
                                    width={32}
                                    height={32}
                                  />
                                ) : (
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-xs text-bg bg-acc shadow-sm ring-1 transition-all ${
                                      isSpeaking
                                        ? "ring-2 ring-online shadow-sm shadow-online/30 animate-pulse"
                                        : "ring-bd-subtle group-hover:ring-acc/40"
                                    }`}
                                  >
                                    {initial}
                                  </div>
                                )}
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-rail ${presenceColor}`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-txt truncate">
                                  {cleanDisplayName}
                                </p>
                                {guildNick && guildNick !== baseDisplayName ? (
                                  <p className="text-[10px] text-mut truncate -mt-0.5 font-mono">
                                    @{baseDisplayName}
                                  </p>
                                ) : isMe && myCustomStatus ? (
                                  <p className="text-[10px] text-acc/90 truncate -mt-0.5 flex items-center gap-1 font-medium" title={myCustomStatus.text}>
                                    {myCustomStatus.emoji && <span>{myCustomStatus.emoji}</span>}
                                    <span className="truncate">{myCustomStatus.text}</span>
                                  </p>
                                ) : (member as any).customStatus ? (
                                  <p className="text-[10px] text-mut/80 truncate -mt-0.5 flex items-center gap-1" title={(member as any).customStatus.text}>
                                    {(member as any).customStatus.emoji && <span>{(member as any).customStatus.emoji}</span>}
                                    <span className="truncate">{(member as any).customStatus.text}</span>
                                  </p>
                                ) : null}
                              </div>
                              {isMe && (
                                <span className="ml-auto text-[11px] text-acc/70 font-medium">
                                  (você)
                                </span>
                              )}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent
                            side="left"
                            align="start"
                            sideOffset={12}
                            collisionPadding={16}
                            className="w-auto p-0 border-0 bg-transparent shadow-none max-w-none outline-none"
                          >
                            <MemberDropdownContent
                              userId={member.userId}
                              initialDisplayName={cleanDisplayName}
                              initialAvatarUrl={effectiveAvatarUrl}
                              initialPresence={effectivePresence}
                              onClose={() => setOpenMemberId(null)}
                            />
                          </PopoverContent>
                        </Popover>
                      </MemberContextMenu>
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

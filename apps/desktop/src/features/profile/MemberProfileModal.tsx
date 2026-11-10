"use client";

import { useEffect, useMemo } from "react";
import { X, Hash, UserCircle, Crown } from "@phosphor-icons/react";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import MxcImage from "@/components/media/MxcImage";

/**
 * Modal leve para visualizar o perfil de outro membro ao clicar em uma menção.
 * Mostra avatar, nickname na guilda, displayName do Matrix, cargos e presença.
 */
export default function MemberProfileModal() {
  const memberProfileUserId = useUiStore((s) => s.memberProfileUserId);
  const setMemberProfileUserId = useUiStore((s) => s.setMemberProfileUserId);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const presence = useUiStore((s) => s.presence);
  const guildMemberProfiles = useSyncStore((s) => s.guildMemberProfiles);
  const guildRoles = useSyncStore((s) => s.guildRoles);
  const guildMemberRoles = useSyncStore((s) => s.guildMemberRoles);
  const membersByRoom = useSyncStore((s) => s.membersByRoom);

  const isOpen = Boolean(memberProfileUserId);

  // Resolve member data across all guilds (prefer active guild)
  const memberData = useMemo(() => {
    if (!memberProfileUserId) return null;

    // Try active guild first
    const guildId = activeGuildId && activeGuildId !== "home" ? activeGuildId : null;
    let nickname: string | null = null;
    let avatarUrl: string | null = null;

    if (guildId && guildMemberProfiles[guildId]?.[memberProfileUserId]) {
      const profile = guildMemberProfiles[guildId][memberProfileUserId];
      nickname = profile.nickname;
      avatarUrl = profile.avatarUrl;
    }

    // Fallback: search all guilds for the member
    if (!nickname && !avatarUrl) {
      for (const [, profiles] of Object.entries(guildMemberProfiles)) {
        if (profiles[memberProfileUserId]) {
          nickname = profiles[memberProfileUserId].nickname;
          avatarUrl = profiles[memberProfileUserId].avatarUrl;
          break;
        }
      }
    }

    // Get Matrix display name from membersByRoom
    let displayName: string | null = null;
    for (const members of Object.values(membersByRoom)) {
      const member = members.find((m) => m.userId === memberProfileUserId);
      if (member?.displayName) {
        displayName = member.displayName;
        break;
      }
    }

    // Get roles for this member in the active guild
    const roleIds = guildId ? guildMemberRoles[guildId]?.[memberProfileUserId] ?? [] : [];
    const roles = guildId
      ? roleIds
          .map((rid) => guildRoles[guildId]?.find((r) => r.id === rid))
          .filter(Boolean) as Array<{ id: string; name: string; color?: string | null }>
      : [];

    const userPresence = presence[memberProfileUserId] ?? "offline";

    return {
      userId: memberProfileUserId,
      nickname,
      displayName,
      avatarUrl,
      roles,
      presence: userPresence,
    };
  }, [memberProfileUserId, activeGuildId, guildMemberProfiles, guildRoles, guildMemberRoles, membersByRoom, presence]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMemberProfileUserId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setMemberProfileUserId]);

  // Clear memberProfileUserId when closing
  const handleClose = () => {
    setMemberProfileUserId(null);
  };

  if (!isOpen || !memberData) return null;

  const displayLabel = memberData.nickname || memberData.displayName || memberData.userId;
  const presenceColor =
    memberData.presence === "online"
      ? "bg-online"
      : memberData.presence === "unavailable"
        ? "bg-amber-400"
        : "bg-mut/40";
  const presenceLabel =
    memberData.presence === "online"
      ? "Online"
      : memberData.presence === "unavailable"
        ? "Ausente"
        : "Offline";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150">
      {/* Backdrop click closes */}
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative w-full max-w-sm rounded-2xl border border-bd bg-card-bg shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Banner gradient */}
        <div className="h-24 bg-gradient-to-br from-acc/30 via-acc/10 to-transparent" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/30 text-white/80 hover:bg-black/50 hover:text-white transition-all cursor-pointer backdrop-blur-sm"
          aria-label="Fechar perfil"
        >
          <X size={16} weight="bold" />
        </button>

        {/* Avatar overlapping banner */}
        <div className="px-6 -mt-10 flex flex-col items-center">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-card-bg overflow-hidden bg-surf2 shadow-lg">
              {memberData.avatarUrl ? (
                <MxcImage
                  mxcUrl={memberData.avatarUrl}
                  alt={displayLabel}
                  className="w-full h-full object-cover"
                  width={80}
                  height={80}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-acc text-bg font-display text-2xl font-bold">
                  {displayLabel.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* Presence indicator */}
            <div
              className={`absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-card-bg ${presenceColor}`}
              title={presenceLabel}
            />
          </div>

          {/* Name */}
          <h2 className="mt-3 text-lg font-display font-bold text-txt text-center leading-tight">
            {displayLabel}
          </h2>

          {/* Username / MXID */}
          <p className="text-xs text-mut font-mono mt-1 truncate max-w-full">{memberData.userId}</p>

          {/* Presence badge */}
          <span className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
            memberData.presence === "online"
              ? "bg-online/15 text-online border border-online/20"
              : "bg-white/[0.05] text-mut border border-white/[0.08]"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${presenceColor}`} />
            {presenceLabel}
          </span>
        </div>

        {/* Roles section */}
        {memberData.roles.length > 0 && (
          <div className="mt-4 px-6 pb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Crown size={12} weight="bold" className="text-acc" />
              <span className="text-[10px] font-semibold text-mut uppercase tracking-wider">Cargos</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {memberData.roles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border"
                  style={{
                    color: role.color || undefined,
                    borderColor: role.color ? `${role.color}33` : undefined,
                    backgroundColor: role.color ? `${role.color}15` : undefined,
                  }}
                >
                  {role.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="mt-2 px-6 py-4 border-t border-white/[0.06] bg-black/10 space-y-2">
          <div className="flex items-center gap-2 text-xs text-mut">
            <UserCircle size={14} />
            <span>Membro da comunidade</span>
          </div>
          {activeGuildId && activeGuildId !== "home" && (
            <div className="flex items-center gap-2 text-xs text-mut">
              <Hash size={14} />
              <span className="truncate">
                Guilda: {useSyncStore.getState().guilds.find((g) => g.guildId === activeGuildId)?.name ?? activeGuildId}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
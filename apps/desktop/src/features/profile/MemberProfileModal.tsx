"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Hash,
  UserCircle,
  Crown,
  At,
  Chats,
  UserPlus,
  UserMinus,
  Copy,
  Prohibit,
  Check,
  Info,
} from "@phosphor-icons/react";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { echoApi } from "@/lib/matrix/instance";
import MxcImage from "@/components/media/MxcImage";

/**
 * Modal completo para visualizar o perfil de outro membro ao clicar em uma menção.
 * Design estilo Discord: banner com gradiente, avatar sobreposto, bio, cargos, presença e info da guilda.
 */
export default function MemberProfileModal() {
  const memberProfileUserId = useUiStore((s) => s.memberProfileUserId);
  const setMemberProfileUserId = useUiStore((s) => s.setMemberProfileUserId);
  const myUserId = useUiStore((s) => s.myUserId);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const presence = useUiStore((s) => s.presence);
  const guildMemberProfiles = useSyncStore((s) => s.guildMemberProfiles);
  const guildRoles = useSyncStore((s) => s.guildRoles);
  const guildMemberRoles = useSyncStore((s) => s.guildMemberRoles);
  const membersByRoom = useSyncStore((s) => s.membersByRoom);
  const guilds = useSyncStore((s) => s.guilds);

  // Friends state for action buttons
  const friends = useFriendsStore((s) => s.friends);
  const blocked = useFriendsStore((s) => s.blocked);
  const pendingOutgoing = useFriendsStore((s) => s.pendingOutgoing);
  const friendsLoading = useFriendsStore((s) => s.loading);

  const isOpen = Boolean(memberProfileUserId);
  const isMe = memberProfileUserId === myUserId;
  const isFriend = friends.some((f) => f.userId === memberProfileUserId);
  const isBlocked = blocked.some((b) => b.user?.userId === memberProfileUserId);
  const isPending = pendingOutgoing.some((p) => p.user?.userId === memberProfileUserId);
  const [copiedId, setCopiedId] = useState(false);
  const [fullProfile, setFullProfile] = useState<{
    bio: string | null;
    bannerUrl: string | null;
    links: Array<{ label: string; url: string }>;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch full profile from API when modal opens
  useEffect(() => {
    if (!isOpen || !memberProfileUserId) {
      setFullProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    echoApi
      .getUserProfile(memberProfileUserId)
      .then((data) => {
        if (!cancelled) {
          setFullProfile({
            bio: data.bio ?? null,
            bannerUrl: data.bannerUrl ?? null,
            links: [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFullProfile(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, memberProfileUserId]);

  // Resolve member data across all guilds (prefer active guild)
  const memberData = useMemo(() => {
    if (!memberProfileUserId) return null;

    const guildId = activeGuildId && activeGuildId !== "home" ? activeGuildId : null;
    let nickname: string | null = null;
    let avatarUrl: string | null = null;

    // Try active guild first
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

    // Get Matrix display name and avatar from membersByRoom
    let displayName: string | null = null;
    let matrixAvatarUrl: string | null = null;
    for (const members of Object.values(membersByRoom)) {
      const member = members.find((m) => m.userId === memberProfileUserId);
      if (member) {
        if (member.displayName && !displayName) displayName = member.displayName;
        if ((member as any).avatarUrl && !matrixAvatarUrl) {
          matrixAvatarUrl = (member as any).avatarUrl;
        }
        if (displayName && matrixAvatarUrl) break;
      }
    }

    // Prefer guild avatar, fallback to Matrix avatar
    const effectiveAvatar = avatarUrl || matrixAvatarUrl;

    // Get roles for this member in the active guild
    const roleIds = guildId ? guildMemberRoles[guildId]?.[memberProfileUserId] ?? [] : [];
    const roles = guildId
      ? roleIds
          .map((rid) => guildRoles[guildId]?.find((r) => r.id === rid))
          .filter(Boolean) as Array<{ id: string; name: string; color?: string | null }>
      : [];

    // Sort roles by position (if available) or alphabetically
    roles.sort((a, b) => a.name.localeCompare(b.name));

    const userPresence = presence[memberProfileUserId] ?? "offline";

    // Extract username from MXID
    const mxidUsername = memberProfileUserId.replace(/^@/, "").split(":")[0];

    // Get guild name
    const guildName = guildId
      ? guilds.find((g) => g.guildId === guildId)?.name ?? guildId
      : null;

    return {
      userId: memberProfileUserId,
      nickname,
      displayName,
      mxidUsername,
      avatarUrl: effectiveAvatar,
      roles,
      presence: userPresence,
      guildName,
      guildId,
    };
  }, [memberProfileUserId, activeGuildId, guildMemberProfiles, guildRoles, guildMemberRoles, membersByRoom, presence, guilds]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMemberProfileUserId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setMemberProfileUserId]);

  const handleClose = () => {
    setMemberProfileUserId(null);
  };

  // Action handlers
  const handleDirectMessage = async () => {
    if (!memberProfileUserId) return;
    try {
      await useFriendsStore.getState().openDirectMessage(memberProfileUserId);
      handleClose();
    } catch {
      // Fallback gracioso — erro já tratado no store
    }
  };

  const handleAddFriend = async () => {
    if (!memberProfileUserId) return;
    try {
      await useFriendsStore.getState().sendFriendRequest(memberProfileUserId);
    } catch {
      // Fallback
    }
  };

  const handleRemoveFriend = async () => {
    if (!memberProfileUserId) return;
    const friend = friends.find((f) => f.userId === memberProfileUserId);
    if (!friend) return;
    try {
      await useFriendsStore.getState().removeFriend(friend.friendshipId);
    } catch {
      // Fallback
    }
  };

  const handleBlock = async () => {
    if (!memberProfileUserId) return;
    try {
      await useFriendsStore.getState().blockUser(memberProfileUserId);
    } catch {
      // Fallback
    }
  };

  const handleUnblock = async () => {
    if (!memberProfileUserId) return;
    const entry = blocked.find((b) => b.user?.userId === memberProfileUserId);
    if (!entry) return;
    try {
      await useFriendsStore.getState().unblockUser(entry.friendshipId || memberProfileUserId);
    } catch {
      // Fallback
    }
  };

  const handleMention = () => {
    if (!memberProfileUserId || !memberData) return;
    const cleanNick = (memberData.nickname || memberData.displayName || memberData.mxidUsername).replace(/\s+/g, "");
    const mentionText = `@${cleanNick} `;
    window.dispatchEvent(
      new CustomEvent("echo:insert-mention", { detail: { userId: memberProfileUserId, mentionText } }),
    );
    handleClose();
  };

  const handleCopyId = async () => {
    if (!memberProfileUserId) return;
    try {
      await navigator.clipboard.writeText(memberProfileUserId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (!isOpen || !memberData) return null;

  const displayLabel = memberData.nickname || memberData.displayName || memberData.mxidUsername;
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

  // Determine banner style based on top role color or default gradient
  const topRoleColor = memberData.roles.length > 0 ? memberData.roles[0].color : null;
  const bannerStyle = topRoleColor
    ? { background: `linear-gradient(135deg, ${topRoleColor}40, ${topRoleColor}15, transparent)` }
    : undefined;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150">
      {/* Backdrop click closes */}
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-card-bg shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Banner area with gradient or custom banner */}
        <div
          className="h-32 relative bg-gradient-to-br from-acc/30 via-acc/10 to-transparent overflow-hidden"
          style={fullProfile?.bannerUrl ? undefined : bannerStyle}
        >
          {fullProfile?.bannerUrl && (
            <MxcImage
              mxcUrl={fullProfile.bannerUrl}
              alt="Banner"
              className="absolute inset-0 w-full h-full object-cover"
              width={400}
              height={128}
            />
          )}
          {/* Decorative pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/30 text-white/80 hover:bg-black/50 hover:text-white transition-all cursor-pointer backdrop-blur-sm z-10"
            aria-label="Fechar perfil"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Avatar overlapping banner */}
        <div className="px-6 -mt-12 relative z-10">
          <div className="relative inline-block">
            <div className="h-24 w-24 rounded-full border-[5px] border-card-bg overflow-hidden bg-surf2 shadow-xl">
              {memberData.avatarUrl ? (
                <MxcImage
                  mxcUrl={memberData.avatarUrl}
                  alt={displayLabel}
                  className="w-full h-full object-cover"
                  width={96}
                  height={96}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-acc to-acc/60 text-bg font-display text-3xl font-bold">
                  {displayLabel.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* Presence indicator */}
            <div
              className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-[3px] border-card-bg ${presenceColor}`}
              title={presenceLabel}
            />
          </div>
        </div>

        {/* Name & identity section */}
        <div className="px-6 mt-3">
          <h2 className="text-xl font-display font-bold text-txt leading-tight truncate">
            {displayLabel}
          </h2>

          {/* Username / handle */}
          <div className="flex items-center gap-1.5 mt-1">
            <At size={12} className="text-mut" />
            <p className="text-sm text-mut font-medium truncate">{memberData.mxidUsername}</p>
          </div>

          {/* Presence badge */}
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
              memberData.presence === "online"
                ? "bg-online/15 text-online border border-online/20"
                : "bg-white/[0.05] text-mut border border-white/[0.08]"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${presenceColor}`} />
              {presenceLabel}
            </span>
          </div>
        </div>

        {/* Bio section */}
        {fullProfile?.bio && (
          <div className="px-6 mt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Info size={12} weight="bold" className="text-acc" />
              <span className="text-[10px] font-bold text-mut uppercase tracking-wider">Sobre</span>
            </div>
            <p className="text-sm text-txt/90 leading-relaxed whitespace-pre-wrap break-words">
              {fullProfile.bio}
            </p>
          </div>
        )}

        {/* Loading indicator for profile fetch */}
        {profileLoading && !fullProfile && (
          <div className="px-6 mt-4">
            <div className="h-16 rounded-lg bg-white/[0.03] animate-pulse" />
          </div>
        )}

        {/* Divider */}
        <div className="mx-6 mt-4 border-t border-white/[0.06]" />

        {/* Roles section */}
        {memberData.roles.length > 0 && (
          <div className="px-6 mt-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Crown size={12} weight="bold" className="text-acc" />
              <span className="text-[10px] font-bold text-mut uppercase tracking-wider">Cargos</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {memberData.roles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border"
                  style={{
                    color: role.color || undefined,
                    borderColor: role.color ? `${role.color}40` : undefined,
                    backgroundColor: role.color ? `${role.color}18` : undefined,
                  }}
                >
                  {role.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Guild info section */}
        <div className="px-6 mt-4 pb-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs text-mut">
            <UserCircle size={14} className="text-acc/70" />
            <span>Membro da comunidade Echo</span>
          </div>

          {memberData.guildName && (
            <div className="flex items-center gap-2 text-xs text-mut">
              <Hash size={14} className="text-acc/70" />
              <span className="truncate">
                <span className="text-mut/60">Guilda:</span>{" "}
                <span className="text-txt/80 font-medium">{memberData.guildName}</span>
              </span>
            </div>
          )}

          {/* MXID full reference (monospace, subtle) */}
          <div className="pt-2 mt-1 border-t border-white/[0.04]">
            <p className="text-[10px] text-mut/50 font-mono truncate select-all" title={memberData.userId}>
              {memberData.userId}
            </p>
          </div>
        </div>

        {/* Action Bar — botões de interação com o membro */}
        {!isMe && (
          <div className="px-6 pb-5 pt-1">
            <div className="flex flex-wrap gap-2">
              {/* Mensagem Direta — sempre disponível */}
              <button
                type="button"
                onClick={handleDirectMessage}
                disabled={friendsLoading}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-acc text-bg text-xs font-bold hover:bg-acc/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Abrir mensagem direta"
              >
                <Chats size={14} weight="fill" />
                <span>Mensagem</span>
              </button>

              {/* Adicionar / Remover Amigo */}
              {isFriend ? (
                <button
                  type="button"
                  onClick={handleRemoveFriend}
                  disabled={friendsLoading}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-err/15 text-err border border-err/30 text-xs font-semibold hover:bg-err/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Desfazer amizade"
                >
                  <UserMinus size={14} weight="bold" />
                  <span>Remover Amigo</span>
                </button>
              ) : isPending ? (
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] text-mut border border-white/[0.08] text-xs font-semibold cursor-default"
                  title="Solicitação pendente"
                >
                  <Check size={14} weight="bold" />
                  <span>Solicitado</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddFriend}
                  disabled={friendsLoading || isBlocked}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surf2 text-txt border border-bd-subtle text-xs font-semibold hover:bg-surf2/80 hover:border-acc/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Enviar solicitação de amizade"
                >
                  <UserPlus size={14} weight="bold" />
                  <span>Adicionar Amigo</span>
                </button>
              )}

              {/* Mencionar */}
              <button
                type="button"
                onClick={handleMention}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surf2 text-txt border border-bd-subtle text-xs font-semibold hover:bg-surf2/80 hover:border-acc/40 active:scale-95 transition-all"
                title="Inserir menção no chat"
              >
                <At size={14} weight="bold" />
                <span>Mencionar</span>
              </button>

              {/* Copiar ID */}
              <button
                type="button"
                onClick={handleCopyId}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surf2 text-txt border border-bd-subtle text-xs font-semibold hover:bg-surf2/80 hover:border-acc/40 active:scale-95 transition-all"
                title="Copiar ID do usuário"
              >
                {copiedId ? <Check size={14} weight="bold" className="text-online" /> : <Copy size={14} weight="bold" />}
                <span>{copiedId ? "Copiado!" : "Copiar ID"}</span>
              </button>

              {/* Bloquear / Desbloquear */}
              {isBlocked ? (
                <button
                  type="button"
                  onClick={handleUnblock}
                  disabled={friendsLoading}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-online/15 text-online border border-online/30 text-xs font-semibold hover:bg-online/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Desbloquear usuário"
                >
                  <Check size={14} weight="bold" />
                  <span>Desbloquear</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBlock}
                  disabled={friendsLoading}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-err/10 text-err/80 border border-err/20 text-xs font-semibold hover:bg-err/20 hover:text-err active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Bloquear usuário"
                >
                  <Prohibit size={14} weight="bold" />
                  <span>Bloquear</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
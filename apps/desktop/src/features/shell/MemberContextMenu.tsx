"use client";

import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  User,
  Chats,
  At,
  UserPlus,
  UserMinus,
  Copy,
  SpeakerSimpleSlash,
  SpeakerSimpleHigh,
} from "@phosphor-icons/react";
import { useUiStore } from "@/stores/uiStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { matrixService } from "@/lib/matrix/instance";

export interface MemberContextMenuProps {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
  onOpenProfile?: () => void;
}

export default function MemberContextMenu({
  userId,
  displayName,
  children,
  onOpenProfile,
}: MemberContextMenuProps) {
  const myUserId = useUiStore((s) => s.myUserId ?? "");
  const activeVoiceChannelId = useVoiceStore((s) => s.activeVoiceChannelId);
  const voiceParticipants = useVoiceStore((s) => s.participants);
  const isMe = userId === myUserId || (typeof matrixService?.getUserId === "function" && userId === matrixService.getUserId());

  const friends = useFriendsStore((s) => s.friends);
  const isFriend = friends.some((f) => f.userId === userId);

  const voiceParticipant = voiceParticipants.find((p) => p.userId === userId);
  const isVoiceMuted = voiceParticipant?.isMuted ?? false;

  const effectiveName =
    displayName ||
    userId.replace(/^@/, "").split(":")[0] ||
    "Membro";

  const handleOpenProfile = () => {
    if (isMe) {
      useUiStore.getState().setProfileOpen(true);
    } else if (onOpenProfile) {
      onOpenProfile();
    }
  };

  const handleDirectMessage = async () => {
    try {
      await useFriendsStore.getState().openDirectMessage(userId);
    } catch {
      // Fallback gracioso
    }
  };

  const handleMention = () => {
    // Insere menção no composer se houver canal ativo
    const cleanNick = effectiveName.replace(/\s+/g, "");
    const mentionText = `@${cleanNick} `;
    // Dispara evento customizado para o Composer capturar se necessário
    window.dispatchEvent(
      new CustomEvent("echo:insert-mention", { detail: { userId, mentionText } })
    );
  };

  const handleAddFriend = async () => {
    try {
      await useFriendsStore.getState().sendFriendRequest(userId);
    } catch {
      // Fallback
    }
  };

  const handleRemoveFriend = async () => {
    try {
      await useFriendsStore.getState().removeFriend(userId);
    } catch {
      // Fallback
    }
  };

  const handleCopyUserId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
    } catch {
      // Fallback
    }
  };

  const handleToggleVoiceMute = () => {
    useVoiceStore.getState().toggleMute(userId);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="truncate text-txt font-semibold flex items-center justify-between">
          <span className="truncate">{effectiveName}</span>
          <span className="text-[10px] font-mono text-mut/60 truncate max-w-[80px]">
            {isMe ? "(você)" : `@${userId.replace(/^@/, "").split(":")[0]}`}
          </span>
        </ContextMenuLabel>
        <ContextMenuSeparator />

        {/* Ver Perfil */}
        <ContextMenuItem onClick={handleOpenProfile}>
          <User size={15} weight="bold" className="text-acc" />
          <span>Ver Perfil</span>
        </ContextMenuItem>

        {!isMe && (
          <>
            {/* Mensagem Direta */}
            <ContextMenuItem onClick={handleDirectMessage}>
              <Chats size={15} weight="bold" className="text-acc" />
              <span>Mensagem Direta</span>
            </ContextMenuItem>

            {/* Mencionar */}
            <ContextMenuItem onClick={handleMention}>
              <At size={15} weight="bold" />
              <span>Mencionar</span>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Amizade */}
            {isFriend ? (
              <ContextMenuItem destructive onClick={handleRemoveFriend}>
                <UserMinus size={15} weight="bold" />
                <span>Desfazer Amizade</span>
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onClick={handleAddFriend}>
                <UserPlus size={15} weight="bold" />
                <span>Adicionar Amigo</span>
              </ContextMenuItem>
            )}
          </>
        )}

        {/* Controles de Voz (se estiver na mesma chamada) */}
        {activeVoiceChannelId && voiceParticipant && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleToggleVoiceMute}>
              {isVoiceMuted ? (
                <>
                  <SpeakerSimpleHigh size={15} weight="bold" className="text-online" />
                  <span>Reativar Áudio</span>
                </>
              ) : (
                <>
                  <SpeakerSimpleSlash size={15} weight="bold" className="text-err" />
                  <span>Silenciar no Canal</span>
                </>
              )}
            </ContextMenuItem>

            {!isMe && (
              <div
                className="px-2.5 py-2 space-y-1.5 border-t border-white/[0.04]"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between text-[11px] text-mut">
                  <span className="font-medium">Volume do Usuário</span>
                  <span className="font-mono text-acc font-bold">
                    {voiceParticipant.volume ?? 100}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="1"
                  value={voiceParticipant.volume ?? 100}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    useVoiceStore.getState().setParticipantVolume(userId, val);
                  }}
                  className="w-full h-1.5 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-[#0FB9A8]"
                />
              </div>
            )}
          </>
        )}

        <ContextMenuSeparator />

        {/* Copiar ID */}
        <ContextMenuItem onClick={handleCopyUserId}>
          <Copy size={15} weight="bold" />
          <span>Copiar ID do Usuário</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

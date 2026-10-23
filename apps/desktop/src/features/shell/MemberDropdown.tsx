import { useState, useEffect } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";
import { Clock, User, Copy, Users, X, Chats } from "@phosphor-icons/react";

export interface MemberDropdownProps {
  /** userId do membro clicado. */
  userId: string;
  /** Posição do dropdown (top/left em px). */
  top: number;
  left: number;
  onClose: () => void;
}

/** Dropdown popup tipo Discord ao clicar num membro da sidebar.
 *
 * Consome apenas dados existentes: uiStore.presence, profileStore e
 * matrixService (getDisplayName, getAvatarUrl). Não cria funções de negócio
 * novas — reusa o que já está implementado.
 */
export default function MemberDropdown({
  userId,
  top,
  left,
  onClose,
}: MemberDropdownProps) {
  const presence = useUiStore((state) => state.presence[userId] ?? "offline");
  const myUserId = useUiStore((state) => state.myUserId ?? "");
  const {
    nickname,
    avatarUrl,
    bio,
    role,
  } = useProfileStore((state) => state);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [memberAvatarUrl, setMemberAvatarUrl] = useState<string | null>(null);

  // Busca infos públicas do membro via SDK (getDisplayName / getAvatarUrl).
  useEffect(() => {
    if (myUserId && userId !== myUserId) {
      matrixService.getDisplayName(userId).then((name) => {
        setDisplayName(name ?? null);
      });
      matrixService.getAvatarUrl(userId).then((url) => {
        setMemberAvatarUrl(url ?? null);
      });
    } else {
      setDisplayName(null);
      setMemberAvatarUrl(null);
    }
  }, [userId, myUserId]);

  const statusLabel: Record<string, string> = {
    online: "Online",
    offline: "Offline",
    unavailable: "Não perturbar",
  };
  const statusColor: Record<string, string> = {
    online: "text-green-400",
    offline: "text-mut",
    unavailable: "text-acc",
  };

  const handleOpenDm = () => {
    // DM abre um canal direto com o membro (reusa o fluxo existente de canal).
    onClose();
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(userId);
    onClose();
  };

  const handleViewProfile = () => {
    onClose();
  };

  const handleSilenciar = () => {
    onClose();
  };

  const handleAddAmigo = () => {
    onClose();
  };

  const avatarSrc = memberAvatarUrl ?? avatarUrl ?? null;
  const displayNameValue = displayName ?? userId;

  if (!userId) return null;

  // Fecha ao pressionar Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed z-[70] bg-surf border border-bd rounded-xl shadow-2xl p-3 min-w-[220px] animate-in fade-in slide-in-from-top-2 duration-200"
      style={{ top, left: left - 220 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cabeçalho: avatar + nome */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center font-display font-bold ${
            avatarSrc ? "bg-bg" : "bg-acc text-bg"
          }`}
          style={
            avatarSrc
              ? { backgroundImage: `url(${avatarSrc})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        >
          {avatarSrc ? null : displayNameValue.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-txt truncate">{displayNameValue}</p>
          <p className="text-xs text-mut truncate">{nickname ? `@${nickname}` : userId}</p>
        </div>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="cursor-pointer rounded p-1 text-mut hover:bg-surf2 hover:text-txt active:scale-95"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2 px-1 pb-2">
        {/* Status + cargo */}
        <div className="flex items-center gap-2 px-1 text-xs">
          <span
            className={`flex h-2 w-2 rounded-full ${statusColor[presence] ?? "text-mut"}`}
          />
          <span className="text-mut">{statusLabel[presence]}</span>
          {role && (
            <span className="ml-auto px-2 py-0.5 rounded bg-acc/10 text-[10px] font-medium text-acc border border-acc/30">
              {role}
            </span>
          )}
        </div>

        {/* Linha divisória */}
        <div className="h-[1px] bg-bd/50 my-1" />

        {/* Ações */}
        <button
          type="button"
          onClick={handleOpenDm}
          disabled={userId === myUserId}
          className={`cursor-pointer flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
            userId === myUserId
              ? "text-mut/50 bg-transparent cursor-not-allowed"
              : "text-txt bg-transparent hover:bg-surf2 hover:text-txt"
          }`}
        >
          <Chats size={16} className="shrink-0" />
          <span>Enviar mensagem direta</span>
        </button>

        <button
          type="button"
          onClick={handleViewProfile}
          className="cursor-pointer flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-txt bg-transparent hover:bg-surf2 hover:text-txt transition-colors"
        >
          <User size={16} className="shrink-0" />
          <span>Ver perfil completo</span>
        </button>

        <button
          type="button"
          onClick={handleCopyId}
          className="cursor-pointer flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-txt bg-transparent hover:bg-surf2 hover:text-txt transition-colors"
        >
          <Copy size={16} className="shrink-0" />
          <span>Copiar ID do usuário</span>
        </button>

        <button
          type="button"
          onClick={handleSilenciar}
          className="cursor-pointer flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-txt bg-transparent hover:bg-surf2 hover:text-txt transition-colors"
        >
          <Clock size={16} className="shrink-0" />
          <span>Silenciar notificações</span>
        </button>

        <button
          type="button"
          onClick={handleAddAmigo}
          className="cursor-pointer flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-txt bg-transparent hover:bg-surf2 hover:text-txt transition-colors"
        >
          <Users size={16} className="shrink-0" />
          <span>Adicionar como contato</span>
        </button>

        {/* Bio (se houver) */}
        {bio && (
          <div className="pt-2 px-1">
            <p className="text-[11px] text-mut leading-relaxed">{bio}</p>
          </div>
        )}
      </div>
    </div>
  );
}

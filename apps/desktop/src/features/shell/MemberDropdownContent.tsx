import { useEffect, useState } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";
import { Chats, User, Copy, Clock, Users } from "@phosphor-icons/react";
import MxcImage from "@/components/media/MxcImage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface MemberDropdownContentProps {
  userId: string;
}

/** Conteúdo do dropdown de membro (aberto via Popover no MemberList). */
export default function MemberDropdownContent({
  userId,
}: MemberDropdownContentProps) {
  const myUserId = useUiStore((state) => state.myUserId ?? "");
  const isMyUser = userId === myUserId;
  const presence = useUiStore((state) => state.presence[userId] ?? "offline");

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const myAvatarUrl = useProfileStore((state) => state.avatarUrl);
  const myBio = useProfileStore((state) => state.bio);
  const myRole = useProfileStore((state) => state.role);

  useEffect(() => {
    let cancelled = false;
    if (isMyUser) {
      setAvatarUrl(myAvatarUrl ?? null);
      setBio(myBio ?? null);
      setRole(myRole ?? null);
      return () => {
        cancelled = true;
      };
    }
    matrixService.getDisplayName(userId).then((name) => {
      if (!cancelled) setDisplayName(name ?? null);
    });
    matrixService.getAvatarUrl(userId).then((url) => {
      if (!cancelled) setAvatarUrl(url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, isMyUser, myAvatarUrl, myBio, myRole]);

  const statusLabel: Record<string, string> = {
    online: "Online",
    offline: "Offline",
    unavailable: "Não perturbar",
  };
  const statusColor: Record<string, string> = {
    online: "bg-online",
    offline: "bg-offline",
    unavailable: "bg-dnd",
  };

  return (
    <div className="w-[220px] flex flex-col gap-1 p-2">
      {/* Cabeçalho: avatar + nome */}
      <div className="flex items-center gap-3 mb-1 px-1">
        <MxcImage
          mxcUrl={avatarUrl ?? null}
          width={40}
          height={40}
          className="rounded-full shrink-0 bg-surf2 text-bg"
          alt="Avatar"
        />
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-txt truncate">
            {displayName ?? userId}
          </p>
          <p className="text-[10px] text-mut truncate">
            {isMyUser ? myUserId.replace(/^@/, '') : userId.replace(/^@/, '')} {isMyUser && " (você)"}
          </p>
        </div>
      </div>

      <div className="w-full flex items-center gap-2 px-1 text-xs mb-1">
        <span
          className={`flex h-2 w-2 rounded-full ${statusColor[presence] ?? "bg-mut"}`}
        />
        <Label className="text-mut">{statusLabel[presence]}</Label>
        {role && (
          <span className="ml-auto px-2 py-0.5 rounded bg-acc/10 text-[10px] font-medium text-acc border border-acc/30">
            {role}
          </span>
        )}
      </div>

      <Separator className="my-1" />

      {/* Ações */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isMyUser}
        className={`w-full justify-start gap-2 text-sm ${
          isMyUser
            ? "text-mut/50 cursor-not-allowed"
            : "text-txt hover:bg-surf2 hover:text-txt"
        }`}
      >
        <Chats size={14} className="shrink-0" />
        <span>Enviar mensagem direta</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt"
      >
        <User size={14} className="shrink-0" />
        <span>Ver perfil completo</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt"
      >
        <Copy size={14} className="shrink-0" />
        <span>Copiar ID do usuário</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt"
      >
        <Clock size={14} className="shrink-0" />
        <span>Silenciar notificações</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt"
      >
        <Users size={14} className="shrink-0" />
        <span>Adicionar como contato</span>
      </Button>

      {bio && (
        <div className="mt-1 px-1">
          <p className="text-[10px] text-mut leading-relaxed">{bio}</p>
        </div>
      )}
    </div>
  );
}

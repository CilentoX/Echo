import { useEffect, useState } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";
import { Chats, User, Copy, Clock, Users, Pencil } from "@phosphor-icons/react";
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
    idle: "Ausente",
  };
  const statusColor: Record<string, string> = {
    online: "bg-online",
    offline: "bg-offline",
    unavailable: "bg-dnd",
    idle: "bg-idle",
  };

  return (
    <div className="w-[260px] flex flex-col gap-1 p-3 bg-bg border border-bd rounded-xl shadow-lg">
      {/* Cabeçalho: avatar + nome + status */}
      <div className="flex items-center gap-3 p-2">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-32 h-32 rounded-full object-cover border border-bd bg-surf2"
            />
          ) : (
            <div className="w-32 h-32 rounded-full flex items-center justify-center font-display font-bold text-txt shadow-lg border-4 border-surf bg-acc">
              {displayName?.charAt(0).toUpperCase() ?? "?"}
            </div>
          )}
          <span
            className={`absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-bg shrink-0 ${
              statusColor[presence] ?? "bg-mut"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-txt truncate">
            {displayName ?? userId.replace(/^@/, "")}
          </p>
          <p className="text-xs text-mut truncate">
            {userId.replace(/^@/, "")} {isMyUser && " (você)"}
          </p>
        </div>
      </div>

      {/* Status e cargo */}
      <div className="w-full flex items-center gap-2 px-2 py-1 text-xs">
        <span
          className={`flex shrink-0 h-3 w-3 rounded-full ${statusColor[presence] ?? "bg-mut"}`}
        />
        <Label className="text-mut text-sm">{statusLabel[presence]}</Label>
        {role && (
          <span className="ml-auto px-2 py-0.5 rounded bg-acc/10 text-xs font-medium text-acc border border-acc/30">
            {role}
          </span>
        )}
      </div>

      <Separator className="my-2" />

      {/* Ações */}
      <div className="flex flex-col gap-1">
        {isMyUser ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              // Abrir perfil próprio
            }}
            className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/40 focus:border-acc rounded-lg"
          >
            <Pencil size={14} className="shrink-0" />
            <span>Editar perfil</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {}}
            className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/40 focus:border-acc rounded-lg"
          >
            <Chats size={14} className="shrink-0" />
            <span>Enviar mensagem direta</span>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {}}
          className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/40 focus:border-acc rounded-lg"
        >
          <User size={14} className="shrink-0" />
          <span>Ver perfil completo</span>
        </Button>
      </div>

      <Separator className="my-2" />

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {}}
          className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/40 focus:border-acc rounded-lg"
        >
          <Copy size={14} className="shrink-0" />
          <span>Copiar ID do usuário</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {}}
          className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/40 focus:border-acc rounded-lg"
        >
          <Clock size={14} className="shrink-0" />
          <span>Silenciar notificações</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {}}
          className="w-full justify-start gap-2 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/40 focus:border-acc rounded-lg"
        >
          <Users size={14} className="shrink-0" />
          <span>Adicionar como contato</span>
        </Button>
      </div>

      {bio && (
        <div className="mt-2 px-2 py-1">
          <p className="text-xs text-mut leading-relaxed">{bio}</p>
        </div>
      )}
    </div>
  );
}

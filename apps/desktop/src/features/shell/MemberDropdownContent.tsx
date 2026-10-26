import { useEffect, useState } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";
import { Chats, User, Copy, Clock, Users, Pencil } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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

  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isMyUser) {
      setAvatarUrl(myAvatarUrl ?? null);
      setBio(myBio ?? null);
      setRole(myRole ?? null);
      setBannerUrl(null);
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
    <div className="w-[256px] flex flex-col gap-2 p-3 bg-bg border border-bd rounded-xl shadow-lg">
      {/* Banner do membro */}
      {bannerUrl && (
        <div className="w-full h-12 rounded-t-xl bg-surf2 overflow-hidden">
          <img
            src={bannerUrl}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Cabeçalho: avatar + nome + status */}
      <div className="flex items-center gap-3 p-2">
        {/* Avatar (estilo Discord - menor) */}
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-12 h-12 rounded-full object-cover border border-bd bg-surf2"
            />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-xs shadow-lg border-4 border-surf bg-acc">
              {displayName?.charAt(0).toUpperCase() ?? "?"}
            </div>
          )}
          {/* Status badge no canto inferior direito do avatar */}
          <span
            className={`absolute bottom-0 right-0 flex h-3 w-3 items-center justify-center rounded-full border-2 border-bg shrink-0 ${
              statusColor[presence] ?? "bg-mut"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          {/* Nome de exibição em destaque */}
          <p className="font-display font-bold text-lg text-txt truncate">
            {displayName ?? userId.replace(/^@/, "")}
          </p>
          {/* @username menor */}
          <p className="text-xs text-mut truncate">
            @{userId.replace(/^@/, "")} {isMyUser && " (você)"}
          </p>
        </div>
      </div>

      {/* Status (linha separada, abaixo do nome) */}
      <div className="w-full flex items-center gap-2 px-3 py-1">
        <span
          className={`flex shrink-0 h-3 w-3 rounded-full ${statusColor[presence] ?? "bg-mut"}`}
        />
        <span className="text-mut text-sm">{statusLabel[presence]}</span>
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
            onClick={() => {}}
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


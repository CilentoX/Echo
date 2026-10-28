"use client";

import { X, Gear, Pencil } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ProfileHeaderProps {
  displayName: string;
  username: string;
  nickname: string | null;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  onClose: () => void;
}

export function ProfileHeader({
  displayName,
  username,
  nickname,
  editing,
  setEditing,
  onClose,
}: ProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <p className="font-display text-xl font-bold text-txt truncate">
              {displayName || username}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-mut">
            <span className="h-2.5 w-2.5 rounded-full bg-online" />
            <span>Online</span>
            <span className="text-mut/50">|</span>
            <span>@{(nickname || username).replace(/^@/, "")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              title="Editar perfil"
              aria-label="Editar perfil"
            >
              <Pencil size={14} className="mr-1" />
              Editar perfil
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="p-2 rounded-xl hover:bg-surf2">
                <Gear size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Configurações
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onClose} className="p-2 rounded-xl hover:bg-surf2">
                <X size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Fechar
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
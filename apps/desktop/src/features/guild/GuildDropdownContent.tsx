"use client"

import { useCallback, useState } from "react"
import { useUiStore } from "@/stores/uiStore"
import { matrixService } from "@/lib/matrix/instance"
import { Chats, Pencil, Gear, Users, Copy } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import ImageUploadButton from "@/components/ImageUploadButton"
import MxcImage from "@/components/media/MxcImage"

export interface GuildDropdownContentProps {
  guildId: string
  guildName: string
  avatarUrl: string | null
  unreadCount: number
  onClose: () => void
}

export default function GuildDropdownContent({
  guildId,
  guildName,
  avatarUrl,
  unreadCount,
  onClose,
}: GuildDropdownContentProps) {
  const activeGuildId = useUiStore((state) => state.activeGuildId)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const isActive = activeGuildId === guildId

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  const handleEditGuild = useCallback(() => {
    showToast("Edição de guilda em breve")
    onClose()
  }, [showToast, onClose])

  const handleGuildSettings = useCallback(() => {
    showToast("Configurações da guilda em breve")
    onClose()
  }, [showToast, onClose])

  const handleInvite = useCallback(() => {
    showToast("Convite copiado")
    onClose()
  }, [onClose])

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(guildId)
      showToast("ID da guilda copiado")
    } catch {
      showToast("Falha ao copiar ID")
    }
    onClose()
  }, [guildId, showToast, onClose])

  const handleLeaveGuild = useCallback(async () => {
    try {
      await matrixService.leaveGuild(guildId)
      showToast("Saiu da guilda")
    } catch {
      showToast("Falha ao sair da guilda")
    }
    onClose()
  }, [guildId, showToast, onClose])

  const handleDeleteGuild = useCallback(async () => {
    if (!confirm(`Tem certeza que deseja excluir "${guildName}"?`)) return
    try {
      await matrixService.deleteGuild(guildId)
      showToast("Guilda excluída")
    } catch {
      showToast("Falha ao excluir guilda")
    }
    onClose()
  }, [guildId, guildName, showToast, onClose])

  return (
    <div
      role="menu"
      className="w-[260px] flex flex-col gap-1 p-3 bg-surf border border-bd rounded-xl shadow-2xl shadow-black/40"
    >
      {/* Cabeçalho da guilda */}
      <div className="flex items-center gap-3 p-2">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <MxcImage
              mxcUrl={avatarUrl}
              alt={guildName}
              className="w-12 h-12 rounded-xl object-cover border border-bd bg-surf2"
              width={48}
              height={48}
            />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-sm text-txt shadow-lg border-4 border-surf bg-acc">
              {guildName.split(" ").map((w) => w[0]).join("").toUpperCase() || "?"}
            </div>
          )}
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-err border-2 border-bd text-[10px] font-bold text-bg"
            >
              {unreadCount}
            </span>
          )}
          <ImageUploadButton
            currentUrl={avatarUrl}
            onUpload={() => {
              showToast("Ícone da guilda atualizado")
            }}
            label=""
            accept="image/*"
            previewSize="sm"
            className="absolute -right-1 -top-1 z-20"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-lg text-txt truncate" title={guildName}>
            {guildName}
          </p>
          {isActive && (
            <p className="text-xs text-mut">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-online" />
                Ativo
              </span>
            </p>
          )}
        </div>
      </div>

      <Separator className="my-1.5" />

      {/* Ações */}
      <div role="none" className="flex flex-col gap-0.5">
        <Button
          type="button"
          role="menuitem"
          variant="ghost"
          size="sm"
          onClick={handleInvite}
          className="w-full justify-start gap-2.5 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/50 rounded-lg"
        >
          <Users size={14} className="shrink-0" />
          <span>Convidar pessoas</span>
        </Button>

        <Button
          type="button"
          role="menuitem"
          variant="ghost"
          size="sm"
          onClick={handleGuildSettings}
          className="w-full justify-start gap-2.5 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/50 rounded-lg"
        >
          <Gear size={14} className="shrink-0" />
          <span>Configurações da guilda</span>
        </Button>

        <Button
          type="button"
          role="menuitem"
          variant="ghost"
          size="sm"
          onClick={handleEditGuild}
          className="w-full justify-start gap-2.5 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/50 rounded-lg"
        >
          <Pencil size={14} className="shrink-0" />
          <span>Editar guilda</span>
        </Button>

        <Button
          type="button"
          role="menuitem"
          variant="ghost"
          size="sm"
          onClick={handleCopyId}
          className="w-full justify-start gap-2.5 text-sm text-txt hover:bg-surf2 hover:text-txt focus:ring-2 focus:ring-acc/50 rounded-lg"
        >
          <Copy size={14} className="shrink-0" />
          <span>Copiar ID da guilda</span>
        </Button>

        <Separator className="my-1" />

        {!isActive && (
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            size="sm"
            onClick={handleLeaveGuild}
            className="w-full justify-start gap-2.5 text-sm text-err hover:bg-err/10 hover:text-err focus:ring-2 focus:ring-err/50 rounded-lg"
          >
            <span>Sair da guilda</span>
          </Button>
        )}

        <Button
          type="button"
          role="menuitem"
          variant="ghost"
          size="sm"
          onClick={handleDeleteGuild}
          className="w-full justify-start gap-2.5 text-sm text-err hover:bg-err/10 hover:text-err focus:ring-2 focus:ring-err/50 rounded-lg"
        >
          <span>Excluir guilda</span>
        </Button>
      </div>

      {toastMessage && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-surf border border-bd bg-acc/10 text-acc text-xs font-medium">
          <Chats size={12} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}

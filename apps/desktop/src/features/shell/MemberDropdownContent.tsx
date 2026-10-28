import { useCallback, useEffect, useState } from "react"
import { useUiStore } from "@/stores/uiStore"
import { useProfileStore } from "@/stores/profileStore"
import { matrixService } from "@/lib/matrix/instance"
import { Chats, User, Copy } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import MxcImage from "@/components/media/MxcImage"

export interface MemberDropdownContentProps {
  userId: string;
}

export default function MemberDropdownContent({
  userId,
}: MemberDropdownContentProps) {
  const myUserId = useUiStore((state) => state.myUserId ?? "")
  const isMyUser = userId === myUserId
  const presence = useUiStore((state) => state.presence[userId] ?? "offline")

  const [displayName, setDisplayName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bio, setBio] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const myAvatarUrl = useProfileStore((state) => state.avatarUrl)
  const myBio = useProfileStore((state) => state.bio)
  const myRole = useProfileStore((state) => state.role)

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const load = async () => {
      if (isMyUser) {
        setAvatarUrl(myAvatarUrl ?? null)
        setBio(myBio ?? null)
        setRole(myRole ?? null)
      }

      const [name, avatar, banner] = await Promise.all([
        matrixService.getDisplayName(userId),
        matrixService.getAvatarUrl(userId),
        matrixService.getUserBanner(userId),
      ])

      if (!cancelled) {
        setDisplayName(name ?? null)
        if (!isMyUser) setAvatarUrl(avatar ?? null)
        setBannerUrl(banner ?? null)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId, isMyUser, myAvatarUrl, myBio, myRole])

  const copyUserId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(userId.replace(/^@/, ""))
      showToast("ID copiado")
    } catch {
      // falha silenciosa
    }
  }, [userId, showToast])

  const openDirectMessage = useCallback(() => {
    showToast("Iniciando mensagem direta")
  }, [showToast])

  const openViewProfile = useCallback(() => {
    showToast("Abrindo perfil completo")
  }, [showToast])

  if (loading) {
    return (
      <div className="w-[300px] flex flex-col p-5 bg-surf border border-bd rounded-2xl shadow-2xl shadow-black/50 animate-pulse">
        <div className="w-full h-20 rounded-xl bg-surf2 mb-4" />
        <div className="flex items-center gap-3 px-2">
          <div className="w-16 h-16 rounded-full bg-surf2 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-6 w-3/4 bg-surf2 rounded" />
            <div className="h-4 w-1/3 bg-surf2 rounded" />
            <div className="h-3 w-28 bg-surf2 rounded" />
          </div>
        </div>
        <div className="w-full flex items-center gap-2 px-4 py-2">
          <div className="h-3 w-3 rounded-full bg-surf2" />
          <div className="h-4 w-20 bg-surf2 rounded" />
        </div>
        <Separator className="my-4" />
        <div className="flex flex-col gap-1 px-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-full rounded-xl bg-surf2" />
          ))}
        </div>
      </div>
    )
  }

  const initial = (displayName ?? cleanUserId(userId)).charAt(0).toUpperCase()

  return (
    <div
      role="menu"
      className="w-[300px] flex flex-col p-5 bg-surf border border-bd rounded-2xl shadow-2xl shadow-black/50"
    >
      {/* Banner do membro com fallback gradiente */}
      <div className="relative w-full h-20 rounded-xl overflow-hidden mb-4">
        {bannerUrl ? (
          <MxcImage
            mxcUrl={bannerUrl}
            alt="Banner"
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-acc/25 via-bg/60 to-surf2 border border-bd/50 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm text-txt shadow-lg border-2 border-surf bg-acc">
              {initial}
            </div>
          </div>
        )}
      </div>

      {/* Cabeçalho: avatar + nome + status */}
      <div className="flex items-center gap-3 px-2">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <MxcImage
              mxcUrl={avatarUrl}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border-2 border-bd bg-surf2"
            />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-sm text-txt shadow-lg border-4 border-surf bg-acc">
              {initial}
            </div>
          )}
          <span
            className={`absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-bg shrink-0 z-10 ${statusColor[presence] ?? "bg-mut"}`}
            aria-label={statusLabel[presence]}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-lg text-txt truncate leading-tight" title={displayName ?? cleanUserId(userId)}>
            {displayName ?? cleanUserId(userId)}
          </p>
          <p className="text-xs text-mut truncate">
            @{cleanUserId(userId)} {isMyUser && " (você)"}
          </p>
          {role && (
            <span className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-acc/10 text-xs font-medium text-acc border border-acc/20">
              {role}
            </span>
          )}
        </div>
      </div>

      {/* Linha de status */}
      <div className="w-full flex items-center gap-2 px-4 py-2">
        <span
          className={`flex shrink-0 h-3 w-3 rounded-full ${statusColor[presence] ?? "bg-mut"}`}
          aria-label={statusLabel[presence]}
        />
        <span className="text-mut text-sm">{statusLabel[presence]}</span>
      </div>

      {/* Toast feedback */}
      {toastMessage && (
        <div className="mx-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-surf border border-bd bg-acc/10 text-acc text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200">
          <Copy size={12} />
          <span>{toastMessage}</span>
        </div>
      )}

      <Separator className="my-4" />

      {/* Ações */}
      <div role="none" className="flex flex-col gap-0.5 px-1">
        <Button
          type="button"
          role="menuitem"
          variant="ghost"
          size="sm"
          onClick={openDirectMessage}
          className={actionButton()}
        >
          <Chats size={14} className="shrink-0" />
          <span>Enviar mensagem direta</span>
        </Button>
        <Button
          type="button"
          role="menuitem"
          variant="ghost"
          size="sm"
          onClick={openViewProfile}
          className={actionButton()}
        >
          <User size={14} className="shrink-0" />
          <span>Ver perfil completo</span>
        </Button>
        <Button
          type="button"
          role="menuitem"
          variant="ghost"
          size="sm"
          onClick={copyUserId}
          className={actionButton()}
        >
          <Copy size={14} className="shrink-0" />
          <span>Copiar ID do usuário</span>
        </Button>
      </div>

      {bio && (
        <div className="mt-4 px-2 py-2.5 rounded-xl bg-surf2 border border-bd/50">
          <p className="text-xs text-mut leading-relaxed">{bio}</p>
        </div>
      )}
    </div>
  )
}

const cleanUserId = (id: string) => id.replace(/^@/, "").replace(/:litteris\.online$/, "")

const statusLabel: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  unavailable: "Não perturbar",
  idle: "Ausente",
}

const statusColor: Record<string, string> = {
  online: "bg-online",
  offline: "bg-offline",
  unavailable: "bg-dnd",
  idle: "bg-idle",
}

const actionButton = (className?: string) =>
  "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-txt transition-all duration-200 hover:bg-surf2 hover:text-txt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none " +
  (className ?? "")
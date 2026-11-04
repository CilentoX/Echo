import { useCallback, useEffect, useState } from "react"
import { useUiStore } from "@/stores/uiStore"
import { useProfileStore } from "@/stores/profileStore"
import { matrixService } from "@/lib/matrix/instance"
import { useEchoApi } from "@/lib/api/echoApi"
import type { UserProfile } from "@/lib/matrix/types"
import { Chats, User, Copy, Pencil } from "@phosphor-icons/react"
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
  const activeGuildId = useUiStore((state) => state.activeGuildId)
  const isMyUser = userId === myUserId
  const presence = useUiStore((state) => state.presence[userId] ?? "offline")

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [editingGuildNick, setEditingGuildNick] = useState(false)
  const [guildNickInput, setGuildNickInput] = useState("")
  const [savingGuildNick, setSavingGuildNick] = useState(false)

  const echoApi = useEchoApi()
  const myAppwriteAvatarUrl = useProfileStore((state) => state.appwriteAvatarUrl)
  const myAppwriteBannerUrl = useProfileStore((state) => state.appwriteBannerUrl)

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const load = async () => {
      try {
        // Timeout de 5s para evitar loading infinito se o SDK travar
        const [fetched, global] = await Promise.all([
          Promise.race([
            matrixService.getUserProfile(userId),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timeout perfil")), 5000)
            ),
          ]),
          Promise.race([
            // getGlobalProfile is for current user only; for other users, use getUserProfile
            matrixService.getUserProfile(userId),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timeout global profile")), 5000)
            ),
          ]).catch(() => null), // global profile is optional
        ])

        if (!cancelled) {
          // Merge global profile data (banner, bio, links) into the profile
          const merged = global
            ? {
                ...fetched,
                bannerUrl: global.bannerUrl ?? fetched.bannerUrl,
                bio: global.bio ?? fetched.bio,
                // links não estão no UserProfile type, mas podemos adicionar se necessário
              }
            : fetched
          setProfile(merged)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setProfile(null)
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const copyUserId = useCallback(async () => {
    try {
      const targetUsername = profile?.username || cleanUserId(userId)
      await navigator.clipboard.writeText(`@${targetUsername}`)
      showToast("Username copiado")
    } catch {
      // falha silenciosa
    }
  }, [userId, profile?.username, showToast])

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

  const initial = (profile?.displayName ?? cleanUserId(userId)).charAt(0).toUpperCase()

  // Fallback chain para avatar (unificado para ambos):
  // 1. profile.avatarUrl (Matrix mxc:// do getUserProfile) - PRIORIDADE
  // 2. Próprio usuário: myAppwriteAvatarUrl (localStorage) - FALLBACK
  // 3. Iniciais - ÚLTIMO RECURSO
  const effectiveAvatarUrl = profile?.avatarUrl
    ?? (isMyUser ? myAppwriteAvatarUrl : null)
    ?? null

  // Banner: global profile (Appwrite Database) → own user Appwrite localStorage → gradient fallback
  const effectiveBannerUrl = profile?.bannerUrl ?? (isMyUser ? myAppwriteBannerUrl : null)

  return (
    <div
      role="menu"
      className="w-[300px] flex flex-col p-5 bg-surf border border-bd rounded-2xl shadow-2xl shadow-black/50"
    >
      {/* Banner do membro com fallback gradiente */}
      <div className="relative w-full h-20 rounded-xl overflow-hidden mb-4">
        {effectiveBannerUrl ? (
          <MxcImage
            mxcUrl={effectiveBannerUrl}
            alt="Banner"
            className="w-full h-full object-cover object-center"
            width={960}
            height={540}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-acc/20 via-surf to-surf2 border border-bd/40" />
        )}
      </div>

      {/* Cabeçalho: avatar + nome + status */}
      <div className="flex items-center gap-3 px-2">
        <div className="relative shrink-0">
          {effectiveAvatarUrl ? (
            <MxcImage
              mxcUrl={effectiveAvatarUrl}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border-2 border-bd bg-surf2"
              width={64}
              height={64}
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
          <p className="font-display font-bold text-lg text-txt truncate leading-tight" title={profile?.displayName ?? cleanUserId(userId)}>
            {profile?.displayName ?? cleanUserId(userId)}
          </p>
          <p className="text-xs text-mut truncate">
            @{profile?.username || cleanUserId(userId)} {isMyUser && " (você)"}
          </p>
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

      {/* Editor rápido de apelido no servidor (se for o próprio usuário em guilda) */}
      {editingGuildNick && activeGuildId && (
        <div className="mt-3 p-3 bg-surf2/80 rounded-xl border border-bd space-y-2 animate-in fade-in">
          <label className="text-[11px] font-semibold text-mut uppercase tracking-wider block">
            Apelido nesta guilda
          </label>
          <input
            type="text"
            value={guildNickInput}
            onChange={(e) => setGuildNickInput(e.target.value)}
            placeholder="Seu apelido nesta comunidade"
            maxLength={32}
            className="w-full px-2.5 py-1.5 text-xs bg-bg border border-bd rounded-lg text-txt focus:border-acc focus:outline-none"
            autoFocus
          />
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={savingGuildNick}
              onClick={async () => {
                try {
                  setSavingGuildNick(true)
                  await echoApi.setGuildMemberNickname(activeGuildId, null)
                  showToast("Apelido resetado para o global")
                  setProfile((prev) => (prev ? { ...prev, displayName: null } : null))
                  setEditingGuildNick(false)
                } catch {
                  showToast("Falha ao redefinir apelido")
                } finally {
                  setSavingGuildNick(false)
                }
              }}
              className="text-[11px] text-mut hover:text-txt cursor-pointer underline"
            >
              Resetar
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={savingGuildNick}
                onClick={() => setEditingGuildNick(false)}
                className="px-2.5 py-1 text-xs text-mut hover:text-txt rounded cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingGuildNick}
                onClick={async () => {
                  try {
                    setSavingGuildNick(true)
                    const saved = await echoApi.setGuildMemberNickname(activeGuildId, guildNickInput.trim() || null)
                    showToast("Apelido atualizado!")
                    setProfile((prev) => (prev ? { ...prev, displayName: saved.nickname || prev.displayName } : null))
                    setEditingGuildNick(false)
                  } catch {
                    showToast("Falha ao atualizar apelido")
                  } finally {
                    setSavingGuildNick(false)
                  }
                }}
                className="px-3 py-1 text-xs font-semibold bg-acc text-bg rounded-lg hover:bg-acc-press active:scale-95 transition-all cursor-pointer"
              >
                {savingGuildNick ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Separator className="my-4" />

      {/* Ações */}
      <div role="none" className="flex flex-col gap-0.5 px-1">
        {isMyUser ? (
          <>
            {activeGuildId && !editingGuildNick && (
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGuildNickInput(profile?.displayName || "")
                  setEditingGuildNick(true)
                }}
                className={actionButton()}
              >
                <Pencil size={14} className="shrink-0 text-acc" />
                <span>Alterar apelido no servidor</span>
              </Button>
            )}
            <Button
              type="button"
              role="menuitem"
              variant="ghost"
              size="sm"
              onClick={() => {
                useUiStore.getState().setProfileOpen(true)
              }}
              className={actionButton()}
            >
              <User size={14} className="shrink-0" />
              <span>Editar perfil</span>
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
              <span>Copiar meu username</span>
            </Button>
          </>
        ) : (
          <>
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
              <span>Copiar username</span>
            </Button>
          </>
        )}
      </div>

      {profile?.bio && (
        <div className="mt-4 px-2 py-2.5 rounded-xl bg-surf2 border border-bd/50">
          <p className="text-xs text-mut leading-relaxed">{profile.bio}</p>
        </div>
      )}
    </div>
  )
}

const cleanUserId = (id: string) => id.replace(/^@/, "").split(":")[0]

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
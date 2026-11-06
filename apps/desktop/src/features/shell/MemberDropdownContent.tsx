import { useCallback, useEffect, useState } from "react"
import { useUiStore } from "@/stores/uiStore"
import { useSyncStore } from "@/stores/syncStore"
import { useProfileStore } from "@/stores/profileStore"
import { useFriendsStore } from "@/stores/friendsStore"
import { matrixService } from "@/lib/matrix/instance"
import { useEchoApi } from "@/lib/api/echoApi"
import type { UserProfile, PresenceState } from "@/lib/matrix/types"
import type { GuildRole } from "@/lib/api/echoApi"
import { Chats, User, Copy, Pencil, Check, Crown, UserPlus } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import MxcImage from "@/components/media/MxcImage"

export interface MemberDropdownContentProps {
  userId: string
  initialDisplayName?: string
  initialAvatarUrl?: string | null
  initialPresence?: PresenceState
  onClose?: () => void
}

export default function MemberDropdownContent({
  userId,
  initialDisplayName,
  initialAvatarUrl,
  initialPresence,
  onClose,
}: MemberDropdownContentProps) {
  const myUserId = useUiStore((state) => state.myUserId ?? "")
  const activeGuildId = useUiStore((state) => state.activeGuildId)
  const isMyUser = Boolean(myUserId && (userId === myUserId || userId.toLowerCase() === myUserId.toLowerCase()))
  const livePresence = useUiStore((state) => state.presence[userId])

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [editingGuildNick, setEditingGuildNick] = useState(false)
  const [guildNickInput, setGuildNickInput] = useState("")
  const [savingGuildNick, setSavingGuildNick] = useState(false)
  const [guildNickname, setGuildNickname] = useState<string | null>(null)
  const [guildRoles, setGuildRoles] = useState<GuildRole[]>([])
  const [isGuildOwner, setIsGuildOwner] = useState(false)

  const echoApi = useEchoApi()
  const myAppwriteAvatarUrl = useProfileStore((state) => state.appwriteAvatarUrl)
  const myAppwriteBannerUrl = useProfileStore((state) => state.appwriteBannerUrl)
  const isFriend = useFriendsStore((state) => state.friends.some((f) => f.userId === userId))

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 2500)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const load = async () => {
      try {
        let fetched: UserProfile | null = null
        try {
          fetched = await Promise.race([
            matrixService.getUserProfile(userId),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timeout perfil")), 5000)
            ),
          ])
        } catch {
          if (typeof echoApi?.getUserProfile === "function") {
            fetched = await echoApi.getUserProfile(userId).catch(() => null)
          }
        }

        let guildData: { memberProfiles?: any[]; memberRoles?: any[]; roles?: any[] } | null = null
        if (activeGuildId && typeof echoApi?.getGuildMembersData === "function") {
          try {
            guildData = await echoApi.getGuildMembersData(activeGuildId).catch(() => null)
          } catch {
            guildData = null
          }
        }

        if (!cancelled) {
          setProfile(fetched)

          if (guildData) {
            if (activeGuildId && Array.isArray(guildData.memberProfiles)) {
              useSyncStore.getState().setGuildMemberProfiles(activeGuildId, guildData.memberProfiles)
            }
            // Verifica apelido do membro nesta guilda
            const memberProfile = guildData.memberProfiles?.find((mp) => mp.userId === userId)
            if (memberProfile?.nickname) {
              setGuildNickname(memberProfile.nickname)
            } else {
              setGuildNickname(null)
            }

            // Verifica cargos do membro nesta guilda
            const userRoleIds = new Set(
              guildData.memberRoles
                ?.filter((mr) => mr.userId === userId)
                .map((mr) => mr.roleId) ?? []
            )
            const userRoles = (guildData.roles ?? []).filter((r) => userRoleIds.has(r.id))
            setGuildRoles(userRoles)
          } else {
            setGuildNickname(null)
            setGuildRoles([])
          }

          // Checa se o usuário é o dono da guilda ativa (se houver)
          setIsGuildOwner(false)
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
  }, [userId, activeGuildId, echoApi])

  const effectiveHandle = profile?.username || cleanUserId(userId)
  const globalDisplayName = profile?.displayName || initialDisplayName || effectiveHandle
  const primaryName = guildNickname || globalDisplayName
  const hasCustomGuildNick = Boolean(guildNickname && guildNickname !== globalDisplayName)

  const copyUserId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`@${effectiveHandle}`)
      showToast("Username copiado")
    } catch {
      showToast("Falha ao copiar")
    }
  }, [effectiveHandle, showToast])

  const handleOpenDirectMessage = useCallback(async () => {
    try {
      showToast("Abrindo conversa direta...")
      await useFriendsStore.getState().openDirectMessage(userId)
      onClose?.()
    } catch {
      showToast("Iniciando mensagem direta")
    }
  }, [userId, onClose, showToast])

  const handleAddFriend = useCallback(async () => {
    try {
      await useFriendsStore.getState().sendFriendRequest(effectiveHandle)
      showToast("Solicitação enviada!")
    } catch {
      showToast("Erro ao adicionar amigo")
    }
  }, [effectiveHandle, showToast])

  const handleSaveNickname = useCallback(async () => {
    if (!activeGuildId) return
    try {
      setSavingGuildNick(true)
      const trimmed = guildNickInput.trim()
      const saved = await echoApi.setGuildMemberNickname(activeGuildId, trimmed || null)
      showToast("Apelido atualizado!")
      const newNick = saved.nickname || null
      setGuildNickname(newNick)
      useSyncStore.getState().setMemberGuildNickname(activeGuildId, userId, newNick)
      setEditingGuildNick(false)
    } catch {
      showToast("Falha ao atualizar apelido")
    } finally {
      setSavingGuildNick(false)
    }
  }, [activeGuildId, guildNickInput, echoApi, showToast, userId])

  const handleResetNickname = useCallback(async () => {
    if (!activeGuildId) return
    try {
      setSavingGuildNick(true)
      await echoApi.setGuildMemberNickname(activeGuildId, null)
      showToast("Apelido resetado para o global")
      setGuildNickname(null)
      useSyncStore.getState().setMemberGuildNickname(activeGuildId, userId, null)
      setEditingGuildNick(false)
    } catch {
      showToast("Falha ao redefinir apelido")
    } finally {
      setSavingGuildNick(false)
    }
  }, [activeGuildId, echoApi, showToast, userId])

  // Presença do usuário (em tempo real > inicial recebida > offline)
  const myPresence = useProfileStore((state) => state.presence)
  const effectivePresence: PresenceState = (
    isMyUser
      ? (myPresence === "dnd" ? "unavailable" : myPresence ?? "online")
      : livePresence || initialPresence || "offline"
  ) as PresenceState

  if (loading && !initialDisplayName && !initialAvatarUrl) {
    return (
      <div
        role="menu"
        className="w-[320px] flex flex-col bg-card-bg border border-bd-glass rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-pulse select-none"
      >
        <div className="w-full h-28 bg-white/[0.04]" />
        <div className="px-4 -mt-10 flex items-end justify-between">
          <div className="w-20 h-20 rounded-full border-4 border-card-bg bg-white/[0.06]" />
          <div className="h-8 w-24 rounded-xl bg-white/[0.04] mb-1" />
        </div>
        <div className="p-4 space-y-2">
          <div className="h-5 w-40 bg-white/[0.06] rounded-lg" />
          <div className="h-3 w-24 bg-white/[0.04] rounded" />
          <div className="h-6 w-20 bg-white/[0.04] rounded-full mt-2" />
        </div>
        <div className="px-4 pb-4 space-y-1.5">
          <div className="h-9 w-full bg-white/[0.04] rounded-xl" />
          <div className="h-9 w-full bg-white/[0.04] rounded-xl" />
        </div>
      </div>
    )
  }

  const initial = (primaryName || "U").charAt(0).toUpperCase()

  // Fallback chain para avatar: perfil carregado > avatar inicial do membro/canal > appwrite (se eu mesmo)
  const effectiveAvatarUrl =
    profile?.avatarUrl ?? initialAvatarUrl ?? (isMyUser ? myAppwriteAvatarUrl : null) ?? null

  // Banner
  const effectiveBannerUrl =
    profile?.bannerUrl ?? (isMyUser ? myAppwriteBannerUrl : null) ?? null

  return (
    <div
      role="menu"
      className="w-[320px] max-w-[340px] flex flex-col bg-card-bg border border-bd-glass rounded-2xl shadow-2xl shadow-black/80 overflow-hidden text-txt select-none animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Banner panorâmico */}
      <div className="relative w-full h-28 shrink-0 overflow-hidden dark:bg-gradient-to-br dark:from-indigo-950/70 dark:via-purple-950/40 dark:to-card-bg bg-gradient-to-br from-acc/20 via-surf2 to-card-bg">
        {effectiveBannerUrl ? (
          <MxcImage
            mxcUrl={effectiveBannerUrl}
            alt="Banner"
            className="w-full h-full object-cover object-center"
            width={640}
            height={224}
          />
        ) : (
          <div className="w-full h-full relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-acc/20 via-transparent to-transparent opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-card-bg via-card-bg/40 to-transparent" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card-bg to-transparent pointer-events-none" />
      </div>

      {/* Avatar sobreposto & Ação de topo */}
      <div className="relative px-4 -mt-11 flex items-end justify-between z-10">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full border-4 border-card-bg bg-surf2 shadow-xl overflow-hidden ring-1 ring-bd-subtle">
            {effectiveAvatarUrl ? (
              <MxcImage
                key={`${userId}-${effectiveAvatarUrl}`}
                mxcUrl={effectiveAvatarUrl}
                alt={primaryName}
                className="w-full h-full object-cover object-center"
                width={80}
                height={80}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display font-bold text-2xl text-bg bg-acc shadow-inner">
                {initial}
              </div>
            )}
          </div>
          {/* Badge de status integrada */}
          <span
            className={`absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-card-bg shrink-0 z-10 ${statusColor[effectivePresence] ?? "bg-mut"}`}
            title={statusLabel[effectivePresence]}
            aria-label={statusLabel[effectivePresence]}
          />
        </div>

        {/* Botão de ação rápido ao lado do avatar */}
        <div className="pb-1">
          {isMyUser ? (
            <button
              type="button"
              onClick={() => {
                useUiStore.getState().setProfileOpen(true)
                onClose?.()
              }}
              title="Editar perfil completo"
              className="cursor-pointer h-8 px-3 rounded-xl dark:bg-white/[0.06] bg-black/[0.05] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-bd-glass text-txt text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
            >
              <Pencil size={13} className="text-acc" />
              <span>Editar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenDirectMessage}
              title="Enviar mensagem direta"
              className="cursor-pointer h-8 px-3.5 rounded-xl bg-acc text-bg font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all"
            >
              <Chats size={14} weight="bold" />
              <span>Mensagem</span>
            </button>
          )}
        </div>
      </div>

      {/* Identidade do Usuário */}
      <div className="px-4 pt-2.5 pb-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <h2
            className="font-display font-bold text-base text-txt truncate leading-snug"
            title={primaryName}
          >
            {primaryName}
          </h2>
          {isMyUser && (
            <span className="shrink-0 text-[10px] font-semibold text-acc bg-acc/10 px-1.5 py-0.5 rounded-md border border-acc/20">
              você
            </span>
          )}
        </div>

        {/* Handle e Apelido secundário (se houver apelido de servidor) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-mut">
          {hasCustomGuildNick && (
            <span className="text-txt/70 font-medium truncate max-w-[140px]" title={globalDisplayName}>
              {globalDisplayName} ·
            </span>
          )}
          <button
            type="button"
            onClick={copyUserId}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-mut hover:text-acc transition-colors cursor-pointer group"
            title="Copiar username"
          >
            <span>@{effectiveHandle}</span>
            <Copy size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-acc" />
          </button>
        </div>
      </div>

      {/* Badge de Presença */}
      <div className="px-4 py-1.5">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium dark:bg-white/[0.03] bg-black/[0.04] border border-bd-subtle text-txt/90 shadow-sm">
          <span
            className={`h-2 w-2 rounded-full ${statusColor[effectivePresence] ?? "bg-mut"}`}
          />
          <span className="text-[11px] font-medium">{statusLabel[effectivePresence]}</span>
        </div>
      </div>

      {/* Feedback Toast */}
      {toastMessage && (
        <div className="mx-4 my-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-acc/15 border border-acc/30 text-acc text-xs font-medium animate-in fade-in zoom-in-95 duration-150">
          <Check size={12} weight="bold" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Editor rápido de apelido no servidor */}
      {editingGuildNick && activeGuildId && (
        <div className="mx-4 my-2 p-3 rounded-xl dark:bg-white/[0.03] bg-card-bg border border-bd-glass space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-mut uppercase tracking-wider">
              Apelido nesta guilda
            </label>
            <span className="font-mono text-[10px] text-mut/60">
              {guildNickInput.length}/32
            </span>
          </div>
          <input
            type="text"
            value={guildNickInput}
            onChange={(e) => setGuildNickInput(e.target.value)}
            placeholder="Seu apelido nesta comunidade"
            maxLength={32}
            className="w-full px-3 py-1.5 text-xs dark:bg-white/[0.03] bg-surf/40 border border-bd-glass rounded-xl text-txt placeholder:text-mut/50 focus:border-acc/50 focus:bg-card-bg focus:ring-1 focus:ring-acc/30 outline-none transition-all"
            autoFocus
          />
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={savingGuildNick}
              onClick={handleResetNickname}
              className="text-[11px] text-mut hover:text-txt cursor-pointer underline transition-colors"
            >
              Resetar
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={savingGuildNick}
                onClick={() => setEditingGuildNick(false)}
                className="px-2.5 py-1 text-xs text-mut hover:text-txt rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingGuildNick}
                onClick={handleSaveNickname}
                className="px-3 py-1 text-xs font-semibold bg-acc text-bg rounded-lg hover:bg-acc-press active:scale-95 transition-all shadow-md shadow-acc/20 cursor-pointer"
              >
                {savingGuildNick ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seção Sobre Mim */}
      {profile?.bio && (
        <div className="px-4 py-1.5 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-mut/70">
            Sobre mim
          </p>
          <div className="p-2.5 rounded-xl dark:bg-white/[0.02] bg-surf/40 border border-bd-subtle text-xs text-txt/80 leading-relaxed break-words whitespace-pre-wrap max-h-28 overflow-y-auto scrollbar-thin">
            {profile.bio}
          </div>
        </div>
      )}

      {/* Seção Cargos da Guilda */}
      {activeGuildId && (isGuildOwner || guildRoles.length > 0) && (
        <div className="px-4 py-1.5 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-mut/70">
            Cargos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {isGuildOwner && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-400/10 text-amber-300 border border-amber-400/20">
                <Crown size={12} weight="fill" className="text-amber-400" />
                Dono
              </span>
            )}
            {guildRoles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium dark:bg-white/[0.04] bg-surf2 border border-bd-subtle text-txt/90"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-acc"
                  style={role.color ? { backgroundColor: role.color } : undefined}
                />
                {role.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Divisor de Seção */}
      <div className="mx-4 my-2 h-px bg-bd-subtle" />

      {/* Menu de Ações */}
      <div role="none" className="px-2 pb-2.5 flex flex-col gap-0.5">
        {isMyUser ? (
          <>
            {activeGuildId && !editingGuildNick && (
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGuildNickInput(guildNickname || profile?.displayName || "")
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
                onClose?.()
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
              onClick={handleOpenDirectMessage}
              className={actionButton()}
            >
              <Chats size={14} className="shrink-0 text-acc" />
              <span>Enviar mensagem direta</span>
            </Button>
            {!isFriend && (
              <Button
                type="button"
                role="menuitem"
                variant="ghost"
                size="sm"
                onClick={handleAddFriend}
                className={actionButton()}
              >
                <UserPlus size={14} className="shrink-0" />
                <span>Adicionar como amigo</span>
              </Button>
            )}
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
  online: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
  offline: "bg-slate-500",
  unavailable: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
  idle: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
}

const actionButton = (className?: string) =>
  "w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-txt/80 hover:text-txt dark:hover:bg-white/[0.06] hover:bg-black/[0.05] active:scale-[0.98] transition-all duration-150 cursor-pointer justify-start h-auto border-0 focus-visible:ring-1 focus-visible:ring-acc/40 " +
  (className ?? "")

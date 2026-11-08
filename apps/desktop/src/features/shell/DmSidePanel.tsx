import { useMemo } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useVoiceStore } from "@/stores/voiceStore";
import MxcImage from "@/components/media/MxcImage";
import MemberContextMenu from "./MemberContextMenu";
import {
  X,
  PhoneCall,
  ShieldCheck,
  ChatCircle,
  Users,
  Sparkle,
} from "@phosphor-icons/react";

export interface DmSidePanelProps {
  variant?: "static" | "overlay";
  onClose?: () => void;
}

/**
 * Painel Lateral Vivo da 4ª Coluna para DMs e Home (Ergonomia Discord, 320px).
 * Exibe perfil expandido do amigo em foco e atividade em tempo real ("Ativo Agora"),
 * garantindo acolhimento e eliminando qualquer sensação de vazio preto.
 */
export default function DmSidePanel({
  variant = "static",
  onClose,
}: DmSidePanelProps) {
  const overlay = variant === "overlay";
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const presenceMap = useUiStore((s) => s.presence);
  const friends = useFriendsStore((s) => s.friends);
  const openDirectMessage = useFriendsStore((s) => s.openDirectMessage);
  const connectVoice = useVoiceStore((s) => s.connectVoice);

  const activeFriend = useMemo(() => {
    if (!activeChannelId) return null;
    return (
      friends.find(
        (f) =>
          f.directRoomId === activeChannelId ||
          f.userId === activeChannelId ||
          activeChannelId.includes(f.userId.replace(/^@/, "").split(":")[0]),
      ) ?? null
    );
  }, [activeChannelId, friends]);

  const friendPresence = useMemo(() => {
    if (!activeFriend) return "offline";
    const live = presenceMap[activeFriend.userId];
    if (live !== undefined) return live;
    return activeFriend.presence ?? "offline";
  }, [activeFriend, presenceMap]);

  const onlineFriends = useMemo(() => {
    return friends.filter((f) => {
      if (activeFriend && f.userId === activeFriend.userId) return false;
      const p = presenceMap[f.userId] ?? f.presence;
      return p === "online" || p === "unavailable";
    });
  }, [friends, presenceMap, activeFriend]);

  const presenceColor =
    friendPresence === "online"
      ? "bg-online ring-2 ring-surf"
      : friendPresence === "unavailable"
        ? "bg-dnd ring-2 ring-surf"
        : "bg-offline ring-2 ring-surf";

  const presenceLabel =
    friendPresence === "online"
      ? "Disponível"
      : friendPresence === "unavailable"
        ? "Ausente / Ocupado"
        : "Offline";

  const handleStartVoiceCall = () => {
    if (!activeFriend) return;
    const roomId = activeFriend.directRoomId || activeChannelId || activeFriend.userId;
    connectVoice("home", "Mensagem Direta", roomId, activeFriend.displayName);
  };

  return (
    <aside
      data-column="members"
      aria-label="Perfil do Amigo e Atividade"
      className={`flex w-[320px] shrink-0 flex-col border-l border-bd-subtle bg-surf select-none overflow-hidden ${
        overlay
          ? "fixed inset-y-0 right-0 z-20 shadow-2xl shadow-black/80"
          : "h-full"
      }`}
    >
      {/* Header do Painel */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-bd-subtle px-4 bg-surf/90 backdrop-blur-md">
        <h2 className="font-display text-sm font-semibold text-txt flex items-center gap-2">
          <span>{activeFriend ? "Perfil do Usuário" : "Ativo Agora"}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-acc/60" />
        </h2>
        {overlay && (
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={onClose}
            className="cursor-pointer flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt transition-all"
          >
            <X size={18} />
          </button>
        )}
      </header>

      {/* Conteúdo com rolagem suave */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        {activeFriend ? (
          <>
            {/* Cartão de Perfil Expandido do Amigo */}
            <div className="rounded-2xl border border-white/[0.08] bg-card-bg/60 dark:bg-white/[0.02] overflow-hidden shadow-lg shadow-black/10">
              {/* Banner Superior com Gradiente Teal */}
              <div className="relative h-20 w-full bg-gradient-to-r from-acc/25 via-surf2/80 to-acc/10">
                <div className="absolute inset-0 bg-black/20" />
              </div>

              {/* Informações de Perfil */}
              <div className="px-4 pb-4 pt-0">
                <div className="relative -mt-9 mb-3 flex items-end justify-between">
                  <div className="relative">
                    {activeFriend.avatarUrl ? (
                      <MxcImage
                        mxcUrl={activeFriend.avatarUrl}
                        alt={activeFriend.displayName}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-2xl object-cover border-4 border-surf shadow-md"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-surf bg-acc text-bg font-display text-2xl font-bold shadow-md">
                        {activeFriend.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ${presenceColor}`}
                      title={presenceLabel}
                    />
                  </div>

                  {/* Botão de Chamada de Voz Direta */}
                  <button
                    type="button"
                    onClick={handleStartVoiceCall}
                    title="Iniciar chamada de voz"
                    className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-xl bg-acc text-bg font-semibold shadow-md shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all"
                  >
                    <PhoneCall size={16} weight="bold" />
                  </button>
                </div>

                <h3 className="font-display text-base font-bold text-txt truncate">
                  {activeFriend.displayName}
                </h3>
                <p className="font-mono text-xs text-mut mt-0.5 truncate">
                  {activeFriend.nickname ? `@${activeFriend.nickname}` : activeFriend.userId}
                </p>

                {/* Status de Presença */}
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-1.5 border border-white/[0.05]">
                  <span className={`h-2 w-2 rounded-full ${friendPresence === "online" ? "bg-online" : "bg-mut/50"}`} />
                  <span className="text-xs text-txt/90 font-medium">{presenceLabel}</span>
                </div>

                {/* Sobre Mim / Bio */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-mut">
                    Sobre Mim
                  </h4>
                  <p className="text-xs text-txt/80 leading-relaxed break-words [overflow-wrap:anywhere]">
                    {activeFriend.bio || "Este usuário ainda não adicionou uma biografia."}
                  </p>
                </div>

                {/* Conexão Segura e Criptografia */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[11px] text-acc/90 font-medium">
                  <ShieldCheck size={16} weight="bold" className="shrink-0" />
                  <span>Criptografia ponta a ponta</span>
                </div>
              </div>
            </div>

            {/* Divisor */}
            <div className="flex items-center gap-2">
              <span className="h-[1px] flex-1 bg-white/[0.06]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mut/80 flex items-center gap-1">
                <Sparkle size={11} className="text-acc" weight="bold" />
                <span>Ativo Agora</span>
              </span>
              <span className="h-[1px] flex-1 bg-white/[0.06]" />
            </div>
          </>
        ) : null}

        {/* Bloco: Amigos Online no Momento */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-txt">
              Amigos Conectados
            </h4>
            {onlineFriends.length > 0 && (
              <span className="text-[10px] font-semibold text-acc bg-acc/10 px-2 py-0.5 rounded border border-acc/20">
                {onlineFriends.length} online
              </span>
            )}
          </div>

          {onlineFriends.length > 0 ? (
            <div className="space-y-2">
              {onlineFriends.slice(0, 6).map((f) => (
                <MemberContextMenu
                  key={f.userId}
                  userId={f.userId}
                  displayName={f.displayName}
                  avatarUrl={f.avatarUrl}
                >
                  <div
                    onClick={() => openDirectMessage(f.userId)}
                    className="cursor-pointer group flex items-center justify-between p-2.5 rounded-xl bg-card-bg/60 border border-bd-glass dark:bg-white/[0.02] dark:border-white/[0.04] hover:bg-card-bg hover:border-acc/30 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        {f.avatarUrl ? (
                          <MxcImage
                            mxcUrl={f.avatarUrl}
                            alt={f.displayName}
                            className="h-8 w-8 rounded-full object-cover"
                            width={32}
                            height={32}
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acc/15 font-display text-xs font-bold text-acc">
                            {f.displayName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card-bg" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-txt truncate group-hover:text-acc transition-colors">
                          {f.displayName}
                        </p>
                        <p className="text-[10px] text-emerald-400/80 truncate">
                          Disponível no Echo
                        </p>
                      </div>
                    </div>
                    <ChatCircle size={15} className="text-mut group-hover:text-txt transition-colors shrink-0" />
                  </div>
                </MemberContextMenu>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-card-bg/40 p-4 text-center space-y-2">
              <div className="w-9 h-9 mx-auto rounded-full dark:bg-white/[0.04] bg-black/[0.05] flex items-center justify-center text-mut/60">
                <Users size={18} />
              </div>
              <p className="text-xs font-semibold text-txt">Nenhum outro amigo online</p>
              <p className="text-[11px] text-mut/60 leading-relaxed">
                Quando outros amigos entrarem, você os verá listados aqui.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

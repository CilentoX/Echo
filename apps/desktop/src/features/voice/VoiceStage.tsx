"use client";

import { useState } from "react";
import {
  SpeakerHigh,
  Microphone,
  MicrophoneSlash,
  Headphones,
  PhoneDisconnect,
  ChatText,
  Broadcast,
  Waveform,
  SignIn,
} from "@phosphor-icons/react";
import { useVoiceStore } from "@/stores/voiceStore";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";
import MxcImage from "@/components/media/MxcImage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MemberDropdownContent from "@/features/shell/MemberDropdownContent";

export interface VoiceStageProps {
  channelId: string;
  channelName: string;
  topic?: string | null;
  guildId?: string | null;
  guildName?: string | null;
  /** Componente opcional de chat para split-view */
  chatComponent?: React.ReactNode;
}

export default function VoiceStage({
  channelId,
  channelName,
  topic,
  guildId,
  guildName,
  chatComponent,
}: VoiceStageProps) {
  const activeVoiceChannelId = useVoiceStore((s) => s.activeVoiceChannelId);
  const isConnected = useVoiceStore((s) => s.isConnected);
  const isConnecting = useVoiceStore((s) => s.isConnecting);
  const pingMs = useVoiceStore((s) => s.pingMs);
  const participants = useVoiceStore((s) => s.participants);
  const speakingMembers = useVoiceStore((s) => s.speakingMembers);
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const connectVoice = useVoiceStore((s) => s.connectVoice);
  const disconnectVoice = useVoiceStore((s) => s.disconnectVoice);
  const setSpeaking = useVoiceStore((s) => s.setSpeaking);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);

  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const myUserId = useUiStore((s) => s.myUserId);
  const activeGuildId = useUiStore((s) => s.activeGuildId ?? guildId ?? "");
  const profileDisplayName = useProfileStore((s) => s.displayName);
  const profileAvatarUrl = useProfileStore((s) => s.avatarUrl);
  const myAppwriteAvatarUrl = useProfileStore((s) => s.appwriteAvatarUrl);

  const guildProfiles = useSyncStore((s) =>
    activeGuildId && activeGuildId !== "home" ? s.guildMemberProfiles[activeGuildId] : undefined,
  );

  // Verifica se o usuário atual está conectado ou conectando neste canal de voz
  const isCurrentChannelConnected = (isConnected || isConnecting) && activeVoiceChannelId === channelId;

  // Participante do usuário local
  const effectiveUserId = myUserId || matrixService.getUserId() || "me";
  const myGuildProfile = effectiveUserId ? guildProfiles?.[effectiveUserId] : undefined;
  const myEffectiveName =
    myGuildProfile?.nickname || profileDisplayName || effectiveUserId.split(":")[0].replace("@", "") || "Você";
  const myEffectiveAvatar =
    (effectiveUserId ? guildProfiles?.[effectiveUserId]?.avatarUrl : null) ||
    profileAvatarUrl ||
    myAppwriteAvatarUrl ||
    null;

  const handleJoinVoice = () => {
    connectVoice(
      guildId ?? activeGuildId ?? "",
      guildName ?? "Comunidade Echo",
      channelId,
      channelName,
      [
        {
          userId: effectiveUserId,
          username: myEffectiveName,
          avatarUrl: myEffectiveAvatar,
          isMuted: false,
          isDeafened: false,
          isSpeaking: false,
          volume: 100,
        },
      ],
    );
  };

  const myParticipant = participants.find(
    (p) => p.userId === effectiveUserId || p.userId === "me" || p.userId === myUserId,
  );
  const isMyMuted = myParticipant?.isMuted ?? false;
  const isMyDeafened = myParticipant?.isDeafened ?? false;

  return (
    <div
      data-testid="voice-stage"
      className="flex flex-1 flex-col h-full w-full overflow-hidden bg-bg font-ui select-none"
    >
      {/* Header do Palco de Voz */}
      <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-bd-subtle bg-surf/80 px-4 backdrop-blur-md z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-online/10 text-online border border-online/20 shadow-xs shrink-0">
            <SpeakerHigh size={18} weight="bold" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-sm font-bold text-txt truncate">
                {channelName}
              </h1>
              {isCurrentChannelConnected ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-online/15 border border-online/30 text-[10px] font-semibold text-online shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-online animate-pulse" />
                  <span>{isConnecting ? "Conectando..." : "Voz Conectada"}</span>
                  <span className="font-mono text-[9px] text-online/70 ml-1">({pingMs}ms)</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-surf2 border border-bd-subtle text-[10px] font-medium text-mut">
                  Canal de Voz
                </span>
              )}
            </div>
            {topic && <p className="text-[11px] text-mut truncate">{topic}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {chatComponent && (
            <button
              type="button"
              onClick={() => setShowChat((prev) => !prev)}
              aria-label="Alternar bate-papo de texto"
              title={showChat ? "Ocultar bate-papo de texto" : "Abrir bate-papo de texto do canal"}
              className={`cursor-pointer flex h-8 items-center gap-1.5 px-3 rounded-xl text-xs font-medium transition-all active:scale-95 border ${
                showChat
                  ? "bg-acc/15 text-acc border-acc/30 shadow-xs"
                  : "text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] border-bd-subtle"
              }`}
            >
              <ChatText size={16} weight={showChat ? "bold" : "regular"} />
              <span className="hidden sm:inline">Bate-Papo</span>
            </button>
          )}

          {!isCurrentChannelConnected && (
            <button
              type="button"
              onClick={handleJoinVoice}
              className="cursor-pointer flex h-8 items-center gap-1.5 px-3 rounded-xl bg-online text-bg font-semibold text-xs shadow-md shadow-online/20 hover:opacity-90 active:scale-95 transition-all"
            >
              <SignIn size={15} weight="bold" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Principal: Grid do Palco de Voz (+ Chat lateral se ativo) */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Palco Central de Voz */}
        <div className="flex flex-1 flex-col justify-between overflow-y-auto p-6 scrollbar-thin">
          {!isCurrentChannelConnected ? (
            /* Hero Quando Desconectado deste canal */
            <div className="flex flex-1 flex-col items-center justify-center text-center max-w-md mx-auto my-auto animate-in fade-in-0 duration-200">
              <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-online/10 text-online border border-online/25 shadow-xl shadow-online/15">
                <SpeakerHigh size={40} weight="bold" />
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-online flex items-center justify-center text-bg text-[10px] font-black">
                  +
                </div>
              </div>
              <h2 className="font-display text-xl font-bold text-txt">
                Canal de Voz #{channelName}
              </h2>
              <p className="mt-1 text-xs text-mut leading-relaxed max-w-sm">
                Conecte-se para conversar com áudio de baixa latência e animação em tempo real de quem está falando.
              </p>

              {participants.length > 0 && (
                <div className="mt-4 flex items-center gap-2 p-2 rounded-2xl bg-surf2/60 border border-bd-subtle">
                  <span className="text-xs font-semibold text-online">
                    {participants.length} participante(s) na chamada:
                  </span>
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {participants.slice(0, 4).map((p) => (
                      <div
                        key={p.userId}
                        className="h-6 w-6 rounded-full bg-acc text-bg flex items-center justify-center text-[10px] font-bold ring-2 ring-surf"
                      >
                        {p.username.charAt(0).toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleJoinVoice}
                className="cursor-pointer mt-6 flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-online text-bg font-display font-semibold text-sm shadow-xl shadow-online/25 hover:opacity-90 active:scale-95 transition-all"
              >
                <Broadcast size={18} weight="bold" />
                <span>Entrar no Canal de Voz</span>
              </button>
            </div>
          ) : (
            /* Grid de Participantes Conectados */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 w-full auto-rows-fr">
              {participants.map((participant) => {
                const isMe =
                  participant.userId === effectiveUserId ||
                  participant.userId === "me" ||
                  participant.userId === myUserId;

                const memberUserId = isMe ? effectiveUserId : participant.userId;
                const memberNick = guildProfiles?.[memberUserId]?.nickname || participant.username;
                const memberAvatar =
                  (isMe ? myEffectiveAvatar : null) ||
                  guildProfiles?.[memberUserId]?.avatarUrl ||
                  participant.avatarUrl ||
                  null;

                const participantSpeaking =
                  participant.isSpeaking ||
                  speakingMembers.includes(participant.userId) ||
                  (isMe && (isSpeaking || speakingMembers.includes("me") || speakingMembers.includes(effectiveUserId)));

                return (
                  <div key={participant.userId} className="relative w-full">
                    <Popover
                      open={openMemberId === participant.userId}
                      onOpenChange={(open) => setOpenMemberId(open ? participant.userId : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Perfil de ${memberNick}`}
                          className={`cursor-pointer group relative flex flex-col items-center justify-center w-full min-h-[190px] p-5 rounded-2xl transition-all duration-200 select-none ${
                            participantSpeaking
                              ? "bg-card-bg/95 border-2 border-online shadow-xl shadow-online/20 scale-[1.02]"
                              : "bg-card-bg/70 hover:bg-card-bg/90 border border-bd-subtle hover:border-white/[0.15] shadow-sm hover:scale-[1.01]"
                          }`}
                        >
                          {/* Equalizer Waveform quando Falando */}
                          {participantSpeaking && (
                            <div
                              className="absolute top-3 right-3 flex items-center gap-0.5 px-2 py-1 rounded-full bg-online/15 border border-online/30 animate-pulse"
                              title="Falando agora"
                            >
                              <span className="w-1 h-3 rounded-full bg-online animate-[pulse_0.6s_ease-in-out_infinite]" />
                              <span className="w-1 h-4 rounded-full bg-online animate-[pulse_0.4s_ease-in-out_infinite_150ms]" />
                              <span className="w-1 h-2 rounded-full bg-online animate-[pulse_0.5s_ease-in-out_infinite_300ms]" />
                            </div>
                          )}

                          {/* Avatar Central com Foto e Anel de Fala */}
                          <div className="relative mt-2">
                            {memberAvatar ? (
                              <MxcImage
                                mxcUrl={memberAvatar}
                                alt={memberNick}
                                className={`h-20 w-20 rounded-full object-cover shadow-lg transition-all duration-150 ${
                                  participantSpeaking
                                    ? "ring-4 ring-online shadow-online/60 animate-pulse"
                                    : "ring-2 ring-bd-subtle group-hover:ring-acc/50"
                                }`}
                                width={80}
                                height={80}
                              />
                            ) : (
                              <div
                                className={`flex h-20 w-20 items-center justify-center rounded-full bg-acc text-bg font-display text-2xl font-black shadow-lg transition-all duration-150 ${
                                  participantSpeaking
                                    ? "ring-4 ring-online shadow-online/60 animate-pulse"
                                    : "ring-2 ring-bd-subtle group-hover:ring-acc/50"
                                }`}
                              >
                                {memberNick.charAt(0).toUpperCase()}
                              </div>
                            )}

                            {/* Badge de Microfone Mutado */}
                            {participant.isMuted && (
                              <div
                                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-err text-white ring-2 ring-card-bg shadow-sm"
                                title="Microfone mutado"
                              >
                                <MicrophoneSlash size={13} weight="bold" />
                              </div>
                            )}
                          </div>

                          {/* Apelido e Identificador */}
                          <div className="mt-3.5 flex flex-col items-center max-w-[90%]">
                            <span className="font-display text-sm font-bold text-txt truncate group-hover:text-acc transition-colors">
                              {memberNick}
                            </span>
                            <span className="text-[11px] text-mut/80 font-mono truncate">
                              {isMe ? "(você)" : `@${memberUserId.split(":")[0].replace("@", "")}`}
                            </span>
                          </div>

                          {/* Badge de Fala Animado */}
                          {participantSpeaking && (
                            <span className="mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-online/15 border border-online/30 text-[9px] font-bold uppercase tracking-wider text-online animate-pulse">
                              <Waveform size={11} weight="bold" />
                              <span>Falando</span>
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>

                      <PopoverContent
                        side="bottom"
                        align="center"
                        sideOffset={8}
                        collisionPadding={16}
                        className="w-auto p-0 border-0 bg-transparent shadow-none max-w-none outline-none z-50"
                      >
                        <MemberDropdownContent
                          userId={memberUserId}
                          onClose={() => setOpenMemberId(null)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              })}
            </div>
          )}

          {/* Barra Flutuante de Ações e Controles de Voz (Ergonomia Discord) */}
          {isCurrentChannelConnected && (
            <div className="mt-6 flex justify-center w-full">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card-bg/95 border border-bd-subtle backdrop-blur-xl shadow-2xl">
                {/* Botão Microfone (Mudo / Desmudo) */}
                <button
                  type="button"
                  onClick={() => toggleMute()}
                  aria-label={isMyMuted ? "Ativar microfone" : "Silenciar microfone"}
                  title={isMyMuted ? "Ativar microfone" : "Silenciar microfone"}
                  className={`cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
                    isMyMuted
                      ? "bg-err text-white shadow-md shadow-err/20 hover:bg-err-press"
                      : "bg-white/[0.06] text-txt hover:bg-white/[0.12] border border-bd-subtle"
                  }`}
                >
                  {isMyMuted ? <MicrophoneSlash size={18} weight="bold" /> : <Microphone size={18} weight="bold" />}
                </button>

                {/* Botão Fone de Ouvido (Ensurdecer) */}
                <button
                  type="button"
                  onClick={() => toggleDeafen()}
                  aria-label={isMyDeafened ? "Reativar áudio" : "Ensurdecer"}
                  title={isMyDeafened ? "Reativar áudio" : "Ensurdecer"}
                  className={`cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
                    isMyDeafened
                      ? "bg-err text-white shadow-md shadow-err/20 hover:bg-err-press"
                      : "bg-white/[0.06] text-txt hover:bg-white/[0.12] border border-bd-subtle"
                  }`}
                >
                  <Headphones size={18} weight="bold" />
                </button>

                {/* Botão de Teste de Fala (Simula/Ativa Fala em tempo real para ver a animação) */}
                <button
                  type="button"
                  onClick={() => setSpeaking(!isSpeaking)}
                  aria-label={isSpeaking ? "Parar de falar" : "Falar (Testar animação)"}
                  title="Clique para alternar fala e testar a animação verde em tempo real"
                  className={`cursor-pointer flex h-10 items-center gap-1.5 px-3.5 rounded-xl font-medium text-xs transition-all active:scale-95 border ${
                    isSpeaking
                      ? "bg-online text-bg font-bold border-online shadow-lg shadow-online/30 animate-pulse"
                      : "bg-white/[0.06] text-txt hover:bg-white/[0.12] border-bd-subtle"
                  }`}
                >
                  <Waveform size={17} weight="bold" />
                  <span>{isSpeaking ? "Falando..." : "Falar (Teste)"}</span>
                </button>

                <div className="h-6 w-[1px] bg-bd-subtle mx-1" />

                {/* Botão Desconectar da Chamada */}
                <button
                  type="button"
                  onClick={disconnectVoice}
                  aria-label="Desconectar da chamada de voz"
                  title="Desconectar da chamada de voz"
                  className="cursor-pointer flex h-10 px-3.5 items-center gap-1.5 rounded-xl bg-err/15 text-err border border-err/30 hover:bg-err hover:text-white transition-all active:scale-95 text-xs font-semibold shadow-xs"
                >
                  <PhoneDisconnect size={17} weight="bold" />
                  <span className="hidden sm:inline">Desconectar</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bate-papo de Texto Lateral (Split-view quando ativado) */}
        {showChat && chatComponent && (
          <aside className="w-full sm:w-[360px] lg:w-[400px] shrink-0 border-l border-bd-subtle bg-bg flex flex-col h-full animate-in slide-in-from-right-4 duration-150">
            {chatComponent}
          </aside>
        )}
      </div>
    </div>
  );
}

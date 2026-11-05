"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SpeakerHigh,
  Microphone,
  MicrophoneSlash,
  Headphones,
  PhoneDisconnect,
  Waveform,
  Lock,
  Screencast,
  VideoCamera,
  VideoCameraSlash,
  StopCircle,
  Television,
  PictureInPicture,
  ArrowsInSimple,
  SquaresFour,
  Broadcast,
  DotsSixVertical,
  Columns,
} from "@phosphor-icons/react";
import { useVoiceActivity } from "./useVoiceActivity";
import { useVoiceStore } from "@/stores/voiceStore";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";
import MxcImage from "@/components/media/MxcImage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MemberDropdownContent from "@/features/shell/MemberDropdownContent";
import MemberContextMenu from "@/features/shell/MemberContextMenu";
import { hasChannelPermission } from "@/lib/permissions/channelPermissions";
import SoundboardPopover, { type SoundEffect } from "./SoundboardPopover";
import ScreenShareModal from "./ScreenShareModal";
import type { ScreenShareConfig } from "@/stores/voiceStore";

const EMPTY_ROLES: string[] = [];
const EMPTY_GUILD_ROLES: any[] = [];

export interface VoiceStageProps {
  channelId: string;
  channelName: string;
  topic?: string | null;
  guildId?: string | null;
  guildName?: string | null;
}

export default function VoiceStage({
  channelId,
  channelName,
  topic,
  guildId,
  guildName,
}: VoiceStageProps) {
  const activeVoiceChannelId = useVoiceStore((s) => s.activeVoiceChannelId);
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
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const isCameraOn = useVoiceStore((s) => s.isCameraOn);
  const setScreenSharing = useVoiceStore((s) => s.setScreenSharing);
  const setCameraOn = useVoiceStore((s) => s.setCameraOn);
  const screenShareConfig = useVoiceStore((s) => s.screenShareConfig);
  const setScreenShareConfig = useVoiceStore((s) => s.setScreenShareConfig);
  const setParticipantSpeaking = useVoiceStore((s) => s.setParticipantSpeaking);
  const screenShareLayout = useVoiceStore((s) => s.screenShareLayout);
  const setScreenShareLayout = useVoiceStore((s) => s.setScreenShareLayout);
  const webcamShape = useVoiceStore((s) => s.webcamShape);
  const setWebcamShape = useVoiceStore((s) => s.setWebcamShape);
  const webcamSize = useVoiceStore((s) => s.webcamSize);
  const setWebcamSize = useVoiceStore((s) => s.setWebcamSize);
  const isScreenDetached = useVoiceStore((s) => s.isScreenDetached);
  const setScreenDetached = useVoiceStore((s) => s.setScreenDetached);

  const [screenShareModalOpen, setScreenShareModalOpen] = useState(false);
  const [webcamPosition, setWebcamPosition] = useState<{ xPercent: number; yPercent: number }>({
    xPercent: 74,
    yPercent: 60,
  });
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  // Sincroniza o MediaStream imediatamente em qualquer montagem/remontagem de layout sem tela preta
  const setScreenVideoRef = useCallback((node: HTMLVideoElement | null) => {
    screenVideoRef.current = node;
    if (node && screenStreamRef.current) {
      if (node.srcObject !== screenStreamRef.current) {
        node.srcObject = screenStreamRef.current;
      }
      node.play().catch(() => {});
    }
  }, []);

  const setCameraVideoRef = useCallback((node: HTMLVideoElement | null) => {
    cameraVideoRef.current = node;
    if (node && cameraStreamRef.current) {
      if (node.srcObject !== cameraStreamRef.current) {
        node.srcObject = cameraStreamRef.current;
      }
      node.play().catch(() => {});
    }
  }, []);
  const screenContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; startXPercent: number; startYPercent: number }>({
    startX: 0,
    startY: 0,
    startXPercent: 74,
    startYPercent: 60,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startXPercent: webcamPosition.xPercent,
      startYPercent: webcamPosition.yPercent,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !screenContainerRef.current) return;
    const rect = screenContainerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;

    const nextX = Math.max(1, Math.min(82, dragStartRef.current.startXPercent + deltaXPercent));
    const nextY = Math.max(3, Math.min(78, dragStartRef.current.startYPercent + deltaYPercent));
    setWebcamPosition({ xPercent: nextX, yPercent: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const snapCorner = (corner: "tl" | "tr" | "bl" | "br") => {
    switch (corner) {
      case "tl":
        setWebcamPosition({ xPercent: 3, yPercent: 6 });
        break;
      case "tr":
        setWebcamPosition({ xPercent: 76, yPercent: 6 });
        break;
      case "bl":
        setWebcamPosition({ xPercent: 3, yPercent: 66 });
        break;
      case "br":
        setWebcamPosition({ xPercent: 76, yPercent: 66 });
        break;
    }
  };

  const handleTogglePiP = async () => {
    try {
      if (typeof document !== "undefined" && (document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture();
        setScreenDetached(false);
      } else if (
        screenVideoRef.current &&
        typeof document !== "undefined" &&
        (document as any).pictureInPictureEnabled
      ) {
        await screenVideoRef.current.requestPictureInPicture();
        setScreenDetached(true);
      } else {
        setScreenDetached(!isScreenDetached);
      }
    } catch {
      setScreenDetached(!isScreenDetached);
    }
  };

  const getWebcamSizeClass = () => {
    if (webcamShape === "circle") {
      switch (webcamSize) {
        case "sm":
          return "w-20 h-20";
        case "lg":
          return "w-36 h-36";
        default:
          return "w-28 h-28";
      }
    } else {
      switch (webcamSize) {
        case "sm":
          return "w-36 h-20";
        case "lg":
          return "w-64 h-36";
        default:
          return "w-48 h-28";
      }
    }
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setScreenSharing(false);
      setScreenShareConfig(null);
      return;
    }

    setScreenShareModalOpen(true);
  };

  const handleStartScreenShare = async (config: ScreenShareConfig) => {
    setScreenShareConfig(config);
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: config.fps, max: config.fps },
            width: { ideal: config.resolution === "1080p" ? 1920 : 1280 },
            height: { ideal: config.resolution === "1080p" ? 1080 : 720 },
            displaySurface: config.sourceType === "screen" ? "monitor" : "window",
          },
          audio: false,
        } as MediaStreamConstraints);
        screenStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            screenStreamRef.current = null;
            setScreenSharing(false);
            setScreenShareConfig(null);
          };
        }
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
        setScreenSharing(true);
      } else {
        setScreenSharing(true);
      }
    } catch {
      // Se prompt for cancelado pelo usuário ou sem permissão
      setScreenSharing(false);
      setScreenShareConfig(null);
    }
  };

  const handleToggleCamera = async () => {
    if (isCameraOn) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraOn(false);
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            cameraStreamRef.current = null;
            setCameraOn(false);
          };
        }
        setCameraOn(true);
      } else {
        setCameraOn(true);
      }
    } catch {
      // Sem permissão de câmera ou cancelado
    }
  };

  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStreamRef.current) {
      if (screenVideoRef.current.srcObject !== screenStreamRef.current) {
        screenVideoRef.current.srcObject = screenStreamRef.current;
      }
      screenVideoRef.current.play().catch(() => {});
    }
  }, [isScreenSharing, screenShareLayout, isScreenDetached]);

  useEffect(() => {
    const video = screenVideoRef.current;
    if (!video) return;

    const onEnterPiP = () => setScreenDetached(true);
    const onLeavePiP = () => setScreenDetached(false);

    video.addEventListener("enterpictureinpicture", onEnterPiP);
    video.addEventListener("leavepictureinpicture", onLeavePiP);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPiP);
      video.removeEventListener("leavepictureinpicture", onLeavePiP);
    };
  }, [isScreenSharing, screenShareLayout]);

  useEffect(() => {
    if (isCameraOn && cameraVideoRef.current && cameraStreamRef.current) {
      if (cameraVideoRef.current.srcObject !== cameraStreamRef.current) {
        cameraVideoRef.current.srcObject = cameraStreamRef.current;
      }
      cameraVideoRef.current.play().catch(() => {});
    }
  }, [isCameraOn, screenShareLayout, isScreenDetached]);

  useEffect(() => {
    return () => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [lastSound, setLastSound] = useState<SoundEffect | null>(null);

  const myUserId = useUiStore((s) => s.myUserId);
  const activeGuildId = useUiStore((s) => s.activeGuildId ?? guildId ?? "");
  const setActiveChannel = useUiStore((s) => s.setActiveChannel);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);

  const profileDisplayName = useProfileStore((s) => s.displayName);
  const profileAvatarUrl = useProfileStore((s) => s.avatarUrl);
  const myAppwriteAvatarUrl = useProfileStore((s) => s.appwriteAvatarUrl);

  const guildProfiles = useSyncStore((s) =>
    activeGuildId && activeGuildId !== "home" ? s.guildMemberProfiles[activeGuildId] : undefined,
  );

  const activeGuild = useSyncStore((s) => s.guilds.find((g) => g.guildId === activeGuildId));
  const effectiveUserId =
    myUserId || (typeof matrixService?.getUserId === "function" ? matrixService.getUserId() : "") || "me";
  const isGuildOwner = Boolean(
    activeGuild && (activeGuild as any).createdBy && effectiveUserId && (activeGuild as any).createdBy === effectiveUserId,
  );
  const guildRoles = useSyncStore((s) => (activeGuildId ? s.guildRoles[activeGuildId] ?? EMPTY_GUILD_ROLES : EMPTY_GUILD_ROLES));
  const userRoleIds = useSyncStore((s) =>
    activeGuildId && effectiveUserId ? s.guildMemberRoles[activeGuildId]?.[effectiveUserId] ?? EMPTY_ROLES : EMPTY_ROLES,
  );
  const channelConfig = useSyncStore((s) => s.channelPermissions[channelId]);

  const canConnectVoice = hasChannelPermission("CONNECT_VOICE", {
    userId: effectiveUserId,
    isGuildOwner,
    userRoleIds: userRoleIds || [],
    guildRoles: (guildRoles as any[]) || [],
    channelConfig,
    channelType: "voice",
  });

  const canSpeak = hasChannelPermission("SPEAK", {
    userId: effectiveUserId,
    isGuildOwner,
    userRoleIds: userRoleIds || [],
    guildRoles: (guildRoles as any[]) || [],
    channelConfig,
    channelType: "voice",
  });

  // Participante do usuário local
  const myGuildProfile = effectiveUserId ? guildProfiles?.[effectiveUserId] : undefined;
  const myEffectiveName =
    myGuildProfile?.nickname || profileDisplayName || effectiveUserId.split(":")[0].replace("@", "") || "Você";
  const myEffectiveAvatar =
    (effectiveUserId ? guildProfiles?.[effectiveUserId]?.avatarUrl : null) ||
    profileAvatarUrl ||
    myAppwriteAvatarUrl ||
    null;

  const hasConnectedRef = useRef(false);

  // Canal de áudio é estritamente de áudio: ao abrir o canal, conecta automaticamente à voz (se permitido)
  useEffect(() => {
    if (!canConnectVoice) return;
    if (!hasConnectedRef.current && activeVoiceChannelId !== channelId) {
      hasConnectedRef.current = true;
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
            isMuted: !canSpeak,
            isDeafened: false,
            isSpeaking: false,
            volume: 100,
          },
        ],
      );
    }
  }, [channelId, activeVoiceChannelId, activeGuildId, guildId, guildName, effectiveUserId, myEffectiveName, myEffectiveAvatar, connectVoice, canConnectVoice, canSpeak]);

  // Ao sair/desconectar do canal de voz, volta imediatamente para o canal de texto da guilda
  const handleDisconnect = () => {
    hasConnectedRef.current = true;
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    disconnectVoice();
    if (channelId.startsWith("temp-voice-") && activeGuildId) {
      const existing = (channelsByGuild[activeGuildId] ?? []).filter((c) => c.channelId !== channelId);
      useSyncStore.getState().setChannels(activeGuildId, existing);
    }
    const guildChannels = (activeGuildId ? channelsByGuild[activeGuildId] : []) ?? [];
    const firstTextChannel = guildChannels.find((c) => c.type !== "voice");
    setActiveChannel(firstTextChannel?.channelId ?? null);
  };

  const myParticipant = participants.find(
    (p) => p.userId === effectiveUserId || p.userId === "me" || p.userId === myUserId,
  );
  const isMyMuted = !canSpeak || (myParticipant?.isMuted ?? false);
  const isMyDeafened = myParticipant?.isDeafened ?? false;

  const isStudioWebcamActive = Boolean(
    isScreenSharing && isCameraOn && screenShareLayout === "studio" && !isScreenDetached,
  );

  useVoiceActivity({
    enabled: Boolean(canConnectVoice && canSpeak && !isMyMuted && !isMyDeafened),
    isMuted: isMyMuted || isMyDeafened,
    onSpeakingChange: (speaking) => {
      setSpeaking(speaking);
      if (effectiveUserId) {
        setParticipantSpeaking(effectiveUserId, speaking);
      }
      setParticipantSpeaking("me", speaking);
    },
  });

  if (!canConnectVoice) {
    return (
      <div
        data-testid="voice-stage-restricted"
        className="flex flex-1 flex-col items-center justify-center h-full w-full bg-bg p-6 text-center select-none"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
          <Lock size={32} weight="bold" />
        </div>
        <h2 className="font-display text-xl font-bold text-txt">Acesso Restrito ao Canal de Áudio</h2>
        <p className="mt-1.5 text-xs text-mut max-w-md leading-relaxed">
          Você não tem permissão para conectar neste canal de voz (<span className="text-txt font-semibold">#{channelName}</span>).
        </p>
        <button
          type="button"
          onClick={handleDisconnect}
          className="mt-5 px-4 py-2 rounded-xl bg-acc text-bg text-xs font-semibold shadow-lg shadow-acc/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          Voltar para os canais de texto
        </button>
      </div>
    );
  }

  const renderParticipantCard = (participant: (typeof participants)[number]) => {
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
      <MemberContextMenu
        key={participant.userId}
        userId={memberUserId}
        displayName={memberNick}
        avatarUrl={memberAvatar}
        onOpenProfile={() => setOpenMemberId(participant.userId)}
      >
        <div className="relative w-full">
          <Popover
            open={openMemberId === participant.userId}
            onOpenChange={(open) => setOpenMemberId(open ? participant.userId : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Perfil de ${memberNick}`}
                className={`cursor-pointer group relative flex flex-col items-center justify-center w-full min-h-[190px] p-4 rounded-2xl transition-all duration-200 select-none ${
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

                {/* Câmera Ao Vivo ou Avatar */}
                {isMe && isCameraOn && !isStudioWebcamActive ? (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden border border-white/[0.1] shadow-inner bg-black mb-2">
                    <video
                      ref={setCameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white">
                      <VideoCamera size={12} weight="fill" className="text-online" />
                      <span>Câmera ativa</span>
                    </div>
                  </div>
                ) : (
                  /* Avatar Central com Foto e Anel de Fala */
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
                )}

                {/* Indicação se câmera está na tela compartilhada (Modo Estúdio) */}
                {isMe && isCameraOn && isStudioWebcamActive && (
                  <span className="mt-1 px-2 py-0.5 rounded-md bg-acc/15 text-acc text-[10px] font-semibold border border-acc/30">
                    Webcam no Estúdio
                  </span>
                )}

                {/* Apelido e Identificador */}
                <div className="mt-3 flex flex-col items-center max-w-[90%]">
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
      </MemberContextMenu>
    );
  };

  const renderScreenShareStage = () => {
    if (!isScreenSharing) return null;

    return (
      <div
        ref={screenContainerRef}
        className={`relative w-full mb-6 rounded-2xl overflow-hidden shadow-2xl flex flex-col ${
          isScreenDetached
            ? "bg-surf/90 border border-acc/30 p-8 items-center justify-center text-center"
            : "bg-black/95 border border-white/[0.1] aspect-video max-h-[520px]"
        } animate-in fade-in-0 duration-200 select-none`}
      >
        {isScreenDetached ? (
          <div className="flex flex-col items-center justify-center text-center py-4 animate-in fade-in-0 duration-200">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-acc/15 border border-acc/30 text-acc mb-3 shadow-lg shadow-acc/10">
              <PictureInPicture size={30} weight="bold" />
            </div>
            <h3 className="font-display text-base font-bold text-txt">Tela Destacada do Palco</h3>
            <p className="text-xs text-mut max-w-md mt-1 mb-5 leading-relaxed">
              A transmissão está em janela flutuante / Picture-in-Picture. Você pode movê-la livremente pela área de trabalho ou para outro monitor.
            </p>
            <button
              type="button"
              onClick={handleTogglePiP}
              className="cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-xl bg-acc text-bg text-xs font-semibold shadow-lg shadow-acc/20 hover:opacity-90 active:scale-95 transition-all"
            >
              <ArrowsInSimple size={16} weight="bold" />
              <span>Fixar Tela de Volta ao Palco</span>
            </button>
          </div>
        ) : (
          <>
            {/* Header Superior da Transmissão e Controles de Layout */}
            <div className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Television size={16} weight="bold" className="text-acc" />
                  <span>Transmitindo Tela</span>
                  {screenShareConfig?.sourceName && (
                    <span className="text-white/60 font-normal lowercase truncate max-w-[130px] sm:max-w-xs">
                      ({screenShareConfig.sourceName})
                    </span>
                  )}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.1] text-[10px] font-mono text-white/80">
                  {screenShareConfig ? `${screenShareConfig.resolution} ${screenShareConfig.fps}fps` : "1080p 60fps"}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Seletor de Modos de Visualização */}
                <div className="flex items-center bg-black/60 border border-white/[0.12] rounded-xl p-0.5 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setScreenShareLayout("studio")}
                    title="Modo Estúdio: Câmera sobreposta à tela como webcam de streamer"
                    className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      screenShareLayout === "studio"
                        ? "bg-acc text-bg shadow-sm"
                        : "text-white/70 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <Broadcast size={14} weight="bold" />
                    <span>Estúdio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScreenShareLayout("split")}
                    title="Modo Split / Grade: Tela lado a lado com os participantes"
                    className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      screenShareLayout === "split"
                        ? "bg-acc text-bg shadow-sm"
                        : "text-white/70 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <Columns size={14} weight="bold" />
                    <span>Grade</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScreenShareLayout("fullscreen")}
                    title="Modo Cinema: Tela limpa e focada"
                    className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      screenShareLayout === "fullscreen"
                        ? "bg-acc text-bg shadow-sm"
                        : "text-white/70 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <SquaresFour size={14} weight="bold" />
                    <span>Cinema</span>
                  </button>
                </div>

                {/* Botão Soltar Tela / Picture-in-Picture */}
                <button
                  type="button"
                  onClick={handleTogglePiP}
                  title="Soltar tela em janela flutuante / Picture-in-Picture para mover livremente para outro monitor"
                  aria-label="Soltar tela em janela flutuante"
                  className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.1] hover:bg-white/[0.2] text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95 border border-white/[0.1]"
                >
                  <PictureInPicture size={15} weight="bold" />
                  <span className="hidden sm:inline">Soltar Tela</span>
                </button>

                {/* Botão Parar Transmissão */}
                <button
                  type="button"
                  onClick={handleToggleScreenShare}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
                >
                  <StopCircle size={15} weight="bold" />
                  <span>Parar Transmissão</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Video Player Principal da Tela: PERMANECE NO DOM para sustentar a sessão nativa de PiP ativa no Windows */}
        <video
          ref={setScreenVideoRef}
          autoPlay
          playsInline
          muted
          className={
            isScreenDetached
              ? "opacity-0 pointer-events-none absolute w-1 h-1 -z-50"
              : "w-full h-full object-contain"
          }
        />

        {/* Overlaid Draggable Webcam in Studio Mode */}
        {!isScreenDetached && isStudioWebcamActive && (
          <div
            role="region"
            aria-label="Webcam Flutuante do Modo Estúdio"
            style={{
              position: "absolute",
              left: `${webcamPosition.xPercent}%`,
              top: `${webcamPosition.yPercent}%`,
              touchAction: "none",
              zIndex: 30,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`group cursor-grab active:cursor-grabbing select-none transition-shadow ${getWebcamSizeClass()} ${
              webcamShape === "circle" ? "rounded-full aspect-square" : "rounded-2xl"
            } overflow-hidden shadow-2xl border-2 ${
              isSpeaking
                ? "border-online ring-4 ring-online/40 shadow-online/30"
                : "border-white/30 hover:border-white/60"
            } bg-black/90 backdrop-blur-md`}
          >
            {/* Câmera da Webcam */}
            <video
              ref={setCameraVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover pointer-events-none"
            />

            {/* Controles de Hover da Webcam */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 pointer-events-auto">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-white/90 bg-black/70 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                  <DotsSixVertical size={12} weight="bold" />
                  <span>Mover</span>
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title="Fixar Topo Esquerda"
                    onClick={(e) => { e.stopPropagation(); snapCorner("tl"); }}
                    className="cursor-pointer px-1 py-0.5 rounded bg-black/70 hover:bg-black/90 text-white/80 hover:text-white text-[9px] font-mono"
                  >
                    TL
                  </button>
                  <button
                    type="button"
                    title="Fixar Topo Direita"
                    onClick={(e) => { e.stopPropagation(); snapCorner("tr"); }}
                    className="cursor-pointer px-1 py-0.5 rounded bg-black/70 hover:bg-black/90 text-white/80 hover:text-white text-[9px] font-mono"
                  >
                    TR
                  </button>
                  <button
                    type="button"
                    title="Fixar Base Esquerda"
                    onClick={(e) => { e.stopPropagation(); snapCorner("bl"); }}
                    className="cursor-pointer px-1 py-0.5 rounded bg-black/70 hover:bg-black/90 text-white/80 hover:text-white text-[9px] font-mono"
                  >
                    BL
                  </button>
                  <button
                    type="button"
                    title="Fixar Base Direita"
                    onClick={(e) => { e.stopPropagation(); snapCorner("br"); }}
                    className="cursor-pointer px-1 py-0.5 rounded bg-black/70 hover:bg-black/90 text-white/80 hover:text-white text-[9px] font-mono"
                  >
                    BR
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  title={webcamShape === "rectangle" ? "Mudar para Círculo" : "Mudar para Retângulo"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setWebcamShape(webcamShape === "rectangle" ? "circle" : "rectangle");
                  }}
                  className="cursor-pointer px-2 py-0.5 rounded bg-black/70 hover:bg-black text-white text-[10px] font-medium"
                >
                  {webcamShape === "rectangle" ? "Redondo" : "Retangular"}
                </button>
                <div className="flex items-center gap-1 bg-black/70 rounded p-0.5">
                  {(["sm", "md", "lg"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setWebcamSize(s); }}
                      className={`cursor-pointer px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                        webcamSize === s ? "bg-acc text-bg" : "text-white/70 hover:text-white"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Badge de Fala Ativa na Webcam */}
            {isSpeaking && (
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-online/90 text-bg text-[9px] font-bold shadow-md">
                <Waveform size={10} weight="bold" />
                <span>Você</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      data-testid="voice-stage"
      className="flex flex-1 flex-col h-full w-full overflow-hidden bg-bg font-ui select-none"
    >
      {/* Header do Canal de Áudio (Estritamente de Voz) */}
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
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-online/15 border border-online/30 text-[10px] font-semibold text-online shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-online animate-pulse" />
                <span>{isConnecting ? "Conectando..." : "Áudio Conectado"}</span>
                <span className="font-mono text-[9px] text-online/70 ml-1">({pingMs}ms)</span>
              </span>
              {!canSpeak && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold text-amber-400">
                  Modo Ouvinte
                </span>
              )}
            </div>
            {topic && <p className="text-[11px] text-mut truncate">{topic}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge de quantidade de membros no áudio */}
          <span className="text-xs text-mut/80 font-medium bg-surf2/80 px-2.5 py-1 rounded-xl border border-bd-subtle">
            {participants.length} membro(s) no áudio
          </span>

          <button
            type="button"
            onClick={handleDisconnect}
            aria-label="Desconectar do canal de voz"
            title="Sair do canal de áudio e voltar ao canal de texto"
            className="cursor-pointer flex h-8 items-center gap-1.5 px-3 rounded-xl bg-err/15 text-err border border-err/30 hover:bg-err hover:text-white transition-all active:scale-95 text-xs font-semibold shadow-xs"
          >
            <PhoneDisconnect size={15} weight="bold" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal: Palco 100% de Áudio com Cards dos Participantes */}
      <div className="flex flex-1 min-h-0 w-full flex-col justify-between overflow-y-auto p-6 scrollbar-thin">
        {participants.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center max-w-md mx-auto my-auto animate-in fade-in-0 duration-200">
            <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-online/10 text-online border border-online/25 shadow-xl shadow-online/15">
              <SpeakerHigh size={40} weight="bold" />
            </div>
            <h2 className="font-display text-xl font-bold text-txt">
              Canal de Áudio #{channelName}
            </h2>
            <p className="mt-1 text-xs text-mut leading-relaxed max-w-sm">
              Conectando aos servidores de voz com baixa latência e animação em tempo real...
            </p>
          </div>
        ) : (
          <div className="flex flex-col w-full">
            {/* Modo Split / Grade: Tela Lado a Lado com os Participantes */}
            {isScreenSharing && !isScreenDetached && screenShareLayout === "split" ? (
              <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
                <div className="flex-1 w-full min-w-0">
                  {renderScreenShareStage()}
                </div>
                <div className="w-full lg:w-80 shrink-0 flex flex-col gap-3 max-h-[520px] overflow-y-auto scrollbar-thin bg-card-bg/40 p-3 rounded-2xl border border-bd-subtle">
                  <div className="flex items-center justify-between pb-2 border-b border-bd-subtle">
                    <span className="text-xs font-semibold text-mut uppercase tracking-wider">
                      Grade ({participants.length})
                    </span>
                    <span className="text-[10px] text-acc font-mono">Modo Grade</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {participants.map((p) => renderParticipantCard(p))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col w-full">
                {renderScreenShareStage()}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 w-full auto-rows-fr">
                  {participants.map((p) => renderParticipantCard(p))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floating Soundboard Notification Badge */}
        {lastSound && (
          <div className="flex justify-center w-full mb-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-acc/15 border border-acc/30 text-acc text-xs font-semibold shadow-lg backdrop-blur-md">
              <span className="text-base">{lastSound.emoji}</span>
              <span>{lastSound.name}</span>
            </div>
          </div>
        )}

        {/* Barra Flutuante Inferior de Controles de Áudio (Ergonomia Discord) */}
        <div className="mt-4 flex justify-center w-full">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card-bg/95 border border-bd-subtle backdrop-blur-xl shadow-2xl">
            {/* Botão Microfone (Mudo / Desmudo) */}
            <button
              type="button"
              disabled={!canSpeak}
              onClick={() => canSpeak && toggleMute()}
              aria-label={!canSpeak ? "Modo ouvinte: sem permissão para falar" : isMyMuted ? "Ativar microfone" : "Silenciar microfone"}
              title={!canSpeak ? "Modo ouvinte: sem permissão para falar" : isMyMuted ? "Ativar microfone" : "Silenciar microfone"}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
                !canSpeak
                  ? "cursor-not-allowed opacity-40 bg-white/[0.04] text-mut border border-bd-subtle"
                  : isMyMuted
                    ? "cursor-pointer bg-err text-white shadow-md shadow-err/20 hover:bg-err-press"
                    : "cursor-pointer bg-white/[0.06] text-txt hover:bg-white/[0.12] border border-bd-subtle"
              }`}
            >
              {isMyMuted || !canSpeak ? <MicrophoneSlash size={18} weight="bold" /> : <Microphone size={18} weight="bold" />}
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

            {/* Soundboard Comunitário */}
            <SoundboardPopover
              onPlaySound={(sound) => {
                setLastSound(sound);
                setTimeout(() => setLastSound((curr) => (curr?.id === sound.id ? null : curr)), 2500);
              }}
            />

            {/* Botão Câmera */}
            <button
              type="button"
              onClick={handleToggleCamera}
              aria-label={isCameraOn ? "Desativar câmera" : "Ativar câmera"}
              title={isCameraOn ? "Desativar câmera" : "Ativar câmera"}
              className={`cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
                isCameraOn
                  ? "bg-online text-bg font-bold shadow-md shadow-online/30 border border-online"
                  : "bg-white/[0.06] text-txt hover:bg-white/[0.12] border border-bd-subtle"
              }`}
            >
              {isCameraOn ? <VideoCamera size={18} weight="bold" /> : <VideoCameraSlash size={18} weight="bold" />}
            </button>

            {/* Botão Compartilhar Tela */}
            <button
              type="button"
              onClick={handleToggleScreenShare}
              aria-label={isScreenSharing ? "Parar de compartilhar tela" : "Compartilhar tela"}
              title={isScreenSharing ? "Parar de compartilhar tela" : "Compartilhar tela"}
              className={`cursor-pointer flex h-10 items-center gap-1.5 px-3 rounded-xl transition-all active:scale-95 text-xs font-semibold ${
                isScreenSharing
                  ? "bg-acc text-bg shadow-md shadow-acc/30 border border-acc"
                  : "bg-white/[0.06] text-txt hover:bg-white/[0.12] border border-bd-subtle"
              }`}
            >
              <Screencast size={18} weight="bold" />
              <span className="hidden sm:inline">{isScreenSharing ? "Compartilhando" : "Compartilhar Tela"}</span>
            </button>

            <div className="h-6 w-[1px] bg-bd-subtle mx-1" />

            {/* Botão Desconectar da Chamada */}
            <button
              type="button"
              onClick={handleDisconnect}
              aria-label="Desconectar da chamada de voz"
              title="Desconectar da chamada de voz e voltar para o canal de texto"
              className="cursor-pointer flex h-10 px-3.5 items-center gap-1.5 rounded-xl bg-err/15 text-err border border-err/30 hover:bg-err hover:text-white transition-all active:scale-95 text-xs font-semibold shadow-xs"
            >
              <PhoneDisconnect size={17} weight="bold" />
              <span className="hidden sm:inline">Desconectar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Nativo do Echo para Seleção de Tela e Janela (Padrão Discord, sem webview/barra externa) */}
      <ScreenShareModal
        open={screenShareModalOpen}
        onClose={() => setScreenShareModalOpen(false)}
        onStartShare={handleStartScreenShare}
      />
    </div>
  );
}

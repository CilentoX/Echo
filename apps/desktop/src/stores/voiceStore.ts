import { create } from "zustand";
import { useUiStore } from "./uiStore";
import { webrtcVoice } from "@/lib/media/webrtcVoice";
import { audioEngine } from "@/lib/media/audioEngine";

export interface ScreenShareConfig {
  sourceId: string;
  sourceName: string;
  sourceType: "screen" | "window";
  resolution: "720p" | "1080p";
  fps: 30 | 60;
}

export type ScreenShareLayout = "studio" | "split" | "fullscreen";
export type WebcamShape = "rectangle" | "circle";
export type WebcamSize = "sm" | "md" | "lg";

export interface VoiceParticipant {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
  isScreenSharing?: boolean;
  hasCamera?: boolean;
  volume?: number; // 0 a 200 (100 padrão)
}

export interface VoiceState {
  activeVoiceGuildId: string | null;
  activeVoiceGuildName: string | null;
  activeVoiceChannelId: string | null;
  activeVoiceChannelName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  pingMs: number;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  isCameraOn: boolean;
  screenShareConfig: ScreenShareConfig | null;
  speakingMembers: string[];
  participants: VoiceParticipant[];
  screenShareLayout: ScreenShareLayout;
  webcamShape: WebcamShape;
  webcamSize: WebcamSize;
  isScreenDetached: boolean;
  remoteVideoStreams: Record<string, MediaStream>;
  activeStreamUserId: string | null;

  connectVoice: (
    guildId: string,
    guildName: string,
    channelId: string,
    channelName: string,
    initialParticipants?: VoiceParticipant[],
  ) => void;
  disconnectVoice: () => void;
  setSpeaking: (isSpeaking: boolean) => void;
  setScreenSharing: (isScreenSharing: boolean) => void;
  setCameraOn: (isCameraOn: boolean) => void;
  setScreenShareConfig: (config: ScreenShareConfig | null) => void;
  setScreenShareLayout: (layout: ScreenShareLayout) => void;
  setWebcamShape: (shape: WebcamShape) => void;
  setWebcamSize: (size: WebcamSize) => void;
  setScreenDetached: (detached: boolean) => void;
  setParticipantSpeaking: (userId: string, isSpeaking: boolean) => void;
  setPing: (pingMs: number) => void;
  setParticipantVolume: (userId: string, volume: number) => void;
  addParticipant: (participant: VoiceParticipant) => void;
  removeParticipant: (userId: string) => void;
  moveParticipantToChannel: (
    userId: string,
    targetChannelId: string,
    targetChannelName: string,
    currentUserId?: string,
  ) => void;
  toggleMute: (userId?: string) => void;
  toggleDeafen: (userId?: string) => void;
  setParticipantMuted: (userId: string, isMuted: boolean) => void;
  setParticipantDeafened: (userId: string, isDeafened: boolean) => void;
  setRemoteVideoStream: (userId: string, stream: MediaStream | null) => void;
  setActiveStreamUserId: (userId: string | null) => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  activeVoiceGuildId: null,
  activeVoiceGuildName: null,
  activeVoiceChannelId: null,
  activeVoiceChannelName: null,
  isConnected: false,
  isConnecting: false,
  pingMs: 24,
  isSpeaking: false,
  isScreenSharing: false,
  isCameraOn: false,
  screenShareConfig: null,
  speakingMembers: [],
  participants: [],
  screenShareLayout: "studio",
  webcamShape: "rectangle",
  webcamSize: "md",
  isScreenDetached: false,
  remoteVideoStreams: {},
  activeStreamUserId: null,

  connectVoice: (guildId, guildName, channelId, channelName, initialParticipants) => {
    // Se já estiver conectado no mesmo canal, não faz nada
    if (get().activeVoiceChannelId === channelId && get().isConnected) return;

    const myUserId = useUiStore.getState().myUserId || "me";
    const firstP = initialParticipants?.[0];
    const username = firstP?.username || "Você";
    const avatarUrl = firstP?.avatarUrl || null;
    const isMuted = Boolean(firstP?.isMuted);
    const isDeafened = Boolean(firstP?.isDeafened);

    const wasConnected = get().isConnected;

    set({
      activeVoiceGuildId: guildId,
      activeVoiceGuildName: guildName,
      activeVoiceChannelId: channelId,
      activeVoiceChannelName: channelName,
      isConnecting: !wasConnected,
      isConnected: true,
      pingMs: 0,
      participants: initialParticipants ?? [
        {
          userId: myUserId,
          username,
          avatarUrl,
          isMuted,
          isDeafened,
          isSpeaking: false,
          isScreenSharing: get().isScreenSharing,
          hasCamera: get().isCameraOn,
          volume: 100,
        },
      ],
    });

    // Inicia conexão WebRTC real e presença em rede
    void webrtcVoice.join(
      guildId,
      channelId,
      myUserId,
      username,
      avatarUrl,
      isMuted,
      isDeafened,
      {
        onParticipantsUpdate: (serverParticipants) => {
          set((state) => {
            const currentUiId = useUiStore.getState().myUserId;
            const currentRealId = currentUiId || webrtcVoice.getMyUserId() || myUserId || "me";
            const myNorm = currentRealId.toLowerCase();

            const currentMyUser = state.participants.find((p) => {
              const pNorm = (p.userId || "").toLowerCase();
              return pNorm === myNorm || pNorm === "me" || pNorm === (myUserId || "").toLowerCase();
            });

            // Filtra os outros participantes de forma defensiva para que o próprio usuário nunca seja duplicado
            const others = serverParticipants.filter((p) => {
              const pNorm = (p.userId || "").toLowerCase();
              return pNorm && pNorm !== "me" && pNorm !== myNorm && pNorm !== (myUserId || "").toLowerCase();
            });

            const merged = [
              currentMyUser || {
                userId: currentRealId,
                username,
                avatarUrl,
                isMuted: state.participants[0]?.isMuted ?? isMuted,
                isDeafened: state.participants[0]?.isDeafened ?? isDeafened,
                isSpeaking: state.isSpeaking,
                isScreenSharing: state.isScreenSharing,
                hasCamera: state.isCameraOn,
                volume: 100,
              },
              ...others.map((o) => ({
                userId: o.userId,
                username: o.username || o.userId.replace(/^@/, "").split(":")[0],
                avatarUrl: o.avatarUrl ?? null,
                isMuted: Boolean(o.isMuted),
                isDeafened: Boolean(o.isDeafened),
                isSpeaking: Boolean(o.isSpeaking),
                isScreenSharing: Boolean(o.isScreenSharing),
                hasCamera: Boolean(o.hasCamera),
                volume: 100,
              })),
            ];

            // Se alguém estiver compartilhando tela e não tivermos ninguém focado, foca automaticamente
            let activeStreamUserId = state.activeStreamUserId;
            if (!activeStreamUserId) {
              const remoteSharing = merged.find(
                (p) => p.isScreenSharing && p.userId !== currentRealId && p.userId !== "me"
              );
              if (remoteSharing) {
                activeStreamUserId = remoteSharing.userId;
              } else if (state.isScreenSharing) {
                activeStreamUserId = currentRealId;
              }
            }

            return { participants: merged, activeStreamUserId };
          });
        },
        onRemoteVideoStream: (userId, stream) => {
          get().setRemoteVideoStream(userId, stream);
        },
        onSpeakingChange: (speaking) => {
          get().setSpeaking(speaking);
        },
        onParticipantSpeaking: (userId, speaking) => {
          get().setParticipantSpeaking(userId, speaking);
        },
        onRttUpdate: (rttMs) => {
          get().setPing(rttMs);
        },
      },
    ).finally(() => {
      set({
        isConnected: true,
        isConnecting: false,
      });
      void audioEngine.playVoiceConnected();
    });
  },

  disconnectVoice: () => {
    void webrtcVoice.leave();
    void audioEngine.playVoiceDisconnected();
    set({
      activeVoiceGuildId: null,
      activeVoiceGuildName: null,
      activeVoiceChannelId: null,
      activeVoiceChannelName: null,
      isConnected: false,
      isConnecting: false,
      isSpeaking: false,
      isScreenSharing: false,
      isCameraOn: false,
      screenShareConfig: null,
      speakingMembers: [],
      participants: [],
      remoteVideoStreams: {},
      activeStreamUserId: null,
    });
  },

  setScreenSharing: (isScreenSharing) => {
    set((state) => {
      const myId = state.participants[0]?.userId ?? "me";
      return {
        isScreenSharing,
        activeStreamUserId: isScreenSharing ? myId : (state.activeStreamUserId === myId ? null : state.activeStreamUserId),
        participants: state.participants.map((p) =>
          p.userId === "me" || p.userId === myId ? { ...p, isScreenSharing } : p,
        ),
      };
    });
  },

  setCameraOn: (isCameraOn) => {
    set((state) => {
      const myId = state.participants[0]?.userId ?? "me";
      return {
        isCameraOn,
        participants: state.participants.map((p) =>
          p.userId === "me" || p.userId === myId ? { ...p, hasCamera: isCameraOn } : p,
        ),
      };
    });
  },

  setRemoteVideoStream: (userId, stream) => {
    set((state) => {
      const next = { ...state.remoteVideoStreams };
      if (!stream) {
        delete next[userId];
        const nextActive = state.activeStreamUserId === userId ? null : state.activeStreamUserId;
        return { remoteVideoStreams: next, activeStreamUserId: nextActive };
      }
      next[userId] = stream;
      const nextActive = state.activeStreamUserId || userId;
      return { remoteVideoStreams: next, activeStreamUserId: nextActive };
    });
  },

  setActiveStreamUserId: (userId) => set({ activeStreamUserId: userId }),
  setScreenShareConfig: (screenShareConfig) => set({ screenShareConfig }),
  setScreenShareLayout: (screenShareLayout) => set({ screenShareLayout }),
  setWebcamShape: (webcamShape) => set({ webcamShape }),
  setWebcamSize: (webcamSize) => set({ webcamSize }),
  setScreenDetached: (isScreenDetached) => set({ isScreenDetached }),

  setSpeaking: (isSpeaking) => {
    set((state) => {
      const myId = state.participants[0]?.userId ?? "me";
      const speaking = isSpeaking
        ? Array.from(new Set([...state.speakingMembers, "me", myId]))
        : state.speakingMembers.filter((id) => id !== "me" && id !== myId);

      return {
        isSpeaking,
        speakingMembers: speaking,
        participants: state.participants.map((p) =>
          p.userId === "me" || p.userId === myId ? { ...p, isSpeaking } : p,
        ),
      };
    });
  },

  setParticipantSpeaking: (userId, isSpeaking) => {
    set((state) => {
      const speaking = isSpeaking
        ? Array.from(new Set([...state.speakingMembers, userId]))
        : state.speakingMembers.filter((id) => id !== userId);

      return {
        speakingMembers: speaking,
        participants: state.participants.map((p) =>
          p.userId === userId ? { ...p, isSpeaking } : p,
        ),
      };
    });
  },

  setPing: (pingMs) => set({ pingMs }),

  setParticipantVolume: (userId, volume) => {
    webrtcVoice.setParticipantVolume(userId, volume);
    set((state) => ({
      participants: state.participants.map((p) =>
        p.userId === userId ? { ...p, volume } : p,
      ),
    }));
  },

  addParticipant: (participant) => {
    set((state) => {
      if (state.participants.some((p) => p.userId === participant.userId)) {
        return state;
      }
      return {
        participants: [...state.participants, participant],
      };
    });
  },

  removeParticipant: (userId) => {
    set((state) => {
      const nextStreams = { ...state.remoteVideoStreams };
      delete nextStreams[userId];
      return {
        participants: state.participants.filter((p) => p.userId !== userId),
        speakingMembers: state.speakingMembers.filter((id) => id !== userId),
        remoteVideoStreams: nextStreams,
        activeStreamUserId: state.activeStreamUserId === userId ? null : state.activeStreamUserId,
      };
    });
  },

  moveParticipantToChannel: (userId, targetChannelId, targetChannelName, currentUserId) => {
    const state = get();
    const isLocalUser =
      userId === "me" ||
      (currentUserId ? userId === currentUserId : false);

    if (isLocalUser) {
      const myParticipant =
        state.participants.find((p) => p.userId === userId) || state.participants[0];

      set({
        activeVoiceChannelId: targetChannelId,
        activeVoiceChannelName: targetChannelName,
        participants: myParticipant ? [myParticipant] : [],
      });

      try {
        useUiStore.getState().setActiveChannel(targetChannelId);
      } catch {}
    } else {
      set((s) => ({
        participants: s.participants.filter((p) => p.userId !== userId),
        speakingMembers: s.speakingMembers.filter((id) => id !== userId),
      }));
    }

    try {
      window.dispatchEvent(
        new CustomEvent("echo:member-moved-voice-channel", {
          detail: { userId, targetChannelId, targetChannelName, isLocalUser },
        }),
      );
    } catch {}
  },

  toggleMute: (userId) => {
    set((state) => {
      const targetId = userId ?? state.participants[0]?.userId ?? "me";
      const myId = useUiStore.getState().myUserId || "me";
      const isMe = targetId === "me" || targetId === myId || targetId === state.participants[0]?.userId;

      return {
        participants: state.participants.map((p) => {
          if (p.userId === targetId || (targetId === "me" && p.userId === state.participants[0]?.userId)) {
            const nextMuted = !p.isMuted;
            if (isMe) webrtcVoice.setMicrophoneMuted(nextMuted);
            return {
              ...p,
              isMuted: nextMuted,
              isSpeaking: nextMuted ? false : p.isSpeaking,
            };
          }
          return p;
        }),
      };
    });
  },

  toggleDeafen: (userId) => {
    set((state) => {
      const targetId = userId ?? state.participants[0]?.userId ?? "me";
      const myId = useUiStore.getState().myUserId || "me";
      const isMe = targetId === "me" || targetId === myId || targetId === state.participants[0]?.userId;

      return {
        participants: state.participants.map((p) => {
          if (p.userId === targetId || (targetId === "me" && p.userId === state.participants[0]?.userId)) {
            const nextDeafened = !p.isDeafened;
            if (isMe) {
              webrtcVoice.setDeafened(nextDeafened);
              if (nextDeafened) webrtcVoice.setMicrophoneMuted(true);
            }
            return {
              ...p,
              isDeafened: nextDeafened,
              isMuted: nextDeafened ? true : p.isMuted,
              isSpeaking: nextDeafened ? false : p.isSpeaking,
            };
          }
          return p;
        }),
      };
    });
  },

  setParticipantMuted: (userId, isMuted) => {
    set((state) => ({
      participants: state.participants.map((p) =>
        p.userId === userId
          ? {
              ...p,
              isMuted,
              isSpeaking: isMuted ? false : p.isSpeaking,
            }
          : p,
      ),
    }));
  },

  setParticipantDeafened: (userId, isDeafened) => {
    set((state) => ({
      participants: state.participants.map((p) =>
        p.userId === userId
          ? {
              ...p,
              isDeafened,
              isMuted: isDeafened ? true : p.isMuted,
              isSpeaking: isDeafened ? false : p.isSpeaking,
            }
          : p,
      ),
    }));
  },
}));


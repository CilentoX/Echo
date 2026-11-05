import { create } from "zustand";

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
  toggleMute: (userId?: string) => void;
  toggleDeafen: (userId?: string) => void;
  setParticipantMuted: (userId: string, isMuted: boolean) => void;
  setParticipantDeafened: (userId: string, isDeafened: boolean) => void;
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

  connectVoice: (guildId, guildName, channelId, channelName, initialParticipants) => {
    // Se já estiver conectado no mesmo canal, não faz nada
    if (get().activeVoiceChannelId === channelId && get().isConnected) return;

    set({
      activeVoiceGuildId: guildId,
      activeVoiceGuildName: guildName,
      activeVoiceChannelId: channelId,
      activeVoiceChannelName: channelName,
      isConnecting: true,
      isConnected: false,
      pingMs: Math.floor(18 + Math.random() * 12),
      participants: initialParticipants ?? [
        {
          userId: "me",
          username: "Você",
          isMuted: false,
          isDeafened: false,
          isSpeaking: false,
          volume: 100,
        },
      ],
    });

    // Simulação síncrona / imediata de handshake WebRTC
    setTimeout(() => {
      set({
        isConnected: true,
        isConnecting: false,
      });
    }, 120);
  },

  disconnectVoice: () => {
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
    });
  },

  setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
  setCameraOn: (isCameraOn) => set({ isCameraOn }),
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
    set((state) => ({
      participants: state.participants.filter((p) => p.userId !== userId),
      speakingMembers: state.speakingMembers.filter((id) => id !== userId),
    }));
  },

  toggleMute: (userId) => {
    set((state) => {
      const targetId = userId ?? state.participants[0]?.userId ?? "me";
      return {
        participants: state.participants.map((p) => {
          if (p.userId === targetId || (targetId === "me" && p.userId === state.participants[0]?.userId)) {
            const nextMuted = !p.isMuted;
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
      return {
        participants: state.participants.map((p) => {
          if (p.userId === targetId || (targetId === "me" && p.userId === state.participants[0]?.userId)) {
            const nextDeafened = !p.isDeafened;
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


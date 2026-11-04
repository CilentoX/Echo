import { create } from "zustand";

export interface VoiceParticipant {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
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
  speakingMembers: string[];
  participants: VoiceParticipant[];

  connectVoice: (
    guildId: string,
    guildName: string,
    channelId: string,
    channelName: string,
    initialParticipants?: VoiceParticipant[],
  ) => void;
  disconnectVoice: () => void;
  setSpeaking: (isSpeaking: boolean) => void;
  setParticipantSpeaking: (userId: string, isSpeaking: boolean) => void;
  setPing: (pingMs: number) => void;
  setParticipantVolume: (userId: string, volume: number) => void;
  addParticipant: (participant: VoiceParticipant) => void;
  removeParticipant: (userId: string) => void;
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
  speakingMembers: [],
  participants: [],

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
      speakingMembers: [],
      participants: [],
    });
  },

  setSpeaking: (isSpeaking) => {
    set((state) => {
      const speaking = isSpeaking
        ? Array.from(new Set([...state.speakingMembers, "me"]))
        : state.speakingMembers.filter((id) => id !== "me");

      return {
        isSpeaking,
        speakingMembers: speaking,
        participants: state.participants.map((p) =>
          p.userId === "me" ? { ...p, isSpeaking } : p,
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
}));


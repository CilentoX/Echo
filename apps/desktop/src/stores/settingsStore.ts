import { create } from "zustand";
import { desktopConfig, type AppAudioConfig } from "@/lib/storage/desktopConfig";

export interface SettingsState {
  /** Notificações */
  nativeNotifications: boolean;   // banners do SO + click-to-focus
  messageSound: boolean;          // áudio ao receber mensagem
  mentionOnly: boolean;           // notificar apenas menções

  /** Voz e vídeo */
  microphoneEnabled: boolean;     // permitir uso do microfone / não mutado
  microphoneDevice: string | null; // ID do dispositivo selecionado
  cameraEnabled: boolean;         // permitir uso da câmera
  cameraDevice: string | null;    // ID do dispositivo selecionado
  headphonesEnabled: boolean;     // permitir saída de áudio / não ensurdecido (deafened)
  headphonesDevice: string | null; // ID do dispositivo selecionado

  /** Configurações Avançadas de Áudio */
  inputVolume: number;            // 0 a 100
  outputVolume: number;           // 0 a 100
  noiseSuppression: boolean;      // cancelamento de ruído
  echoCancellation: boolean;      // cancelamento de eco
  autoGainControl: boolean;       // controle automático de ganho
  inputMode: "voice_activity" | "push_to_talk";
  pushToTalkKey: string;

  /** Privacidade */
  onlineStatusVisible: boolean;   // outros veem se você está online
  readReceipts: boolean;          // enviar recibos de leitura
  typingVisible: boolean;         // mostrar "está digitando…"

  /** Sessões */
  currentSessionDevice: string | null;

  setNativeNotifications(v: boolean): void;
  setMessageSound(v: boolean): void;
  setMentionOnly(v: boolean): void;

  setMicrophoneEnabled(v: boolean): void;
  setMicrophoneDevice(id: string | null): void;
  setCameraEnabled(v: boolean): void;
  setCameraDevice(id: string | null): void;
  setHeadphonesEnabled(v: boolean): void;
  setHeadphonesDevice(id: string | null): void;

  setInputVolume(v: number): void;
  setOutputVolume(v: number): void;
  setNoiseSuppression(v: boolean): void;
  setEchoCancellation(v: boolean): void;
  setAutoGainControl(v: boolean): void;
  setInputMode(mode: "voice_activity" | "push_to_talk"): void;
  setPushToTalkKey(key: string): void;

  setOnlineStatusVisible(v: boolean): void;
  setReadReceipts(v: boolean): void;
  setTypingVisible(v: boolean): void;
  setCurrentSessionDevice(id: string | null): void;

  initFromDesktopConfig(): void;
  reset(): void;
}

function persistAudioConfig(state: Partial<SettingsState>) {
  try {
    const existing = (desktopConfig.get("audio") as AppAudioConfig) || {};
    desktopConfig.set("audio", {
      ...existing,
      inputDeviceId: state.microphoneDevice !== undefined ? state.microphoneDevice : existing.inputDeviceId,
      outputDeviceId: state.headphonesDevice !== undefined ? state.headphonesDevice : existing.outputDeviceId,
      inputVolume: state.inputVolume !== undefined ? state.inputVolume : existing.inputVolume,
      outputVolume: state.outputVolume !== undefined ? state.outputVolume : existing.outputVolume,
      muted: state.microphoneEnabled !== undefined ? !state.microphoneEnabled : existing.muted,
      deafened: state.headphonesEnabled !== undefined ? !state.headphonesEnabled : existing.deafened,
      noiseSuppression: state.noiseSuppression !== undefined ? state.noiseSuppression : existing.noiseSuppression,
      echoCancellation: state.echoCancellation !== undefined ? state.echoCancellation : existing.echoCancellation,
      autoGainControl: state.autoGainControl !== undefined ? state.autoGainControl : existing.autoGainControl,
      inputMode: state.inputMode !== undefined ? state.inputMode : existing.inputMode,
      pushToTalkKey: state.pushToTalkKey !== undefined ? state.pushToTalkKey : existing.pushToTalkKey,
    });
  } catch {}
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  nativeNotifications: true,
  messageSound: true,
  mentionOnly: false,

  microphoneEnabled: true,
  microphoneDevice: null,
  cameraEnabled: true,
  cameraDevice: null,
  headphonesEnabled: true,
  headphonesDevice: null,

  inputVolume: 100,
  outputVolume: 100,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  inputMode: "voice_activity",
  pushToTalkKey: "ControlLeft",

  onlineStatusVisible: true,
  readReceipts: true,
  typingVisible: true,
  currentSessionDevice: null,

  setNativeNotifications: (v) => set({ nativeNotifications: v }),
  setMessageSound: (v) => set({ messageSound: v }),
  setMentionOnly: (v) => set({ mentionOnly: v }),

  setMicrophoneEnabled: (v) => {
    set({ microphoneEnabled: v });
    persistAudioConfig({ microphoneEnabled: v });
  },
  setMicrophoneDevice: (id) => {
    set({ microphoneDevice: id });
    persistAudioConfig({ microphoneDevice: id });
  },
  setCameraEnabled: (v) => set({ cameraEnabled: v }),
  setCameraDevice: (id) => set({ cameraDevice: id }),
  setHeadphonesEnabled: (v) => {
    set({ headphonesEnabled: v });
    persistAudioConfig({ headphonesEnabled: v });
  },
  setHeadphonesDevice: (id) => {
    set({ headphonesDevice: id });
    persistAudioConfig({ headphonesDevice: id });
  },

  setInputVolume: (v) => {
    set({ inputVolume: v });
    persistAudioConfig({ inputVolume: v });
  },
  setOutputVolume: (v) => {
    set({ outputVolume: v });
    persistAudioConfig({ outputVolume: v });
  },
  setNoiseSuppression: (v) => {
    set({ noiseSuppression: v });
    persistAudioConfig({ noiseSuppression: v });
  },
  setEchoCancellation: (v) => {
    set({ echoCancellation: v });
    persistAudioConfig({ echoCancellation: v });
  },
  setAutoGainControl: (v) => {
    set({ autoGainControl: v });
    persistAudioConfig({ autoGainControl: v });
  },
  setInputMode: (mode) => {
    set({ inputMode: mode });
    persistAudioConfig({ inputMode: mode });
  },
  setPushToTalkKey: (key) => {
    set({ pushToTalkKey: key });
    persistAudioConfig({ pushToTalkKey: key });
  },

  setOnlineStatusVisible: (v) => set({ onlineStatusVisible: v }),
  setReadReceipts: (v) => set({ readReceipts: v }),
  setTypingVisible: (v) => set({ typingVisible: v }),
  setCurrentSessionDevice: (id) => set({ currentSessionDevice: id }),

  initFromDesktopConfig: () => {
    try {
      const audio = desktopConfig.get("audio") as AppAudioConfig | undefined;
      if (audio) {
        set({
          microphoneDevice: audio.inputDeviceId ?? get().microphoneDevice,
          headphonesDevice: audio.outputDeviceId ?? get().headphonesDevice,
          inputVolume: typeof audio.inputVolume === "number" ? audio.inputVolume : get().inputVolume,
          outputVolume: typeof audio.outputVolume === "number" ? audio.outputVolume : get().outputVolume,
          microphoneEnabled: audio.muted !== undefined ? !audio.muted : get().microphoneEnabled,
          headphonesEnabled: audio.deafened !== undefined ? !audio.deafened : get().headphonesEnabled,
          noiseSuppression: audio.noiseSuppression !== undefined ? audio.noiseSuppression : get().noiseSuppression,
          echoCancellation: audio.echoCancellation !== undefined ? audio.echoCancellation : get().echoCancellation,
          autoGainControl: audio.autoGainControl !== undefined ? audio.autoGainControl : get().autoGainControl,
          inputMode: audio.inputMode ?? get().inputMode,
          pushToTalkKey: audio.pushToTalkKey ?? get().pushToTalkKey,
        });
      }
    } catch {}
  },

  reset: () =>
    set({
      nativeNotifications: true,
      messageSound: true,
      mentionOnly: false,
      microphoneEnabled: true,
      microphoneDevice: null,
      cameraEnabled: true,
      cameraDevice: null,
      headphonesEnabled: true,
      headphonesDevice: null,
      inputVolume: 100,
      outputVolume: 100,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      inputMode: "voice_activity",
      pushToTalkKey: "ControlLeft",
      onlineStatusVisible: true,
      readReceipts: true,
      typingVisible: true,
      currentSessionDevice: null,
    }),
}));

// Inicializa a partir do desktopConfig se disponível
useSettingsStore.getState().initFromDesktopConfig();

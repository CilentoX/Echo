import { create } from "zustand";

export interface SettingsState {
  /** Notificações */
  nativeNotifications: boolean;   // banners do SO + click-to-focus
  messageSound: boolean;          // áudio ao receber mensagem
  mentionOnly: boolean;           // notificar apenas menções
  /** Voz e vídeo */
  microphoneEnabled: boolean;     // permitir uso do microfone em chamadas
  microphoneDevice: string | null; // dispositivo selecionado
  cameraEnabled: boolean;         // permitir uso da câmera em chamadas
  cameraDevice: string | null;    // dispositivo selecionado
  headphonesEnabled: boolean;     // usar fones de ouvido por padrão
  headphonesDevice: string | null; // dispositivo selecionado
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
  setOnlineStatusVisible(v: boolean): void;
  setReadReceipts(v: boolean): void;
  setTypingVisible(v: boolean): void;
  setCurrentSessionDevice(id: string | null): void;
  reset(): void;
}

/** Dispositivos simulados (Fase 2: ligar na API real de devices do SO). */
const DEFAULT_DEVICES = {
  microphone: [
    { id: "mic-default", label: "Microfone padrão do sistema" },
    { id: "mic-headset", label: "Headset Echo (microfone)" },
  ],
  camera: [
    { id: "cam-default", label: "Câmera integrada" },
    { id: "cam-webcam", label: "Webcam USB" },
  ],
  headphones: [
    { id: "hp-default", label: "Áudio padrão do sistema" },
    { id: "hp-headset", label: "Headset Echo (áudio)" },
  ],
};

export const useSettingsStore = create<SettingsState>()((set) => ({
  nativeNotifications: true,
  messageSound: true,
  mentionOnly: false,
  microphoneEnabled: true,
  microphoneDevice: null,
  cameraEnabled: true,
  cameraDevice: null,
  headphonesEnabled: true,
  headphonesDevice: null,
  onlineStatusVisible: true,
  readReceipts: true,
  typingVisible: true,
  currentSessionDevice: null,

  setNativeNotifications: (v) => set({ nativeNotifications: v }),
  setMessageSound: (v) => set({ messageSound: v }),
  setMentionOnly: (v) => set({ mentionOnly: v }),
  setMicrophoneEnabled: (v) => set({ microphoneEnabled: v }),
  setMicrophoneDevice: (id) => set({ microphoneDevice: id }),
  setCameraEnabled: (v) => set({ cameraEnabled: v }),
  setCameraDevice: (id) => set({ cameraDevice: id }),
  setHeadphonesEnabled: (v) => set({ headphonesEnabled: v }),
  setHeadphonesDevice: (id) => set({ headphonesDevice: id }),
  setOnlineStatusVisible: (v) => set({ onlineStatusVisible: v }),
  setReadReceipts: (v) => set({ readReceipts: v }),
  setTypingVisible: (v) => set({ typingVisible: v }),
  setCurrentSessionDevice: (id) => set({ currentSessionDevice: id }),
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
      onlineStatusVisible: true,
      readReceipts: true,
      typingVisible: true,
      currentSessionDevice: null,
    }),
}));

export { DEFAULT_DEVICES };

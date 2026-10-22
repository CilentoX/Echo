import { create } from "zustand";

export type Density = "confortavel" | "compacto";

export interface SettingsState {
  /** Aparência */
  compactMode: boolean;
  density: Density;
  /** Notificações */
  nativeNotifications: boolean;   // banners do SO + click-to-focus
  messageSound: boolean;          // áudio ao receber mensagem
  mentionOnly: boolean;           // notificar apenas menções
  /** Privacidade */
  onlineStatusVisible: boolean;   // outros veem se você está online
  readReceipts: boolean;          // enviar recibos de leitura
  typingVisible: boolean;         // mostrar "está digitando…"
  /** Sessões */
  currentSessionDevice: string | null;

  setCompactMode(v: boolean): void;
  setDensity(d: Density): void;
  setNativeNotifications(v: boolean): void;
  setMessageSound(v: boolean): void;
  setMentionOnly(v: boolean): void;
  setOnlineStatusVisible(v: boolean): void;
  setReadReceipts(v: boolean): void;
  setTypingVisible(v: boolean): void;
  setCurrentSessionDevice(id: string | null): void;
  reset(): void;
}

/** Configurações do app (persistidas no keyring / localStorage na Fase 2). */
export const useSettingsStore = create<SettingsState>()((set) => ({
  compactMode: false,
  density: "confortavel",
  nativeNotifications: true,
  messageSound: true,
  mentionOnly: false,
  onlineStatusVisible: true,
  readReceipts: true,
  typingVisible: true,
  currentSessionDevice: null,

  setCompactMode: (v) => set({ compactMode: v }),
  setDensity: (d) => set({ density: d }),
  setNativeNotifications: (v) => set({ nativeNotifications: v }),
  setMessageSound: (v) => set({ messageSound: v }),
  setMentionOnly: (v) => set({ mentionOnly: v }),
  setOnlineStatusVisible: (v) => set({ onlineStatusVisible: v }),
  setReadReceipts: (v) => set({ readReceipts: v }),
  setTypingVisible: (v) => set({ typingVisible: v }),
  setCurrentSessionDevice: (id) => set({ currentSessionDevice: id }),
  reset: () =>
    set({
      compactMode: false,
      density: "confortavel",
      nativeNotifications: true,
      messageSound: true,
      mentionOnly: false,
      onlineStatusVisible: true,
      readReceipts: true,
      typingVisible: true,
      currentSessionDevice: null,
    }),
}));
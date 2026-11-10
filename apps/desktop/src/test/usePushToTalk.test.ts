import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { usePushToTalk } from "@/features/voice/usePushToTalk";
import { useVoiceStore } from "@/stores/voiceStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { webrtcVoice } from "@/lib/media/webrtcVoice";
import { audioEngine } from "@/lib/media/audioEngine";

vi.mock("@/lib/media/webrtcVoice", () => ({
  webrtcVoice: {
    setMicrophoneMuted: vi.fn(),
  },
}));

vi.mock("@/lib/media/audioEngine", () => ({
  audioEngine: {
    playPttActivate: vi.fn(),
    playPttDeactivate: vi.fn(),
  },
}));

describe("usePushToTalk Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    useVoiceStore.setState({
      isConnected: true,
      isSpeaking: false,
      participants: [{ userId: "me", username: "Lucas", isMuted: false, isDeafened: false }],
    });

    useSettingsStore.setState({
      microphoneEnabled: true,
      headphonesEnabled: true,
      inputMode: "push_to_talk",
      pushToTalkKey: "ControlLeft",
      pttActive: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("silencia o microfone ao inicializar em modo push_to_talk conectado", () => {
    renderHook(() => usePushToTalk());
    expect(webrtcVoice.setMicrophoneMuted).toHaveBeenCalledWith(true);
  });

  it("ativa fala e desmuta o microfone ao segurar a tecla configurada", () => {
    renderHook(() => usePushToTalk());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ControlLeft" }));
    });

    expect(useSettingsStore.getState().pttActive).toBe(true);
    expect(webrtcVoice.setMicrophoneMuted).toHaveBeenCalledWith(false);
    expect(useVoiceStore.getState().isSpeaking).toBe(true);
    expect(audioEngine.playPttActivate).toHaveBeenCalledTimes(1);
  });

  it("desativa fala e silencia o microfone após soltar a tecla (respeitando hang time)", () => {
    renderHook(() => usePushToTalk());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ControlLeft" }));
    });
    expect(useVoiceStore.getState().isSpeaking).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ControlLeft" }));
    });

    // Antes do hang time de 150ms, ainda está ativo
    expect(useSettingsStore.getState().pttActive).toBe(true);

    // Avança 150ms
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(useSettingsStore.getState().pttActive).toBe(false);
    expect(webrtcVoice.setMicrophoneMuted).toHaveBeenLastCalledWith(true);
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
    expect(audioEngine.playPttDeactivate).toHaveBeenCalledTimes(1);
  });

  it("ignora teclas diferentes da tecla configurada", () => {
    renderHook(() => usePushToTalk());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyX" }));
    });

    expect(useSettingsStore.getState().pttActive).toBe(false);
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
  });

  it("não transmite se o microfone estiver globalmente mutado", () => {
    useSettingsStore.setState({ microphoneEnabled: false });
    renderHook(() => usePushToTalk());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ControlLeft" }));
    });

    expect(useSettingsStore.getState().pttActive).toBe(false);
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
  });
});


import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceActivity } from "@/features/voice/useVoiceActivity";

describe("useVoiceActivity Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não inicia detecção quando desabilitado ou mutado", () => {
    const onSpeakingChange = vi.fn();
    const { rerender } = renderHook(
      ({ enabled, isMuted }) =>
        useVoiceActivity({
          enabled,
          isMuted,
          onSpeakingChange,
        }),
      {
        initialProps: { enabled: false, isMuted: false },
      },
    );

    expect(onSpeakingChange).not.toHaveBeenCalled();

    rerender({ enabled: true, isMuted: true });
    expect(onSpeakingChange).not.toHaveBeenCalled();
  });

  it("cancela fala imediatamente quando o microfone é mutado", () => {
    const onSpeakingChange = vi.fn();
    const { rerender } = renderHook(
      ({ enabled, isMuted }) =>
        useVoiceActivity({
          enabled,
          isMuted,
          onSpeakingChange,
        }),
      {
        initialProps: { enabled: true, isMuted: false },
      },
    );

    // Quando muta o microfone
    rerender({ enabled: true, isMuted: true });
    expect(onSpeakingChange).not.toHaveBeenCalledWith(true);
  });

  it("lida com simulação de Web Audio API e threshold de volume", async () => {
    const onSpeakingChange = vi.fn();

    let byteFrequencyDataCallback: (arr: Uint8Array) => void = (arr) => {
      // Simula voz alta
      arr.fill(30);
    };

    const mockAnalyser = {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((arr: Uint8Array) => {
        byteFrequencyDataCallback(arr);
      }),
    };

    const mockSource = {
      connect: vi.fn(),
    };

    const mockClose = vi.fn().mockResolvedValue(undefined);
    class MockAudioContext {
      createMediaStreamSource = vi.fn(() => mockSource);
      createAnalyser = vi.fn(() => mockAnalyser);
      close = mockClose;
    }

    const mockTrack = {
      stop: vi.fn(),
    };
    const mockStream = {
      getTracks: () => [mockTrack],
    };

    // Mock global AudioContext e getUserMedia
    (window as any).AudioContext = MockAudioContext;
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    });

    const { unmount } = renderHook(() =>
      useVoiceActivity({
        enabled: true,
        isMuted: false,
        threshold: 15,
        holdTimeMs: 200,
        onSpeakingChange,
      }),
    );

    // Espera a resolução de getUserMedia e o primeiro tick
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    expect(onSpeakingChange).toHaveBeenCalledWith(true);

    // Simula silêncio (volume baixo < threshold)
    byteFrequencyDataCallback = (arr) => {
      arr.fill(2);
    };

    // Avança intervalo de amostragem
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });

    // Durante o hold time (200ms), ainda não deve desligar a fala
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(onSpeakingChange).not.toHaveBeenCalledWith(false);

    // Após completar o hold time de silêncio, desativa a fala
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(onSpeakingChange).toHaveBeenCalledWith(false);

    // Desmonta e limpa recursos
    unmount();
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });
});

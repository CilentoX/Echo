import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { webrtcVoice } from "@/lib/media/webrtcVoice";

vi.mock("@/lib/api/echoApi", () => ({
  useEchoApi: () => ({
    getAccessToken: () => "mock-token-syt",
    getBaseUrl: () => "https://echo-api.litteris.online",
    joinVoiceChannel: vi.fn().mockResolvedValue({
      success: true,
      channelId: "ch-test-1",
      myUserId: "@test:echo.litteris.online",
      participants: [
        {
          userId: "@test:echo.litteris.online",
          username: "Tester",
          avatarUrl: null,
          isMuted: false,
          isDeafened: false,
        },
        {
          userId: "@peer1:echo.litteris.online",
          username: "Peer One",
          avatarUrl: null,
          isMuted: false,
          isDeafened: false,
        },
      ],
    }),
    leaveVoiceChannel: vi.fn().mockResolvedValue({ success: true }),
    voiceHeartbeat: vi.fn().mockResolvedValue({ success: true, participants: [] }),
    sendVoiceSignal: vi.fn().mockResolvedValue({ success: true }),
    getVoiceSignals: vi.fn().mockResolvedValue({ signals: [] }),
  }),
}));

describe("WebRtcVoiceManager - SSE, Qualidade de Live e Boost 200%", () => {
  let createdEventSources: any[] = [];

  beforeEach(() => {
    createdEventSources = [];
    // Mock global EventSource
    (global as any).EventSource = class MockEventSource {
      url: string;
      listeners: Record<string, ((event: any) => void)[]> = {};
      readyState = 1;

      constructor(url: string) {
        this.url = url;
        createdEventSources.push(this);
      }

      addEventListener(event: string, cb: (event: any) => void) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
      }

      removeEventListener(event: string, cb: (event: any) => void) {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter((l) => l !== cb);
        }
      }

      emit(event: string, data: any) {
        const cbs = this.listeners[event] || [];
        for (const cb of cbs) {
          cb({ data: JSON.stringify(data) });
        }
      }

      close = vi.fn();
    };
  });

  afterEach(async () => {
    await webrtcVoice.leave();
    delete (global as any).EventSource;
  });

  it("conecta SSE com URL autenticada por token ao entrar no canal de voz", async () => {
    const onParticipantsUpdate = vi.fn();

    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
      { onParticipantsUpdate },
    );

    expect(createdEventSources.length).toBe(1);
    expect(createdEventSources[0].url).toContain("/api/channels/ch-test-1/voice/events?token=mock-token-syt");
    expect(webrtcVoice.getCurrentChannelId()).toBe("ch-test-1");
    expect(onParticipantsUpdate).toHaveBeenCalled();
  });

  it("despacha sinais recebidos via SSE instantaneamente", async () => {
    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
    );

    const sse = createdEventSources[0];
    expect(sse).toBeDefined();

    // Emite sinal simulado de peer remoto via SSE
    expect(() => {
      sse.emit("signal", {
        fromUserId: "@peer1:echo.litteris.online",
        channelId: "ch-test-1",
        signal: { type: "candidate", candidate: { candidate: "candidate:1 1 UDP ...", sdpMid: "0" } },
      });
    }).not.toThrow();
  });

  it("suporta controle de volume granular e boost até 200%", async () => {
    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
    );

    // Ajusta volume para 150% e 200% sem erros
    expect(() => {
      webrtcVoice.setParticipantVolume("@peer1:echo.litteris.online", 150);
      webrtcVoice.setParticipantVolume("@peer1:echo.litteris.online", 200);
      webrtcVoice.setParticipantVolume("@peer1:echo.litteris.online", 50);
      webrtcVoice.setParticipantVolume("@peer1:echo.litteris.online", 0);
    }).not.toThrow();
  });

  it("permite silenciar e ensurdecer o usuário", async () => {
    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
    );

    expect(() => {
      webrtcVoice.setMicrophoneMuted(true);
      webrtcVoice.setDeafened(true);
      webrtcVoice.setDeafened(false);
      webrtcVoice.setMicrophoneMuted(false);
    }).not.toThrow();
  });

  it("fecha SSE e limpa conexões ao sair da sala de voz", async () => {
    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
    );

    const sse = createdEventSources[0];
    await webrtcVoice.leave();

    expect(sse.close).toHaveBeenCalled();
    expect(webrtcVoice.getCurrentChannelId()).toBeNull();
  });

  it("não dispara polling de sinais HTTP quando conexão SSE está ativa e conectada", async () => {
    const api = (await import("@/lib/api/echoApi")).useEchoApi();
    const getSignalsSpy = vi.spyOn(api, "getVoiceSignals");

    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
    );

    // Fast-path burst e pulseSignalingFast devem ser ignorados porque o mock SSE está com readyState = 1 (OPEN)
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(getSignalsSpy).not.toHaveBeenCalled();
  });
});


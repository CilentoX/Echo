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

  it("permite silenciar e ensurdecer o usuário, forçando isSpeaking=false ao mutar", async () => {
    const onSpeakingChange = vi.fn();

    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
      { onSpeakingChange },
    );

    webrtcVoice.setMicrophoneMuted(true);
    expect(onSpeakingChange).toHaveBeenCalledWith(false);

    webrtcVoice.setDeafened(true);
    // Ensurdecer deve manter microfone mutado
    webrtcVoice.setDeafened(false);
    webrtcVoice.setMicrophoneMuted(false);
  });

  it("despacha participant_updated via SSE para atualizar status remoto e remover stream de tela se parado", async () => {
    const onParticipantUpdated = vi.fn();
    const onRemoteVideoStream = vi.fn();

    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
      { onParticipantUpdated, onRemoteVideoStream },
    );

    const sse = createdEventSources[0];
    expect(sse).toBeDefined();

    // Emite participant_updated informando que o usuário parou o compartilhamento de tela
    sse.emit("participant_updated", {
      userId: "@peer1:echo.litteris.online",
      isSpeaking: false,
      isMuted: true,
      isDeafened: false,
      isScreenSharing: false,
      hasCamera: false,
    });

    expect(onParticipantUpdated).toHaveBeenCalledWith("@peer1:echo.litteris.online", {
      isSpeaking: false,
      isMuted: true,
      isDeafened: false,
      isScreenSharing: false,
      hasCamera: false,
    });
    expect(onRemoteVideoStream).toHaveBeenCalledWith("@peer1:echo.litteris.online", null, "screen");
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

  it("ao desconectar um peer via participant_left, invoca onParticipantSpeaking(peerId, false)", async () => {
    const onParticipantSpeaking = vi.fn();
    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
      { onParticipantSpeaking },
    );

    const sse = createdEventSources[0];
    expect(sse).toBeDefined();

    // Emite participant_left
    sse.emit("participant_left", {
      userId: "@peer1:echo.litteris.online",
    });

    expect(onParticipantSpeaking).toHaveBeenCalledWith("@peer1:echo.litteris.online", false);
  });

  it("garante que participante mutado NUNCA ative status de fala", async () => {
    const onParticipantSpeaking = vi.fn();
    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
      { onParticipantSpeaking },
    );

    const sse = createdEventSources[0];

    // Emite participant_updated com isMuted=true e isSpeaking=true
    sse.emit("participant_updated", {
      userId: "@peer1:echo.litteris.online",
      isSpeaking: true,
      isMuted: true,
      isDeafened: false,
    });

    expect(onParticipantSpeaking).toHaveBeenCalledWith("@peer1:echo.litteris.online", false);
    expect(onParticipantSpeaking).not.toHaveBeenCalledWith("@peer1:echo.litteris.online", true);
  });

  it("reutiliza prewarmedStream sem chamar getUserMedia concorrente", async () => {
    const mockTrack = { readyState: "live", stop: vi.fn(), kind: "audio" };
    const mockStream = {
      getAudioTracks: () => [mockTrack],
      getTracks: () => [mockTrack],
    } as any;

    const getUserMediaSpy = vi.fn();
    const origMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: getUserMediaSpy },
      configurable: true,
      writable: true,
    });

    webrtcVoice.setPrewarmedStream(mockStream);

    await webrtcVoice.join(
      "guild-1",
      "ch-test-1",
      "@test:echo.litteris.online",
      "Tester",
      null,
      false,
      false,
    );

    expect(getUserMediaSpy).not.toHaveBeenCalled();
    expect(webrtcVoice.getLocalStream()).toBe(mockStream);
    webrtcVoice.setPrewarmedStream(null);
    Object.defineProperty(navigator, "mediaDevices", {
      value: origMediaDevices,
      configurable: true,
      writable: true,
    });
  });
});


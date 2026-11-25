import { describe, it, expect, beforeEach, vi } from "vitest";
import { voiceTransport } from "@/lib/media/voiceTransport";
import { livekitVoice } from "@/lib/media/livekitVoice";
import { webrtcVoice } from "@/lib/media/webrtcVoice";

const mockGetVoiceToken = vi.fn();

vi.mock("@/lib/api/echoApi", () => ({
  useEchoApi: () => ({
    getVoiceToken: mockGetVoiceToken,
    joinVoiceChannel: vi.fn().mockResolvedValue({ success: true, participants: [] }),
    leaveVoiceChannel: vi.fn().mockResolvedValue({ success: true }),
    voiceHeartbeat: vi.fn().mockResolvedValue({ success: true }),
    sendVoiceSignal: vi.fn().mockResolvedValue({ success: true }),
    getVoiceSignals: vi.fn().mockResolvedValue({ signals: [] }),
  }),
}));

describe("VoiceTransportRouter (LiveKit SFU + WebRTC Mesh Fallback)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa LiveKit SFU quando /voice/token retorna enabled=true com serverUrl e token", async () => {
    mockGetVoiceToken.mockResolvedValue({
      enabled: true,
      serverUrl: "wss://livekit.litteris.online",
      token: "lk-jwt-token",
    });

    const lkJoinSpy = vi.spyOn(livekitVoice, "join").mockResolvedValue();
    const rtcJoinSpy = vi.spyOn(webrtcVoice, "join").mockResolvedValue();

    await voiceTransport.join("g1", "ch1", "@u1:hs", "Lucas", null, false, false, {});

    expect(voiceTransport.getMode()).toBe("livekit");
    expect(lkJoinSpy).toHaveBeenCalledWith(
      "g1",
      "ch1",
      "@u1:hs",
      "Lucas",
      null,
      false,
      false,
      {},
      { serverUrl: "wss://livekit.litteris.online", token: "lk-jwt-token" },
    );
    expect(rtcJoinSpy).not.toHaveBeenCalled();

    lkJoinSpy.mockRestore();
    rtcJoinSpy.mockRestore();
  });

  it("faz fallback automático para WebRTC Mesh quando LiveKit não está habilitado", async () => {
    mockGetVoiceToken.mockResolvedValue({
      enabled: false,
      serverUrl: null,
      token: null,
    });

    const lkJoinSpy = vi.spyOn(livekitVoice, "join").mockResolvedValue();
    const rtcJoinSpy = vi.spyOn(webrtcVoice, "join").mockResolvedValue();

    await voiceTransport.join("g1", "ch1", "@u1:hs", "Lucas", null, false, false, {});

    expect(voiceTransport.getMode()).toBe("webrtc");
    expect(rtcJoinSpy).toHaveBeenCalled();
    expect(lkJoinSpy).not.toHaveBeenCalled();

    lkJoinSpy.mockRestore();
    rtcJoinSpy.mockRestore();
  });
});

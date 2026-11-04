import { describe, it, expect, beforeEach, vi } from "vitest";
import { useVoiceStore } from "@/stores/voiceStore";

describe("voiceStore", () => {
  beforeEach(() => {
    useVoiceStore.getState().disconnectVoice();
    vi.useRealTimers();
  });

  it("inicia desconectado por padrão", () => {
    const state = useVoiceStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isConnecting).toBe(false);
    expect(state.activeVoiceChannelId).toBeNull();
  });

  it("conecta ao canal de voz e adiciona participante", () => {
    useVoiceStore.getState().connectVoice("guild-1", "Comunidade Echo", "ch-voice-1", "Geral Voz");

    const state = useVoiceStore.getState();
    expect(state.activeVoiceGuildId).toBe("guild-1");
    expect(state.activeVoiceGuildName).toBe("Comunidade Echo");
    expect(state.activeVoiceChannelId).toBe("ch-voice-1");
    expect(state.activeVoiceChannelName).toBe("Geral Voz");
    expect(state.isConnecting).toBe(true);
    expect(state.participants.length).toBeGreaterThan(0);
  });

  it("alterna estado de fala (speaking)", () => {
    useVoiceStore.getState().connectVoice("guild-1", "Guild", "ch-1", "Voz");

    useVoiceStore.getState().setSpeaking(true);
    expect(useVoiceStore.getState().isSpeaking).toBe(true);
    expect(useVoiceStore.getState().speakingMembers).toContain("me");

    useVoiceStore.getState().setSpeaking(false);
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
    expect(useVoiceStore.getState().speakingMembers).not.toContain("me");
  });

  it("desconecta e limpa estado", () => {
    useVoiceStore.getState().connectVoice("guild-1", "Guild", "ch-1", "Voz");
    useVoiceStore.getState().disconnectVoice();

    const state = useVoiceStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.activeVoiceChannelId).toBeNull();
    expect(state.participants).toEqual([]);
  });
});


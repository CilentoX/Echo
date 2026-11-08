import { describe, it, expect, beforeEach, vi } from "vitest";
import { useVoiceStore } from "@/stores/voiceStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { audioEngine } from "@/lib/media/audioEngine";

describe("voiceStore", () => {
  beforeEach(() => {
    useVoiceStore.getState().disconnectVoice();
    useSettingsStore.getState().setMicrophoneEnabled(true);
    useSettingsStore.getState().setHeadphonesEnabled(true);
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

  it("alterna estado de fala (speaking) quando conectado e desmutado", () => {
    useVoiceStore.getState().connectVoice("guild-1", "Guild", "ch-1", "Voz");
    useVoiceStore.setState({ isConnected: true });

    useVoiceStore.getState().setSpeaking(true);
    expect(useVoiceStore.getState().isSpeaking).toBe(true);
    expect(useVoiceStore.getState().speakingMembers).toContain("me");

    useVoiceStore.getState().setSpeaking(false);
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
    expect(useVoiceStore.getState().speakingMembers).not.toContain("me");
  });

  it("não permite setSpeaking(true) quando o usuário está mutado ou desconectado", () => {
    // 1. Desconectado
    useVoiceStore.getState().setSpeaking(true);
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
    expect(useVoiceStore.getState().speakingMembers).not.toContain("me");

    // 2. Conectado mas microfone desativado nas configurações
    useVoiceStore.getState().connectVoice("guild-1", "Guild", "ch-1", "Voz");
    useVoiceStore.setState({ isConnected: true });
    useSettingsStore.getState().setMicrophoneEnabled(false);

    useVoiceStore.getState().setSpeaking(true);
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
    expect(useVoiceStore.getState().speakingMembers).not.toContain("me");

    // 3. Conectado mas mutado no participante
    useSettingsStore.getState().setMicrophoneEnabled(true);
    useVoiceStore.getState().setParticipantMuted("me", true);

    useVoiceStore.getState().setSpeaking(true);
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
    expect(useVoiceStore.getState().speakingMembers).not.toContain("me");
  });

  it("força isSpeaking=false e limpa speakingMembers ao mutar ou ensurdecer", () => {
    useVoiceStore.getState().connectVoice("guild-1", "Guild", "ch-1", "Voz");
    useVoiceStore.setState({ isConnected: true });

    useVoiceStore.getState().setSpeaking(true);
    expect(useVoiceStore.getState().isSpeaking).toBe(true);

    // Muta
    useVoiceStore.getState().toggleMute("me");
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
    expect(useVoiceStore.getState().speakingMembers).not.toContain("me");

    // Desmuta e fala novamente
    useVoiceStore.getState().toggleMute("me");
    useVoiceStore.getState().setSpeaking(true);
    expect(useVoiceStore.getState().isSpeaking).toBe(true);

    // Ensurdece
    useVoiceStore.getState().toggleDeafen("me");
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
    expect(useVoiceStore.getState().speakingMembers).not.toContain("me");
  });

  it("não permite que participante remoto mutado seja marcado como falando", () => {
    useVoiceStore.getState().connectVoice("guild-1", "Guild", "ch-1", "Voz");
    useVoiceStore.setState({ isConnected: true });

    useVoiceStore.getState().addParticipant({
      userId: "@user2:matrix",
      username: "User 2",
      avatarUrl: null,
      isMuted: true,
      isDeafened: false,
      isSpeaking: false,
    });

    useVoiceStore.getState().setParticipantSpeaking("@user2:matrix", true);
    expect(useVoiceStore.getState().speakingMembers).not.toContain("@user2:matrix");
  });

  it("updateParticipant atualiza atributos e reseta fala se mutado", () => {
    useVoiceStore.getState().connectVoice("guild-1", "Guild", "ch-1", "Voz");
    useVoiceStore.setState({ isConnected: true });

    useVoiceStore.getState().addParticipant({
      userId: "@user3:matrix",
      username: "User 3",
      avatarUrl: null,
      isMuted: false,
      isDeafened: false,
      isSpeaking: true,
    });

    useVoiceStore.getState().updateParticipant("@user3:matrix", { isMuted: true, isSpeaking: false });
    const p = useVoiceStore.getState().participants.find((x) => x.userId === "@user3:matrix");
    expect(p?.isMuted).toBe(true);
    expect(p?.isSpeaking).toBe(false);
  });

  it("desconecta e limpa estado", () => {
    useVoiceStore.getState().connectVoice("guild-1", "Guild", "ch-1", "Voz");
    useVoiceStore.getState().disconnectVoice();

    const state = useVoiceStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.connectionState).toBe("disconnected");
    expect(state.activeVoiceChannelId).toBeNull();
    expect(state.participants).toEqual([]);
  });

  it("inicia em connecting e só toca playVoiceConnected quando connectionState for connected", async () => {
    const playSpy = vi.spyOn(audioEngine, "playVoiceConnected").mockResolvedValue(undefined);

    useVoiceStore.getState().connectVoice("guild-1", "Guild", "ch-1", "Voz");
    expect(useVoiceStore.getState().connectionState).toBe("connecting");

    // Durante connecting, o chime ainda NÃO toca
    expect(playSpy).not.toHaveBeenCalled();

    // Transição para connected via setConnectionState (ICE/WebRTC concluído)
    useVoiceStore.getState().setConnectionState("connected");
    expect(useVoiceStore.getState().connectionState).toBe("connected");
    expect(useVoiceStore.getState().isConnected).toBe(true);
    expect(playSpy).toHaveBeenCalled();
  });
});


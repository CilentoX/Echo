import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceTab } from "@/features/profile/tabs/VoiceTab";
import { useSettingsStore } from "@/stores/settingsStore";
import { audioEngine } from "@/lib/media/audioEngine";

vi.mock("@/lib/media/devices", () => ({
  FALLBACK_DEVICES: {
    microphone: [{ id: "mic-1", label: "Microfone Teste" }],
    headphones: [{ id: "hp-1", label: "Fone de Ouvido Teste" }],
    camera: [{ id: "cam-1", label: "Câmera Teste" }],
  },
  listRealDevices: vi.fn(async () => ({
    microphone: [{ id: "mic-1", label: "Microfone Teste" }],
    headphones: [{ id: "hp-1", label: "Fone de Ouvido Teste" }],
    camera: [{ id: "cam-1", label: "Câmera Teste" }],
  })),
}));

describe("VoiceTab Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      microphoneEnabled: true,
      microphoneDevice: null,
      headphonesEnabled: true,
      headphonesDevice: null,
      cameraEnabled: true,
      cameraDevice: null,
      inputVolume: 80,
      outputVolume: 90,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      inputMode: "voice_activity",
      pushToTalkKey: "ControlLeft",
    });
  });

  it("renderiza os títulos e seções de áudio", () => {
    render(<VoiceTab />);
    expect(screen.getByText("Voz & Dispositivos")).toBeTruthy();
    expect(screen.getByText("Dispositivo de Entrada")).toBeTruthy();
    expect(screen.getByText("Dispositivo de Saída")).toBeTruthy();
    expect(screen.getByText("Teste de Microfone & Saída")).toBeTruthy();
    expect(screen.getByText("Modo de Entrada")).toBeTruthy();
    expect(screen.getByText("Processamento de Áudio")).toBeTruthy();
  });

  it("permite alterar o modo de entrada para Pressionar para Falar", async () => {
    render(<VoiceTab />);
    const pttBtn = screen.getByRole("button", { name: /Pressionar para Falar/i });
    await userEvent.click(pttBtn);
    expect(useSettingsStore.getState().inputMode).toBe("push_to_talk");
  });

  it("permite disparar o teste de som de saída", async () => {
    const playSpy = vi.spyOn(audioEngine, "playTestChime").mockResolvedValue();
    render(<VoiceTab />);
    const testSoundBtn = screen.getByRole("button", { name: "Testar Alto-falante" });
    await userEvent.click(testSoundBtn);
    expect(playSpy).toHaveBeenCalled();
  });

  it("permite alternar o teste de microfone", async () => {
    const startMicSpy = vi.spyOn(audioEngine, "startMicTest").mockResolvedValue();
    const stopMicSpy = vi.spyOn(audioEngine, "stopMicTest").mockImplementation(() => {});
    render(<VoiceTab />);
    const testMicBtn = screen.getByRole("button", { name: /Testar Microfone/i });
    await userEvent.click(testMicBtn);
    expect(startMicSpy).toHaveBeenCalled();

    const stopMicBtn = screen.getByRole("button", { name: /Parar Teste de Microfone/i });
    await userEvent.click(stopMicBtn);
    expect(stopMicSpy).toHaveBeenCalled();
  });
});


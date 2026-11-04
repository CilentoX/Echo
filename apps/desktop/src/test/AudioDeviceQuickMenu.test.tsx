import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AudioDeviceQuickMenu from "@/features/shell/AudioDeviceQuickMenu";
import { useSettingsStore } from "@/stores/settingsStore";
import { audioEngine } from "@/lib/media/audioEngine";

vi.mock("@/lib/media/devices", () => ({
  FALLBACK_DEVICES: {
    microphone: [{ id: "mic-usb", label: "Microfone USB HyperX" }],
    headphones: [{ id: "hp-steel", label: "Fone SteelSeries Arctis" }],
    camera: [],
  },
  listRealDevices: vi.fn(async () => ({
    microphone: [{ id: "mic-usb", label: "Microfone USB HyperX" }],
    headphones: [{ id: "hp-steel", label: "Fone SteelSeries Arctis" }],
    camera: [],
  })),
}));

describe("AudioDeviceQuickMenu Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      microphoneDevice: null,
      headphonesDevice: null,
      inputVolume: 85,
      outputVolume: 95,
    });
  });

  it("renderiza o menu rápido com as seções de entrada e saída", async () => {
    render(<AudioDeviceQuickMenu onClose={vi.fn()} />);

    expect(screen.getByText("Dispositivos de Áudio")).toBeTruthy();
    expect(screen.getByText("Microfone")).toBeTruthy();
    expect(screen.getByText("Saída de Áudio")).toBeTruthy();
    expect(await screen.findByText("Microfone USB HyperX")).toBeTruthy();
    expect(await screen.findByText("Fone SteelSeries Arctis")).toBeTruthy();
  });

  it("permite selecionar um microfone da lista", async () => {
    render(<AudioDeviceQuickMenu onClose={vi.fn()} />);

    const micBtn = await screen.findByText("Microfone USB HyperX");
    await userEvent.click(micBtn);

    expect(useSettingsStore.getState().microphoneDevice).toBe("mic-usb");
  });

  it("permite selecionar um fone de ouvido da lista", async () => {
    render(<AudioDeviceQuickMenu onClose={vi.fn()} />);

    const hpBtn = await screen.findByText("Fone SteelSeries Arctis");
    await userEvent.click(hpBtn);

    expect(useSettingsStore.getState().headphonesDevice).toBe("hp-steel");
  });

  it("chama onOpenVoiceSettings e onClose ao clicar no botão de configurações completas", async () => {
    const onClose = vi.fn();
    const onOpenVoice = vi.fn();

    render(<AudioDeviceQuickMenu onClose={onClose} onOpenVoiceSettings={onOpenVoice} />);

    const settingsBtn = screen.getByRole("button", { name: "Configurações de Voz & Vídeo" });
    await userEvent.click(settingsBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onOpenVoice).toHaveBeenCalled();
  });

  it("chama playTestChime ao clicar no botão Testar", async () => {
    const playSpy = vi.spyOn(audioEngine, "playTestChime").mockResolvedValue();

    render(<AudioDeviceQuickMenu onClose={vi.fn()} />);

    const testBtn = screen.getByRole("button", { name: /Tocar som de teste/i });
    await userEvent.click(testBtn);

    expect(playSpy).toHaveBeenCalled();
  });
});


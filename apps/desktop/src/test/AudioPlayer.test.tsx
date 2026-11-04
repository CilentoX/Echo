import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AudioPlayer from "@/components/media/AudioPlayer";

describe("AudioPlayer Component", () => {
  it("renderiza o player de áudio com botão play e waveform", () => {
    render(<AudioPlayer src="https://example.com/audio.webm" duration={45} />);

    expect(screen.getByTestId("audio-player")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tocar áudio" })).toBeTruthy();
    expect(screen.getByText("Mensagem de voz")).toBeTruthy();
    expect(screen.getByText("1x")).toBeTruthy();
  });

  it("alterna a velocidade ao clicar no botão de velocidade", async () => {
    render(<AudioPlayer src="https://example.com/audio.webm" duration={30} />);

    const speedBtn = screen.getByText("1x");
    await userEvent.click(speedBtn);
    expect(screen.getByText("1.5x")).toBeTruthy();

    await userEvent.click(screen.getByText("1.5x"));
    expect(screen.getByText("2x")).toBeTruthy();

    await userEvent.click(screen.getByText("2x"));
    expect(screen.getByText("1x")).toBeTruthy();
  });

  it("tenta tocar o áudio ao clicar no botão play", async () => {
    const playStub = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    render(<AudioPlayer src="https://example.com/audio.webm" duration={20} />);

    const playBtn = screen.getByRole("button", { name: "Tocar áudio" });
    await userEvent.click(playBtn);

    expect(playStub).toHaveBeenCalled();
  });
});


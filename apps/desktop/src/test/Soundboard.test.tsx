import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SoundboardPopover from "@/features/voice/SoundboardPopover";

describe("SoundboardPopover", () => {
  it("renderiza o botão do soundboard", () => {
    render(<SoundboardPopover />);
    expect(screen.getByRole("button", { name: "Soundboard comunitário" })).toBeTruthy();
  });

  it("abre a lista de efeitos sonoros ao clicar", async () => {
    const user = userEvent.setup();
    render(<SoundboardPopover />);

    const trigger = screen.getByRole("button", { name: "Soundboard comunitário" });
    await user.click(trigger);

    expect(screen.getByText("Soundboard")).toBeTruthy();
    expect(screen.getByText("Aplausos")).toBeTruthy();
    expect(screen.getByText("Vitória")).toBeTruthy();
    expect(screen.getByText("Buzina")).toBeTruthy();
    expect(screen.getByText("Ba-Dum-Tss")).toBeTruthy();
    expect(screen.getByText("Moeda 8-bit")).toBeTruthy();
    expect(screen.getByText("GG Well Played")).toBeTruthy();
  });

  it("chama onPlaySound e executa o efeito ao clicar em um som", async () => {
    const user = userEvent.setup();
    const handlePlay = vi.fn();
    render(<SoundboardPopover onPlaySound={handlePlay} />);

    const trigger = screen.getByRole("button", { name: "Soundboard comunitário" });
    await user.click(trigger);

    const victoryButton = screen.getByRole("button", { name: /Vitória/i });
    await user.click(victoryButton);

    expect(handlePlay).toHaveBeenCalledTimes(1);
    expect(handlePlay).toHaveBeenCalledWith(
      expect.objectContaining({ id: "victory", name: "Vitória" }),
    );
  });
});


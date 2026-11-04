import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmojiPicker } from "@/components/emoji/EmojiPicker";

describe("EmojiPicker", () => {
  it("renders when open and shows emojis header", () => {
    render(<EmojiPicker open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText("Emojis")).toBeTruthy();
    expect(screen.getByText("Tom:")).toBeTruthy();
  });

  it("expande a lista de tons de pele ao passar o mouse", async () => {
    render(<EmojiPicker open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);
    const toneContainer = screen.getByText("Tom:").closest("div");
    expect(toneContainer).toBeTruthy();

    if (toneContainer) {
      fireEvent.mouseEnter(toneContainer);
      expect(await screen.findByTestId("skin-tone-hover-list")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Claro" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Escuro" })).toBeTruthy();
    }
  });

  it("permite selecionar um tom de pele no hover", async () => {
    render(<EmojiPicker open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);
    const toneContainer = screen.getByText("Tom:").closest("div");

    if (toneContainer) {
      fireEvent.mouseEnter(toneContainer);
      const claroBtn = await screen.findByRole("button", { name: "Claro" });
      await userEvent.click(claroBtn);
    }
  });
});

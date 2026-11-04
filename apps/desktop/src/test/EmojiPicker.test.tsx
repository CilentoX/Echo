import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmojiPicker } from "@/components/emoji/EmojiPicker";

vi.mock("emoji-picker-react", () => ({
  default: () => <div data-testid="emoji-picker-react-mock" />,
  Theme: { DARK: "dark", LIGHT: "light" },
  EmojiStyle: { NATIVE: "native" },
  SkinTones: {
    NEUTRAL: "neutral",
    LIGHT: "1f3fb",
    MEDIUM_LIGHT: "1f3fc",
    MEDIUM: "1f3fd",
    MEDIUM_DARK: "1f3fe",
    DARK: "1f3ff",
  },
  Categories: {
    SUGGESTED: "suggested",
    SMILEYS_PEOPLE: "smileys_people",
    ANIMALS_NATURE: "animals_nature",
    FOOD_DRINK: "food_drink",
    TRAVEL_PLACES: "travel_places",
    ACTIVITIES: "activities",
    OBJECTS: "objects",
    SYMBOLS: "symbols",
    FLAGS: "flags",
  },
}));

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

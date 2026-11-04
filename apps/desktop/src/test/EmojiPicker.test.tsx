import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmojiPicker } from "@/components/emoji/EmojiPicker";

describe("EmojiPicker", () => {
  it("renders when open", () => {
    render(<EmojiPicker open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole("dialog", { hidden: true }) || screen.getByText(/emoji/i, { selector: "*" })).toBeTruthy();
  });
});


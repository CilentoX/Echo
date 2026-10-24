import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("exibe mensagem e botão criar guilda quando não há guildas", () => {
    render(<EmptyState />);
    expect(screen.getByText(/nenhuma guilda/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /criar guilda/i })).not.toBeNull();
  });
});

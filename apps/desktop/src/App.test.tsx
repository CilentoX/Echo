import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage/keyring", () => ({
  loadSession: vi.fn(async () => null),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));

import App from "@/App";

describe("App", () => {
  it("sem sessão salva, mostra a tela de login com o Eco", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    expect(screen.getByText("Eco")).toBeTruthy();
  });
});

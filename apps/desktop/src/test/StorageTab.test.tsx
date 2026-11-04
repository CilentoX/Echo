import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StorageTab from "@/features/profile/tabs/StorageTab";
import { desktopCache } from "@/lib/storage/desktopConfig";

describe("StorageTab Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza informações de armazenamento e caminhos de disco", async () => {
    render(<StorageTab />);

    expect(screen.getByTestId("storage-tab")).toBeTruthy();
    expect(screen.getByText("Armazenamento & Dados Locais")).toBeTruthy();
    expect(screen.getByText("Cache de Mensagens & Guildas")).toBeTruthy();
    expect(screen.getByText("Arquivo de Configurações")).toBeTruthy();
  });

  it("permite limpar o cache ao clicar no botão", async () => {
    const clearSpy = vi.spyOn(desktopCache, "clear").mockResolvedValue(undefined);

    render(<StorageTab />);

    const clearBtn = screen.getByRole("button", { name: /Limpar Cache/i });
    await userEvent.click(clearBtn);

    expect(clearSpy).toHaveBeenCalled();
  });
});


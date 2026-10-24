import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CreateGuildModal from "@/features/guild/CreateGuildModal";

function renderModal(overrides: Partial<Parameters<typeof CreateGuildModal>[0]> = {}) {
  const onCreate = vi.fn<(data: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null }) => Promise<{ guildId: string; name: string }>>();
  const onCreated = vi.fn();
  render(
    <CreateGuildModal
      open
      onClose={vi.fn()}
      onCreate={
        overrides.onCreate ??
        (async (data: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null }) => {
          await onCreate(data);
          return { guildId: "!new:hs", name: data.name };
        })
      }
      onCreated={overrides.onCreated ?? onCreated}
    />,
  );
  return { onCreate, onCreated };
}

describe("CreateGuildModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza quando open é falso", () => {
    render(<CreateGuildModal open={false} onClose={vi.fn()} onCreate={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("mostra erro quando o nome está vazio", async () => {
    renderModal();
    await userEvent.click(screen.getByRole("button", { name: "Criar guilda" }));
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("chama onCreate com o nome digitado e onCreated com a guilda", async () => {
    const { onCreated } = renderModal();
    await userEvent.type(screen.getByPlaceholderText("Ex: Minha comunidade"), "Comunidade Teste");
    await userEvent.click(screen.getByRole("button", { name: "Criar guilda" }));
    await screen.findByText(/criando/i).catch(() => {});
    // aguarda a promise resolver
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith({ guildId: "!new:hs", name: "Comunidade Teste" }));
  });

  it("mostra erro inline quando onCreate rejeita", async () => {
    renderModal({
      onCreate: async () => {
        throw new Error("fail");
      },
    });
    await userEvent.type(screen.getByPlaceholderText("Ex: Minha comunidade"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Criar guilda" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/não foi possível criar/i);
  });
} );
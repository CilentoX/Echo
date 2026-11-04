import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateChannelModal from "@/features/guild/CreateChannelModal";

describe("CreateChannelModal", () => {
  it("não renderiza quando open é falso", () => {
    const { container } = render(
      <CreateChannelModal
        open={false}
        guildId="guild_123"
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onCreated={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza campos de texto e opções de canal", () => {
    render(
      <CreateChannelModal
        open={true}
        guildId="guild_123"
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Criar canal" })).toBeTruthy();
    expect(screen.getByPlaceholderText("novo-canal")).toBeTruthy();
    expect(screen.getByText("Texto")).toBeTruthy();
    expect(screen.getByText("Voz & Vídeo")).toBeTruthy();
  });

  it("submete com nome formatado e chama onCreated", async () => {
    const onCreate = vi.fn().mockResolvedValue({
      channelId: "chan_999",
      name: "projetos-novos",
    });
    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(
      <CreateChannelModal
        open={true}
        guildId="guild_123"
        onClose={onClose}
        onCreate={onCreate}
        onCreated={onCreated}
      />
    );

    const input = screen.getByPlaceholderText("novo-canal");
    fireEvent.change(input, { target: { value: "Projetos Novos" } });

    const submitBtn = screen.getByRole("button", { name: "Criar canal" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: "projetos-novos",
        type: "text",
        topic: undefined,
        category: undefined,
      });
      expect(onCreated).toHaveBeenCalledWith({
        channelId: "chan_999",
        name: "projetos-novos",
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});

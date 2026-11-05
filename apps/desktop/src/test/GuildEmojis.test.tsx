import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MessageBody from "@/features/chat/MessageBody";
import { renderMarkdown } from "@/lib/markdown";
import { useSyncStore } from "@/stores/syncStore";

describe("Sistema de Emojis Customizados do Servidor", () => {
  beforeEach(() => {
    useSyncStore.setState({
      guildEmojis: {},
    });
    localStorage.clear();
  });

  it("gerencia emojis customizados no syncStore", () => {
    const store = useSyncStore.getState();
    store.addGuildEmoji("!guild1", {
      name: "echo_hype",
      url: "https://echo.litteris.online/hype.png",
    });

    const emojis = useSyncStore.getState().guildEmojis["!guild1"];
    expect(emojis).toHaveLength(1);
    expect(emojis![0]!.name).toBe("echo_hype");
    expect(emojis![0]!.url).toBe("https://echo.litteris.online/hype.png");

    const emojiId = emojis![0]!.id;
    useSyncStore.getState().removeGuildEmoji("!guild1", emojiId);
    expect(useSyncStore.getState().guildEmojis["!guild1"]).toHaveLength(0);
  });

  it("renderMarkdown converte shortcodes de emojis customizados em tags img", () => {
    const map = {
      echo_fire: "https://echo.litteris.online/fire.png",
    };

    const html = renderMarkdown("Parabéns pelo lançamento! :echo_fire:", map);
    expect(html).toContain('<img src="https://echo.litteris.online/fire.png"');
    expect(html).toContain('alt=":echo_fire:"');
  });

  it("MessageBody renderiza emojis customizados automaticamente a partir do syncStore", () => {
    useSyncStore.getState().addGuildEmoji("!guild1", {
      name: "party_cat",
      url: "https://echo.litteris.online/cat.png",
    });

    render(<MessageBody body="Olha esse meme :party_cat: demais!" />);

    const img = screen.getByRole("img");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("https://echo.litteris.online/cat.png");
    expect(img.getAttribute("alt")).toBe(":party_cat:");
  });
});


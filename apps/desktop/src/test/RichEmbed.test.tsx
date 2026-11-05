import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import RichEmbed from "@/features/chat/RichEmbed";

describe("RichEmbed", () => {
  it("não renderiza nada se o texto não contém URLs", () => {
    const { container } = render(<RichEmbed content="Olá mundo sem links!" />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza preview de vídeo do YouTube quando houver link do YouTube", () => {
    render(<RichEmbed content="Veja esse vídeo incrível: https://www.youtube.com/watch?v=dQw4w9WgXcQ" />);

    expect(screen.getByText("YouTube")).toBeTruthy();
    expect(screen.getByTitle("Abrir no YouTube")).toBeTruthy();
    expect(screen.getByAltText("Prévia do vídeo")).toBeTruthy();
  });

  it("renderiza player de vídeo ao clicar na prévia do YouTube", async () => {
    const user = userEvent.setup();
    render(<RichEmbed content="Vídeo: https://youtu.be/dQw4w9WgXcQ" />);

    const thumbnail = screen.getByAltText("Prévia do vídeo");
    await user.click(thumbnail);

    const iframe = screen.getByTitle("YouTube video player");
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toContain("dQw4w9WgXcQ");
  });

  it("renderiza card de repositório do GitHub", () => {
    render(<RichEmbed content="Confira o repo https://github.com/facebook/react" />);

    expect(screen.getByText("facebook/react")).toBeTruthy();
    expect(screen.getByText("Repositório no GitHub")).toBeTruthy();
  });

  it("renderiza preview genérico para links comuns", () => {
    render(<RichEmbed content="Acesse https://example.com/artigo-novo" />);

    expect(screen.getByText("example.com")).toBeTruthy();
  });
});


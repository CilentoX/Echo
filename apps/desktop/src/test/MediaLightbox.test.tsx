import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MediaLightbox from "@/components/media/MediaLightbox";

describe("MediaLightbox Component", () => {
  it("não renderiza quando open é false", () => {
    const { container } = render(
      <MediaLightbox src="https://example.com/photo.png" open={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza imagem e controles quando open é true", () => {
    render(
      <MediaLightbox
        src="https://example.com/photo.png"
        alt="Foto de teste"
        open={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Visualizador de imagem" })).toBeTruthy();
    expect(screen.getByText("Foto de teste")).toBeTruthy();
    expect(screen.getByAltText("Foto de teste")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aumentar zoom" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reduzir zoom" })).toBeTruthy();
  });

  it("chama onClose ao clicar no botão fechar", async () => {
    const onClose = vi.fn();
    render(
      <MediaLightbox
        src="https://example.com/photo.png"
        alt="Foto de teste"
        open={true}
        onClose={onClose}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: "Fechar visualizador" });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ajusta o percentual de zoom ao clicar nos botões de zoom in e zoom out", async () => {
    render(
      <MediaLightbox
        src="https://example.com/photo.png"
        open={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("100%")).toBeTruthy();

    const zoomInBtn = screen.getByRole("button", { name: "Aumentar zoom" });
    await userEvent.click(zoomInBtn);
    expect(screen.getByText("125%")).toBeTruthy();

    const zoomOutBtn = screen.getByRole("button", { name: "Reduzir zoom" });
    await userEvent.click(zoomOutBtn);
    expect(screen.getByText("100%")).toBeTruthy();
  });
});


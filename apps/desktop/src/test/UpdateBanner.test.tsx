import { afterEach, describe, expect, it, vi } from "vitest";

const { restartMock } = vi.hoisted(() => ({ restartMock: vi.fn() }));

vi.mock("@/lib/updater", () => ({
  restartApp: restartMock,
}));

import UpdateBanner from "@/features/shell/UpdateBanner";
import { useUpdateStore } from "@/stores/updateStore";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useUpdateStore.getState().reset();
});

describe("UpdateBanner", () => {
  it("idle → não renderiza nada", () => {
    const { container } = render(<UpdateBanner />);

    expect(container.children.length).toBe(0);
  });

  it("downloading → mostra o progresso com a versão, sem botão", () => {
    useUpdateStore.getState().beginDownload("0.1.2");
    render(<UpdateBanner />);

    expect(screen.getByText(/baixando atualização v0\.1\.2/i)).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("ready → mostra aviso e botão Reiniciar agora que chama restartApp", async () => {
    useUpdateStore.getState().beginDownload("0.1.2");
    useUpdateStore.getState().markReady();
    render(<UpdateBanner />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /reiniciar agora/i }));

    expect(restartMock).toHaveBeenCalledTimes(1);
  });
});

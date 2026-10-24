vi.mock("@/stores/updateStore", () => ({
  useUpdateStore: vi.fn((selector) => {
    const state = { status: "idle", version: null };
    return selector(state as any);
  }),
}));

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import UpdateBanner from "./UpdateBanner";
import { useUpdateStore } from "@/stores/updateStore";

const mockUpdateStore = vi.mocked(useUpdateStore);

let currentState: any = {
  status: "idle",
  version: null,
  beginCheck: vi.fn(),
  beginDownload: vi.fn(),
  markReady: vi.fn(),
  reset: vi.fn(),
};

beforeEach(() => {
  currentState = {
    status: "idle",
    version: null,
    beginCheck: vi.fn(),
    beginDownload: vi.fn(),
    markReady: vi.fn(),
    reset: vi.fn(),
  };
  mockUpdateStore.mockImplementation((selector) => selector(currentState));
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UpdateBanner", () => {
  it("não renderiza quando status é idle", () => {
    currentState = {
      status: "idle",
      version: null,
      beginCheck: vi.fn(),
      beginDownload: vi.fn(),
      markReady: vi.fn(),
      reset: vi.fn(),
    };
    const { container } = render(<UpdateBanner />);
    expect(container.children.length).toBe(0);
  });

  it("renderiza banner 'checking' com indicador de carregamento", () => {
    currentState = {
      status: "checking",
      version: null,
      beginCheck: vi.fn(),
      beginDownload: vi.fn(),
      markReady: vi.fn(),
      reset: vi.fn(),
    };
    render(<UpdateBanner />);
    expect(screen.getByText(/Verificando atualizações/i)).not.toBeNull();
  });

  it("renderiza banner 'ready' com botão Reiniciar agora", () => {
    currentState = {
      status: "ready",
      version: "0.1.2",
      beginCheck: vi.fn(),
      beginDownload: vi.fn(),
      markReady: vi.fn(),
      reset: vi.fn(),
    };
    render(<UpdateBanner />);
    expect(screen.getByText(/Atualização pronta/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Reiniciar agora/i })).not.toBeNull();
  });
});

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import AppShell from "@/features/shell/AppShell";

/** Column lookup helper for the `data-column` layout contract. */
const column = (name: string): Element | null =>
  document.querySelector(`[data-column="${name}"]`);

/**
 * Sets the real jsdom window width and fires a native `resize` event,
 * so the shell is exercised through the actual breakpoint path.
 */
const setWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
};

afterEach(() => {
  setWidth(1024); // jsdom default
});

describe("AppShell", () => {
  it("renders all four columns at 1200px with no overlay toggles", () => {
    setWidth(1200);
    render(<AppShell />);

    expect(column("rail")).toBeTruthy();
    expect(column("sidebar")).toBeTruthy();
    expect(column("chat")).toBeTruthy();
    expect(column("members")).toBeTruthy();

    expect(screen.queryByRole("button", { name: "Abrir canais" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Membros" })).toBeNull();
  });

  it("renders placeholder chat content", () => {
    setWidth(1200);
    render(<AppShell />);

    expect(screen.getByText("# geral")).toBeTruthy();
    expect(screen.getByText("Bem-vinda, galera!")).toBeTruthy();
  });

  it("hides the member list and shows a members toggle at 1000px", () => {
    setWidth(1000);
    render(<AppShell />);

    expect(column("members")).toBeNull();
    expect(screen.getByRole("button", { name: "Membros" })).toBeTruthy();
  });

  it("opens the member list as an overlay when the members toggle is clicked", async () => {
    setWidth(1000);
    render(<AppShell />);

    await userEvent.click(screen.getByRole("button", { name: "Membros" }));
    expect(column("members")).toBeTruthy();
  });

  it("keeps the rail and hides the sidebar until the menu button is clicked at 800px", async () => {
    setWidth(800);
    render(<AppShell />);

    expect(column("rail")).toBeTruthy();
    expect(column("sidebar")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Abrir canais" }));
    expect(column("sidebar")).toBeTruthy();
    expect(column("rail")).toBeTruthy(); // the rail never disappears
  });

  it("removes the static sidebar but keeps the rail when resized from 1200px to 800px", () => {
    setWidth(1200);
    render(<AppShell />);
    expect(column("sidebar")).toBeTruthy();

    act(() => setWidth(800));

    expect(column("rail")).toBeTruthy();
    expect(column("sidebar")).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir canais" })).toBeTruthy();
  });

  it("resets open overlays when crossing breakpoints (800 -> 1200 -> 800)", async () => {
    setWidth(800);
    render(<AppShell />);

    await userEvent.click(screen.getByRole("button", { name: "Abrir canais" }));
    await userEvent.click(screen.getByRole("button", { name: "Membros" }));
    expect(column("sidebar")).toBeTruthy();
    expect(column("members")).toBeTruthy();

    act(() => setWidth(1200)); // static layout: overlays must reset
    act(() => setWidth(800)); // back to overlay layout

    expect(column("rail")).toBeTruthy();
    expect(column("sidebar")).toBeNull(); // overlay does not reappear open
    expect(column("members")).toBeNull();
  });

  it("resets the members overlay when crossing breakpoints (1000 -> 1200 -> 1000)", async () => {
    setWidth(1000);
    render(<AppShell />);

    await userEvent.click(screen.getByRole("button", { name: "Membros" }));
    expect(column("members")).toBeTruthy();

    act(() => setWidth(1200)); // docked member column: overlay state must reset
    act(() => setWidth(1000)); // back below 1150px

    expect(column("members")).toBeNull(); // overlay does not reappear open
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useBreakpoints } from "@/features/shell/useBreakpoints";

/**
 * Sets the real jsdom window width and fires a native `resize` event,
 * so the hook is exercised through its actual listener path.
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

describe("useBreakpoints (ruling R3)", () => {
  it("1200px: membersVisible true, sidebarOverlay false", () => {
    setWidth(1200);
    const { result } = renderHook(() => useBreakpoints());
    expect(result.current).toEqual({
      membersVisible: true,
      sidebarOverlay: false,
    });
  });

  it("1150px (inclusive boundary): membersVisible true, sidebarOverlay false", () => {
    setWidth(1150);
    const { result } = renderHook(() => useBreakpoints());
    expect(result.current).toEqual({
      membersVisible: true,
      sidebarOverlay: false,
    });
  });

  it("1000px: membersVisible false, sidebarOverlay false", () => {
    setWidth(1000);
    const { result } = renderHook(() => useBreakpoints());
    expect(result.current).toEqual({
      membersVisible: false,
      sidebarOverlay: false,
    });
  });

  it("900px (inclusive boundary): membersVisible false, sidebarOverlay false", () => {
    setWidth(900);
    const { result } = renderHook(() => useBreakpoints());
    expect(result.current).toEqual({
      membersVisible: false,
      sidebarOverlay: false,
    });
  });

  it("800px: membersVisible false, sidebarOverlay true", () => {
    setWidth(800);
    const { result } = renderHook(() => useBreakpoints());
    expect(result.current).toEqual({
      membersVisible: false,
      sidebarOverlay: true,
    });
  });

  it("re-renders with new values when the window is resized", () => {
    setWidth(1024);
    const { result } = renderHook(() => useBreakpoints());
    expect(result.current).toEqual({
      membersVisible: false,
      sidebarOverlay: false,
    });

    act(() => setWidth(800));
    expect(result.current).toEqual({
      membersVisible: false,
      sidebarOverlay: true,
    });

    act(() => setWidth(1200));
    expect(result.current).toEqual({
      membersVisible: true,
      sidebarOverlay: false,
    });
  });

  it("accepts an injected width that overrides the window", () => {
    setWidth(1200);
    const { result } = renderHook(() => useBreakpoints(800));
    expect(result.current).toEqual({
      membersVisible: false,
      sidebarOverlay: true,
    });
  });
});

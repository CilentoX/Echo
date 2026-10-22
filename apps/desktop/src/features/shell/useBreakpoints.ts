import { useEffect, useState } from "react";

/** Breakpoint ruling R3: member list is part of the layout at >= 1150px. */
export const MEMBERS_BREAKPOINT = 1150;
/** Breakpoint ruling R3: channel sidebar collapses into an overlay below 900px. */
export const SIDEBAR_BREAKPOINT = 900;

export interface Breakpoints {
  /** Member list is visible in the 4-column layout (width >= 1150). */
  membersVisible: boolean;
  /** Channel sidebar collapses into an overlay (width < 900). */
  sidebarOverlay: boolean;
}

function computeBreakpoints(width: number): Breakpoints {
  return {
    membersVisible: width >= MEMBERS_BREAKPOINT,
    sidebarOverlay: width < SIDEBAR_BREAKPOINT,
  };
}

/**
 * Tracks the responsive layout breakpoints of the app shell.
 *
 * Reads `window.innerWidth` and follows `resize` events. Pass `width`
 * to inject a deterministic value (used by tests); when injected, no
 * listener is attached.
 */
export function useBreakpoints(width?: number): Breakpoints {
  const [windowWidth, setWindowWidth] = useState(() => width ?? window.innerWidth);

  useEffect(() => {
    if (width !== undefined) return;
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [width]);

  return computeBreakpoints(width ?? windowWidth);
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { performLogout, registerLogoutHandler, isLogoutAvailable } from "@/features/auth/logout";

describe("logout.ts - Logout Flow (B2)", () => {
  beforeEach(() => {
    registerLogoutHandler(null);
    vi.clearAllMocks();
  });

  it("B2: performLogout calls registered handler and awaits it", async () => {
    const handler = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    registerLogoutHandler(handler);

    await performLogout();

    expect(handler).toHaveBeenCalled();
  });

  it("B2: performLogout does nothing if no handler registered", async () => {
    registerLogoutHandler(null);

    await expect(performLogout()).resolves.toBeUndefined();
  });

  it("B2: isLogoutAvailable returns true when handler registered", () => {
    registerLogoutHandler(vi.fn<() => Promise<void>>().mockResolvedValue(undefined));
    expect(isLogoutAvailable()).toBe(true);
  });

  it("B2: isLogoutAvailable returns false when no handler", () => {
    registerLogoutHandler(null);
    expect(isLogoutAvailable()).toBe(false);
  });
});
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MemberDropdownContent from "./MemberDropdownContent";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";
import type { UserProfile } from "@/lib/matrix/types";

// Mock dependencies
vi.mock("@/stores/uiStore", () => ({
  useUiStore: vi.fn(),
}));

vi.mock("@/stores/profileStore", () => ({
  useProfileStore: vi.fn(),
}));

vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    getUserProfile: vi.fn(),
    getGlobalProfile: vi.fn(),
  },
}));

vi.mock("@/components/media/MxcImage", () => {
  return {
    default: ({ mxcUrl, ...props }: any) => (
      <img data-testid="mxc-image" src={mxcUrl} {...props} />
    ),
  };
});

const mockUseUiStore = vi.mocked(useUiStore);
const mockUseProfileStore = vi.mocked(useProfileStore);
const mockGetUserProfile = vi.mocked(matrixService.getUserProfile);
const mockGetGlobalProfile = vi.mocked(matrixService.getGlobalProfile);

describe("MemberDropdownContent", () => {
  const userId = "@user:echo.litteris.online";
  const myUserId = "@me:echo.litteris.online";

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseUiStore.mockImplementation((selector) => {
      const state = {
        myUserId,
        presence: { [userId]: "online" },
      };
      return selector(state);
    });

    mockUseProfileStore.mockImplementation((selector) => {
      const state = {
        avatarUrl: null,
        bannerUrl: null,
      };
      return selector(state);
    });

    mockGetUserProfile.mockResolvedValue({
      displayName: "Test User",
      avatarUrl: "mxc://avatar-from-matrix",
      bannerUrl: null,
      bio: null,
      role: null,
    });

    mockGetGlobalProfile.mockResolvedValue(null);
  });

  function renderComponent(props = {}) {
    return render(<MemberDropdownContent userId={userId} {...props} />);
  }

  describe("avatar fallback chain", () => {
    it("shows own user avatar from profile avatar URL (Matrix) when Appwrite avatar is null", async () {
      renderComponent();
      
      // Wait for async load
      await vi.waitFor(() => {
        const img = screen.getByAltText("Avatar");
        expect(img).toBeInTheDocument();
        expect(img.src).toContain("mxc://avatar-from-matrix");
      });
    });

    it("shows own user avatar from profile avatar URL (Matrix) when own avatar is null", async () {
      const otherUserId = "@other:echo.litteris.online";
      mockUseUiStore.mockImplementation((selector) => {
        const state = {
          myUserId: "@me:echo.litteris.online",
          presence: { [otherUserId]: "online" },
        };
        return selector(state);
      });

      renderComponent({ userId: otherUserId });
      
      await vi.waitFor(() => {
        const img = screen.getByAltText("Avatar");
        expect(img).toBeInTheDocument();
        expect(img.src).toContain("mxc://avatar-from-matrix");
      });
    });

    it("falls back to initials when no avatar available", async () => {
      mockGetUserProfile.mockResolvedValue({
        displayName: "Test User",
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        role: null,
      });

      mockUseProfileStore.mockImplementation((selector) => {
        const state = {
          avatarUrl: null,
          bannerUrl: null,
        };
        return selector(state);
      });

      renderComponent();
      
      await vi.waitFor(() => {
        const img = screen.getByAltText("Avatar");
        expect(img).toBeInTheDocument();
        // Should show initials fallback
        expect(img.src).toMatch(/data:image\/svg\+xml/) || expect(img.src).toBe("");
      });
    });
  });
});
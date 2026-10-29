import type { MatrixClientLike, RoomLike, UserProfile } from "../types";
import { getGlobalProfile, GlobalProfile } from "../../appwrite/profiles";

export type ClientFactory = (opts: Record<string, unknown>) => MatrixClientLike;

export class ProfileApi {
  private client: MatrixClientLike | null;
  private readonly clientFactory: ClientFactory;

  constructor(client: MatrixClientLike | null, clientFactory: ClientFactory) {
    this.client = client;
    this.clientFactory = clientFactory;
  }

  /** Update the internal client reference (used after login/restoreSession). */
  setClient(client: MatrixClientLike | null): void {
    this.client = client;
  }

  private requireClient(): MatrixClientLike {
    if (!this.client) {
      throw new Error("ProfileApi: no active session — call loginWithSsoToken or restoreSession first");
    }
    return this.client;
  }

  /** Get display name of a user (defaults to current user). */
  async getDisplayName(userId?: string): Promise<string | null> {
    const client = this.requireClient();
    const resolvedUserId = userId ?? client.getUserId() ?? undefined;
    if (!resolvedUserId) return null;

    const accessToken = client.getAccessToken();
    const baseUrl = client.getBaseUrl();
    const encodedUserId = encodeURIComponent(resolvedUserId);
    const response = await fetch(`${baseUrl}/_matrix/client/v3/profile/${encodedUserId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const res = await response.json();
    return res.displayname ?? null;
  }

  /** Set display name of the current user. */
  async setDisplayName(name: string): Promise<void> {
    await this.requireClient().setDisplayName(name);
  }

  /** Set avatar URL of the current user (null to remove). */
  async setAvatarUrl(url: string | null): Promise<void> {
    const client = this.requireClient();
    if (!url) {
      await client.setAvatarUrl("");
      return;
    }
    await client.setAvatarUrl(url);
  }

  /** Get avatar URL of a user (defaults to current user). */
  async getAvatarUrl(userId?: string): Promise<string | null> {
    const client = this.requireClient();
    const resolvedUserId = userId ?? client.getUserId() ?? undefined;
    if (!resolvedUserId) return null;

    const accessToken = client.getAccessToken();
    const baseUrl = client.getBaseUrl();
    const encodedUserId = encodeURIComponent(resolvedUserId);
    const response = await fetch(`${baseUrl}/_matrix/client/v3/profile/${encodedUserId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const res = await response.json();
    return res.avatar_url ?? null;
  }

  /** Get banner URL of a user (defaults to current user). Matrix doesn't have global banners. */
  async getBannerUrl(userId?: string): Promise<string | null> {
    return null; // Global banner comes from Appwrite Database
  }

  /** Get full user profile from Matrix (displayName, avatarUrl). Bio/links/banner from Appwrite if available. */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const client = this.requireClient();
    const accessToken = client.getAccessToken();
    const baseUrl = client.getBaseUrl();

    // Workaround for matrix-js-sdk 44.x bug with userId containing special chars (@:)
    // Direct HTTP call instead of client.getProfileInfo(userId)
    const encodedUserId = encodeURIComponent(userId);
    const response = await fetch(`${baseUrl}/_matrix/client/v3/profile/${encodedUserId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }

    const res = await response.json();

    // Try to get global profile from Appwrite for bio, links, banner
    const global = await getGlobalProfile(userId);
    return {
      displayName: res.displayname ?? null,
      avatarUrl: res.avatar_url ?? null,
      bannerUrl: global?.bannerUrl ?? null,
      bio: global?.bio ?? null,
      role: null, // Roles are guild-specific (Matrix power levels), not global
    };
  }

  /** Get global profile from Appwrite Database (avatar, banner, bio, links). */
  async getGlobalProfile(userId: string): Promise<GlobalProfile | null> {
    this.requireClient(); // Ensure session exists
    return getGlobalProfile(userId);
  }
}
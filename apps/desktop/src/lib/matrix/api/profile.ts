import type { MatrixClientLike, RoomLike, UserProfile } from "../types";

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
    const res = await client.getProfileInfo(resolvedUserId);
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
    const res = await client.getProfileInfo(resolvedUserId);
    return res.avatar_url ?? null;
  }

  /** Get banner URL of a user (defaults to current user). 
   * Note: Matrix profile doesn't have banner_url by default.
   * This returns null; banner should come from global source (Appwrite/Database). */
  async getBannerUrl(userId?: string): Promise<string | null> {
    return null;
  }

  /** Get full user profile in a single call (Matrix profile only). */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const res = await this.requireClient().getProfileInfo(userId);
    return {
      displayName: res.displayname ?? null,
      avatarUrl: res.avatar_url ?? null,
      bannerUrl: null, // banner não vem do perfil Matrix padrão
      bio: null,
      role: null,
    };
  }
}
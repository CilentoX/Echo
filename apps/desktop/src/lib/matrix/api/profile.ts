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

  /** Get banner URL of a user (defaults to current user). */
  async getBannerUrl(userId?: string): Promise<string | null> {
    const client = this.requireClient();
    const resolvedUserId = userId ?? client.getUserId() ?? undefined;
    const res = await client.getProfileInfo(resolvedUserId);
    return (res as { banner_url?: string }).banner_url ?? null;
  }

  /** Get full user profile in a single call. */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const res = await this.requireClient().getProfileInfo(userId);
    return {
      displayName: res.displayname ?? null,
      avatarUrl: res.avatar_url ?? null,
      bannerUrl: (res as { banner_url?: string }).banner_url ?? null,
      bio: null,
      role: null,
    };
  }

  /** Get user banner from DM room state event (echo.user.banner). */
  async getUserBanner(userId: string): Promise<string | null> {
    const client = this.requireClient();
    const rooms = client.getRooms();
    for (const room of rooms) {
      if (room.getType() !== "m.direct") continue;
      const members = room.getJoinedMembers();
      const hasUser = members.some((m) => m.userId === userId);
      if (!hasUser) continue;
      const bannerEv = room.currentState.getStateEvents("echo.user.banner")[0];
      const url = bannerEv?.getContent().url;
      return typeof url === "string" && url.length > 0 ? url : null;
    }
    return null;
  }

  /** Set user banner in DM room state event (echo.user.banner). */
  async setUserBanner(userId: string, bannerUrl: string | null): Promise<void> {
    const client = this.requireClient();
    const rooms = client.getRooms();
    let dmRoom: RoomLike | null = rooms.find((r) => {
      if (r.getType() !== "m.direct") return false;
      return r.getJoinedMembers().some((m) => m.userId === userId);
    }) ?? null;

    if (!dmRoom) {
      if (!bannerUrl) return; // nothing to do
      const res = await client.createRoom({
        preset: "private_chat" as any,
        is_direct: true,
        invite: [userId],
        visibility: "private" as any,
      });
      dmRoom = client.getRoom(res.room_id);
    }

    if (dmRoom) {
      if (bannerUrl) {
        await client.sendStateEvent(dmRoom.roomId, "echo.user.banner", { url: bannerUrl });
      } else {
        const eventId = await this._findBannerEventId(dmRoom.roomId);
        if (eventId) {
          await client.redactEvent(dmRoom.roomId, eventId);
        }
      }
    }
  }

  private async _findBannerEventId(roomId: string): Promise<string> {
    const room = this.requireClient().getRoom(roomId);
    if (!room) return "";
    const ev = room.currentState.getStateEvents("echo.user.banner")[0];
    return ev?.getId() ?? "";
  }
}
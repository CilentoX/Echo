import type { MatrixClientLike, RoomLike, RoomMemberLike, MemberSummary } from "../types";

/**
 * MembersApi handles room member management operations:
 * - listing members
 * - inviting, kicking, banning users
 * - setting power levels
 */
export class MembersApi {
  private client: MatrixClientLike | null;
  private readonly clientFactory: (opts: Record<string, unknown>) => MatrixClientLike;

  constructor(
    client: MatrixClientLike | null,
    clientFactory: (opts: Record<string, unknown>) => MatrixClientLike
  ) {
    this.client = client;
    this.clientFactory = clientFactory;
  }

  /** Updates the internal client reference (used on session restore). */
  setClient(client: MatrixClientLike | null): void {
    this.client = client;
  }

  private requireClient(): MatrixClientLike {
    if (!this.client) {
      throw new Error("MembersApi: no active client — call setClient() first");
    }
    return this.client;
  }

  /** Returns joined members of a room with presence and avatar info. */
  async listMembers(roomId: string): Promise<MemberSummary[]> {
    const client = this.requireClient();
    const room = client.getRoom(roomId);
    if (!room) return [];

    const members = room.getJoinedMembers();
    const out: MemberSummary[] = [];

    for (const m of members) {
      out.push({
        userId: m.userId,
        displayName: m.name ?? m.userId,
        presence: mapPresence(m.user?.presence),
        avatarUrl: m.avatarUrl ?? null,
      });
    }
    return out;
  }

  /** Invites a user to a room. Returns the event ID of the invite. */
  async inviteUser(roomId: string, userId: string): Promise<string> {
    const client = this.requireClient();
    const room = client.getRoom(roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }
    const result = await client.inviteUser(roomId, userId);
    return normalizeEventId(result);
  }

  /** Kicks a user from a room. Returns the event ID of the kick. */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<string> {
    const client = this.requireClient();
    const room = client.getRoom(roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }
    const result = await client.kickUser(roomId, userId, reason);
    return normalizeEventId(result);
  }

  /** Bans a user from a room. Returns the event ID of the ban. */
  async banUser(roomId: string, userId: string, reason?: string): Promise<string> {
    const client = this.requireClient();
    const room = client.getRoom(roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }
    const result = await client.banUser(roomId, userId, reason);
    return normalizeEventId(result);
  }

  /**
   * Sets the power level for a user in a room.
   * Power level must be between 0 and 100.
   * Returns the event ID of the power level change.
   */
  async setPowerLevel(roomId: string, userId: string, level: number): Promise<string> {
    if (level < 0 || level > 100) {
      throw new Error("Power level must be between 0 and 100");
    }
    const client = this.requireClient();
    const room = client.getRoom(roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }
    const result = await client.setPowerLevel(roomId, userId, level);
    return normalizeEventId(result);
  }
}

function mapPresence(presence?: string | null): MemberSummary["presence"] {
  switch (presence) {
    case "online":
      return "online";
    case "offline":
      return "offline";
    case "unavailable":
      return "unavailable";
    default:
      return "offline";
  }
}

function normalizeEventId(result: string | { event_id: string }): string {
  return typeof result === "string" ? result : result.event_id;
}
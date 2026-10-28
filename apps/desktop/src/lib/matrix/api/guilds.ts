import { createClient, Preset, Visibility } from "matrix-js-sdk";
import type {
  MatrixClientLike,
  ClientFactory,
  GuildSummary,
  RoomLike,
} from "../types";

function defaultClientFactory(opts: Parameters<typeof createClient>[0]): MatrixClientLike {
  return createClient(opts) as unknown as MatrixClientLike;
}

function isSpace(room: RoomLike): boolean {
  return room.getType() === "m.space";
}

function stateEventName(room: RoomLike, eventType: string): string | null {
  const ev = room.currentState.getStateEvents(eventType)[0];
  const name = ev?.getContent().name;
  return typeof name === "string" && name.length > 0 ? name : null;
}

/**
 * Guilds API for MatrixService.
 * Handles Spaces (guilds) - listing, creating, editing, deleting, leaving.
 */
export class GuildsApi {
  private client: MatrixClientLike;
  private readonly clientFactory: ClientFactory;

  constructor(client: MatrixClientLike, clientFactory: ClientFactory = defaultClientFactory) {
    this.client = client;
    this.clientFactory = clientFactory;
  }

  /** Updates the internal client reference (used after login/restoreSession). */
  setClient(client: MatrixClientLike): void {
    this.client = client;
  }

  /** Joined Spaces (m.space) como resumos de guildas. Nome lido de m.room.name. */
  async listGuilds(): Promise<GuildSummary[]> {
    return this.client
      .getRooms()
      .filter((room) => room.getMyMembership() === "join" && isSpace(room))
      .map((room) => ({
        guildId: room.roomId,
        name: stateEventName(room, "m.room.name") ?? room.roomId,
        avatarUrl: room.getMxcAvatarUrl() ?? null,
        unreadCount: room.getUnreadNotificationCount() ?? 0,
      }));
  }

  /** Cria uma nova guilda (Space m.space) com nome, ícone, banner e descrição. */
  async createGuild(
    data: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ): Promise<GuildSummary> {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error("createGuild: nome é obrigatório");
    const res = await this.client.createRoom({
      name: trimmed,
      creation_content: { type: "m.space" },
      visibility: Visibility.Private,
      preset: Preset.PrivateChat,
    });
    if (!res?.room_id) throw new Error("createGuild: resposta sem room_id");
    // Criar canal # geral automaticamente dentro da guilda (P5)
    try {
      const geralRes = await this.client.createRoom({
        name: "geral",
        visibility: Visibility.Private,
        preset: Preset.PrivateChat,
        creation_content: { "m.federate": false },
      });
      if (geralRes?.room_id) {
        await this.client.sendStateEvent(res.room_id, "m.space.child", { via: [res.room_id] }, geralRes.room_id);
      }
    } catch {
      // Se falhar criar o # geral, a guilda já existe — não bloqueia
    }
    // Definir ícone, banner e descrição da guilda (state events)
    if (data.iconUrl) {
      await this.client.sendStateEvent(res.room_id, "m.room.avatar", { url: data.iconUrl });
    }
    if (data.bannerUrl) {
      await this.client.sendStateEvent(res.room_id, "echo.room.banner", { url: data.bannerUrl });
    }
    if (data.description) {
      await this.client.sendStateEvent(res.room_id, "m.room.topic", { topic: data.description });
    }
    return {
      guildId: res.room_id,
      name: trimmed,
      avatarUrl: data.iconUrl ?? null,
      unreadCount: 0,
    };
  }

  /** Sai (deleta) uma guilda própria. */
  async deleteGuild(guildId: string): Promise<void> {
    await this.client.leave(guildId);
  }

  /** Sai de uma guilda (sem excluí-la). */
  async leaveGuild(guildId: string): Promise<void> {
    await this.client.leave(guildId);
  }

  /** Edita uma guilda própria individualmente (nome, ícone, banner, descrição). */
  async editGuild(
    guildId: string,
    data: {
      name: string;
      iconUrl?: string | null;
      bannerUrl?: string | null;
      description?: string | null;
    },
  ): Promise<void> {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error("editGuild: nome é obrigatório");
    // Nome da guilda (m.room.name — spec Matrix)
    await this.client.sendStateEvent(guildId, "m.room.name", { name: trimmed });
    // Ícone da guilda (m.room.avatar — mxc:// URI)
    if (data.iconUrl !== undefined) {
      await this.client.sendStateEvent(guildId, "m.room.avatar", {
        url: data.iconUrl,
      });
    }
    // Banner da guilda (evento de estado customizado)
    if (data.bannerUrl !== undefined) {
      await this.client.sendStateEvent(guildId, "echo.room.banner", {
        url: data.bannerUrl,
      });
    }
    // Descrição da guilda (m.room.topic)
    if (data.description !== undefined) {
      await this.client.sendStateEvent(guildId, "m.room.topic", {
        topic: data.description,
      });
    }
  }
}
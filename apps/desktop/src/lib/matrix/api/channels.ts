import { createClient, Preset, Visibility } from "matrix-js-sdk";
import type {
  MatrixClientLike,
  ClientFactory,
  ChannelSummary,
  RoomLike,
} from "../types";

function defaultClientFactory(opts: Parameters<typeof createClient>[0]): MatrixClientLike {
  return createClient(opts) as unknown as MatrixClientLike;
}

function isSpace(room: RoomLike | null | undefined): boolean {
  return typeof room?.getType === "function" && room.getType() === "m.space";
}

function stateEventName(room: RoomLike, eventType: string): string | null {
  const ev = room.currentState.getStateEvents(eventType)[0];
  const name = ev?.getContent().name;
  return typeof name === "string" && name.length > 0 ? name : null;
}

function stateEventTopic(room: RoomLike, eventType: string): string | null {
  const ev = room.currentState.getStateEvents(eventType)[0];
  const topic = ev?.getContent().topic;
  return typeof topic === "string" && topic.length > 0 ? topic : null;
}

/**
 * Channels API for MatrixService.
 * Handles rooms (channels) within a Space (guild).
 */
export class ChannelsApi {
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

  /** Canais (filhos declarados via m.space.child) de um Space. */
  async listChannels(guildId: string): Promise<ChannelSummary[]> {
    const space = this.client.getRoom(guildId);
    if (!space || !isSpace(space)) return [];

    const childIds = space.currentState
      .getStateEvents("m.space.child")
      .filter((ev) => {
        const via = ev.getContent().via;
        return Array.isArray(via) && via.includes(guildId);
      })
      .map((ev) => ev.getStateKey())
      .filter((stateKey): stateKey is string => typeof stateKey === "string");

    return childIds.map((childId) => {
      const room = this.client.getRoom(childId);
      return {
        channelId: childId,
        name: room ? (stateEventName(room, "m.room.name") ?? childId) : childId,
        topic: room ? stateEventTopic(room, "m.room.topic") ?? undefined : undefined,
        unreadCount: room?.getUnreadNotificationCount() ?? 0,
      };
    });
  }

  /** Cria um canal dentro de uma guilda (Space). Aceita tipo, tópico e categoria. */
  async createChannel(
    guildId: string,
    data: { name: string; type: string; topic?: string; category?: string }
  ): Promise<ChannelSummary> {
    const space = this.client.getRoom(guildId);
    if (!space || !isSpace(space)) throw new Error("createChannel: guilda não encontrada");

    const trimmed = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!trimmed) throw new Error("createChannel: nome é obrigatório");

    const res = await this.client.createRoom({
      name: trimmed,
      topic: data.topic || undefined,
      visibility: Visibility.Private,
      preset: Preset.PrivateChat,
      creation_content: {
        "m.federate": false,
      },
    });
    if (!res?.room_id) throw new Error("createChannel: resposta sem room_id");

    await this.client.sendStateEvent(guildId, "m.space.child", { via: [guildId] }, res.room_id);

    return {
      channelId: res.room_id,
      name: trimmed,
      topic: data.topic || undefined,
      type: data.type,
      category: data.category || undefined,
      unreadCount: 0,
    };
  }

  /** Edita um canal (nome, tópico, categoria). */
  async editChannel(
    channelId: string,
    data: {
      name?: string;
      topic?: string | null;
      category?: string | null;
    }
  ): Promise<void> {
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) throw new Error("editChannel: nome é obrigatório");
      await this.client.sendStateEvent(channelId, "m.room.name", { name: trimmed });
    }
    if (data.topic !== undefined) {
      await this.client.sendStateEvent(channelId, "m.room.topic", { topic: data.topic });
    }
    if (data.category !== undefined) {
      await this.client.sendStateEvent(channelId, "echo.channel.category", { category: data.category });
    }
  }

  /** Sai (deleta) um canal próprio. */
  async deleteChannel(channelId: string): Promise<void> {
    await this.client.leave(channelId);
  }
}
import { createClient } from "matrix-js-sdk";
import type {
  MatrixClientLike,
  ClientFactory,
  NormalizedEvent,
  SendEventResponseLike,
  TimelineEventLike,
} from "../types";

function defaultClientFactory(opts: Parameters<typeof createClient>[0]): MatrixClientLike {
  return createClient(opts) as unknown as MatrixClientLike;
}

/**
 * Messages API for MatrixService.
 * Handles sending, editing, reacting to, and loading messages.
 */
export class MessagesApi {
  private client: MatrixClientLike | null;
  private readonly clientFactory: ClientFactory;

  constructor(client: MatrixClientLike | null, clientFactory: ClientFactory = defaultClientFactory) {
    this.client = client;
    this.clientFactory = clientFactory;
  }

  /** Update the client instance (called after login/restoreSession). */
  setClient(client: MatrixClientLike): void {
    this.client = client;
  }

  private requireClient(): MatrixClientLike {
    if (!this.client) {
      throw new Error("MessagesApi: no client set — call setClient after login");
    }
    return this.client;
  }

  /** Send an m.text message; resolves with the resulting event id. */
  async sendMessage(roomId: string, body: string): Promise<string> {
    const res: SendEventResponseLike = await this.requireClient().sendMessage(roomId, {
      msgtype: "m.text",
      body,
    });
    if (typeof res === "string") return res;
    if (!res?.event_id) throw new Error("sendMessage failed: missing event_id");
    return res.event_id;
  }

  /** Sends an m.file message: uploads the file, then sends m.message with m.file content. */
  async sendFile(roomId: string, file: File, body?: string): Promise<string> {
    const url = await this.uploadMedia(file);
    const res: SendEventResponseLike = await this.requireClient().sendEvent(roomId, "m.message", {
      msgtype: "m.file",
      body: body ?? file.name,
      url,
      info: {
        mimetype: file.type,
        size: file.size,
      },
    } as Record<string, unknown>);
    if (typeof res === "string") return res;
    if (!res?.event_id) throw new Error("sendFile failed: missing event_id");
    return res.event_id;
  }

  /** Envia uma reação m.reaction (m.annotation com m.relates_to) a um evento. */
  async sendReaction(roomId: string, targetEventId: string, emoji: string): Promise<string> {
    const res = await this.requireClient().sendEvent(roomId, "m.reaction", {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: targetEventId,
      },
      "m.annotation": {
        emoji,
      },
    });
    if (!res?.event_id) throw new Error("sendReaction failed: missing event_id");
    return res.event_id;
  }

  /** Remove a própria reação de um evento (redige o evento de reação). */
  async removeReaction(roomId: string, reactionEventId: string): Promise<void> {
    await this.requireClient().redactEvent(roomId, reactionEventId);
  }

  /** Marca o canal como lido até o evento dado (recibo de leitura real no server). */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    await this.requireClient().sendReadReceipt(
      { getId: () => eventId, getRoomId: () => roomId } as unknown as Parameters<
        MatrixClientLike["sendReadReceipt"]
      >[0],
    );
  }

  /** Redige (exclui) um evento próprio. */
  async redact(roomId: string, eventId: string): Promise<void> {
    await this.requireClient().redactEvent(roomId, eventId);
  }

  /** Define o estado de digitação em uma sala (m.typing ephemeral). */
  async setTyping(roomId: string, isTyping: boolean): Promise<void> {
    await this.requireClient().sendTyping(roomId, isTyping);
  }

  /** Edita uma mensagem existente (m.replace). */
  async editMessage(roomId: string, eventId: string, newBody: string): Promise<void> {
    await this.requireClient().sendEvent(roomId, "m.room.message", {
      msgtype: "m.text",
      body: newBody,
      "m.new_content": {
        msgtype: "m.text",
        body: newBody,
      },
      "m.relates_to": {
        rel_type: "m.replace",
        event_id: eventId,
      },
    });
  }

  /** Carrega histórico antigo de uma sala (scrollback) e retorna os eventos. */
  async loadOlder(roomId: string, limit = 20): Promise<NormalizedEvent[]> {
    const room = this.requireClient().getRoom(roomId);
    if (!room) return [];
    const scrollbacked = await this.requireClient().scrollback(room, limit);
    const events = (scrollbacked as { getLiveTimeline: () => { getEvents: () => TimelineEventLike[] } }).getLiveTimeline().getEvents();
    return events
      .map((e) => normalizeTimelineEvent(e))
      .filter((e): e is NormalizedEvent => e !== null);
  }

  /** Envia um arquivo de mídia (avatar, banner, anexo) e devolve o mxc:// URI. */
  async uploadMedia(file: File): Promise<string> {
    const res = await this.requireClient().uploadContent(file, {
      name: file.name,
      type: file.type,
    });
    if (!res?.content_uri) throw new Error("uploadMedia: resposta sem content_uri");
    return res.content_uri;
  }
}

function normalizeTimelineEvent(event: TimelineEventLike): NormalizedEvent | null {
  // Ignora eventos de reação (vem pelo handler próprio) e redactados.
  if (event.getType() !== "m.room.message") return null;
  if (event.isRedacted?.()) return null;
  const body = event.getContent().body;
  const eventId = event.getId();
  const roomId = event.getRoomId();
  if (typeof body !== "string" || !eventId || !roomId) return null;
  return {
    eventId,
    roomId,
    sender: event.getSender(),
    body,
    originServerTs: event.getTs(),
  };
}
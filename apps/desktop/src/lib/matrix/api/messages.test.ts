import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "matrix-js-sdk";
import type { NormalizedEvent, SendEventResponseLike } from "../types";

// Mock the matrix-js-sdk
vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(),
  Preset: { PrivateChat: "private_chat" },
  Visibility: { Private: "private" },
}));

import { MessagesApi } from "./messages";

describe("MessagesApi", () => {
  let mockClient: ReturnType<typeof vi.fn>;
  let mockClientFactory: ReturnType<typeof vi.fn>;
  let messagesApi: MessagesApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      sendMessage: vi.fn(),
      sendEvent: vi.fn(),
      redactEvent: vi.fn(),
      sendReadReceipt: vi.fn(),
      sendTyping: vi.fn(),
      scrollback: vi.fn(),
      uploadContent: vi.fn(),
      getRoom: vi.fn(),
    };
    mockClientFactory = vi.fn(() => mockClient);
    messagesApi = new MessagesApi(mockClient, mockClientFactory);
  });

  describe("sendMessage", () => {
    it("sends m.text message and returns event_id", async () => {
      mockClient.sendMessage.mockResolvedValue("event-123" as SendEventResponseLike);

      const result = await messagesApi.sendMessage("!room:example.com", "Hello world");

      expect(mockClient.sendMessage).toHaveBeenCalledWith("!room:example.com", {
        msgtype: "m.text",
        body: "Hello world",
      });
      expect(result).toBe("event-123");
    });

    it("handles object response with event_id", async () => {
      mockClient.sendMessage.mockResolvedValue({ event_id: "event-456" } as SendEventResponseLike);

      const result = await messagesApi.sendMessage("!room:example.com", "Hello");

      expect(result).toBe("event-456");
    });

    it("throws when event_id missing", async () => {
      mockClient.sendMessage.mockResolvedValue({} as SendEventResponseLike);

      await expect(messagesApi.sendMessage("!room:example.com", "Hello")).rejects.toThrow(
        "sendMessage failed: missing event_id"
      );
    });
  });

  describe("sendFile", () => {
    it("uploads media then sends m.file message", async () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      mockClient.uploadContent.mockResolvedValue({ content_uri: "mxc://example.com/file" });
      mockClient.sendEvent.mockResolvedValue({ event_id: "event-789" } as SendEventResponseLike);

      const result = await messagesApi.sendFile("!room:example.com", file, "My file");

      expect(mockClient.uploadContent).toHaveBeenCalledWith(file, {
        name: "test.txt",
        type: "text/plain",
      });
      expect(mockClient.sendEvent).toHaveBeenCalledWith("!room:example.com", "m.message", {
        msgtype: "m.file",
        body: "My file",
        url: "mxc://example.com/file",
        info: {
          mimetype: "text/plain",
          size: file.size,
        },
      });
      expect(result).toBe("event-789");
    });

    it("uses filename as body when not provided", async () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      mockClient.uploadContent.mockResolvedValue({ content_uri: "mxc://example.com/file" });
      mockClient.sendEvent.mockResolvedValue({ event_id: "event-789" } as SendEventResponseLike);

      await messagesApi.sendFile("!room:example.com", file);

      expect(mockClient.sendEvent).toHaveBeenCalledWith("!room:example.com", "m.message", 
        expect.objectContaining({ body: "test.txt" })
      );
    });
  });

  describe("sendReaction", () => {
    it("sends m.reaction event with correct structure", async () => {
      mockClient.sendEvent.mockResolvedValue({ event_id: "reaction-123" });

      const result = await messagesApi.sendReaction("!room:example.com", "$event:example.com", "👍");

      expect(mockClient.sendEvent).toHaveBeenCalledWith("!room:example.com", "m.reaction", {
        "m.relates_to": {
          rel_type: "m.annotation",
          event_id: "$event:example.com",
        },
        "m.annotation": {
          emoji: "👍",
        },
      });
      expect(result).toBe("reaction-123");
    });

    it("throws when event_id missing", async () => {
      mockClient.sendEvent.mockResolvedValue({});

      await expect(messagesApi.sendReaction("!room:example.com", "$event:example.com", "👍")).rejects.toThrow(
        "sendReaction failed: missing event_id"
      );
    });
  });

  describe("removeReaction", () => {
    it("redacts the reaction event", async () => {
      mockClient.redactEvent.mockResolvedValue({ event_id: "redact-123" });

      await messagesApi.removeReaction("!room:example.com", "$reaction:example.com");

      expect(mockClient.redactEvent).toHaveBeenCalledWith("!room:example.com", "$reaction:example.com");
    });
  });

  describe("redact", () => {
    it("redacts the given event", async () => {
      mockClient.redactEvent.mockResolvedValue({ event_id: "redact-123" });

      await messagesApi.redact("!room:example.com", "$event:example.com");

      expect(mockClient.redactEvent).toHaveBeenCalledWith("!room:example.com", "$event:example.com");
    });
  });

  describe("markAsRead", () => {
    it("sends read receipt with event reference", async () => {
      mockClient.sendReadReceipt.mockResolvedValue(undefined);

      await messagesApi.markAsRead("!room:example.com", "$event:example.com");

      expect(mockClient.sendReadReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          getId: expect.any(Function),
          getRoomId: expect.any(Function),
        })
      );
    });
  });

  describe("loadOlder", () => {
    it("fetches older messages via scrollback and normalizes", async () => {
      const mockRoom = {
        getLiveTimeline: () => ({
          getEvents: () => [
            {
              getType: () => "m.room.message",
              getId: () => "$event1",
              getRoomId: () => "!room:example.com",
              getSender: () => "@user:example.com",
              getContent: () => ({ body: "Message 1" }),
              getTs: () => 1000,
              isRedacted: () => false,
            },
            {
              getType: () => "m.room.message",
              getId: () => "$event2",
              getRoomId: () => "!room:example.com",
              getSender: () => "@user:example.com",
              getContent: () => ({ body: "Message 2" }),
              getTs: () => 2000,
              isRedacted: () => false,
            },
          ],
        }),
      };

      mockClient.getRoom.mockReturnValue(mockRoom);
      mockClient.scrollback.mockResolvedValue(mockRoom);

      const events = await messagesApi.loadOlder("!room:example.com", 20);

      expect(mockClient.getRoom).toHaveBeenCalledWith("!room:example.com");
      expect(mockClient.scrollback).toHaveBeenCalledWith(mockRoom, 20);
      expect(events).toHaveLength(2);
      expect(events[0].eventId).toBe("$event1");
      expect(events[1].eventId).toBe("$event2");
    });

    it("returns empty array when room not found", async () => {
      mockClient.getRoom.mockReturnValue(null);

      const events = await messagesApi.loadOlder("!room:example.com", 20);

      expect(events).toEqual([]);
    });

    it("filters out non-message and redacted events", async () => {
      const mockRoom = {
        getLiveTimeline: () => ({
          getEvents: () => [
            {
              getType: () => "m.reaction",
              getId: () => "$event1",
              getRoomId: () => "!room:example.com",
              getSender: () => "@user:example.com",
              getContent: () => ({}),
              getTs: () => 1000,
            },
            {
              getType: () => "m.room.message",
              getId: () => "$event2",
              getRoomId: () => "!room:example.com",
              getSender: () => "@user:example.com",
              getContent: () => ({ body: "Valid" }),
              getTs: () => 2000,
              isRedacted: () => true,
            },
            {
              getType: () => "m.room.message",
              getId: () => "$event3",
              getRoomId: () => "!room:example.com",
              getSender: () => "@user:example.com",
              getContent: () => ({ body: "Valid 2" }),
              getTs: () => 3000,
              isRedacted: () => false,
            },
          ],
        }),
      };

      mockClient.getRoom.mockReturnValue(mockRoom);
      mockClient.scrollback.mockResolvedValue(mockRoom);

      const events = await messagesApi.loadOlder("!room:example.com", 20);

      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBe("$event3");
    });
  });

  describe("editMessage", () => {
    it("sends m.room.message with m.new_content and m.relates_to", async () => {
      mockClient.sendEvent.mockResolvedValue({ event_id: "edit-123" });

      await messagesApi.editMessage("!room:example.com", "$event:example.com", "New content");

      expect(mockClient.sendEvent).toHaveBeenCalledWith("!room:example.com", "m.room.message", {
        msgtype: "m.text",
        body: "New content",
        "m.new_content": {
          msgtype: "m.text",
          body: "New content",
        },
        "m.relates_to": {
          rel_type: "m.replace",
          event_id: "$event:example.com",
        },
      });
    });
  });

  describe("setTyping", () => {
    it("sends typing notification", async () => {
      mockClient.sendTyping.mockResolvedValue(undefined);

      await messagesApi.setTyping("!room:example.com", true);

      expect(mockClient.sendTyping).toHaveBeenCalledWith("!room:example.com", true);
    });
  });
});
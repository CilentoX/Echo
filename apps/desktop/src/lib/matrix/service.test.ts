import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MatrixClient } from "matrix-js-sdk";
import { MatrixService } from "./service";

const BASE_URL = "https://echo.litteris.online";

// Objeto client compartilhado entre todos os testes
const mockClient: Record<string, ReturnType<typeof vi.fn>> = {
  loginRequest: vi.fn(),
  getSsoLoginUrl: vi.fn(() => "https://mock/sso"),
  on: vi.fn(),
  removeListener: vi.fn(),
  startClient: vi.fn(),
  stopClient: vi.fn(),
  sendMessage: vi.fn(),
  sendEvent: vi.fn(),
  sendTyping: vi.fn(),
  redactEvent: vi.fn(),
  sendReadReceipt: vi.fn(),
  scrollback: vi.fn(),
  getProfileInfo: vi.fn(),
  setDisplayName: vi.fn(),
  getRooms: vi.fn(() => []),
  getRoom: vi.fn(),
  createRoom: vi.fn(),
  sendStateEvent: vi.fn(),
  uploadContent: vi.fn(),
  setAvatarUrl: vi.fn(),
};

vi.mock("matrix-js-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("matrix-js-sdk")>();
  return {
    ...actual,
    createClient: vi.fn(() => mockClient),
    Preset: actual.Preset,
    Visibility: actual.Visibility,
  };
});

import { createClient } from "matrix-js-sdk";

const mockCreateClient = vi.mocked(createClient);

beforeEach(() => {
  mockCreateClient.mockClear();
  Object.values(mockClient).forEach((fn) => {
    if (typeof fn === "function" && "mockClear" in fn) {
      fn.mockClear();
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MatrixService (SDK mockado)", () => {
  let service: MatrixService;

  beforeEach(() => {
    service = new MatrixService(BASE_URL);
  });

  describe("loginWithSsoToken", () => {
    it("aplica a sessão e devolve as credenciais", async () => {
      mockClient.loginRequest.mockResolvedValue({
        access_token: "tok-1",
        user_id: "@alice:hs",
        device_id: "DEV1",
        refresh_token: "rt-1",
      });
      const session = await service.loginWithSsoToken("login-token");

      expect(session).toEqual({
        baseUrl: BASE_URL,
        accessToken: "tok-1",
        userId: "@alice:hs",
        deviceId: "DEV1",
        refreshToken: "rt-1",
      });
      expect(mockClient.loginRequest).toHaveBeenCalledWith({
        type: "m.login.token",
        token: "login-token",
      });
    });

    it("lança erro quando não há access_token", async () => {
      mockClient.loginRequest.mockResolvedValue({});
      await expect(service.loginWithSsoToken("bad-token")).rejects.toThrow("missing access_token");
    });
  });

  describe("sendMessage", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
    });

    it("envia m.text e resolve com o eventId", async () => {
      mockClient.sendMessage.mockResolvedValue({ event_id: "$evt:hs" });
      const id = await service.sendMessage("!room:hs", "oi");

      expect(id).toBe("$evt:hs");
      expect(mockClient.sendMessage).toHaveBeenCalledWith("!room:hs", {
        msgtype: "m.text",
        body: "oi",
      });
    });
  });

  describe("sendReaction", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
    });

    it("envia m.reaction com m.relates_to e m.annotation", async () => {
      mockClient.sendEvent.mockResolvedValue({ event_id: "$reaction:hs" });
      const id = await service.sendReaction("!room:hs", "$target:hs", "👍");

      expect(id).toBe("$reaction:hs");
      expect(mockClient.sendEvent).toHaveBeenCalledWith("!room:hs", "m.reaction", {
        "m.relates_to": { rel_type: "m.annotation", event_id: "$target:hs" },
        "m.annotation": { emoji: "👍" },
      });
    });
  });

  describe("markAsRead", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
    });

    it("envia recibo de leitura", async () => {
      mockClient.sendReadReceipt.mockResolvedValue(undefined);
      await service.markAsRead("!room:hs", "$evt:hs");

      expect(mockClient.sendReadReceipt).toHaveBeenCalled();
    });
  });

  describe("redact", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
    });

    it("redige um evento próprio", async () => {
      mockClient.redactEvent.mockResolvedValue({ event_id: "$redact:hs" });
      await service.redact("!room:hs", "$evt:hs");

      expect(mockClient.redactEvent).toHaveBeenCalledWith("!room:hs", "$evt:hs");
    });
  });

  describe("setTyping", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
    });

    it("envia notificação de digitação", async () => {
      mockClient.sendTyping.mockResolvedValue(undefined);
      await service.setTyping("!room:hs", true);

      expect(mockClient.sendTyping).toHaveBeenCalledWith("!room:hs", true);
    });
  });

  describe("getDisplayName / setDisplayName", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
    });

    it("getDisplayName devolve o nome do perfil", async () => {
      mockClient.getProfileInfo.mockResolvedValue({ displayname: "Alice" });
      const name = await service.getDisplayName("@alice:hs");
      expect(name).toBe("Alice");
      expect(mockClient.getProfileInfo).toHaveBeenCalledWith("@alice:hs");
    });

    it("setDisplayName altera o nome de exibição", async () => {
      mockClient.setDisplayName.mockResolvedValue(undefined);
      await service.setDisplayName("Alice");
      expect(mockClient.setDisplayName).toHaveBeenCalledWith("Alice");
    });
  });

  describe("createGuild", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
    });

    it("cria uma Space com m.space na creation_content", async () => {
      mockClient.createRoom.mockResolvedValue({ room_id: "!space:hs" });
      const guild = await service.createGuild({ name: "Guilda Echo" });

      expect(guild).toEqual({ guildId: "!space:hs", name: "Guilda Echo", avatarUrl: null, unreadCount: 0 });
      expect(mockClient.createRoom).toHaveBeenCalledWith({
        name: "Guilda Echo",
        creation_content: { type: "m.space" },
        visibility: "private",
        preset: "private_chat",
      });
    });

    it("rejeita nome vazio", async () => {
      await expect(service.createGuild({ name: "   " })).rejects.toThrow("nome é obrigatório");
    });
  });

  describe("createChannel", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
      mockClient.getRoom.mockReturnValue({
        getType: () => "m.space",
        currentState: { getStateEvents: () => [] },
      });
    });

    it("cria uma sala m.room e declara m.space.child", async () => {
      mockClient.createRoom.mockResolvedValue({ room_id: "!chan:hs" });
      const channel = await service.createChannel("!guild:hs", {
        name: "geral",
        type: "text",
        topic: "tópico do geral",
        category: "Geral",
      });

      expect(channel).toEqual({
        channelId: "!chan:hs",
        name: "geral",
        topic: "tópico do geral",
        type: "text",
        category: "Geral",
        unreadCount: 0,
      });
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        "!guild:hs",
        "m.space.child",
        { via: ["!guild:hs"] },
        "!chan:hs",
      );
    });
  });

  describe("editGuild (fix B4: m.room.name, não m.space.name)", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
    });

    it("escreve m.room.name no estado da guilda", async () => {
      mockClient.sendStateEvent.mockResolvedValue({ event_id: "$rename:hs" });
      await service.editGuild("!guild:hs", { name: "Novo Nome" });

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        "!guild:hs",
        "m.room.name",
        { name: "Novo Nome" },
      );
    });
  });

  describe("listGuilds / listChannels / listMembers (sem sync)", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
      mockClient.getRoom.mockReturnValue({
        getJoinedMembers: vi.fn(() => []),
        currentState: { getStateEvents: () => [] },
      });
    });

    it("listGuilds devolve [] sem sync prévio", async () => {
      expect(await service.listGuilds()).toEqual([]);
    });

    it("listChannels devolve [] quando a guilda não existe", async () => {
      expect(await service.listChannels("!nao-existe")).toEqual([]);
    });

    it("listMembers devolve [] quando o canal não existe", async () => {
      expect(await service.listMembers("!nao-existe")).toEqual([]);
    });
  });

  describe("getSsoLoginUrl", () => {
    it("constrói a URL de redirect do provider OIDC", () => {
      mockClient.getSsoLoginUrl.mockReturnValue(
        "https://mock/sso?redirectUrl=http://localhost:1420/callback&idpId=oidc-google",
      );
      const url = service.getSsoLoginUrl("http://localhost:1420/callback", "oidc-google");
      expect(mockClient.getSsoLoginUrl).toHaveBeenCalledWith(
        "http://localhost:1420/callback",
        "sso",
        "oidc-google",
      );
      expect(url).toContain("idpId=oidc-google");
    });
  });

  describe("startSyncHandlers / stopSync", () => {
    let onSpy: ReturnType<typeof vi.spyOn>;
    let startSpy: ReturnType<typeof vi.spyOn>;
    let stopSpy: ReturnType<typeof vi.spyOn>;
    let removeListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      onSpy = vi.spyOn(MatrixClient.prototype, "on");
      startSpy = vi.spyOn(MatrixClient.prototype, "startClient");
      stopSpy = vi.spyOn(MatrixClient.prototype, "stopClient");
      removeListenerSpy = vi.spyOn(MatrixClient.prototype, "removeListener");
    });

    afterEach(() => {
      onSpy.mockRestore();
      startSpy.mockRestore();
      stopSpy.mockRestore();
      removeListenerSpy.mockRestore();
    });

    it("registra listeners e chama startClient com as opções corretas", () => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
      service.startSyncHandlers({
        onEvent: vi.fn(),
        onStatus: vi.fn(),
        onTyping: vi.fn(),
        onPresence: vi.fn(),
        onMembers: vi.fn(),
        onReaction: vi.fn(),
        onReadReceipt: vi.fn(),
      });

      expect(mockClient.on).toHaveBeenCalledWith("sync", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("Room.timeline", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("RoomMember.typing", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("User.presence", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("RoomStateEvent.Members", expect.any(Function));
      expect(mockClient.startClient).toHaveBeenCalledWith({ initialSyncLimit: 20, threadSupport: true });
    });

    it("stopSync remove listeners e chama stopClient", () => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
      service.startSyncHandlers({ onEvent: vi.fn(), onStatus: vi.fn() });
      service.stopSync();

      expect(mockClient.removeListener).toHaveBeenCalledWith("sync", expect.any(Function));
      expect(mockClient.removeListener).toHaveBeenCalledWith("Room.timeline", expect.any(Function));
      expect(mockClient.stopClient).toHaveBeenCalled();
    });
  });

  describe("uploadMedia / avatar", () => {
    beforeEach(() => {
      service.restoreSession({ baseUrl: BASE_URL, accessToken: "tok", userId: "@alice:hs", deviceId: null });
    });

    it("uploadMedia envia o arquivo e devolve o mxc:// URI", async () => {
      mockClient.uploadContent.mockResolvedValue({ content_uri: "mxc://hs/abc123" });
      const file = new File(["dummy"], "avatar.png", { type: "image/png" });
      const uri = await service.uploadMedia(file);

      expect(uri).toBe("mxc://hs/abc123");
      expect(mockClient.uploadContent).toHaveBeenCalledWith(file, expect.anything());
    });

    it("setAvatarUrl altera o avatar do próprio usuário", async () => {
      mockClient.setAvatarUrl.mockResolvedValue(undefined);
      await service.setAvatarUrl("mxc://hs/avatar");
      expect(mockClient.setAvatarUrl).toHaveBeenCalledWith("mxc://hs/avatar");
    });

    it("getProfileInfo devolve o avatar_url do usuário", async () => {
      mockClient.getProfileInfo.mockResolvedValue({ avatar_url: "mxc://hs/avatar", displayname: "Alice" });
      const info = await service.getAvatarUrl("@alice:hs");
      expect(info).toBe("mxc://hs/avatar");
      expect(mockClient.getProfileInfo).toHaveBeenCalledWith("@alice:hs");
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { createClient } from "matrix-js-sdk";
import { MatrixService } from "./service";
import {
  createFakeClient,
  createFakeRoom,
  createFakeTimelineEvent,
  type FakeClient,
} from "./fakeClient";
import type { Session } from "./types";

const BASE_URL = "https://hs.example";

function makeService(fake: FakeClient): MatrixService {
  return new MatrixService(BASE_URL, () => fake);
}

function makeSession(): Session {
  return {
    baseUrl: BASE_URL,
    accessToken: "syt-restored",
    userId: "@user:hs.example",
    deviceId: "FAKEDEV",
  };
}

describe("MatrixService", () => {
  it("loginWithSsoToken chama loginRequest com m.login.token e devolve Session", async () => {
    const fake = createFakeClient();
    fake.loginRequest.mockResolvedValueOnce({
      access_token: "syt-at-1",
      user_id: "@nina:hs.example",
      device_id: "DEV123",
      refresh_token: "rt-1",
    });
    const service = makeService(fake);

    const session = await service.loginWithSsoToken("LT-1");

    expect(fake.loginRequest).toHaveBeenCalledWith({
      type: "m.login.token",
      token: "LT-1",
    });
    expect(session).toEqual({
      baseUrl: BASE_URL,
      accessToken: "syt-at-1",
      userId: "@nina:hs.example",
      deviceId: "DEV123",
      refreshToken: "rt-1",
    });
  });

  it("loginWithSsoToken devolve Session sem refreshToken quando ausente", async () => {
    const fake = createFakeClient();
    fake.loginRequest.mockResolvedValueOnce({
      access_token: "syt-at-2",
      user_id: "@nina:hs.example",
      device_id: null,
    });
    const service = makeService(fake);

    const session = await service.loginWithSsoToken("LT-2");

    expect(session).toEqual({
      baseUrl: BASE_URL,
      accessToken: "syt-at-2",
      userId: "@nina:hs.example",
      deviceId: null,
    });
  });

  it("loginWithSsoToken troca o client anônimo por um client com credenciais", async () => {
    const anonymous = createFakeClient();
    anonymous.loginRequest.mockResolvedValueOnce({
      access_token: "syt-at-3",
      user_id: "@nina:hs.example",
      device_id: "DEV123",
    });
    const created: Array<{ opts: Parameters<typeof createClient>[0]; client: FakeClient }> = [];
    const service = new MatrixService(BASE_URL, (opts) => {
      const client = created.length === 0 ? anonymous : createFakeClient();
      created.push({ opts, client });
      return client;
    });

    const session = await service.loginWithSsoToken("LT-3");

    // 1º client: anônimo (só baseUrl); 2º client: criado com credenciais da sessão
    expect(created).toHaveLength(2);
    expect(created[0].opts).toEqual({ baseUrl: BASE_URL });
    expect(created[1].opts).toEqual({
      baseUrl: BASE_URL,
      accessToken: "syt-at-3",
      userId: "@nina:hs.example",
      deviceId: "DEV123",
    });
    expect(session).toEqual({
      baseUrl: BASE_URL,
      accessToken: "syt-at-3",
      userId: "@nina:hs.example",
      deviceId: "DEV123",
    });

    // o client ativo pós-login é o NOVO (credenciado), não o anônimo
    created[1].client.sendMessage.mockResolvedValueOnce({ event_id: "$sent-cred" });
    await expect(service.sendMessage("!room:hs.example", "oi")).resolves.toBe("$sent-cred");
    expect(anonymous.sendMessage).not.toHaveBeenCalled();
  });

  it("startSync usa os parâmetros do startClient e entrega evento m.room.message normalizado", () => {
    const fake = createFakeClient();
    const service = makeService(fake);
    service.restoreSession(makeSession());

    const onEvent = vi.fn();
    const onStatus = vi.fn();
    service.startSync(onEvent, onStatus);

    expect(fake.startClient).toHaveBeenCalledWith({
      initialSyncLimit: 20,
      threadSupport: true,
    });

    fake.emit(
      "Room.timeline",
      createFakeTimelineEvent({
        eventId: "$evt-1",
        roomId: "!room:hs.example",
        sender: "@ana:hs.example",
        body: "olá mundo",
        ts: 1700000123456,
      }),
    );

    expect(onEvent).toHaveBeenCalledWith({
      eventId: "$evt-1",
      roomId: "!room:hs.example",
      sender: "@ana:hs.example",
      body: "olá mundo",
      originServerTs: 1700000123456,
    });
  });

  it("startSync ignora eventos que não são m.room.message", () => {
    const fake = createFakeClient();
    const service = makeService(fake);
    service.restoreSession(makeSession());

    const onEvent = vi.fn();
    service.startSync(onEvent, vi.fn());

    fake.emit("Room.timeline", createFakeTimelineEvent({ type: "m.room.member" }));

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("client.on('sync') com ERROR reporta onStatus('error')", () => {
    const fake = createFakeClient();
    const service = makeService(fake);
    service.restoreSession(makeSession());

    const onStatus = vi.fn();
    service.startSync(vi.fn(), onStatus);

    fake.emit("sync", "ERROR");

    expect(onStatus).toHaveBeenCalledWith("error");
  });

  it("client.on('sync') com PREPARED reporta onStatus('syncing')", () => {
    const fake = createFakeClient();
    const service = makeService(fake);
    service.restoreSession(makeSession());

    const onStatus = vi.fn();
    service.startSync(vi.fn(), onStatus);

    fake.emit("sync", "PREPARED");

    expect(onStatus).toHaveBeenCalledWith("syncing");
  });

  it("stopSync remove os listeners e para o client", () => {
    const fake = createFakeClient();
    const service = makeService(fake);
    service.restoreSession(makeSession());

    const onEvent = vi.fn();
    const onStatus = vi.fn();
    service.startSync(onEvent, onStatus);
    service.stopSync();

    fake.emit("sync", "PREPARED");
    fake.emit("Room.timeline", createFakeTimelineEvent());

    expect(onStatus).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
    expect(fake.stopClient).toHaveBeenCalled();
  });

  it("sendMessage monta m.text e resolve com o eventId", async () => {
    const fake = createFakeClient();
    fake.sendMessage.mockResolvedValueOnce({ event_id: "$sent-1" });
    const service = makeService(fake);
    service.restoreSession(makeSession());

    const eventId = await service.sendMessage("!room:hs.example", "oi");

    expect(fake.sendMessage).toHaveBeenCalledWith("!room:hs.example", {
      msgtype: "m.text",
      body: "oi",
    });
    expect(eventId).toBe("$sent-1");
  });

  it("getSsoLoginUrl delega ao client (wrapper p/ sso.ts)", () => {
    const fake = createFakeClient();
    fake.getSsoLoginUrl.mockReturnValueOnce("https://hs.example/sso-redirect");
    const service = makeService(fake);
    service.restoreSession(makeSession());

    const url = service.getSsoLoginUrl("http://localhost:1420/sso-callback");

    expect(url).toBe("https://hs.example/sso-redirect");
    expect(fake.getSsoLoginUrl).toHaveBeenCalledWith(
      "http://localhost:1420/sso-callback",
    );
  });

  it("listGuilds transforma um Space joined em GuildSummary", async () => {
    const space = createFakeRoom({
      roomId: "!space:hs.example",
      type: "m.space",
      spaceName: "Guilda Eco",
      unreadCount: 2,
    });
    const fake = createFakeClient();
    fake.getRooms.mockReturnValueOnce([space]);
    const service = makeService(fake);
    service.restoreSession(makeSession());

    const guilds = await service.listGuilds();

    expect(guilds).toEqual([
      {
        guildId: "!space:hs.example",
        name: "Guilda Eco",
        avatarUrl: null,
        unreadCount: 2,
      },
    ]);
  });

  it("listGuilds ignora rooms que não são Space", async () => {
    const channel = createFakeRoom({ roomId: "!chan:hs.example" });
    const fake = createFakeClient();
    fake.getRooms.mockReturnValueOnce([channel]);
    const service = makeService(fake);
    service.restoreSession(makeSession());

    expect(await service.listGuilds()).toEqual([]);
  });

  it("listChannels lê os filhos do Space via m.space.child", async () => {
    const geral = createFakeRoom({
      roomId: "!chan1:hs.example",
      name: "#geral",
      unreadCount: 3,
    });
    const dev = createFakeRoom({ roomId: "!chan2:hs.example", name: "#dev" });
    const space = createFakeRoom({
      roomId: "!space:hs.example",
      type: "m.space",
      spaceName: "Guilda Eco",
      children: [
        { roomId: "!chan1:hs.example", via: ["hs.example"] },
        { roomId: "!ghost:hs.example" }, // sem via: não é filho recomendado
        { roomId: "!chan2:hs.example", via: ["hs.example"] },
      ],
    });
    const fake = createFakeClient();
    fake.getRoom.mockImplementation((roomId: string) => {
      if (roomId === "!chan1:hs.example") return geral;
      if (roomId === "!chan2:hs.example") return dev;
      return space;
    });
    const service = makeService(fake);
    service.restoreSession(makeSession());

    const channels = await service.listChannels("!space:hs.example");

    expect(channels).toEqual([
      { channelId: "!chan1:hs.example", name: "#geral", unreadCount: 3 },
      { channelId: "!chan2:hs.example", name: "#dev", unreadCount: 0 },
    ]);
  });

  it("listChannels devolve [] quando o guildId não é um room conhecido", async () => {
    const fake = createFakeClient();
    const service = makeService(fake);
    service.restoreSession(makeSession());

    expect(await service.listChannels("!desconhecido")).toEqual([]);
  });
});

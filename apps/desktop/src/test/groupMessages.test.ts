import { describe, expect, it } from "vitest";
import { groupMessages, senderLabel } from "@/features/chat/groupMessages";
import type { NormalizedEvent } from "@/lib/matrix/types";

const T0 = 1_700_000_000_000;
const GAP_5MIN = 5 * 60 * 1000;

function ev(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    eventId: "e1",
    roomId: "!c1:hs",
    sender: "@lucas:hs",
    body: "olá",
    originServerTs: T0,
    ...overrides,
  };
}

describe("groupMessages", () => {
  it("mensagens da mesma pessoa seguidas formam 1 grupo", () => {
    const groups = groupMessages([
      ev({ eventId: "e1", originServerTs: T0 }),
      ev({ eventId: "e2", originServerTs: T0 + 60_000 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].sender).toBe("@lucas:hs");
    expect(groups[0].events.map((e) => e.eventId)).toEqual(["e1", "e2"]);
  });

  it("mudança de sender abre novo grupo", () => {
    const groups = groupMessages([
      ev({ eventId: "e1", sender: "@lucas:hs" }),
      ev({ eventId: "e2", sender: "@maria:hs", originServerTs: T0 + 1000 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].sender).toBe("@lucas:hs");
    expect(groups[1].sender).toBe("@maria:hs");
  });

  it("gap de 6 minutos entre a mesma pessoa abre novo grupo", () => {
    const groups = groupMessages([
      ev({ eventId: "e1", originServerTs: T0 }),
      ev({ eventId: "e2", originServerTs: T0 + 6 * 60 * 1000 }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("gap de exatamente 5 minutos NÃO abre novo grupo (limite <=)", () => {
    const groups = groupMessages([
      ev({ eventId: "e1", originServerTs: T0 }),
      ev({ eventId: "e2", originServerTs: T0 + GAP_5MIN }),
    ]);

    expect(groups).toHaveLength(1);
  });

  it("lista vazia → nenhum grupo", () => {
    expect(groupMessages([])).toEqual([]);
  });

  it("senderLabel extrai o localpart de ids Matrix", () => {
    expect(senderLabel("@lucas:hs")).toBe("lucas");
    expect(senderLabel("Você")).toBe("Você");
  });
});

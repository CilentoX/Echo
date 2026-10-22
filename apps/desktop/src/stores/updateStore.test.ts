import { afterEach, describe, expect, it } from "vitest";

import { useUpdateStore } from "./updateStore";

afterEach(() => {
  useUpdateStore.getState().reset();
});

describe("updateStore", () => {
  it("começa idle sem versão", () => {
    expect(useUpdateStore.getState().status).toBe("idle");
    expect(useUpdateStore.getState().version).toBeNull();
  });

  it("beginDownload registra downloading + versão", () => {
    useUpdateStore.getState().beginDownload("0.1.2");

    expect(useUpdateStore.getState().status).toBe("downloading");
    expect(useUpdateStore.getState().version).toBe("0.1.2");
  });

  it("markReady mantém a versão e muda para ready", () => {
    useUpdateStore.getState().beginDownload("0.1.2");
    useUpdateStore.getState().markReady();

    expect(useUpdateStore.getState().status).toBe("ready");
    expect(useUpdateStore.getState().version).toBe("0.1.2");
  });

  it("reset volta ao idle sem versão", () => {
    useUpdateStore.getState().beginDownload("0.1.2");
    useUpdateStore.getState().reset();

    expect(useUpdateStore.getState().status).toBe("idle");
    expect(useUpdateStore.getState().version).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { useProfileStore } from "./profileStore";

describe("profileStore", () => {
  beforeEach(() => {
    useProfileStore.setState({
      displayName: "",
      username: "",
      avatarUrl: null,
      bio: null,
      role: null,
      joinedAt: null,
      links: [],
      bannerUrl: null,
      nickname: null,
    });
  });

  it("inicializa com valores vazios", () => {
    const s = useProfileStore.getState();
    expect(s.displayName).toBe("");
    expect(s.avatarUrl).toBeNull();
    expect(s.bannerUrl).toBeNull();
    expect(s.nickname).toBeNull();
    expect(s.bio).toBeNull();
    expect(s.links).toEqual([]);
  });

  it("setAvatarUrl altera avatarUrl", () => {
    useProfileStore.getState().setAvatarUrl("mxc://server/abc");
    expect(useProfileStore.getState().avatarUrl).toBe("mxc://server/abc");
    expect(useProfileStore.getState().bannerUrl).toBeNull();
  });

  it("setBannerUrl altera bannerUrl sem afetar avatarUrl", () => {
    useProfileStore.getState().setAvatarUrl("mxc://server/avatar");
    useProfileStore.getState().setBannerUrl("mxc://server/banner");
    const s = useProfileStore.getState();
    expect(s.avatarUrl).toBe("mxc://server/avatar");
    expect(s.bannerUrl).toBe("mxc://server/banner");
  });

  it("setNickname altera nickname", () => {
    useProfileStore.getState().setNickname("lucas");
    expect(useProfileStore.getState().nickname).toBe("lucas");
  });

  it("setNickname com null limpa", () => {
    useProfileStore.getState().setNickname("lucas");
    useProfileStore.getState().setNickname(null);
    expect(useProfileStore.getState().nickname).toBeNull();
  });

  it("reset limpa banner e nickname", () => {
    useProfileStore.getState().setBannerUrl("mxc://server/banner");
    useProfileStore.getState().setNickname("lucas");
    useProfileStore.getState().reset();
    const s = useProfileStore.getState();
    expect(s.bannerUrl).toBeNull();
    expect(s.nickname).toBeNull();
    expect(s.avatarUrl).toBeNull();
  });
});

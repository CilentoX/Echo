import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProfileStore } from "@/stores/profileStore";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import UserBar from "@/features/shell/UserBar";
import MemberList from "@/features/shell/MemberList";

describe("Custom Status (Status de Atividade Personalizado)", () => {
  beforeEach(() => {
    localStorage.clear();
    useProfileStore.getState().reset();
    useUiStore.setState({
      myUserId: "@lucas:echo.litteris.online",
      activeGuildId: "!guild1:hs",
      activeChannelId: "!chan1:hs",
    });
    useProfileStore.setState({
      displayName: "Lucas Dev",
      username: "lucas",
      matrixUserId: "@lucas:echo.litteris.online",
      customStatus: null,
    });
    useSyncStore.setState({
      guilds: [
        {
          guildId: "!guild1:hs",
          name: "Echo Guild",
          avatarUrl: null,
          unreadCount: 0,
        },
      ],
      channelsByGuild: {
        "!guild1:hs": [{ channelId: "!chan1:hs", name: "geral", unreadCount: 0 }],
      },
      membersByRoom: {
        "!chan1:hs": [
          {
            userId: "@lucas:echo.litteris.online",
            displayName: "Lucas Dev",
            avatarUrl: null,
            presence: "online",
          },
        ],
      },
    });
  });

  it("permite definir um status customizado e persiste no store", () => {
    useProfileStore.getState().setCustomStatus({
      emoji: "🎧",
      text: "Ouvindo Daft Punk",
    });

    const status = useProfileStore.getState().customStatus;
    expect(status).toEqual({ emoji: "🎧", text: "Ouvindo Daft Punk" });
  });

  it("renderiza o status de atividade na UserBar", () => {
    useProfileStore.getState().setCustomStatus({
      emoji: "🎮",
      text: "Jogando Cyberpunk 2077",
    });

    render(<UserBar />);

    expect(screen.getByText("Jogando Cyberpunk 2077")).toBeTruthy();
    expect(screen.getByText("🎮")).toBeTruthy();
  });

  it("renderiza o status de atividade na MemberList", () => {
    useProfileStore.getState().setCustomStatus({
      emoji: "💻",
      text: "Codando no Echo",
    });

    render(<MemberList />);

    expect(screen.getByText("Codando no Echo")).toBeTruthy();
    expect(screen.getByText("💻")).toBeTruthy();
  });

  it("limpa o status de atividade ao passar null", () => {
    useProfileStore.getState().setCustomStatus({
      emoji: "☕",
      text: "Pausa para café",
    });
    expect(useProfileStore.getState().customStatus).not.toBeNull();

    useProfileStore.getState().setCustomStatus(null);
    expect(useProfileStore.getState().customStatus).toBeNull();

    render(<UserBar />);
    expect(screen.queryByText("Pausa para café")).toBeNull();
  });
});


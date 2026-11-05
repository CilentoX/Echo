import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MemberContextMenu from "@/features/shell/MemberContextMenu";
import { useFriendsStore } from "@/stores/friendsStore";
import { useUiStore } from "@/stores/uiStore";
import MessageBubble from "@/features/chat/MessageBubble";
import type { NormalizedEvent } from "@/lib/matrix/types";

describe("Sistema Global de Context Menus (Padrão Discord)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({
      myUserId: "@lucas:echo.litteris.online",
      activeGuildId: "guild-1",
    });
    useFriendsStore.setState({
      friends: [],
    });

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe("MemberContextMenu", () => {
    it("abre menu de contexto com opções do membro no clique direito e permite copiar ID", async () => {
      const openDmSpy = vi.fn().mockResolvedValue(undefined);
      useFriendsStore.setState({ openDirectMessage: openDmSpy });

      render(
        <MemberContextMenu
          userId="@alice:echo.litteris.online"
          displayName="Alice Wonderland"
        >
          <div data-testid="member-card">Alice Wonderland</div>
        </MemberContextMenu>
      );

      const trigger = screen.getByTestId("member-card");
      expect(trigger).toBeDefined();

      // Dispara o clique direito (contextmenu)
      fireEvent.contextMenu(trigger);

      // Radix monta o menu de contexto no portal
      await waitFor(() => {
        expect(screen.getByText("Ver Perfil")).toBeDefined();
        expect(screen.getByText("Mensagem Direta")).toBeDefined();
        expect(screen.getByText("Mencionar")).toBeDefined();
        expect(screen.getByText("Adicionar Amigo")).toBeDefined();
        expect(screen.getByText("Copiar ID do Usuário")).toBeDefined();
      });

      // Clica em 'Copiar ID do Usuário'
      const copyButton = screen.getByText("Copiar ID do Usuário");
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("@alice:echo.litteris.online");
    });

    it("chama openDirectMessage ao selecionar Mensagem Direta", async () => {
      const openDmSpy = vi.fn().mockResolvedValue(undefined);
      useFriendsStore.setState({ openDirectMessage: openDmSpy });

      render(
        <MemberContextMenu
          userId="@bob:echo.litteris.online"
          displayName="Bob Builder"
        >
          <div data-testid="bob-card">Bob Builder</div>
        </MemberContextMenu>
      );

      fireEvent.contextMenu(screen.getByTestId("bob-card"));

      await waitFor(() => {
        expect(screen.getByText("Mensagem Direta")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Mensagem Direta"));
      expect(openDmSpy).toHaveBeenCalledWith("@bob:echo.litteris.online");
    });

    it("dispara evento echo:insert-mention ao clicar em Mencionar", async () => {
      const mentionListener = vi.fn();
      window.addEventListener("echo:insert-mention", mentionListener);

      render(
        <MemberContextMenu
          userId="@carol:echo.litteris.online"
          displayName="Carol Danvers"
        >
          <div data-testid="carol-card">Carol Danvers</div>
        </MemberContextMenu>
      );

      fireEvent.contextMenu(screen.getByTestId("carol-card"));

      await waitFor(() => {
        expect(screen.getByText("Mencionar")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Mencionar"));
      expect(mentionListener).toHaveBeenCalled();

      window.removeEventListener("echo:insert-mention", mentionListener);
    });
  });

  describe("MessageBubble ContextMenu", () => {
    const mockEvent: NormalizedEvent = {
      eventId: "$event123",
      roomId: "!room1:echo.litteris.online",
      sender: "@other:echo.litteris.online",
      body: "Olá, esta é uma mensagem de teste!",
      originServerTs: Date.now(),
      msgtype: "m.text",
    };

    it("abre menu de contexto na mensagem e permite copiar texto", async () => {
      render(
        <MessageBubble
          event={mockEvent}
          showHeader={true}
          myUserId="@lucas:echo.litteris.online"
        />
      );

      const messageArticle = screen.getByText("Olá, esta é uma mensagem de teste!").closest("article");
      expect(messageArticle).not.toBeNull();

      fireEvent.contextMenu(messageArticle!);

      await waitFor(() => {
        expect(screen.getByText("Copiar Texto")).toBeDefined();
        expect(screen.getByText("Fixar Mensagem")).toBeDefined();
        expect(screen.getByText("Mencionar Autor")).toBeDefined();
        expect(screen.getByText("Copiar ID da Mensagem")).toBeDefined();
      });

      // Clica em 'Copiar Texto'
      fireEvent.click(screen.getByText("Copiar Texto"));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Olá, esta é uma mensagem de teste!");
    });

    it("permite copiar ID da mensagem pelo menu de contexto", async () => {
      render(
        <MessageBubble
          event={mockEvent}
          showHeader={true}
          myUserId="@lucas:echo.litteris.online"
        />
      );

      const messageArticle = screen.getByText("Olá, esta é uma mensagem de teste!").closest("article");
      expect(messageArticle).not.toBeNull();

      fireEvent.contextMenu(messageArticle!);

      await waitFor(() => {
        expect(screen.getByText("Copiar ID da Mensagem")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Copiar ID da Mensagem"));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("$event123");
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  hasChannelPermission,
  getOverrideState,
  setOverrideState,
  createDefaultChannelPermissions,
  ChannelPermissionsConfig,
} from "@/lib/permissions/channelPermissions";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import ChannelSettingsModal from "@/features/guild/ChannelSettingsModal";
import Composer from "@/features/chat/Composer";
import ChannelSidebar from "@/features/shell/ChannelSidebar";

describe("Sistema Completo de Permissões de Canais (Texto e Áudio)", () => {
  beforeEach(() => {
    useSyncStore.getState().reset();
    useUiStore.setState({
      activeGuildId: "guild-1",
      activeChannelId: "channel-1",
      myUserId: "@nina:echo.litteris.online",
    });
  });

  describe("1. Algoritmo Hierárquico de Resolução (hasChannelPermission)", () => {
    it("Dono do servidor (Guild Owner) possui 100% de acesso irrestrito a qualquer permissão", () => {
      const allowed = hasChannelPermission("MANAGE_CHANNELS", {
        userId: "@owner:echo.litteris.online",
        isGuildOwner: true,
        userRoleIds: [],
        channelType: "text",
      });
      expect(allowed).toBe(true);
    });

    it("Membro com cargo contendo MANAGE_GUILD possui acesso total mesmo em canal privado", () => {
      const config: ChannelPermissionsConfig = {
        channelId: "c-private",
        isPrivate: true,
        overrides: [
          {
            id: "@everyone",
            type: "role",
            name: "@everyone",
            allow: [],
            deny: ["VIEW_CHANNEL"],
          },
        ],
      };

      const allowed = hasChannelPermission("VIEW_CHANNEL", {
        userId: "@admin:echo.litteris.online",
        isGuildOwner: false,
        userRoleIds: ["role-admin"],
        guildRoles: [
          {
            id: "role-admin",
            guildId: "guild-1",
            name: "Admin",
            color: "#ff0000",
            position: 1,
            isHoisted: true,
            permissions: ["MANAGE_GUILD"],
          },
        ],
        channelConfig: config,
        channelType: "text",
      });
      expect(allowed).toBe(true);
    });

    it("Canal Privado: nega VIEW_CHANNEL para @everyone a menos que role ou membro possua allow", () => {
      const config: ChannelPermissionsConfig = {
        channelId: "c-secret",
        isPrivate: true,
        overrides: [
          {
            id: "@everyone",
            type: "role",
            name: "@everyone",
            allow: [],
            deny: ["VIEW_CHANNEL"],
          },
          {
            id: "role-vip",
            type: "role",
            name: "VIP",
            allow: ["VIEW_CHANNEL"],
            deny: [],
          },
        ],
      };

      // Usuário comum sem o cargo VIP
      const commonUserAllowed = hasChannelPermission("VIEW_CHANNEL", {
        userId: "@common:echo.litteris.online",
        isGuildOwner: false,
        userRoleIds: [],
        channelConfig: config,
        channelType: "text",
      });
      expect(commonUserAllowed).toBe(false);

      // Usuário com o cargo VIP
      const vipUserAllowed = hasChannelPermission("VIEW_CHANNEL", {
        userId: "@vip:echo.litteris.online",
        isGuildOwner: false,
        userRoleIds: ["role-vip"],
        channelConfig: config,
        channelType: "text",
      });
      expect(vipUserAllowed).toBe(true);
    });

    it("Sobrescrita de Membro Individual (Member Override) tem prioridade sobre sobrescrita de Cargo", () => {
      const config: ChannelPermissionsConfig = {
        channelId: "c-text",
        overrides: [
          {
            id: "role-vip",
            type: "role",
            name: "VIP",
            allow: ["SEND_MESSAGES"],
            deny: [],
          },
          {
            id: "@silenced:echo.litteris.online",
            type: "member",
            name: "Silenciado",
            allow: [],
            deny: ["SEND_MESSAGES"], // sobrescrita específica negando envio
          },
        ],
      };

      const allowed = hasChannelPermission("SEND_MESSAGES", {
        userId: "@silenced:echo.litteris.online",
        isGuildOwner: false,
        userRoleIds: ["role-vip"], // possui cargo VIP que permite, mas o override individual nega
        channelConfig: config,
        channelType: "text",
      });
      expect(allowed).toBe(false);
    });

    it("Permissões de Áudio: respeita CONNECT_VOICE e SPEAK em canais de voz", () => {
      const config: ChannelPermissionsConfig = {
        channelId: "c-voice",
        overrides: [
          {
            id: "@everyone",
            type: "role",
            name: "@everyone",
            allow: ["CONNECT_VOICE"],
            deny: ["SPEAK"], // modo ouvinte para everyone
          },
        ],
      };

      const canConnect = hasChannelPermission("CONNECT_VOICE", {
        userId: "@member:echo.litteris.online",
        userRoleIds: [],
        channelConfig: config,
        channelType: "voice",
      });
      const canSpeak = hasChannelPermission("SPEAK", {
        userId: "@member:echo.litteris.online",
        userRoleIds: [],
        channelConfig: config,
        channelType: "voice",
      });

      expect(canConnect).toBe(true);
      expect(canSpeak).toBe(false);
    });

    it("getOverrideState e setOverrideState manipulam o estado de 3 vias corretamente", () => {
      const initial = createDefaultChannelPermissions("c-test").overrides[0];
      expect(getOverrideState(initial, "SEND_MESSAGES")).toBe("allow");

      const denied = setOverrideState(initial, "SEND_MESSAGES", "deny");
      expect(getOverrideState(denied, "SEND_MESSAGES")).toBe("deny");

      const inherited = setOverrideState(denied, "SEND_MESSAGES", "inherit");
      expect(getOverrideState(inherited, "SEND_MESSAGES")).toBe("inherit");
    });
  });

  describe("2. Modal de Configurações de Canal (ChannelSettingsModal)", () => {
    it("renderiza o modal com abas de Visão Geral e Permissões", () => {
      render(
        <ChannelSettingsModal
          open={true}
          onClose={vi.fn()}
          channel={{
            channelId: "c-geral",
            name: "geral",
            type: "text",
            topic: "Canal de boas-vindas",
          }}
          guildId="guild-1"
        />,
      );

      expect(screen.getByText("Configurações do Canal:")).toBeTruthy();
      expect(screen.getByText("#geral")).toBeTruthy();
      expect(screen.getByText("Visão Geral")).toBeTruthy();
      expect(screen.getByText("Permissões (Cargos e Membros)")).toBeTruthy();
    });

    it("permite alternar para a aba de Permissões e visualizar o cargo @everyone", () => {
      render(
        <ChannelSettingsModal
          open={true}
          onClose={vi.fn()}
          channel={{
            channelId: "c-geral",
            name: "geral",
            type: "text",
          }}
          guildId="guild-1"
        />,
      );

      const permTab = screen.getByText("Permissões (Cargos e Membros)");
      fireEvent.click(permTab);

      // Deve listar @everyone na coluna lateral de sobrescritas
      expect(screen.getAllByText("@everyone").length).toBeGreaterThan(0);
      expect(screen.getByText("Enviar Mensagens")).toBeTruthy();
      expect(screen.getByText("Anexar Arquivos & Mídias")).toBeTruthy();
    });

    it("permite salvar alterações de nome e permissões atualizando o syncStore", async () => {
      const handleSave = vi.fn();
      const onClose = vi.fn();

      render(
        <ChannelSettingsModal
          open={true}
          onClose={onClose}
          channel={{
            channelId: "c-geral",
            name: "geral",
            type: "text",
          }}
          guildId="guild-1"
          onSave={handleSave}
        />,
      );

      // Altera o nome do canal
      const nameInput = screen.getByPlaceholderText("nome-do-canal");
      fireEvent.change(nameInput, { target: { value: "anuncios" } });

      // Salva alterações
      const saveBtn = screen.getByText("Salvar Alterações");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith({
          name: "anuncios",
          topic: null,
        });
        expect(onClose).toHaveBeenCalled();
      });

      // Confirma que a configuração de canal foi registrada no syncStore
      const savedConfig = useSyncStore.getState().channelPermissions["c-geral"];
      expect(savedConfig).toBeDefined();
      expect(savedConfig.channelId).toBe("c-geral");
    });
  });

  describe("3. Aplicação das Permissões na Interface (Composer e Sidebar)", () => {
    it("desabilita Composer e mostra aviso quando SEND_MESSAGES é negado", () => {
      render(
        <Composer
          roomId="c-readonly"
          channelName="anuncios-oficiais"
          sendMessage={vi.fn()}
          canSendMessages={false}
          canAttachFiles={false}
        />,
      );

      // Placeholder deve indicar falta de permissão
      const textarea = screen.getByPlaceholderText("🔒 Você não tem permissão para enviar mensagens neste canal.");
      expect((textarea as HTMLTextAreaElement).disabled).toBe(true);

      // Botão enviar deve estar desabilitado
      const sendButton = screen.getByRole("button", { name: "Enviar" });
      expect((sendButton as HTMLButtonElement).disabled).toBe(true);

      // Botão de anexo deve estar desabilitado
      const attachButton = screen.getByRole("button", { name: "Anexar arquivo" });
      expect((attachButton as HTMLButtonElement).disabled).toBe(true);
    });

    it("exibe ícone de cadeado na Sidebar para canais privados", () => {
      useSyncStore.getState().setGuilds([
        {
          guildId: "guild-1",
          name: "Comunidade Echo",
          avatarUrl: null,
          bannerUrl: null,
          unreadCount: 0,
        },
      ]);

      useSyncStore.getState().setChannels("guild-1", [
        {
          channelId: "c-public",
          name: "geral",
          type: "text",
          unreadCount: 0,
        },
        {
          channelId: "c-private",
          name: "staff-secreta",
          type: "text",
          unreadCount: 0,
        },
      ]);

      // Configura c-private como privado no syncStore
      useSyncStore.getState().setChannelPermissions("c-private", {
        channelId: "c-private",
        isPrivate: true,
        overrides: [
          {
            id: "@everyone",
            type: "role",
            name: "@everyone",
            allow: [],
            deny: ["VIEW_CHANNEL"],
          },
          {
            id: "@nina:echo.litteris.online",
            type: "member",
            name: "Nina",
            allow: ["VIEW_CHANNEL"],
            deny: [],
          },
        ],
      });

      render(<ChannelSidebar />);

      expect(screen.getByText("geral")).toBeTruthy();
      expect(screen.getByText("staff-secreta")).toBeTruthy();

      // Elemento com título "Canal Privado" deve estar presente na tela
      expect(screen.getByTitle("Canal Privado")).toBeTruthy();
    });
  });
});

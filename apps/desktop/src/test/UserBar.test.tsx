import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UserBar from "@/features/shell/UserBar";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";

describe("UserBar Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ myUserId: "@lucas:echo.litteris.online" });
    useProfileStore.setState({
      nickname: "Lucas",
      displayName: "Lucas Cilento",
      avatarUrl: null,
      appwriteAvatarUrl: null,
      presence: "online",
    });
    useSettingsStore.setState({
      microphoneEnabled: true,
      headphonesEnabled: true,
    });
  });

  it("renderiza o nome do usuário e o identificador @user", () => {
    render(<UserBar />);
    expect(screen.getByText("Lucas")).toBeTruthy();
    expect(screen.getByText("@lucas")).toBeTruthy();
  });

  it("chama onOpenProfile ao clicar no bloco de perfil", async () => {
    const onOpenProfile = vi.fn();
    render(<UserBar onOpenProfile={onOpenProfile} />);
    const profileBtn = screen.getByTitle("Abrir perfil");
    await userEvent.click(profileBtn);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it("chama onOpenSettings ao clicar no botão de configurações", async () => {
    const onOpenSettings = vi.fn();
    render(<UserBar onOpenSettings={onOpenSettings} />);
    const settingsBtn = screen.getByRole("button", { name: "Configurações" });
    await userEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("alterna o microfone ao clicar no botão de áudio", async () => {
    render(<UserBar />);
    const micBtn = screen.getByRole("button", { name: "Silenciar microfone" });
    await userEvent.click(micBtn);
    expect(useSettingsStore.getState().microphoneEnabled).toBe(false);

    const unmuteBtn = screen.getByRole("button", { name: "Ativar microfone" });
    await userEvent.click(unmuteBtn);
    expect(useSettingsStore.getState().microphoneEnabled).toBe(true);
  });

  it("alterna os fones ao clicar no botão de áudio/deafen", async () => {
    render(<UserBar />);
    const foneBtn = screen.getByRole("button", { name: "Desativar áudio" });
    await userEvent.click(foneBtn);
    expect(useSettingsStore.getState().headphonesEnabled).toBe(false);

    const unfoneBtn = screen.getByRole("button", { name: "Ativar áudio" });
    await userEvent.click(unfoneBtn);
    expect(useSettingsStore.getState().headphonesEnabled).toBe(true);
  });
});


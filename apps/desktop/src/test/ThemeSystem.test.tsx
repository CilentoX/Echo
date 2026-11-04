import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useThemeStore, THEME_PRESETS, type ThemeId } from "@/stores/themeStore";
import { AppearanceTab } from "@/features/profile/tabs/AppearanceTab";

describe("Theme System & AppearanceTab", () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.getState().setTheme("echo");
    useThemeStore.getState().setMode("dark");
  });

  describe("themeStore", () => {
    it("inicializa com o tema Verde Echo no modo escuro por padrão", () => {
      const state = useThemeStore.getState();
      expect(state.themeId).toBe("echo");
      expect(state.mode).toBe("dark");

      expect(document.documentElement.getAttribute("data-theme")).toBe("echo");
      expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.style.getPropertyValue("--acc")).toBe(THEME_PRESETS.echo.modes.dark.acc);
    });

    it("permite alternar entre todos os temas predefinidos (echo, sakura, sunset, ocean)", () => {
      const themes: ThemeId[] = ["sakura", "sunset", "ocean", "echo"];

      for (const id of themes) {
        useThemeStore.getState().setTheme(id);
        const state = useThemeStore.getState();
        expect(state.themeId).toBe(id);
        expect(localStorage.getItem("echo:themeId")).toBe(id);
        expect(document.documentElement.getAttribute("data-theme")).toBe(id);

        const expectedTokens = THEME_PRESETS[id].modes[state.mode];
        expect(document.documentElement.style.getPropertyValue("--acc")).toBe(expectedTokens.acc);
        expect(document.documentElement.style.getPropertyValue("--card-bg")).toBe(expectedTokens.cardBg);
        expect(document.documentElement.style.getPropertyValue("--rail")).toBe(expectedTokens.rail);
        expect(document.documentElement.style.getPropertyValue("--surf")).toBe(expectedTokens.surf);
      }
    });

    it("permite alternar entre modo Claro e Escuro e atualiza as variáveis CSS", () => {
      useThemeStore.getState().setTheme("sakura");
      useThemeStore.getState().setMode("light");

      expect(useThemeStore.getState().mode).toBe("light");
      expect(localStorage.getItem("echo:themeMode")).toBe("light");
      expect(document.documentElement.getAttribute("data-mode")).toBe("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(false);

      const lightTokens = THEME_PRESETS.sakura.modes.light;
      expect(document.documentElement.style.getPropertyValue("--bg")).toBe(lightTokens.bg);
      expect(document.documentElement.style.getPropertyValue("--card-bg")).toBe(lightTokens.cardBg);
      expect(document.documentElement.style.getPropertyValue("--acc")).toBe(lightTokens.acc);

      // Toggle volta para escuro
      useThemeStore.getState().toggleMode();
      expect(useThemeStore.getState().mode).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  describe("AppearanceTab Component", () => {
    it("renderiza todos os 4 temas predefinidos com nomes e badges", () => {
      render(<AppearanceTab />);

      expect(screen.getByText("Verde Echo")).toBeTruthy();
      expect(screen.getByText("Sakura Japonês")).toBeTruthy();
      expect(screen.getByText("Cyber Sunset")).toBeTruthy();
      expect(screen.getByText("Ocean Deep")).toBeTruthy();

      expect(screen.getByText("Original")).toBeTruthy();
      expect(screen.getByText("Floral")).toBeTruthy();
      expect(screen.getByText("Solar")).toBeTruthy();
      expect(screen.getByText("Oceânico")).toBeTruthy();
    });

    it("permite mudar para o tema Sakura Japonês ao clicar no card", () => {
      render(<AppearanceTab />);

      const sakuraCard = screen.getByText("Sakura Japonês").closest("div[class*='cursor-pointer']");
      expect(sakuraCard).toBeTruthy();
      fireEvent.click(sakuraCard!);

      expect(useThemeStore.getState().themeId).toBe("sakura");
      expect(document.documentElement.getAttribute("data-theme")).toBe("sakura");
    });

    it("permite alternar entre Modo Escuro e Claro através dos botões", () => {
      render(<AppearanceTab />);

      const lightBtn = screen.getByRole("button", { name: /Claro/i });
      fireEvent.click(lightBtn);

      expect(useThemeStore.getState().mode).toBe("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);

      const darkBtn = screen.getByRole("button", { name: /Escuro/i });
      fireEvent.click(darkBtn);

      expect(useThemeStore.getState().mode).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });
});

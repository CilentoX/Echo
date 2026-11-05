import { create } from "zustand";
import { desktopConfig } from "@/lib/storage/desktopConfig";

export type ThemeId = "echo" | "sakura" | "sunset" | "ocean";
export type ThemeMode = "dark" | "light";
export type InterfaceDensity = "compact" | "comfortable";

export interface ThemeTokens {
  bg: string;
  rail: string;
  surf: string;
  surf2: string;
  cardBg: string;
  userbarBg: string;
  bd: string;
  bdSubtle: string;
  bdGlass: string;
  txt: string;
  mut: string;
  acc: string;
  accPress: string;
  accGlow: string;
  accMuted: string;
  bubbleSender: string;
  bubbleReceiver: string;
}

export interface ThemePreset {
  id: ThemeId;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  previewAccent: string;
  modes: {
    dark: ThemeTokens;
    light: ThemeTokens;
  };
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  echo: {
    id: "echo",
    name: "Verde Echo",
    tagline: "O clássico cyberpunk e minimalista",
    badge: "Original",
    description: "Paleta esmeralda e ardósia profunda que define a identidade visual icônica do Echo.",
    previewAccent: "#0FB9A8",
    modes: {
      dark: {
        bg: "#0D1017",
        rail: "#12151C",
        surf: "#171B24",
        surf2: "#1D222D",
        cardBg: "#121622",
        userbarBg: "#0e121a",
        bd: "#2A3546",
        bdSubtle: "rgba(255, 255, 255, 0.06)",
        bdGlass: "rgba(255, 255, 255, 0.1)",
        txt: "#E9EDF2",
        mut: "#97A2B0",
        acc: "#0FB9A8",
        accPress: "#0D9E8A",
        accGlow: "rgba(15, 185, 168, 0.2)",
        accMuted: "rgba(15, 185, 168, 0.12)",
        bubbleSender: "#1D222D",
        bubbleReceiver: "#171B24",
      },
      light: {
        bg: "#f8fafc",
        rail: "#edf2f7",
        surf: "#f1f5f9",
        surf2: "#e2e8f0",
        cardBg: "#ffffff",
        userbarBg: "#eef2f6",
        bd: "#cbd5e1",
        bdSubtle: "rgba(15, 23, 42, 0.08)",
        bdGlass: "rgba(15, 23, 42, 0.12)",
        txt: "#0f172a",
        mut: "#64748b",
        acc: "#0d9488",
        accPress: "#0f766e",
        accGlow: "rgba(13, 148, 136, 0.2)",
        accMuted: "rgba(13, 148, 136, 0.12)",
        bubbleSender: "#ccfbf1",
        bubbleReceiver: "#ffffff",
      },
    },
  },

  sakura: {
    id: "sakura",
    name: "Sakura Japonês",
    tagline: "Flores de cerejeira & Noites de Kyoto",
    badge: "Floral",
    description: "Inspirado no haru (primavera japonesa) e yozakura (cerejeiras sob o luar), com suaves tons de pétala e ameixa.",
    previewAccent: "#f472b6",
    modes: {
      dark: {
        bg: "#120e18",
        rail: "#0c0812",
        surf: "#181220",
        surf2: "#21182c",
        cardBg: "#1d1527",
        userbarBg: "#0e0a14",
        bd: "#312140",
        bdSubtle: "rgba(244, 114, 182, 0.08)",
        bdGlass: "rgba(244, 114, 182, 0.12)",
        txt: "#fdf2f8",
        mut: "#a8889d",
        acc: "#f472b6",
        accPress: "#e8569c",
        accGlow: "rgba(244, 114, 182, 0.35)",
        accMuted: "rgba(244, 114, 182, 0.15)",
        bubbleSender: "#351b2c",
        bubbleReceiver: "#1f1628",
      },
      light: {
        bg: "#fffbfe",
        rail: "#f7e8f0",
        surf: "#fcf2f7",
        surf2: "#f5deec",
        cardBg: "#ffffff",
        userbarBg: "#f8e9f2",
        bd: "#edd0e0",
        bdSubtle: "rgba(190, 24, 93, 0.08)",
        bdGlass: "rgba(190, 24, 93, 0.14)",
        txt: "#1e0a16",
        mut: "#7c586e",
        acc: "#be185d",
        accPress: "#9d174d",
        accGlow: "rgba(190, 24, 93, 0.2)",
        accMuted: "rgba(190, 24, 93, 0.12)",
        bubbleSender: "#fce7f3",
        bubbleReceiver: "#ffffff",
      },
    },
  },

  sunset: {
    id: "sunset",
    name: "Cyber Sunset",
    tagline: "Calor crepuscular & Laranja neon",
    badge: "Solar",
    description: "Tons incandescentes de âmbar, horizonte dourado e superfícies vulcânicas escuras.",
    previewAccent: "#f97316",
    modes: {
      dark: {
        bg: "#120d09",
        rail: "#0a0705",
        surf: "#17110c",
        surf2: "#221811",
        cardBg: "#1d140e",
        userbarBg: "#0c0806",
        bd: "#332115",
        bdSubtle: "rgba(249, 115, 22, 0.08)",
        bdGlass: "rgba(249, 115, 22, 0.12)",
        txt: "#fff7ed",
        mut: "#a38c7b",
        acc: "#f97316",
        accPress: "#ea580c",
        accGlow: "rgba(249, 115, 22, 0.35)",
        accMuted: "rgba(249, 115, 22, 0.15)",
        bubbleSender: "#361c0d",
        bubbleReceiver: "#1f140e",
      },
      light: {
        bg: "#fffdfa",
        rail: "#f7ede4",
        surf: "#fbf5ee",
        surf2: "#f4e6d8",
        cardBg: "#ffffff",
        userbarBg: "#f8efe6",
        bd: "#ebdcd0",
        bdSubtle: "rgba(194, 65, 12, 0.08)",
        bdGlass: "rgba(194, 65, 12, 0.14)",
        txt: "#1c0e05",
        mut: "#7d5e4b",
        acc: "#c2410c",
        accPress: "#9a3412",
        accGlow: "rgba(194, 65, 12, 0.2)",
        accMuted: "rgba(194, 65, 12, 0.12)",
        bubbleSender: "#ffedd5",
        bubbleReceiver: "#ffffff",
      },
    },
  },

  ocean: {
    id: "ocean",
    name: "Ocean Deep",
    tagline: "Profundidade marítima & Azul elétrico",
    badge: "Oceânico",
    description: "Azul cobalto e safira trazendo clareza, calma e tecnologia de alta performance.",
    previewAccent: "#38bdf8",
    modes: {
      dark: {
        bg: "#080d16",
        rail: "#04070c",
        surf: "#0c1320",
        surf2: "#121d30",
        cardBg: "#10182b",
        userbarBg: "#060a12",
        bd: "#1a2942",
        bdSubtle: "rgba(56, 189, 248, 0.08)",
        bdGlass: "rgba(56, 189, 248, 0.12)",
        txt: "#f0f9ff",
        mut: "#7f97b0",
        acc: "#38bdf8",
        accPress: "#0284c7",
        accGlow: "rgba(56, 189, 248, 0.35)",
        accMuted: "rgba(56, 189, 248, 0.15)",
        bubbleSender: "#102644",
        bubbleReceiver: "#101827",
      },
      light: {
        bg: "#f8fafc",
        rail: "#e6f0fa",
        surf: "#f0f6fc",
        surf2: "#deecf8",
        cardBg: "#ffffff",
        userbarBg: "#e7f1fb",
        bd: "#cbdde9",
        bdSubtle: "rgba(3, 105, 161, 0.08)",
        bdGlass: "rgba(3, 105, 161, 0.14)",
        txt: "#091726",
        mut: "#506880",
        acc: "#0284c7",
        accPress: "#0369a1",
        accGlow: "rgba(2, 132, 199, 0.2)",
        accMuted: "rgba(2, 132, 199, 0.12)",
        bubbleSender: "#e0f2fe",
        bubbleReceiver: "#ffffff",
      },
    },
  },
};

export function applyThemeTokens(tokens: ThemeTokens, mode: ThemeMode, themeId: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.style.setProperty("--bg", tokens.bg);
  root.style.setProperty("--rail", tokens.rail);
  root.style.setProperty("--surf", tokens.surf);
  root.style.setProperty("--surf2", tokens.surf2);
  root.style.setProperty("--card-bg", tokens.cardBg);
  root.style.setProperty("--userbar-bg", tokens.userbarBg);
  root.style.setProperty("--bd", tokens.bd);
  root.style.setProperty("--bd-subtle", tokens.bdSubtle);
  root.style.setProperty("--bd-glass", tokens.bdGlass);
  root.style.setProperty("--txt", tokens.txt);
  root.style.setProperty("--mut", tokens.mut);
  root.style.setProperty("--acc", tokens.acc);
  root.style.setProperty("--acc-press", tokens.accPress);
  root.style.setProperty("--acc-glow", tokens.accGlow);
  root.style.setProperty("--acc-muted", tokens.accMuted);
  root.style.setProperty("--bubble-sender", tokens.bubbleSender);
  root.style.setProperty("--bubble-receiver", tokens.bubbleReceiver);

  root.setAttribute("data-theme", themeId);
  root.setAttribute("data-mode", mode);

  root.style.backgroundColor = tokens.bg;
  root.style.color = tokens.txt;
  if (typeof document !== "undefined" && document.body) {
    document.body.style.backgroundColor = tokens.bg;
    document.body.style.color = tokens.txt;
    const rootEl = document.getElementById("root");
    if (rootEl) {
      rootEl.style.backgroundColor = tokens.bg;
    }
  }

  if (mode === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

export interface ThemeState {
  themeId: ThemeId;
  mode: ThemeMode;
  density: InterfaceDensity;
  setTheme: (id: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
  setDensity: (density: InterfaceDensity) => void;
  toggleMode: () => void;
  getCurrentTokens: () => ThemeTokens;
}

const getInitialTheme = (): ThemeId => {
  const fromConfig = desktopConfig.get("theme")?.themeId;
  if (fromConfig && THEME_PRESETS[fromConfig]) return fromConfig;
  if (typeof window === "undefined") return "echo";
  const saved = localStorage.getItem("echo:themeId") as ThemeId;
  if (saved && THEME_PRESETS[saved]) return saved;
  return "echo";
};

const getInitialMode = (): ThemeMode => {
  const fromConfig = desktopConfig.get("theme")?.mode;
  if (fromConfig === "light" || fromConfig === "dark") return fromConfig;
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem("echo:themeMode") as ThemeMode;
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
};

const getInitialDensity = (): InterfaceDensity => {
  const fromConfig = desktopConfig.get("theme")?.density;
  if (fromConfig === "compact" || fromConfig === "comfortable") return fromConfig;
  if (typeof window === "undefined") return "comfortable";
  const saved = localStorage.getItem("echo:density");
  if (saved === "Compacta" || saved === "compact") return "compact";
  return "comfortable";
};

export const useThemeStore = create<ThemeState>()((set, get) => {
  const initialTheme = getInitialTheme();
  const initialMode = getInitialMode();
  const initialDensity = getInitialDensity();

  // Aplica imediatamente as variáveis de tema
  const initialTokens = THEME_PRESETS[initialTheme].modes[initialMode];
  applyThemeTokens(initialTokens, initialMode, initialTheme);

  return {
    themeId: initialTheme,
    mode: initialMode,
    density: initialDensity,

    setDensity: (density: InterfaceDensity) => {
      try {
        desktopConfig.setTheme({ density });
        localStorage.setItem("echo:density", density === "compact" ? "Compacta" : "Confortável");
      } catch {}
      set({ density });
    },

    setTheme: (id: ThemeId) => {
      const mode = get().mode;
      const tokens = THEME_PRESETS[id].modes[mode];
      applyThemeTokens(tokens, mode, id);
      try {
        desktopConfig.setTheme({ themeId: id });
        localStorage.setItem("echo:themeId", id);
      } catch {}
      set({ themeId: id });
    },

    setMode: (mode: ThemeMode) => {
      const id = get().themeId;
      const tokens = THEME_PRESETS[id].modes[mode];
      applyThemeTokens(tokens, mode, id);
      try {
        desktopConfig.setTheme({ mode });
        localStorage.setItem("echo:themeMode", mode);
      } catch {}
      set({ mode });
    },

    toggleMode: () => {
      const nextMode: ThemeMode = get().mode === "dark" ? "light" : "dark";
      get().setMode(nextMode);
    },

    getCurrentTokens: () => {
      const { themeId, mode } = get();
      return THEME_PRESETS[themeId].modes[mode];
    },
  };
});

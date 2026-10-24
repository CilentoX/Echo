/**
 * Eco design tokens — camada semântica.
 *
 * Mapeia os tokens CSS definidos em `src/styles/tokens.css` para nomes de
 * uso fácil nos componentes. Única fonte de verdade para cores, espaçamento,
 * tipografia e estados de presença.
 *
 * Nunca use valores de cor hardcoded em componentes — sempre referência um
 * token deste arquivo (ou uma classe Tailwind gerada a partir dele).
 */

// ---------------------------------------------------------------------------
// Cores — camada semântica (referencia --color-* do CSS)
// ---------------------------------------------------------------------------

export const color = {
  // Superfícies
  bg: "bg",
  rail: "rail",
  surf: "surf",
  surf2: "surf2",
  elevated: "surf2",

  // Bordas e divisórias
  border: "bd",

  // Texto
  text: "txt",
  textMuted: "mut",

  // Acento principal (ações, links, ativos)
  accent: "acc",
  accentPress: "acc-press",

  // Estados de presença (Discord-like)
  online: "online",
  idle: "idle",
  dnd: "dnd",
  offline: "offline",

  // Semântico
  success: "online",
  error: "err",
  warning: "idle",
} as const;

export type ColorToken = keyof typeof color;

// ---------------------------------------------------------------------------
// Bolhas de mensagem (sender vs receiver)
// ---------------------------------------------------------------------------

export const bubble = {
  // Mensagens enviadas pelo usuário local (própria)
  sender: {
    bg: "surf2",
    text: "txt",
  },
  // Mensagens recebidas de outros usuários
  receiver: {
    bg: "surf",
    text: "txt",
  },
} as const;

// ---------------------------------------------------------------------------
// Espaçamento (escala)
// ---------------------------------------------------------------------------

export const space = {
  xs: "0.5rem",   // 8px
  sm: "0.75rem",  // 12px
  md: "1rem",     // 16px
  lg: "1.5rem",   // 24px
  xl: "2rem",     // 32px
  "2xl": "3rem",  // 48px
} as const;

// ---------------------------------------------------------------------------
// Tipografia
// ---------------------------------------------------------------------------

export const font = {
  display: "font-display", // Space Grotesk
  ui: "font-ui",           // Inter
} as const;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------

export const radius = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  full: "9999px",
} as const;

// ---------------------------------------------------------------------------
// Z-index (camadas)
// ---------------------------------------------------------------------------

export const zIndex = {
  dropdown: 100,
  modal: 200,
  tooltip: 300,
  toast: 400,
} as const;

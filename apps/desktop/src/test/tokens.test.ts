import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// Side-effect import: with `css.include` enabled in vite.config.ts, Vitest
// runs the Tailwind pipeline and injects the compiled stylesheet into jsdom.
import "../styles.css";

const read = (relative: string): string =>
  readFileSync(resolve(import.meta.dirname, relative), "utf8");

const tokensCss = read("../styles/tokens.css");
const mainTsx = read("../main.tsx");
const stylesCss = read("../styles.css");

/** Escape a literal string for embedding in a RegExp. */
const esc = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TOKENS: Record<string, string> = {
  "--bg": "#0D1017",
  "--rail": "#12151C",
  "--surf": "#171B24",
  "--surf2": "#1D222D",
  "--bd": "#2A3546",
  "--txt": "#E9EDF2",
  "--mut": "#97A2B0",
  "--acc": "#5865F2",
  "--acc-press": "#4752C4",
  "--online": "#34D399",
  "--idle": "#FAA81A",
  "--dnd": "#F04747",
  "--offline": "#747F8D",
  "--err": "#F87171",
  "--bubble-sender": "#1D222D",
  "--bubble-receiver": "#171B24",
};

const COLOR_MAPPINGS: Record<string, string> = {
  "--color-bg": "var(--bg)",
  "--color-rail": "var(--rail)",
  "--color-surf": "var(--surf)",
  "--color-surf2": "var(--surf2)",
  "--color-bd": "var(--bd)",
  "--color-txt": "var(--txt)",
  "--color-mut": "var(--mut)",
  "--color-acc": "var(--acc)",
  "--color-acc-press": "var(--acc-press)",
  "--color-online": "var(--online)",
  "--color-idle": "var(--idle)",
  "--color-dnd": "var(--dnd)",
  "--color-offline": "var(--offline)",
  "--color-err": "var(--err)",
  "--color-bubble-sender": "var(--bubble-sender)",
  "--color-bubble-receiver": "var(--bubble-receiver)",
};

const REQUIRED_UTILITIES = [
  ".bg-bg",
  ".bg-rail",
  ".bg-surf",
  ".bg-surf2",
  ".text-txt",
  ".text-mut",
  ".text-acc",
  ".text-online",
  ".text-err",
  ".border-bd",
  ".bg-acc",
  ".bg-acc-press",
  ".font-display",
  ".font-ui",
];

/** CSS that Vitest injected into the jsdom document. */
const injectedCss = (): string =>
  Array.from(document.head.querySelectorAll("style"))
    .map((tag) => tag.textContent ?? "")
    .join("\n");

describe("design tokens (tokens.css)", () => {
  it("defines the 11 tokens in :root with the exact hex values", () => {
    for (const [name, value] of Object.entries(TOKENS)) {
      expect(
        tokensCss.match(new RegExp(`${esc(name)}\\s*:\\s*${esc(value)}`)),
        `${name}: ${value}`,
      ).not.toBeNull();
    }
  });

  it("maps every token to a Tailwind @theme color variable", () => {
    for (const [name, value] of Object.entries(COLOR_MAPPINGS)) {
      expect(
        tokensCss.match(new RegExp(`${esc(name)}\\s*:\\s*${esc(value)}`)),
        `${name}: ${value}`,
      ).not.toBeNull();
    }
  });

  it("declares the @theme block with display and ui fonts", () => {
    expect(tokensCss).toContain("@theme");
    expect(tokensCss).toMatch(/--font-display\s*:\s*"Space Grotesk"/);
    expect(tokensCss).toMatch(/--font-ui\s*:\s*"Inter"/);
  });
});

describe("token wiring (main.tsx + styles.css)", () => {
  it("imports both fontsource packages in main.tsx", () => {
    expect(mainTsx).toContain('import "@fontsource/inter"');
    expect(mainTsx).toContain('import "@fontsource/space-grotesk"');
  });

  it("loads tokens.css from the global stylesheet entry", () => {
    expect(stylesCss).toMatch(/@import\s+["'].*tokens\.css["']/);
  });
});

describe("utility generation (compiled Tailwind output)", () => {
  it("generates every required semantic utility class", () => {
    const css = injectedCss();
    expect(css.length, "stylesheet should be injected into jsdom").toBeGreaterThan(0);

    for (const utility of REQUIRED_UTILITIES) {
      expect(css.includes(utility), `${utility} should be generated`).toBe(true);
    }
  });

  it("renders a probe element using the generated utilities", () => {
    const probe = document.createElement("div");
    probe.className = "bg-surf text-acc font-display";
    probe.textContent = "probe";
    document.body.appendChild(probe);

    try {
      expect(probe.className).toBe("bg-surf text-acc font-display");
      expect(document.querySelector(".bg-surf.text-acc.font-display")).toBe(probe);
    } finally {
      probe.remove();
    }
  });
});

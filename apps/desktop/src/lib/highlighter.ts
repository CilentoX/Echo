import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Importa gramáticas comuns para chat de desenvolvedores
import tsGrammar from "shiki/langs/typescript.mjs";
import jsGrammar from "shiki/langs/javascript.mjs";
import pyGrammar from "shiki/langs/python.mjs";
import rustGrammar from "shiki/langs/rust.mjs";
import jsonGrammar from "shiki/langs/json.mjs";
import htmlGrammar from "shiki/langs/html.mjs";
import cssGrammar from "shiki/langs/css.mjs";
import bashGrammar from "shiki/langs/bash.mjs";
import sqlGrammar from "shiki/langs/sql.mjs";
import markdownGrammar from "shiki/langs/markdown.mjs";

// Tema dark refinado consistente com o Echo
import vscDarkPlus from "shiki/themes/dark-plus.mjs";

let highlighterPromise: Promise<any> | null = null;
let highlighterInstance: any = null;

export async function getEchoHighlighter() {
  if (highlighterInstance) return highlighterInstance;
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [vscDarkPlus],
      langs: [
        tsGrammar,
        jsGrammar,
        pyGrammar,
        rustGrammar,
        jsonGrammar,
        htmlGrammar,
        cssGrammar,
        bashGrammar,
        sqlGrammar,
        markdownGrammar,
      ],
      engine: createJavaScriptRegexEngine(),
    }).then((hl) => {
      highlighterInstance = hl;
      return hl;
    });
  }
  return highlighterPromise;
}

const LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  json: "json",
  html: "html",
  css: "css",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  shell: "bash",
  sql: "sql",
  md: "markdown",
  markdown: "markdown",
};

/**
 * Realça código utilizando o Shiki e o tema Dark Plus / VS Code.
 * Retorna o HTML gerado ou fallback seguro se a linguagem não for suportada.
 */
export function highlightCode(code: string, lang = ""): string | null {
  if (!highlighterInstance) return null;
  const normalizedLang = LANG_MAP[lang.toLowerCase().trim()] || (highlighterInstance.getLoadedLanguages().includes(lang) ? lang : null);
  if (!normalizedLang) return null;

  try {
    return highlighterInstance.codeToHtml(code, {
      lang: normalizedLang,
      theme: "dark-plus",
    });
  } catch {
    return null;
  }
}

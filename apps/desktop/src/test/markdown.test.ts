import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("converte URLs cruas em links clicáveis sem resíduo de tokens", () => {
    const steamUrl = "https://store.steampowered.com/app/2073620/ArenaBreakoutInfinite/";
    const html = renderMarkdown(steamUrl);

    expect(html).not.toContain("URL_TOKEN");
    expect(html).not.toContain("URLTOKEN");
    expect(html).not.toContain("%%");
    expect(html).not.toContain("@@");
    expect(html).toContain(`<a href="${steamUrl}"`);
    expect(html).toContain(`>${steamUrl}</a>`);
  });

  it("converte URLs contendo múltiplos underscores sem corrupção por itálico", () => {
    const complexUrl = "https://example.com/api_v1_endpoint_test_run?token_id=123_abc";
    const html = renderMarkdown(complexUrl);

    expect(html).not.toContain("URLTOKEN");
    expect(html).not.toContain("<em>TOKEN");
    expect(html).toContain(`<a href="${complexUrl}"`);
  });

  it("preserva underscores dentro de blocos de código sem converter em itálico", () => {
    const code = "```\nconst user_id_var = 123;\nconst auth_token_secret = true;\n```";
    const html = renderMarkdown(code);

    expect(html).toContain("user_id_var");
    expect(html).toContain("auth_token_secret");
    expect(html).not.toContain("<em>id");
  });

  it("preserva underscores em código inline", () => {
    const inline = "Use a variável `my_custom_var_name` no código";
    const html = renderMarkdown(inline);

    expect(html).toContain("<code");
    expect(html).toContain("my_custom_var_name");
    expect(html).not.toContain("<em>custom");
  });

  it("formata negrito e itálico corretamente junto com URLs", () => {
    const text = "**Atenção**: veja este link _muito legal_ https://echo.litteris.online/docs e teste!";
    const html = renderMarkdown(text);

    expect(html).toContain("<strong class=\"font-bold\">Atenção</strong>");
    expect(html).toContain("<em>muito legal</em>");
    expect(html).toContain("<a href=\"https://echo.litteris.online/docs\"");
    expect(html).not.toContain("URLTOKEN");
  });
});


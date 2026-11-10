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

  it("não inclui pontuação final na URL clicável", () => {
    const text = "Acesse https://echo.litteris.online/docs. Depois me avise!";
    const html = renderMarkdown(text);

    expect(html).toContain('<a href="https://echo.litteris.online/docs"');
    expect(html).toContain(">https://echo.litteris.online/docs</a>.");
  });

  it("remove com segurança qualquer token residual ou corrompido", () => {
    const text = "Mensagem com resíduo %%URL_TOKEN0%% e %%URL<em>TOKEN</em>1%%";
    const html = renderMarkdown(text);

    expect(html).not.toContain("%%URL_TOKEN0%%");
    expect(html).not.toContain("TOKEN");
  });

  it("formata riscado (strikethrough) com a sintaxe ~~texto~~", () => {
    const text = "Este texto foi ~~cancelado~~ e substituído.";
    const html = renderMarkdown(text);

    expect(html).toContain('<del class="line-through opacity-75">cancelado</del>');
  });

  it("formata spoilers com a sintaxe ||segredo|| interativo", () => {
    const text = "O final do jogo é ||o herói sobrevive||!";
    const html = renderMarkdown(text);

    expect(html).toContain("text-transparent");
    expect(html).toContain("o herói sobrevive");
    expect(html).toContain("title=\"Spoiler: clique para revelar\"");
  });

  it("preserva riscado e spoilers combinados com negrito e links", () => {
    const text = "**Cuidado**: ~~não abra~~ veja este ||link secreto||: https://echo.litteris.online";
    const html = renderMarkdown(text);

    expect(html).toContain("<strong class=\"font-bold\">Cuidado</strong>");
    expect(html).toContain('<del class="line-through opacity-75">não abra</del>');
    expect(html).toContain("link secreto");
    expect(html).toContain('<a href="https://echo.litteris.online"');
  });

  it("renderiza menções de membros com pill interativo e data-mention-id", () => {
    const text = "Olá @[Lucas](@lucas:echo.litteris.online), bem-vindo!";
    const html = renderMarkdown(text);

    expect(html).toContain('class="mention-pill');
    expect(html).toContain('data-mention-id="@lucas:echo.litteris.online"');
    expect(html).toContain("@Lucas");
  });

  it("renderiza menções de cargos com badge colorido e data-role-id", () => {
    const text = "Atenção @[Moderadores](role:role-mod-1), nova denúncia.";
    const html = renderMarkdown(text);

    expect(html).toContain('class="mention-pill');
    expect(html).toContain('data-role-id="role-mod-1"');
    expect(html).toContain("@Moderadores");
  });

  it("renderiza menções especiais @everyone e @here", () => {
    const text = "Reunião agora @everyone e atenção @here!";
    const html = renderMarkdown(text);

    expect(html).toContain('class="mention-pill');
    expect(html).toContain("@everyone");
    expect(html).toContain("@here");
  });

  it("renderiza menções de canais com pill e data-channel-id", () => {
    const text = "Por favor converse em #[bate-papo](channel:chan-general-1) amigos.";
    const html = renderMarkdown(text);

    expect(html).toContain('class="channel-pill');
    expect(html).toContain('data-channel-id="chan-general-1"');
    expect(html).toContain("#bate-papo");
  });
});


/**
 * Markdown renderer simples para mensagens do chat.
 *
 * Suporta o subconjunto usado no Echo: negrito, itálico, código inline e
 * blocos, links, listas não ordenadas, citações e quebras de linha.
 * Não adiciona dependências externas — escapa HTML e converte somente o
 * essencial, evitando XSS.
 */

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

/**
 * Converte texto markdown simples em HTML seguro.
 * Elementos gerados usam classes Tailwind para estilo.
 */
export function renderMarkdown(text: string, customEmojis?: Record<string, string>): string {
  if (!text) return "";

  let html = escapeHtml(text);

  // Blocos de código (triple backticks) primeiro, protegidos com token seguro
  const codeBlocks: string[] = [];
  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre class="bg-surf2 border border-bd rounded-md p-2 text-sm font-mono overflow-x-auto"><code>${escapeHtml(
        code.trim(),
      )}</code></pre>`,
    );
    return `@@CODEBLOCK${idx}@@`;
  });

  // Código inline (backticks simples) protegido com token seguro
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(
      `<code class="bg-surf2 px-1 py-0.5 rounded text-sm font-mono">${escapeHtml(code)}</code>`,
    );
    return `@@INLINECODE${idx}@@`;
  });

  // Protege menções de membros, cargos e canais contra colisões com itálicos/negritos
  const mentionTokens: Array<{
    kind: "member" | "role" | "special" | "channel";
    name: string;
    id?: string;
  }> = [];

  // Menções ricas de membros ou cargos: @[Nome](userId) ou @[Cargo](role:roleId)
  html = html.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, (_match, name, idPart) => {
    const idx = mentionTokens.length;
    const isRole = idPart.startsWith("role:");
    const id = isRole ? idPart.slice(5) : idPart;
    mentionTokens.push({
      kind: isRole ? "role" : "member",
      name,
      id,
    });
    return `@@MENTIONTOKEN${idx}@@`;
  });

  // Menções de canais: #[Nome](channel:channelId) ou #[Nome](channelId)
  html = html.replace(/#\[([^\]]+)\]\(([^)]+)\)/g, (_match, name, idPart) => {
    const idx = mentionTokens.length;
    const id = idPart.startsWith("channel:") ? idPart.slice(8) : idPart;
    mentionTokens.push({
      kind: "channel",
      name,
      id,
    });
    return `@@MENTIONTOKEN${idx}@@`;
  });

  // Menções especiais de sistema: @everyone e @here
  html = html.replace(/(?:^|\s)@(everyone|here)(?=\s|$|[.,!?;:])/g, (match, special) => {
    const prefix = match.startsWith(" ") ? " " : "";
    const idx = mentionTokens.length;
    mentionTokens.push({
      kind: "special",
      name: special,
    });
    return `${prefix}@@MENTIONTOKEN${idx}@@`;
  });

  // Protege links markdown [texto](url) e URLs cruas de colisões com itálicos/negritos
  // O formato @@URLTOKEN...@@ NÃO contém underscores nem asteriscos, prevenindo corrupção por formatações
  const urlTokens: Array<{ type: "md" | "raw"; text?: string; url: string }> = [];

  html = html.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|spotify:|steam:\/\/)[^\s)]+)\)/g,
    (_match, textPart, url) => {
      const idx = urlTokens.length;
      urlTokens.push({ type: "md", text: textPart, url });
      return `@@URLTOKEN${idx}@@`;
    },
  );

  html = html.replace(
    /((?:https?:\/\/|spotify:|steam:\/\/)[^\s<)]+)/g,
    (_match, rawUrl) => {
      // Separa pontuação final comum (. , ! ? ; :) para não quebrar a URL
      let url = rawUrl;
      let trailing = "";
      const trailMatch = url.match(/[.,!?:;]+$/);
      if (trailMatch) {
        trailing = trailMatch[0];
        url = url.slice(0, -trailing.length);
      }
      const idx = urlTokens.length;
      urlTokens.push({ type: "raw", url });
      return `@@URLTOKEN${idx}@@${trailing}`;
    },
  );

  // Negrito: **texto** ou __texto__
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    (_match, inner) => `<strong class="font-bold">${inner}</strong>`,
  );
  html = html.replace(/__(.+?)__/g, (_match, inner) => `<strong class="font-bold">${inner}</strong>`);

  // Riscado: ~~texto~~
  html = html.replace(
    /~~(.+?)~~/g,
    (_match, inner) => `<del class="line-through opacity-75">${inner}</del>`,
  );

  // Spoilers: ||texto|| (revela no clique / hover com visual Dark Glass)
  html = html.replace(
    /\|\|(.+?)\|\|/g,
    (_match, inner) =>
      `<span class="rounded px-1.5 py-0.5 bg-surf3/90 text-transparent hover:text-txt hover:bg-surf3 cursor-pointer select-none transition-all duration-150" onclick="this.classList.toggle('text-transparent'); this.classList.toggle('select-none');" title="Spoiler: clique para revelar">${inner}</span>`,
  );

  // Itálico: *texto* ou _texto_ (não dentro de código já processado)
  html = html.replace(/\*(.+?)\*/g, (_match, inner) => `<em>${inner}</em>`);
  html = html.replace(/_(.+?)_/g, (_match, inner) => `<em>${inner}</em>`);

  // Restaura links protegidos
  html = html.replace(/@@URLTOKEN(\d+)@@/g, (_match, idxStr) => {
    const item = urlTokens[Number(idxStr)];
    if (!item) return "";
    const cleanUrl = item.url;
    if (item.type === "md" && item.text) {
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-acc underline underline-offset-4 hover:text-acc-press break-all">${item.text}</a>`;
    }
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-acc underline underline-offset-4 hover:text-acc-press break-all">${cleanUrl}</a>`;
  });

  // Restaura menções de membros, cargos, canais e menções especiais protegidas
  html = html.replace(/@@MENTIONTOKEN(\d+)@@/g, (_match, idxStr) => {
    const item = mentionTokens[Number(idxStr)];
    if (!item) return "";
    if (item.kind === "channel") {
      return `<span class="channel-pill inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.08] text-txt border border-white/[0.08] font-medium text-xs hover:text-acc hover:bg-white/[0.12] cursor-pointer transition-all select-none" data-channel-id="${escapeHtml(item.id || "")}">#${escapeHtml(item.name)}</span>`;
    }
    if (item.kind === "special") {
      return `<span class="mention-pill inline-flex items-center px-1.5 py-0.5 rounded-md bg-acc/20 text-acc border border-acc/30 font-bold text-xs hover:bg-acc/30 cursor-pointer transition-all select-none">@${escapeHtml(item.name)}</span>`;
    }
    if (item.kind === "role") {
      return `<span class="mention-pill inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-acc/15 text-acc border border-acc/20 font-medium text-xs hover:bg-acc/25 cursor-pointer transition-all select-none" data-role-id="${escapeHtml(item.id || "")}"><span class="w-1.5 h-1.5 rounded-full bg-acc"></span>@${escapeHtml(item.name)}</span>`;
    }
    return `<span class="mention-pill inline-flex items-center px-1.5 py-0.5 rounded-md bg-acc/15 text-acc border border-acc/20 font-medium text-xs hover:bg-acc/25 cursor-pointer transition-all select-none" data-mention-id="${escapeHtml(item.id || "")}">@${escapeHtml(item.name)}</span>`;
  });

  // Limpeza defensiva contra qualquer token residual de versões legadas ou corrupção
  html = html.replace(/%%URL(?:_TOKEN_?|<em>TOKEN<\/em>|&lt;em&gt;TOKEN&lt;\/em&gt;|TOKEN_?)(\d+)%%/gi, (_match, idxStr) => {
    const item = urlTokens[Number(idxStr)];
    return item ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="text-acc underline underline-offset-4 hover:text-acc-press break-all">${item.url}</a>` : "";
  });
  html = html.replace(/%%URL[\s_]*(?:TOKEN|<em>TOKEN<\/em>|&lt;em&gt;TOKEN&lt;\/em&gt;)?[\s_]*\d*%%/gi, "");
  html = html.replace(/@@URLTOKEN\d+@@/g, "");

  // Restaura código inline e blocos de código
  html = html.replace(/@@INLINECODE(\d+)@@/g, (_match, idxStr) => inlineCodes[Number(idxStr)] ?? "");
  html = html.replace(/@@CODEBLOCK(\d+)@@/g, (_match, idxStr) => codeBlocks[Number(idxStr)] ?? "");

  // Citações: > texto
  html = html.replace(
    /^&gt; (.+)$/gm,
    (match) =>
      `<blockquote class="border-l-2 border-bd pl-2 mut italic my-1">${match.slice(4)}</blockquote>`,
  );

  // Listas não ordenadas: - texto ou * texto (linha iniciada)
  html = html.replace(
    /^(?:-|\*) (.+)$/gm,
    (match) => `<li class="list-disc pl-4">${match.slice(2)}</li>`,
  );
  // Envolve blocos de li consecutivos em <ul>
  html = html.replace(/(?:<li.*<\/li>\s?)+/g, (block) => `<ul class="my-2">${block}</ul>`);

  // Emojis customizados (:shortcode:) processados após formatações para evitar que underscores virem itálico
  if (customEmojis) {
    html = html.replace(/:([a-zA-Z0-9_-]+):/g, (match, name) => {
      const url = customEmojis[name];
      if (url) {
        return `<img src="${escapeHtml(url)}" alt=":${name}:" title=":${name}:" class="inline-block h-5 w-5 object-contain align-middle mx-0.5" />`;
      }
      return match;
    });
  }

  // Quebras de linha simples
  html = html.replace(/\n/g, "<br>");

  return html;
}

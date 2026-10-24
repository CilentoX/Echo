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
export function renderMarkdown(text: string): string {
  if (!text) return "";

  let html = escapeHtml(text);

  // Blocos de código (triple backticks) primeiro, para proteger o conteúdo.
  html = html.replace(
    /```([\s\S]*?)```/g,
    (_match, code) =>
      `<pre class="bg-surf2 border border-bd rounded-md p-2 text-sm font-mono overflow-x-auto"><code>${escapeHtml(
        code.trim(),
      )}</code></pre>`,
  );

  // Código inline (backticks simples)
  html = html.replace(
    /`([^`]+)`/g,
    (_match, code) => `<code class="bg-surf2 px-1 py-0.5 rounded text-sm font-mono">${escapeHtml(code)}</code>`,
  );

  // Negrito: **texto** ou __texto__
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    (_match, inner) => `<strong class="font-bold">${inner}</strong>`,
  );
  html = html.replace(/__(.+?)__/g, (_match, inner) => `<strong class="font-bold">${inner}</strong>`);

  // Itálico: *texto* ou _texto_ (não dentro de código já processado)
  html = html.replace(/\*(.+?)\*/g, (_match, inner) => `<em>${inner}</em>`);
  html = html.replace(/_(.+?)_/g, (_match, inner) => `<em>${inner}</em>`);

  // Links: [texto](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, textPart, url) =>
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-acc underline underline-offset-4 hover:text-acc-press">${escapeHtml(
        textPart,
      )}</a>`,
  );

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

  // Quebras de linha simples
  html = html.replace(/\n/g, "<br>");

  return html;
}

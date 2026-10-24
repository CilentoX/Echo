# Plano de Implementação — Echo Desktop (faseado)

**Objetivo:** aproximar o Echo Desktop da experiência do Discord (sem voice), corrigindo o máximo de falhas de UI/UX e adicionando funcionalidades ausentes, sem reinventar — baseando-se em Element Web, Cinny, shadcn/ui chat components e TanStack Virtual.

**Estado inicial:** tsc 0 erros | vitest 166/166 passando | branch master | commit d718a12 (SSO corrigido).

---

## Fase A — Fundação UI (design tokens + markdown renderer + EmojiPicker)

### A1. Design tokens (Tailwind v4 + CSS vars)
Criar `src/lib/design-tokens.ts` com a camada primitiva → semântica → componente, inspirada no Discord:
- Cores: bg primário `#323339` (dark), surface `#2F3136`, elevated `#292B2F`, accent blurple `#5865F2`
- Estados de presença: online `#43B581`, idle `#FAA81A`, dnd `#F04747`, offline `#747F8D`
- Bubble: sender vs receiver cores distintas
- Escala de tipografia e espaçamento

### A2. Markdown renderer
Criar `src/lib/markdown.ts` (ou usar lib leve já existente) para renderizar:
- Negrito/itálico, código inline e blocos, listas, links, citações
- Aplicar em `MessageBubble.tsx` (substitui texto cru)

### A3. EmojiPicker
Criar `src/components/emoji/EmojiPicker.tsx` com:
- Seções de emojis, busca, skin tone picker, frecência (mais usados)
- Integração no Composer (botão ao lado do textarea) e em reações

### Validação Fase A
- `tsc --noEmit`: 0 erros
- `vitest`: 166/166 (não quebrar existentes)

---

## Fase B — Composer v2 (placeholder otimista + anexo + filas)

### B1. Placeholder otimista
Mensagens enviadas aparecem imediatamente no timeline com estado "enviando" (otimista), substituídas pela confirmação do servidor quando `m.room.message` é recebido.

### B2. Anexo de arquivo (hablitado)
Reativar envio de anexos via `matrixService.uploadMedia` + mensagem `m.file`, com preview e progresso.

### B3. Fila de envio aprimorada
Manter `queuedRef` mas adicionar retry com backoff, erro visível por mensagem e botão "tentar novamente" por falha individual.

### B4. Composer refinado
- Botão EmojiPicker ao lado do textarea
- Botão anexar arquivo
- Botões de formatação rápida (negrito, itálico, código)
- Auto-grow com limite de altura

### Validação Fase B
- tsc 0 erros | vitest 166/166 | testes novos para Composer v2

---

## Fase C — MessageBubble v2 (bubbles distintas + reações + reply + edited/deleted)

### C1. Sender vs Receiver bubbles
Cores distintas para mensagens próprias vs alheias (discord-like), avatar inicial do remetente, nome, timestamp.

### C2. Reações empilhadas na bubble
Reações `m.reaction` empilhadas abaixo da mensagem com contador, tooltip de quem reagiu, toggle add/remove.

### C3. Reply-to / threads básicos
Referência a mensagem respondida (quote), visualização da mensagem citada na bubble.

### C4. Estados edited / deleted
Sinal visual "editado" quando conteúdo muda, e "mensagem removida" para redações.

### Validação Fase C
- tsc 0 erros | vitest 166/166 | testes novos para MessageBubble v2

---

## Fase D — ChatPane v2 (virtualização + agrupar por data)

### D1. TanStack Virtual
Virtualizar a lista de mensagens (end-anchored) para performance em canais grandes.

### D2. Agrupamento por data
Separadores de data (ex: "Hoje", "Ontem", "15/10/2026") entre grupos de mensagens.

### D3. Scroll e load older
Scroll automático para o fim ao chegar novas mensagens, `loadOlder` ao topo com indicador de carregamento.

### Validação Fase D
- tsc 0 erros | vitest 166/166

---

## Fase E — Melhorias gerais de UI (busca global, temas, server folders, DMs)

### E1. Busca global (Ctrl+K)
Buscar mensagens/canais/servidores.

### E2. Temas light/dark
Alternância de tema persistente.

### E3. Server folders / CommunityRail refinado
Agrupar servidores em pastas, avatares reais dos servidores.

### E4. DMs
Lista de mensagens diretas no rail lateral.

### Validação Fase E
- tsc 0 erros | vitest 166/166

---

## Regras de execução (obrigatórias)

1. Sem novas dependências sem perguntar ao usuário (exceto `marked` ou similar para markdown se já estiver no lock).
2. Manter `tsc --noEmit` com 0 erros a cada fase.
3. Manter `vitest` 166/166 (ou adicionar testes novos e manter total verde).
4. Commits seguem Conventional Commits em inglês.
5. Não reformatar código não relacionado à tarefa.
6. Cada fase: implementar → validar → commitar → próxima fase.

---

## Métrica de sucesso

- 100% dos testes passando (vitest verde)
- tsc 0 erros
- UI com bubbles distintas, markdown renderizado, reações empilhadas, reply-to, placeholder otimista, anexos, EmojiPicker, virtualização e agrupamento por data
- Nenhuma regressão nas funcionalidades existentes (auth, onboarding, perfil, guildas, canais, settings)

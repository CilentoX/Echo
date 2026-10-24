# Fase C — MessageBubble v2 (Echo Desktop)

## Objetivo
Reescrever `MessageBubble.tsx` com bolhas distintas para remetente (sender) vs destinatário (receiver), reações empilhadas, chip de reply-to (citação), estados edited/deleted e renderer de markdown no corpo. Eliminar o máximo possível de falhas visuais e funcionais na tela de chat.

## Escopo

### 1. `src/lib/matrix/types.ts` — estender `NormalizedEvent`
Adicionar campos opcionais (não quebram código existente):
- `replyTo?: { eventId: string; sender: string; body: string }` — mensagem citada
- `editedAt?: number` — timestamp da última edição
- `redacted?: boolean` — mensagem excluída pelo server
- `senderAvatarUrl?: string | null` — avatar mxc:// do remetente

### 2. Novos componentes

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/features/chat/ReplyChip.tsx` | Chip acima da bolha: avatar inicial do autor da resposta + corpo truncado da mensagem citada |
| `src/features/chat/EditedBadge.tsx` | Selo pequeno "editado" abaixo da hora da mensagem |
| `src/features/chat/ReactionStack.tsx` | Reações empilhadas: avatares iniciais dos reatores + count, ou emoji + count quando não há avatar |
| `src/features/chat/MessageBody.tsx` | Corpo da mensagem com `renderMarkdown` (Fase A) via `dangerouslySetInnerHTML`, suporte a mensagem excluída |

### 3. `src/features/chat/MessageBubble.tsx` — reescrito v2

Layout:
- `<article>` com `flex` e `justify-end` (sender) / `justify-start` (receiver)
- Bolha com `max-w-[75%]` e `rounded-lg`
- Sender: `bg-bubble-sender`, texto `txt`, alinhado à direita, seta/ponta inferior direita
- Receiver: `bg-bubble-receiver`, texto `txt`, alinhado à esquerda, seta/ponta inferior esquerda
- Avatar inicial apenas quando `showHeader` (primeira do grupo)
- Nome + hora + EditedBadge apenas quando `showHeader`
- ReplyChip acima do corpo quando `event.replyTo` existe
- Corpo: `MessageBody` com markdown; se `redacted`, mostra "[mensagem excluída]" em `text-mut italic`
- Pending: opacidade reduzida + "Enviando…"
- Reações: `ReactionStack` abaixo do corpo
- Selos: BOT (teal) no header quando `isBot`

### 4. Testes

Criar `src/test/MessageBubble.test.tsx` com:
- Renderização básica (bolha receiver default)
- Bolha sender (alinhamento à direita, bg distinto)
- showHeader exibe avatar, nome, hora
- replyTo exibe chip de citação
- redacted exibe "[mensagem excluída]"
- editedAt exibe selo "editado"
- Reações empilhadas com count
- Pending mostra "Enviando…"
- isBot mostra selo BOT

### 5. Validação
- `tsc --noEmit`: 0 erros
- `vitest run`: todos passando (incluindo ChatPane.test.tsx existente sem regressões)

## Fora de escopo (Fase D+)
- Virtualização TanStack no ChatPane
- Agrupamento por data (separador de dia)
- Reações com toggle remove explícito (já parcialmente no ChatPane)
- Edição inline de mensagem própria

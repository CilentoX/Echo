# Design: Replicação de Features e UI do Discord no Echo Desktop

**Data:** 2026-10-24  
**Status:** Rascunho para aprovação  
**Projeto:** Echo Desktop (Tauri 2 + React 19 + Vite 8 + Tailwind v4 + matrix-js-sdk v44 + Zustand)  
**Objetivo:** Replicar o máximo possível da UI/UX e features do Discord no cliente Echo Desktop.

---

## 1. Por que e o que está em jogo

O usuário deseja que o Echo Desktop se pareça e se comporte o mais próximo possível do Discord, que é a referência de UX para clientes de chat comunitário. Isso inclui layout (4 colunas), componentes de mensagem, compositor, sidebar de canais, rail de comunidades, perfil, configurações, reações, threads, canais de voz, mensagens diretas, busca global, emoji picker, temas, etc.

O Echo é um cliente Matrix, então nem todo recurso do Discord faz sentido (ex.: voz em tempo real depende do servidor Matrix). O foco está no que é replicável sobre Matrix + Tauri.

---

## 2. Inventário do estado atual (já implementado)

### Shell / Layout
- `AppShell.tsx` — esqueleto de 4 colunas: rail (72px), sidebar (232px), chat (flex), member list (224px). Sobreposições abaixo de breakpoints.
- `CommunityRail.tsx` — rail esquerdo: servidores como avatar com iniciais, botão + criar, perfil, configurações. Nunca some.
- `ChannelSidebar.tsx` — coluna de canais: busca, canais de texto, criar canal, editar guilda, contador de não lidas. Tipo "voz" existe no código mas não é funcional.
- `MemberList.tsx` — lista de membros (Popover-based, reescrita recentemente).
- `MemberDropdownContent.tsx` — menu de contexto do membro (Popover).
- `EmptyState.tsx` — estado vazio.

### Chat / Mensagens
- `ChatPane.tsx` — timeline, agrupamento por autor/gap de 5min, scroll infinito (carrega mais ao topo), typing indicator, composer.
- `MessageBubble.tsx` — avatar inicial, nome, hora, corpo, chips de reação, chip de tópico/respostas, selo BOT.
- `Composer.tsx` — textarea com auto-grow, envio com Enter, anexo desabilitado (Fase 2), erro de envio com retry.

### Perfil / Onboarding / Sessão
- `Profile.tsx` — Dialog reescrito: avatar, nome, username, banner, seção edição/visualização, ligações sociais, salvar/cancelar/editar.
- `OnboardingScreen.tsx`, `AvatarUpload.tsx`, `ProfileForm.tsx` — fluxo de primeiro acesso.
- `SessionGate.tsx` — 5 views: booting, update-required, login, onboarding, shell.

### Infra / Outros
- `SyncStatusIndicator.tsx`, `UpdateBanner.tsx`
- `Settings.tsx` — existe (básico)
- shadcn/ui: button, input, label, card, dialog, sheet, popover, tabs, textarea, toggle, tooltip, separator, select, scroll-area

---

## 3. Gap: o que falta para bater com o Discord

### P0 — Essenciais (replicar primeiro)
| Feature Discord | Estado no Echo | Ação |
|-----------------|----------------|------|
| Layout 4 colunas (rail/sidebar/chat/member) | Implementado | Manter, refinar |
| Servidores no rail (avatar + nome) | Implementado (iniciais) | Adicionar avatar real (mxc://, Fase 2) |
| Canais de texto na sidebar | Implementado | Refinar (categorias, voz, DMs) |
| Canais de voz na sidebar | Tipo existe, não funcional | Implementar ícone 🔊 + entrada em voz |
| Mensagem com avatar/nome/hora/corpo | Implementado | Refinar (markdown, editar, deletar, reply) |
| Reações com emoji | Implementado (básico) | Adicionar emoji picker, super reactions |
| Composer (textarea + enviar) | Implementado | Adicionar emoji, anexo, markdown preview, slash commands |
| Typing indicator | Implementado | Manter |
| Perfil (Dialog) | Implementado | Expandir (status, atividade, badge Nitro, etc.) |
| Configurações | Existe (básico) | Expandir (aparência, temas, keybinds, privacidade) |
| Contador de não lidas (servidor/canal) | Implementado | Manter |
| Busca de canais | Implementado | Adicionar busca global (servidores, membros, mensagens) |

### P1 — Alta prioridade
| Feature Discord | Estado no Echo | Ação |
|-----------------|----------------|------|
| Markdown nas mensagens (negrito, itálico, código, links) | Texto cru | Implementar renderer de markdown |
| Reply / citação de mensagem | Não existe | Implementar message reference + thread inline |
| Threads (abrir tópico em separado) | Chip só | Implementar thread view |
| Emoji picker | Não existe | Criar componente EmojiPicker |
| Anexo de arquivo (upload) | Botão desabilitado | Conectar upload (matrix-js-sdk uploadMedia) |
| Status do usuário (online/idle/dnd/offline) | Apenas "online" fixo | Implementar presence real |
| Dot de presença ao lado do avatar | Existe (básico) | Refinar cores por status |
| Direct Messages / lista de amigos | Não existe | Criar seção de DMs no rail/sidebar |
| Busca global (atalho Ctrl+K) | Não existe | Criar SearchBar + resultados |
| Editar mensagem enviada | Não existe | Implementar edit (placeholder otimista) |
| Deletar mensagem | Não existe | Implementar delete |
| Fixar mensagem | Não existe | Implementar pin |
| Notificações (sinal sonoro, badge) | Não existe | Implementar notificações |
| Embeds / preview de link | Não existe | Implementar link preview |

### P2 — Média prioridade
| Feature Discord | Estado no Echo | Ação |
|-----------------|----------------|------|
| Canais de voz (entrar, falar, sobrepor) | Não existe | Voice over Matrix (depende do servidor) |
| Stage channels | Não existe | Depende do servidor |
| Compartilhamento de tela | Não existe | Tauri + desktop capturer |
| Sobreposição (overlay) em jogos | Não existe | Fora do escopo (Tauri desktop) |
| Server folders (agrupar servidores) | Não existe | Implementar no rail |
| Emojis customizados por servidor | Não existe | Implementar emoji upload/uso |
| Slash commands (/giphy, /tenor, etc.) | Não existe | Implementar command palette |
| Bot integração (selo BOT existe) | Parcial | Comandos de bot |
| Reações em voz (Voice Channel Reactions) | Não existe | Não aplicável (sem voz) |
| Perfil com Nomeplate / Avatar Decoration | Não existe | Expandir Profile |

### P3 — Baixa prioridade / não-goals
- Nitro / assinatura / loja (fora do escopo — não há modelo de negócio)
- Video chamadas 1:1 (depende de infra)
- Servidor templates / community onboarding (depende do servidor Matrix)
- Insights / analytics de servidor
- App directory / bots marketplace
- Overlay em jogos

---

## 4. Layout e Design Tokens (baseado no Discord 2025/2026)

### Cores (Discord "Onyx" / Dark base)
- Background principal: `#323339` (ou similar, azul-escuro cinza)
- Sidebar/rail: um tom mais escuro
- Surface (cards, popovers): um tom intermediário
- Texto principal: branco / cinza claro
- Texto secundário: cinza médio
- Acento (Discord "blurple"): `#5865F2`
- Erro: `#ED4245`
- Sucesso: `#3BA967`
- Online: `#3BA967`, Idle: `#FAA81A`, DND: `#F04747`, Offline: `#747F8D`

### Espaçamento / Tipografia
- Fonte UI: Inter ou similar (sem serif)
- Fonte display (nomes): fonte ligeiramente mais pesada/monospace para iniciais
- Border radius: 8-12px (mais arredondado no redesign 2025)
- Sidebar: 72px (rail), 232px (sidebar), member list 224px

### Estrutura visual (4 colunas)
```
[ Rail 72px ] [ Sidebar 232px ] [ Chat flex ] [ Member List 224px ]
```
- Acima de 1150px: todas visíveis
- 900–1150px: member list vira overlay
- Abaixo de 900px: sidebar vira overlay, member list oculto

---

## 5. Componentes a criar / modificar (plano de implementação)

### Fase A — Fundação UI e tema (sem depender de servidor)
1. **Design tokens** — arquivo CSS com variáveis baseadas no Discord (cores, radius, spacing).
2. **Theme toggle** — claro/escuro (Discord tem light, ash, dark, onyx).
3. **EmojiPicker** — componente standalone (grid de emojis, busca, categorias, skin tone).
4. **Message markdown renderer** — converter `event.body` (markdown simples: **negrito**, *itálico*, `código`, [links](url), > citação) para React.

### Fase B — Chat aprimorado
5. **MessageBubble v2** — markdown no corpo, botão editar/deletar (hover), reply indicator, seleção de texto, menu de contexto (clique direito).
6. **Composer v2** — botões de emoji, anexo (ativo), markdown preview toggle, slash command detector (`/`).
7. **Reply/Quote** — componente de referência de mensagem (quoted message bubble acima do composer).
8. **Thread view** — abrir tópico em painel lateral ou modal.

### Fase C — Navegação e descoberta
9. **Search global** — Ctrl+K, busca servidores/canais/membros/mensagens.
10. **Direct Messages** — seção de DMs no rail/sidebar (lista de conversas diretas).
11. **Server folders** — agrupar servidores no rail (arrastar um sobre outro).
12. **Canais de voz** — listar na sidebar com ícone 🔊, indicar quem está em voz.

### Fase D — Perfil e presença
13. **User status** — online/idle/dnd/invisível, dot de presença, status message personalizado.
14. **Profile expandido** — atividade, badge, ligações sociais, nomeplate.
15. **Settings expandido** — aparência (temas), keybinds, privacidade, notificações.

### Fase E — Mídia e interação
16. **Anexo de arquivo** — conectar uploadMedia, preview de imagem/vídeo, download.
17. **Link preview** — extrair Open Graph de URLs nas mensagens.
18. **Emoji customizado** — upload e uso de emojis por servidor.

---

## 6. Não-goals (anti-goals)
- Voz em tempo real (WebRTC) — depende do servidor Matrix e infra de mídia.
- Vídeo / screen share — depende de infra de mídia.
- Nitro, assinaturas, loja — não há modelo de negócio.
- Overlay em jogos — fora do escopo Tauri desktop.
- Bots marketplace / app directory — depende do servidor.

---

## 7. Métricas de sucesso
- Layout visualmente indistinguível do Discord (mesmo esquema de 4 colunas, cores, radius).
- Todas as features P0 funcionando e cobertas por testes.
- tsc 0 erros, vitest 100% verde.
- Nenhuma dependência nova sem aprovação do usuário (conforme AGENTS.md).

---

## 8. Próximos passos (após aprovação)
1. Criar design tokens (CSS vars) baseados no Discord.
2. Implementar EmojiPicker.
3. Implementar markdown renderer para MessageBubble.
4. Ativar anexo no Composer + conectar upload.
5. Implementar search global (Ctrl+K).
6. Implementar Direct Messages no rail.

---

**Aguardando aprovação do usuário antes de iniciar a implementação.** Nenhuma feature será construída sem sinal verde.

@641@
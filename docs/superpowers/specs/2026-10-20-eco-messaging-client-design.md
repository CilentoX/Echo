# Eco — Documento de Design

**Data:** 2026-10-20
**Status:** Rascunho para aprovação
**Projeto:** Cliente desktop de mensageria estilo Discord, sobre o protocolo Matrix, em rede fechada própria.

---

## 1. Intenção e porquê

O parceiro quer **seu próprio programa de mensageria** com as features do Element (matrix.org) e uma experiência parecida com Discord — guildas, canais, threads, reações, presença, bots, voz — mas com visual próprio e rodando em infraestrutura própria (VPS Oracle com Coolify). A rede é **fechada**: um servidor só seu, sua comunidade, sem federação com o resto do Matrix.

O Matrix foi escolhido como base por já entregar de graça o que custaria caro construir: sync em tempo real, E2EE nativo, threads, reações, presença, voz (Element Call) e um ecossistema maduro de bots e bridges. O diferencial do Eco é a camada de produto: uma interface desktop coesa, rápida e bonita, no espírito do Discord, sem ser um clone.

## 2. Objetivos (MVP)

Marcados pelo usuário como escopo inicial:

- **Guildas e canais de texto** — guildas via Matrix Spaces; canais como salas filhas.
- **Chat em tempo real** com: **reações** (chips), **threads** nativas, **presença** (online/ausente/offline), **indicador de "digitando…"**.
- **Uploads de mídia com preview** (imagens renderizadas inline; outros tipos como cards com ícone e nome).
- **Voz desde o início** — chamadas de canal com **UI nativa do Eco sobre o SDK do LiveKit** (SFU self-hosted no Coolify). Element Call fica como plano B. *\[Decisão do usuário\]*
- **Registro de contas por convite** — registration tokens do Synapse; ninguém entra sem token.
- **Janela responsiva** — app desktop com janelas redimensionáveis e layout adaptativo (não há layout mobile).

## 3. Não-objetivos (fases futuras, explicitamente fora do MVP)

- **Emoji & image packs** (MSC2545) — mencionado como desejo, não marcado no MVP.
- **Sistema de bots com bot inicial** — **requisito geral do projeto**, planejado para fase 3 (após o MVP), via matrix-bot-sdk (TypeScript) e Application Services.
- **Federação** — desligada por design; rede fechada.
- **Mobile / layout de telefone** — app desktop Tauri; responsividade = janelas redimensionáveis, mínimo 700×500px.
- **E2EE** — fora do MVP; ligar numa fase dedicada no futuro (a rede é fechada e o servidor é seu). *\[Decisão do usuário\]*
- **Bridges** (Discord/Telegram/etc.) — possíveis no futuro pelo ecossistema mautrix, mas fora de escopo.

## 4. Anti-objetivos

- **Clone visual do Discord** — inspirado nele, mas com identidade original (Eco tem paleta e tipografia próprias).
- **Dependência de serviços de terceiros** — tudo self-hosted na VPS do usuário; nada de SaaS externo.
- **Fork do Element Web** — cliente próprio construído com matrix-js-sdk (decisão do usuário), não uma customização do Element.

## 5. Restrições e ambiente

| Restrição | Detalhe |
|---|---|
| VPS | Oracle Cloud ARM Ampere A1 — 4 OCPU, 24 GB RAM |
| Deploy | Coolify (containers) na VPS |
| Homeserver | Synapse + PostgreSQL |
| Voz | Element Call + LiveKit (containers no Coolify) |
| Domínio | O usuário **tem** domínio próprio; nome real ainda não informado. Usar `eco.chat` como placeholder em toda a documentação e config até confirmação. |
| Federação | Desligada (`federation_enabled: false` no Synapse) |
| E2EE | Fora do MVP — fase dedicada no futuro (Synapse fechado e self-hosted) |
| Plataformas | **Windows primeiro** (build + testes); macOS/Linux ficam fáceis via Tauri, sem garantia no início *\[Decisão do usuário\]* |

## 6. Identidade visual — [Decisão do usuário: direção "Profundo" (B)]

> O usuário avisou que **haverá alterações futuras** na identidade. Todos os valores abaixo vivem como tokens (CSS variables / design tokens) fáceis de trocar — nenhuma cor hardcoded em componentes.

- **Nome:** Eco
- **Logo:** ondas sonoras concêntricas — um ponto + três arcos com opacidade decrescente (1 / 0.66 / 0.33), stroke arredondado.
- **Modo:** dark-first (não há light mode planejado por enquanto).
- **Tipografia:** Space Grotesk (display/títulos) + Inter (UI/corpo).

### Tokens de cor (paleta oficial)

| Token | Valor |
|---|---|
| `--bg` (base) | `#0D1017` |
| `--rail` (coluna de comunidades) | `#12151C` |
| `--surf` (superfícies) | `#171B24` |
| `--surf2` (superfície elevada) | `#1D222D` |
| `--bd` (bordas) | `#2A3546` |
| `--txt` (texto) | `#E9EDF2` |
| `--mut` (texto secundário) | `#97A2B0` |
| `--acc` (accent) | `#14B8A6` |
| `--acc-press` | `#0D9488` |
| `--online` | `#34D399` |
| `--err` (erro) | `#F87171` |

Contraste: `--txt` sobre `--bg` ≥ 4.5:1 (verificado); `--mut` usado apenas para texto secundário, nunca para conteúdo essencial.

## 7. Layout e responsividade — [Mockups aprovados pelo usuário]

Referência visual: mockups em `.superpowers/brainstorm/959-1792535699/content/` (`layout.html`, `layout-responsivo.html`).

### Estrutura (4 colunas)

| Coluna | Largura | Conteúdo |
|---|---|---|
| Rail de comunidades | 72px fixa | avatar/logo de cada guilda (ativo em teal com pill indicator), badges de não-lidas, botão `+`, ajustes no rodapé |
| Sidebar de canais | 232px fixa | header da guilda (nome ▾), busca, categorias (Geral/Voz…), canais de voz com avatares dos conectados, painel do usuário (avatar + user ID + mic/fones/ajustes) no rodapé |
| Chat | flex | header do canal, mensagens (agrupamento por autor, chips de reação, chip de thread com contagem, tag `BOT` em teal para bots), indicador "X está digitando…" animado, composer com foco teal |
| Lista de membros | 224px fixa | seções Online/Offline, ponto de presença, nome colorido por cargo, badge de bot |

### Regras de responsividade

| Largura da janela | Comportamento |
|---|---|
| ≥ 1150px | 4 colunas visíveis |
| 900–1150px | Membros auto-escondidos; ícone de pessoas no header da sala, aceso, com pill "N escondidos — mostrar" |
| < 900px | Sidebar de canais vira overlay (botão ☰ no header); rail de comunidades permanece |
| Mínimo | 700×500px |

### Decisões de layout tomadas por mim (revertíveis)

1. **Lista de membros visível por padrão**, auto-esconde abaixo de 1150px (usuário delegou: "pode decidir por mim").
2. **Densidade de mensagens confortável** (não compacta).
3. **Rail de comunidades nunca desaparece** — espinha dorsal da navegação em qualquer largura.

## 8. Arquitetura

```
┌────────────────────────── VPS Oracle (Coolify) ──────────────────────────┐
│  Synapse (homeserver) ── PostgreSQL                                      │
│  Element Call ── LiveKit (SFU de voz)                                     │
│  (futuro: containers de bots / Application Services)                      │
└──────────────────────────────────────────────────────────────────────────┘
              ▲ HTTPS (domínio próprio, TLS via Coolify)
              │
┌─────────────┴────────────┐
│  Eco Desktop (Tauri 2)   │
│  React + matrix-js-sdk   │
└──────────────────────────┘
```

- **Cliente:** Tauri 2 (wrapper desktop leve), front-end React + Vite + Tailwind + shadcn/ui + TypeScript. Conexão ao Synapse via matrix-js-sdk (`createClient({ baseUrl, accessToken, userId })`), sync por long-polling/event stream.
- **Homeserver:** Synapse com `federation_enabled: false`, PostgreSQL como banco, registration por tokens (`registration_shared_secret` + tokens de convite gerados por admin).
- **Fluxo de auth no Eco** *(minha decisão, revertível)*: registro in-app — a pessoa digita o token de convite que recebeu e cria sua conta com senha; login por usuário/senha. Sem colar access token na mão.
- **Voz:** UI de chamada **nativa do Eco** (`livekit-client`) sobre um SFU **LiveKit** self-hosted no Coolify, no mesmo domínio. Element Call (widget MSC3401) fica registrado como plano B se o custo da UI nativa explodir.
- **Bots (fase 3):** bots TypeScript com matrix-bot-sdk rodando como containers na mesma VPS; Application Services para usuários virtuais quando precisar de escala (análogo às Gateway Intents do Discord).

### Mapeamento de conceitos Discord → Matrix

| Discord | Matrix (implementação no Eco) |
|---|---|
| Guilda | Space |
| Categoria | Space aninhado |
| Canal | Sala filha do Space |
| Thread | Thread nativa (relações MSC3440) |
| Reação | Annotation (MSC2677) |
| Presença | Presence API do Matrix |
| "Digitando…" | Typing notification |
| Webhook | Bridge / Application Service |
| Cargo/role | Power level da sala (renderizado como cor de nome) |
| "Nitro" | Não existe — recursos nativos |
| Emoji custom | Emoji packs (MSC2545) — fase futura |

## 9. Fases

1. **Fase 1 — Fundação:** repo, design tokens, layout de 4 colunas, login (acess token), sync, lista de guildas/canais, chat básico em tempo real.
2. **Fase 2 — MVP completo:** reações, threads, presença, typing, uploads com preview, voz (UI nativa sobre LiveKit), registro por convite, deploy Synapse+Postgres no Coolify.
3. **Fase 3 — Bots:** sistema de bots (matrix-bot-sdk), primeiro bot do servidor, Application Services.
4. **Futuro:** E2EE (verificação de dispositivos + backup e recuperação de chaves), emoji packs, bridges, refinamentos visuais (usuário sinalizou que vai querer mexer na identidade).

## 10. Deixado ao builder

- Estrutura de pastas e organização de componentes no app Tauri.
- Biblioteca de estado no front (sugestão: algo leve tipo zustand, mas é escolha do builder).
- Como persistir sessão (access token) com segurança no Tauri (keyring do SO vs armazenamento local criptografado).
- Estratégia de cache de mídia e thumbnails.
- Detalhes de UX do composer (upload drag-and-drop, paste de imagem).
- Configuração exata dos containers no Coolify (nomes, redes, volumes) respeitando os limites da VPS.
- Versionamento do protocolo de voz e fallback, se o LiveKit der trabalho na fase 2 — voz pode ser empurrada para uma fase 2.5 sem invalidar o plano.

## 11. Decisões do design-check (minhas, revertíveis)

Surgiram do revisor independente que leu o documento antes da entrega; resolvi por conta porque não mudam o que o usuário pediu:

1. **Administração:** criação de guildas, categorias e canais **in-app** (o botão `+` do mockup aprovado), convites de sala in-app; emissão de registration tokens **fora do app** (script/admin do Synapse); moderação básica (kick/ban/power levels) in-app — barata via APIs do Matrix. Painel admin completo: fora de escopo.
2. **Notificações:** badges de não-lidas in-app no MVP (já nos mockups); notificações nativas do SO (banner + click-to-focus) na Fase 2; sons e badge no dock/taskbar depois.
3. **Sync:** comunidade fechada, esperamos dezenas de usuários → `/sync` clássico com cache local (IndexedDB) desde a Fase 1; Sliding Sync fica como otimização futura se a rede escalar.

## 12. Pendências (só o usuário pode responder)

1. **Domínio real** — enquanto não houver nome confirmado, tudo usa o placeholder `eco.chat`.

> As demais pendências do design-check foram respondidas: E2EE fora do MVP (fase futura), voz com UI nativa Eco sobre LiveKit, Windows primeiro.

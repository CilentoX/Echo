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
- **Login via Google** — SSO (OIDC) no Synapse: qualquer conta Google entra no app; entrar numa comunidade só por convite. *\[Decisão do usuário\]*
- **Usernames e nicknames** — username único e imutável (`@username:litteris.online`) escolhido no primeiro login; nickname global mutável + apelido por guilda (como no Discord). *\[Decisão do usuário\]*
- **Roles e permissões estilo Discord** — roles com nome, cor, hierarquia e permissões por canal, criadas por admins (camada própria do Eco sobre power levels). *\[Decisão do usuário: completo no MVP\]*
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
- **Dependência de serviços de terceiros** — tudo self-hosted na VPS do usuário; nada de SaaS externo. **Exceções (decididas pelo usuário):** login com Google; mídia pode viver em storage externo (ver §8.1).
- **Fork do Element Web** — cliente próprio construído com matrix-js-sdk (decisão do usuário), não uma customização do Element.

## 5. Restrições e ambiente

| Restrição | Detalhe |
|---|---|
| VPS | Oracle Cloud ARM Ampere A1 — **4 OCPU / 24 GB RAM confirmados pelo usuário** (out/2026). Como o Always Free caiu para 2 OCPU/12 GB em jun/2026, a instância provavelmente está como Pay-as-you-go — conferir no console se há cobrança. Egress: 10 TB/mês grátis; block storage free tier: 200 GB. |
| Deploy | Coolify (containers) na VPS |
| Homeserver | Synapse + PostgreSQL |
| Login | SSO Google (OIDC) para membros; conta admin local de emergência (break-glass) *\[minha decisão\]* |
| Voz | LiveKit (SFU self-hosted no Coolify) com UI nativa do Eco; Element Call como plano B |
| Mídia | Fase 1–2: disco local da VPS (200 GB do free tier) com dedup/purge + backups; migração para object storage S3 ao passar de ~100 GB (ver §8.1) |
| Domínio | **litteris.online** — app/servidor em `eco.litteris.online`; MXIDs no formato `@user:litteris.online`. *\[Decisão do usuário\]* |
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
- **Homeserver:** Synapse com `federation_enabled: false`, PostgreSQL como banco.
- **Fluxo de auth no Eco** *\[Decisão do usuário\]*: login com **Google** (SSO/OIDC; Synapse como relying party — sem senha para membros). **Mecanismo verificado** *(minha decisão, com base em pesquisa out/2026 — ver plano da Fase 1)*: o Synapse serve nativamente a tela de escolha de username no 1º login OIDC (omitir `localpart_template` + `confirm_localpart: true` → página `sso_auth_account_details.html`; uma vez vinculado, o localpart é imutável). O Eco abre o browser do sistema (`getSsoLoginUrl` + listener HTTP loopback `127.0.0.1` em Rust) e troca o `loginToken` por sessão via `loginRequest({type: "m.login.token"})`. Assim o **username** (localpart único e imutável → `@username:litteris.online`) é escolhido pela pessoa no primeiro login. O **nickname** (displayname global) é mutável, e cada guilda pode ter um **apelido local** (displayname por sala), como no Discord. Conta recém-criada vê um estado vazio ("entrar com convite") até ser convidada. Uma conta admin local permanece como break-glass *(minha decisão)*. Nota técnica: `federation_enabled` não existe no Synapse — rede fechada = listener sem o resource `federation`, `federation_domain_whitelist: []` e firewall na porta 8448.
- **Voz:** UI de chamada **nativa do Eco** (`livekit-client`) sobre um SFU **LiveKit** self-hosted no Coolify, no mesmo domínio. Element Call (widget MSC3401) fica registrado como plano B se o custo da UI nativa explodir.
- **Roles e permissões:** camada própria do Eco — roles (nome, cor, hierarquia) e permissões por canal, persistidas pelo Eco e **mapeadas para power levels** das salas no Synapse; criação/atribuição via UI de administração in-app. *\[Decisão do usuário: completo no MVP\]*
- **Mídia:** começa no **disco local da VPS** (carga trivial nessa escala — o único gargalo é disco, não CPU/banda); caminho de migração para object storage S3 definido desde o início (§8.1). Google Drive foi avaliado a pedido do usuário e descartado. *\[minha decisão, com base em estudo out/2026\]*
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
| Cargo/role | Camada própria do Eco: roles com nome/cor/hierarquia/perms por canal, mapeadas para power levels |
| Nickname por guilda | displayname por sala (evento `m.room.member`) |
| "Entrar com Google" | SSO OIDC configurado no Synapse |
| "Nitro" | Não existe — recursos nativos |
| Emoji custom | Emoji packs (MSC2545) — fase futura |

### 8.1 Armazenamento de mídia (estudo, out/2026)

**Contexto:** o usuário não quer "pesar a VPS" e sugeriu usar Google Drive (conta Workspace com 5 TB).

**Google Drive — avaliado e descartado** *\[minha decisão, com base em estudo\]*:

- Não tem API S3; a única via é mount via rclone — e aí **todo o tráfego de download continuaria passando pela VPS** (mount é filesystem sobre HTTP), com latência pior. Não descarrega nada, contradiz o objetivo.
- Rate limits fatais para chat: 750 GB/dia de upload por usuário, ~1000 req/100s, e o **"download quota exceeded" por arquivo** — um arquivo popular (meme/gif) trava downloads por ~24h para todos.
- Fardo de OAuth (client_id próprio do rclone sendo aposentado em 2026; verificação de app no Google Cloud) + risco documentado de **ban por uso como storage automatizado** (histórico com Plex/backups). Perder a conta Google = perder a mídia da comunidade.
- Nenhum caso documentado de homeserver Matrix usando Drive com sucesso.

**Plano adotado — local primeiro, S3 depois:**

1. **Fase 1–2:** mídia no disco local do Synapse (até ~100–150 GB). Block storage do OCI free tier: **200 GB**; egress grátis: **10 TB/mês**. Dezenas de usuários geram poucos GB/mês — CPU e banda são irrelevantes; só disco conta, e sobra.
2. **Ao passar de ~100 GB:** migrar para object storage S3-compatible com **synapse-s3-storage-provider** (matrix-org; escreve local e sobe ao S3, com ferramenta de migração local→S3 incluída).
3. **Provedores S3 (preços 2026):** Hetzner Object Storage €6,49/TB-mês (egress incluído; só EU); Backblaze B2 ~US$7/TB (egress grátis até 3× o armazenado); Contabo ~€10/TB (egress livre); Cloudflare R2 $15/TB (egress grátis); Wasabi ~$8/TB (mínimo 1 TB + retenção 90 dias). Recomendação na migração: **Hetzner** ou **B2**.
4. matrix-media-repo (MMR) anotado como opção futura para multi-tenant/thumbnails centralizados — overkill para dezenas de usuários hoje.

**Backups desde o início:** rotina rclone do media store para destino externo (ex.: B2, ~US$0,35/mês para 50 GB).

## 9. Fases

1. **Fase 1 — Fundação:** repo, design tokens, layout de 4 colunas, login via Google (SSO) + escolha de username, sync, lista de guildas/canais, chat básico em tempo real.
2. **Fase 2 — MVP completo:** reações, threads, presença, typing, uploads com preview (plano de mídia da §8.1), voz (UI nativa sobre LiveKit), convites de comunidade, roles e permissões estilo Discord, deploy Synapse+Postgres no Coolify.
3. **Fase 3 — Bots:** sistema de bots (matrix-bot-sdk), primeiro bot do servidor, Application Services. Inclui **painel de criação de bots no próprio app Eco**: o dono do servidor cria o usuário-bot pelo app (via Admin API do Synapse), o app exibe o access token + credenciais (user/pass) para copiar, e o bot pode ser hospedado em qualquer máquina (a própria do dono, a VPS via Coolify, etc.) — o bot só precisa do token e da URL do homeserver para conectar.
4. **Futuro:** E2EE (verificação de dispositivos + backup e recuperação de chaves), emoji packs, bridges, refinamentos visuais (usuário sinalizou que vai querer mexer na identidade).

## 10. Deixado ao builder

- Estrutura de pastas e organização de componentes no app Tauri.
- Biblioteca de estado no front (sugestão: algo leve tipo zustand, mas é escolha do builder).
- Como persistir sessão (access token) com segurança no Tauri (keyring do SO vs armazenamento local criptografado).
- Estratégia de cache de mídia e thumbnails.
- Detalhes de UX do composer (upload drag-and-drop, paste de imagem).
- Configuração exata dos containers no Coolify (nomes, redes, volumes) respeitando os limites da VPS.
- Versionamento do protocolo de voz e fallback, se o LiveKit der trabalho na fase 2 — voz pode ser empurrada para uma fase 2.5 sem invalidar o plano.
- Como persistir a camada de roles (state events em sala de controle vs tabela própria em serviço auxiliar) e sincronizá-la com power levels.
- Config do synapse-s3-storage-provider e escolha do provedor S3 quando a migração da §8.1 disparar (Hetzner/B2 recomendados; detalhe de deploy).

## 11. Decisões do design-check (minhas, revertíveis)

Surgiram do revisor independente que leu o documento antes da entrega; resolvi por conta porque não mudam o que o usuário pediu:

1. **Administração:** criação de guildas, categorias e canais **in-app** (botão `+` do mockup aprovado), convites de comunidade in-app, moderação (kick/ban) in-app — barata via APIs do Matrix. Painel admin completo: fora de escopo.
2. **Notificações:** badges de não-lidas in-app no MVP (já nos mockups); notificações nativas do SO (banner + click-to-focus) na Fase 2; sons e badge no dock/taskbar depois.
3. **Sync:** comunidade fechada, esperamos dezenas de usuários → `/sync` clássico; Sliding Sync fica como otimização futura se a rede escalar. **Revisão da Fase 1 (2026-10-21): o cache local via IndexedDB (`IndexedDBStore` do matrix-js-sdk) foi movido para a Fase 2**, junto com a paginação de histórico (`/messages`). Na Fase 1 o sync é em memória com `initialSyncLimit: 20`, então cada restart recarrega apenas as últimas ~20 mensagens por canal. Motivo: `restoreSession` do `MatrixService` é síncrono e o `MatrixClientLike` de teste não modela store assíncrono — wire o `IndexedDBStore` exigiria async no caminho de restore + double de teste novo, risco desproporcional para o ganho nesta fase.

## 12. Pendências (só o usuário pode responder)

1. ~~Domínio real~~ **Resolvido:** `litteris.online` / `eco.litteris.online`.

> As demais pendências do design-check foram respondidas: E2EE fora do MVP (fase futura), voz com UI nativa Eco sobre LiveKit, Windows primeiro.

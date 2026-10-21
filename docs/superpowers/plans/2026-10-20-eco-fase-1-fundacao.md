# Eco — Fase 1 (Fundação) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente desktop Eco (Tauri 2, Windows) com login via Google, layout de 4 colunas responsivo, lista de guildas/canais e chat básico em tempo real, rodando contra um Synapse de desenvolvimento local (docker compose).

**Architecture:** pnpm workspace na raiz; app em `apps/desktop` (Tauri 2 + React + Vite + Tailwind + shadcn/ui). Toda interação com o protocolo Matrix passa por um adapter testável (`MatrixService`); componentes nunca importam matrix-js-sdk direto. Estado em zustand, alimentado por eventos normalizados do sync. Auth: Synapse serve o SSO Google (incluindo a escolha de username no 1º login via `confirm_localpart`); o app abre o browser do sistema e um listener HTTP loopback em Rust devolve o `loginToken`. Sessão persistida no keyring do SO.

**Tech Stack:** Tauri 2, React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, zustand, matrix-js-sdk@44 (Node ≥ 22), Vitest + @testing-library/react + jsdom, @phosphor-icons/react, @fontsource/inter + @fontsource/space-grotesk, Rust crates `keyring` + `tokio`/`hyper` (listener SSO), Docker Desktop (dev homeserver).

**Spec:** `docs/superpowers/specs/2026-10-20-eco-messaging-client-design.md`

## Global Constraints

- **Windows primeiro** (build e testes); macOS/Linux sem garantia nesta fase.
- Paleta dark-first **sempre via CSS vars** — nenhum hex hardcoded em componentes: `--bg #0D1017; --rail #12151C; --surf #171B24; --surf2 #1D222D; --bd #2A3546; --txt #E9EDF2; --mut #97A2B0; --acc #14B8A6; --acc-press #0D9488; --online #34D399; --err #F87171`.
- Tipografia: Space Grotesk (display) + Inter (UI/corpo). Contraste de texto essencial ≥ 4.5:1.
- **Copy de UI em PT-BR.**
- Janela mínima **700×500px**. Breakpoints: **≥1150px** tudo visível; **<1150px** lista de membros auto-escondida; **<900px** sidebar de canais vira overlay; **rail de comunidades nunca desaparece**.
- Sem E2EE e sem federação no MVP. Nenhum fluxo de registro/senha no app — contas nascem só via SSO Google.
- Ícones: Phosphor (`@phosphor-icons/react`); emoji nunca como ícone estrutural (emoji como conteúdo de mensagem ok).
- Sem virtualização de timeline nesta fase (YAGNI — dezenas de usuários).
- Commits: Conventional Commits em inglês. Tarefa só termina com testes verdes.
- Sem federação no Synapse: listener **sem** o resource `federation`, `federation_domain_whitelist: []`, firewall na 8448. `federation_enabled` NÃO existe no Synapse.

**⚠ Ação do usuário necessária antes da Task 4:** criar OAuth Client ID no Google Cloud Console (tipo **"Desktop app"**) — o redirect loopback `http://127.0.0.1` (IP literal, porta dinâmica) já cobre. Guardar o Client ID (`xxx.apps.googleusercontent.com`) e o secret para o `.env` do dev.

## Review Focus

1. **Access token salvo inválido/expirado no boot** → app cai na tela de login com sessão limpa, sem crash. → Teste na Task 7 (restore falha → login screen).
2. **Conta recém-criada sem guilda** → estado vazio "entrar com convite" (spec §8), não tela em branco. → Teste na Task 9.
3. **Usuário fecha o browser / SSO não completa** → erro retry-ável na tela de login, não spinner eterno. → Teste na Task 6 (timeout → erro + botão tentar de novo).
4. **Sync cai em runtime (rede)** → indicador de status "reconectando…" e o composer preserva o texto digitado. → Testes nas Tasks 8 (status) e 10 (input preservado).
5. **Mensagens longas / displaynames longos** → quebra de linha e ellipsis, sem overflow horizontal. → Teste na Task 10.

---

## File Structure

```
eco/
├─ pnpm-workspace.yaml
├─ apps/desktop/
│  ├─ src/
│  │  ├─ main.tsx / App.tsx
│  │  ├─ styles/tokens.css
│  │  ├─ lib/
│  │  │  ├─ matrix/service.ts      (MatrixService — adapter matrix-js-sdk)
│  │  │  ├─ matrix/types.ts        (Session, NormalizedEvent, Guild/ChannelSummary)
│  │  │  └─ storage/keyring.ts     (wraps invoke → Rust keyring)
│  │  ├─ stores/
│  │  │  ├─ syncStore.ts
│  │  │  └─ uiStore.ts
│  │  └─ features/
│  │     ├─ auth/GoogleLoginScreen.tsx
│  │     ├─ shell/AppShell.tsx, CommunityRail.tsx, ChannelSidebar.tsx,
│  │     │   ChatPane.tsx, MemberList.tsx, useBreakpoints.ts
│  │     └─ chat/MessageList.tsx, groupMessages.ts, Composer.tsx
│  ├─ src-tauri/                   (Tauri 2; commands: sso listener, keyring)
│  └─ tailwind.config.ts, vite.config.ts, package.json
├─ infra/dev/
│  ├─ docker-compose.yml           (synapse + postgres)
│  ├─ synapse/homeserver.yaml      (config dev, OIDC via env)
│  └─ .env.example                 (POSTGRES_PASSWORD, GOOGLE_CLIENT_ID/SECRET)
└─ docs/superpowers/
```

---

### Task 1: Scaffold do workspace e do app

**Files:**
- Create: `pnpm-workspace.yaml`, `apps/desktop/**` (scaffold Tauri 2 React-TS), `apps/desktop/package.json` scripts, `apps/desktop/src/App.test.tsx`, `apps/desktop/vite.config.ts` (alias `@/` → `src/`, Vitest + jsdom + setup)

**Interfaces:**
- Produces: app roda com `pnpm tauri dev`; `pnpm test` executa Vitest; alias `@/` funciona em imports e em testes.

- [ ] **Step 1: Scaffold**

`pnpm create tauri-app@latest` (template React + TypeScript, sem git init) dentro de `apps/desktop`; criar `pnpm-workspace.yaml` com `packages: ["apps/*"]`. Instalar deps: `tailwindcss`, `matrix-js-sdk@^44`, `zustand`, `@phosphor-icons/react`, `@fontsource/inter`, `@fontsource/space-grotesk`, dev: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@types/*`.

- [ ] **Step 2: Escrever o teste de fumaça (falhando)**

`src/App.test.tsx`: renderiza `<App />` e espera que exista um elemento com o texto "Eco".

- [ ] **Step 3: Rodar e ver falhar** — Run: `pnpm test` — Expected: FAIL (jsdom/setup não configurado ou App não renderiza).

- [ ] **Step 4: Configurar Vite/Vitest/Tailwind e App mínimo**

`vite.config.ts`: plugins React + Tauri, `test: { environment: "jsdom", setupFiles: [...] }`, `resolve.alias { "@": "/src" }`. Tailwind: content paths, CSS base. `App.tsx` renderiza `<h1>Eco</h1>`.

- [ ] **Step 5: Rodar testes — passar** — Run: `pnpm test` — Expected: PASS.

- [ ] **Step 6: Verificar boot** — Run: `pnpm tauri dev` (fecha após janela abrir) — Expected: janela "Eco" abre branca.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "chore: scaffold tauri workspace with test toolchain"`

---

### Task 2: Design tokens

**Files:**
- Create: `apps/desktop/src/styles/tokens.css`, `apps/desktop/src/test/tokens.test.ts`
- Modify: `apps/desktop/tailwind.config.ts`, `apps/desktop/src/main.tsx` (import tokens + fontes)

**Interfaces:**
- Produces: cores semânticas no Tailwind via `var(--<token>)` — ex.: classe `bg-surf2`, `text-mut`, `border-bd`, `text-acc`. Fontes `font-display` (Space Grotesk) e `font-ui` (Inter).

- [ ] **Step 1: Teste (falhando)**

`tokens.test.ts` (ambiente node): lê `src/styles/tokens.css` e `tailwind.config.ts`; asserta que os 11 tokens da Global Constraints estão presentes no CSS com os hexes exatos, e que `tailwind.config.ts` mapeia cada cor semântica (`bg`, `rail`, `surf`, `surf2`, `bd`, `txt`, `mut`, `acc`, `acc-press`, `online`, `err`) para `var(--<nome>)`.

- [ ] **Step 2: Rodar e ver falhar** — Run: `pnpm test -- tokens` — Expected: FAIL.

- [ ] **Step 3: Implementar** `tokens.css` (11 vars no `:root`, valores verbatim da Global Constraints) + Tailwind `theme.extend.colors` apontando para as vars + `fontFamily` (`display`: Space Grotesk, `ui`: Inter) + imports `@fontsource` no `main.tsx`.

- [ ] **Step 4: Rodar — passar** — Run: `pnpm test -- tokens` — Expected: PASS.

- [ ] **Step 5: Commit** — `feat: add design tokens and tailwind theme`

---

### Task 3: AppShell de 4 colunas + responsividade

**Files:**
- Create: `src/features/shell/AppShell.tsx`, `CommunityRail.tsx`, `ChannelSidebar.tsx`, `ChatPane.tsx`, `MemberList.tsx`, `useBreakpoints.ts`, e testes `AppShell.test.tsx`, `useBreakpoints.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `useBreakpoints(width?: number): { membersVisible: boolean; sidebarOverlay: boolean }` — `membersVisible: width >= 1150`, `sidebarOverlay: width < 900`. `AppShell` aceita slots (children) e renderiza `rail | sidebar | chat | members` com as larguras do spec (72px / 232px / flex / 224px).

- [ ] **Step 1: Teste do hook (falhando)** — `useBreakpoints.test.ts`: 1200 → ambos falsos... atenção: `sidebarOverlay` true só < 900; 1000 → `membersVisible: false, sidebarOverlay: false`; 800 → ambos true... `membersVisible: false, sidebarOverlay: true`. Cobrir 1150 e 900 exatos (boundary inclusivo).

- [ ] **Step 2: Rodar e ver falhar** — Run: `pnpm test -- useBreakpoints` — Expected: FAIL.

- [ ] **Step 3: Implementar hook** (window.matchMedia ou resize listener; a assinatura com `width?` permite injetar em testes).

- [ ] **Step 4: Teste do shell (falhando)** — `AppShell.test.tsx` com largura simulada: em 1200 as 4 colunas estão no DOM (`role` de cada coluna: `complementary` ×3? use `data-column` attrs); em 1000 `MemberList` não está visível e existe um botão de alternar membros; em 800 a sidebar só aparece quando o botão ☰ é clicado (overlay) e o `CommunityRail` permanece.

- [ ] **Step 5: Implementar `AppShell`** + subcolunas esqueleto (conteúdo estático placeholder: rail com pill ativo, sidebar com categorias fake, chat vazio, membros fake — só estrutura visual, sem dados reais).

- [ ] **Step 6: Rodar — passar** — Run: `pnpm test -- shell` — Expected: PASS.

- [ ] **Step 7: Commit** — `feat: responsive 4-column app shell`

---

### Task 4: Homeserver de desenvolvimento (Synapse + Postgres)

**Files:**
- Create: `infra/dev/docker-compose.yml`, `infra/dev/synapse/homeserver.yaml`, `infra/dev/.env.example`, `infra/dev/README.md`

**Interfaces:**
- Produces: Synapse dev em `http://localhost:8008` com SSO Google funcional (chave de config `oidc_providers` com `idp_id: google`, `confirm_localpart: true`, SEM `localpart_template`), Postgres, admin break-glass, federação desligada. Requer Docker Desktop no Windows.

- [ ] **Step 1: Escrever compose + config**

`docker-compose.yml`: `postgres:16` (db `synapse`, senha via env) + `matrixdotorg/synapse` (depends_on postgres; volume `./synapse` + `./data`; porta `8008:8008`). `homeserver.yaml` (gerado por `generate` na primeira subida, depois editado): `server_name: eco.litteris.online` (dev local aceita mesmo com DNS apontando pro remoto — não federar), `database` Postgres, listener única com `resources: [client]`, `federation_domain_whitelist: []`, `allow_profile_lookup_over_federation: false`, `require_auth_for_profile_requests: true`, `registration_shared_secret` (só para criar o admin via CLI), OIDC com `issuer: https://accounts.google.com/`, `client_id/secret` via env `SYNAPSE_GOOGLE_*`. `.env.example` documentado no README.

- [ ] **Step 2: Subir e gerar config** — Run: `docker compose up -d` (com o comando `generate` na primeira vez) — Expected: containers healthy.

- [ ] **Step 3: Verificar servidor** — Run: `curl http://localhost:8008/_matrix/client/versions` — Expected: JSON com `versions`.

- [ ] **Step 4: Criar admin break-glass** — Run: `docker compose exec synapse register_new_matrix_user -u ecoadmin -p <senha> -a -c /data/homeserver.yaml http://localhost:8008` — Expected: "Success".

- [ ] **Step 5: Verificar SSO manualmente** — abrir `http://localhost:8008/_matrix/client/v3/login` e confirmar que o fluxo `m.login.sso` aparece (o teste E2E completo do Google acontece na Task 6, Step 7) — Expected: `flows` contém `m.login.sso`.

- [ ] **Step 6: Commit** — `chore: add dev homeserver (synapse + postgres, sso google)`

---

### Task 5: MatrixService — adapter do matrix-js-sdk

**Files:**
- Create: `src/lib/matrix/types.ts`, `src/lib/matrix/service.ts`, `src/lib/matrix/fakeClient.ts` (mock de testes), `service.test.ts`

**Interfaces:**
- Produces (usado por Tasks 6–10):

```ts
interface Session { baseUrl: string; accessToken: string; userId: string; deviceId: string | null; refreshToken?: string }
interface NormalizedEvent { eventId: string; roomId: string; sender: string; body: string; originServerTs: number }
interface GuildSummary { guildId: string; name: string; avatarUrl: string | null; unreadCount: number }
interface ChannelSummary { channelId: string; name: string; unreadCount: number }
type SyncStatus = "connecting" | "syncing" | "error";

class MatrixService {
  constructor(baseUrl: string)
  loginWithSsoToken(loginToken: string): Promise<Session>   // loginRequest({ type: "m.login.token", token })
  restoreSession(session: Session): void                    // createClient com credenciais
  startSync(onEvent: (e: NormalizedEvent) => void, onStatus: (s: SyncStatus) => void): void
  stopSync(): void
  sendMessage(roomId: string, body: string): Promise<string> // resolve eventId
  listGuilds(): Promise<GuildSummary[]>                     // Spaces joined (m.space.name)
  listChannels(guildId: string): Promise<ChannelSummary[]>  // children do Space via m.space.child
}
```

- Consumes: matrix-js-sdk v44 — `createClient`, `client.loginRequest`, `client.getSsoLoginUrl`, `client.on("sync")`, `client.startClient({ initialSyncLimit: 20, threadSupport: true })`, `client.getRoom(...)`/`getRooms()`, `client.sendMessage(roomId, { msgtype: "m.text", body })`.

- [ ] **Step 1: Teste (falhando)** — `service.test.ts` com `fakeClient` (objeto com mesma interface que usamos do SDK, injetado por factory no service p/ testes): (a) `loginWithSsoToken` chama `loginRequest` com `{ type: "m.login.token", token }` e devolve `Session` com os campos da resposta; (b) evento `m.room.message` no sync → `onEvent` recebe `NormalizedEvent` com body; (c) `client.on("sync")` com `"ERROR"` → `onStatus("error")`; (d) `sendMessage` monta `m.text` e resolve com eventId; (e) `listGuilds` transforma um Space com `m.space.child` em `GuildSummary` + filhos em `ChannelSummary`.

- [ ] **Step 2: Rodar e ver falhar** — Run: `pnpm test -- service` — Expected: FAIL.

- [ ] **Step 3: Implementar** `types.ts` + `service.ts`. Ponto de injeção: `MatrixService` usa `createClient` do SDK por padrão, mas aceita `clientFactory` no construtor (default = `createClient`) — testes injetam `fakeClient`.

- [ ] **Step 4: Rodar — passar** — Run: `pnpm test -- service` — Expected: PASS.

- [ ] **Step 5: Commit** — `feat: matrix service adapter over matrix-js-sdk`

---

### Task 6: Fluxo de login SSO Google (Rust loopback + tela)

**Files:**
- Modify: `src-tauri/src/lib.rs` (registrar commands), `src-tauri/Cargo.toml` (crates `hyper`, `tokio`, `tauri-plugin-opener`)
- Create: `src-tauri/src/sso.rs`, `src/features/auth/GoogleLoginScreen.tsx`, `src/lib/matrix/sso.ts` (coordena invoke + service), testes `sso.test.ts`, `GoogleLoginScreen.test.tsx`

**Interfaces:**
- Consumes: `MatrixService` (Task 5).
- Produces: Rust commands `begin_sso_listener() -> u16` (sobe listener HTTP em `127.0.0.1` porta aleatória; URL de callback aceita qualquer path) e `finish_sso_listener(port) -> Promise<String>` (resolve com o `loginToken` do query param, rejeita em timeout de 5 min ou listener cancelado). JS: `runSsoLogin(service: MatrixService): Promise<Session>` em `sso.ts`. UI: `GoogleLoginScreen` com botão "Entrar com Google" e estados idle/loading/error.

- [ ] **Step 1: Teste JS (falhando)** — `sso.test.ts` com `invoke` mockado: `runSsoLogin` chama `begin_sso_listener`, depois `service.loginWithSsoToken` com o token de `finish_sso_listener`; se `finish_sso_listener` rejeita (timeout), `runSsoLogin` rejeita com erro tipado. `GoogleLoginScreen.test.tsx`: botão dispara o fluxo (mock de `runSsoLogin`); rejeição → mensagem de erro PT-BR + botão "Tentar de novo" (Review Focus 3).

- [ ] **Step 2: Rodar e ver falhar** — Run: `pnpm test -- sso GoogleLogin` — Expected: FAIL.

- [ ] **Step 3: Implementar Rust `sso.rs`** — hyper server one-shot em porta `0` (SO atribui), guarda token do query param `loginToken`, timeout 5 min; commands registrados no `lib.rs`.

- [ ] **Step 4: Implementar `sso.ts`** — porta = `begin_sso_listener()`; `redirectUrl = http://127.0.0.1:${port}/callback`; `url = client.getSsoLoginUrl(redirectUrl, "sso", "google")` (temp client sem credenciais); abre browser via `tauri-plugin-opener`; `finish_sso_listener` → `service.loginWithSsoToken`.

- [ ] **Step 5: Implementar tela** — usa `text-acc`/`bg-surf` tokens; logo Eco (SVG das ondas concêntricas do mockup) sobre `--bg`.

- [ ] **Step 6: Rodar testes — passar** — Run: `pnpm test` — Expected: PASS.

- [ ] **Step 7: Verificação E2E manual** — `pnpm tauri dev` + Synapse dev da Task 4: clicar "Entrar com Google", completar Google, escolher username na página servida pelo Synapse, voltar ao app autenticado — Expected: app mostra a sessão (LOG temporário do `userId`).

- [ ] **Step 8: Commit** — `feat: google sso login with native username choice`

---

### Task 7: Persistência de sessão (keyring) + boot

**Files:**
- Modify: `src-tauri/Cargo.toml` (crate `keyring`), `src-tauri/src/lib.rs`, `src/App.tsx`
- Create: `src-tauri/src/keyring_cmds.rs`, `src/lib/storage/keyring.ts`, `src/features/auth/SessionGate.tsx`, testes `keyring.test.ts`, `SessionGate.test.tsx`

**Interfaces:**
- Consumes: `Session` (Task 5).
- Produces: Rust commands `store_token(userId: String, token: String)`, `load_token() -> Option<{userId, token}>`, `clear_token()` (service = "eco", entry = userId). JS `keyring.ts`: `saveSession(session: Session)`, `loadSession(): Promise<Session | null>` (baseUrl fixo de config: `import.meta.env.VITE_HOMESERVER_URL`), `clearSession()`. `SessionGate`: carrega sessão no boot → `restoreSession` + `startSync`; falha → tela de login com sessão limpa (Review Focus 1).

- [ ] **Step 1: Testes (falhando)** — `keyring.test.ts` (invoke mockado: save→load devolve; clear→load null). `SessionGate.test.tsx`: com sessão salva e `startSync` ok → renderiza `AppShell`; com sessão que o Synapse rejeita (mock de erro no restore/sync inicial) → `GoogleLoginScreen` visível e `clear_token` chamado; sem sessão → `GoogleLoginScreen`.

- [ ] **Step 2: Rodar e ver falhar** — Run: `pnpm test -- keyring SessionGate` — Expected: FAIL.

- [ ] **Step 3: Implementar Rust keyring commands** (Windows Credential Manager via crate `keyring`).

- [ ] **Step 4: Implementar `keyring.ts` + `SessionGate`** + wire no `App.tsx` (login bem-sucedido da Task 6 agora salva a sessão).

- [ ] **Step 5: Rodar testes — passar** — Run: `pnpm test` — Expected: PASS.

- [ ] **Step 6: Verificação manual** — fechar e reabrir o app: sessão restaurada sem login. — Expected: entra direto na shell.

- [ ] **Step 7: Commit** — `feat: persist session in os keyring and gate boot on it`

---

### Task 8: Sync store (zustand)

**Files:**
- Create: `src/stores/syncStore.ts`, `src/stores/uiStore.ts`, `src/test/syncStore.test.ts`

**Interfaces:**
- Consumes: `MatrixService` (Task 5) — o store não fala com o SDK; quem liga service↔store é o `SessionGate`/bootstrap (Task 11): `startSync(onEvent → syncStore.applyEvent, onStatus → syncStore.setStatus)`, e ao ficar `PREPARED` chama `listGuilds`/`listChannels`.
- Produces:

```ts
syncStore: { status: SyncStatus; guilds: GuildSummary[]; channelsByGuild: Record<string, ChannelSummary[]>;
  timelineByChannel: Record<string, NormalizedEvent[]>;
  setGuilds(list: GuildSummary[]): void; setChannels(guildId: string, list: ChannelSummary[]): void;
  applyEvent(e: NormalizedEvent): void; setStatus(s: SyncStatus): void; }
uiStore: { activeGuildId: string | null; activeChannelId: string | null; ...setters }
```

- [ ] **Step 1: Teste (falhando)** — `syncStore.test.ts`: `applyEvent` de canal existente anexa na timeline (dedupe por eventId — aplicar 2× adiciona 1); `setStatus("error")` expõe status p/ indicador "reconectando…" (Review Focus 4); `setGuilds` substitui a lista.

- [ ] **Step 2: Rodar e ver falhar** — Run: `pnpm test -- syncStore` — Expected: FAIL.

- [ ] **Step 3: Implementar** stores zustand + seletores exportados (`selectGuilds`, `selectChannels(guildId)`, `selectTimeline(channelId)`).

- [ ] **Step 4: Rodar — passar** — Run: `pnpm test -- syncStore` — Expected: PASS.

- [ ] **Step 5: Commit** — `feat: sync and ui zustand stores`

---

### Task 9: Rail de guildas + sidebar de canais (dados reais) + empty state

**Files:**
- Modify: `src/features/shell/CommunityRail.tsx`, `ChannelSidebar.tsx`
- Create: `src/features/shell/EmptyState.tsx`, testes `CommunityRail.test.tsx`, `ChannelSidebar.test.tsx`

**Interfaces:**
- Consumes: `syncStore`/`uiStore` (Task 8), layout da Task 3.
- Produces: rail e sidebar alimentados pelo store; tela "Entrar com convite" quando `guilds.length === 0` (Review Focus 2); pill indicator na guilda/canal ativos; badge de não-lidas (`unreadCount > 0`); categorias por prefixo de tipo (texto — sem prefixo; voz fica para a Fase 2, mostrar só texto agora).

- [ ] **Step 1: Testes (falhando)** — `CommunityRail.test.tsx`: guildas do store renderizam (nome, badge quando unread > 0), clique seleciona (`activeGuildId`), pill na ativa. `ChannelSidebar.test.tsx`: canais da guilda ativa renderizam, clique seleciona canal, ativo com destaque. `EmptyState` — store vazio → mensagem "Você ainda não está em nenhuma comunidade. Entre com um convite." (Review Focus 2).

- [ ] **Step 2: Rodar e ver falhar** — Run: `pnpm test -- Rail Sidebar EmptyState` — Expected: FAIL.

- [ ] **Step 3: Implementar** (Phosphor icons: `PhosphorLogo`-like p/ guildas sem avatar usar inicial; `Hash` nos canais; `MagnifyingGlass` na busca — busca visual only nesta fase).

- [ ] **Step 4: Rodar — passar** — Run: `pnpm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `feat: guild rail and channel sidebar bound to sync store`

---

### Task 10: Chat básico em tempo real

**Files:**
- Modify: `src/features/shell/ChatPane.tsx`
- Create: `src/features/chat/MessageList.tsx`, `groupMessages.ts`, `Composer.tsx`, testes `groupMessages.test.ts`, `MessageList.test.tsx`, `Composer.test.tsx`

**Interfaces:**
- Consumes: `syncStore.selectTimeline(activeChannelId)`, `uiStore`, `MatrixService.sendMessage`.
- Produces: `groupMessages(events: NormalizedEvent[]): MessageGroup[]` — quebra grupo quando muda o sender OU gap > 5 min (`{ sender: string; events: NormalizedEvent[] }`). `Composer`: `onSend(body: string)`; estado pendente + rollback em erro. `MessageList`: grupos com avatar (inicial do sender), nome, hora, corpo em `whitespace-pre-wrap break-words`.

- [ ] **Step 1: Testes (falhando)** — `groupMessages.test.ts`: mesma pessoa seguida = 1 grupo; muda sender = novo grupo; gap de 6 min = novo grupo. `MessageList.test.tsx`: renderiza grupos com autor+texto; texto de 300 chars sem palavras quebra sem overflow horizontal (Review Focus 5 — assert: nenhum elemento com `scrollWidth > clientWidth` no contêiner). `Composer.test.tsx`: Enter envia via `onSend` e limpa; erro de send → texto preservado + indicador de erro (Review Focus 4); novo evento no store durante digitação → input intacto.

- [ ] **Step 2: Rodar e ver falhar** — Run: `pnpm test -- chat` — Expected: FAIL.

- [ ] **Step 3: Implementar** `groupMessages` + componentes; `ChatPane` liga store → list + composer; `sendMessage` com estado pendente (evento otimista com id `pending-*`, substituído/dedupeado por eventId real no `applyEvent` — Task 8).

- [ ] **Step 4: Rodar — passar** — Run: `pnpm test` — Expected: PASS.

- [ ] **Step 5: Verificação E2E manual** — dois clientes (app + Element Web apontando ao Synapse dev) conversando no mesmo canal — Expected: mensagens chegam em tempo real dos dois lados.

- [ ] **Step 6: Commit** — `feat: realtime chat with grouped timeline and composer`

---

### Task 11: Bootstrap completo + build Windows

**Files:**
- Modify: `src/App.tsx`, `src/features/auth/SessionGate.tsx`, `src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: tudo das Tasks 1–10.
- Produces: fluxo completo boot → login/restaura → shell com dados reais; janela mínima 700×500; indicador de status de sync no shell ("reconectando…" quando `status === "error"`).

- [ ] **Step 1: Teste (falhando)** — `App.test.tsx` atualizado: sem sessão → login; com sessão + guildas → shell com rail/sidebar/chat; `syncStore.status === "error"` → indicador "Reconectando…" visível (Review Focus 4).

- [ ] **Step 2: Implementar** — janela: `tauri.conf.json` `windows[0]` com `"minWidth": 700, "minHeight": 500`; wire final do bootstrap (login → saveSession → restore → startSync → load guilds/channels → shell).

- [ ] **Step 3: Rodar testes — passar** — Run: `pnpm test` — Expected: PASS (suite inteira).

- [ ] **Step 4: Build de release** — Run: `pnpm tauri build` — Expected: build conclui e gera instalador/binary em `src-tauri/target/release/bundle/`.

- [ ] **Step 5: Smoke do instalador** — instalar e abrir o .exe gerado; login com uma conta de teste; enviar e receber mensagem — Expected: fluxo completo funciona no app instalado.

- [ ] **Step 6: Commit** — `feat: full bootstrap, window sizing and release build`

---

## Pós-Fase 1 (fora deste plano)

Fase 2 (reções, threads, presença, typing, uploads, convites, roles, voz LiveKit, badges, deploy Coolify) e Fase 3 (bots) recebem planos próprios a partir do mesmo spec.

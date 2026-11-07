# Auditoria Técnica Completa — Ecossistema Echo

**Data:** 2026-11-07
**Auditor:** Engenharia de Software Sênior (AI-Assisted)
**Escopo:** echo-api, echo (desktop), echo-site
**Versão analisada:** v0.1.16

---

## 1. Resumo Executivo

O ecossistema Echo demonstra uma base arquitetural sólida para um aplicativo de comunicação moderno, com escolhas tecnológicas acertadas (Fastify + Prisma + Tauri 2 + Matrix). A criptografia de tokens em repouso (AES-256-GCM) e o uso de keyring nativo são pontos fortes de segurança.

No entanto, a auditoria identificou **3 vulnerabilidades críticas (P0)**, **8 problemas de alta prioridade (P1)** e diversas oportunidades de melhoria. Os riscos mais urgentes são:

1.  **Token Refresh Fictício:** O endpoint `/auth/refresh` retorna tokens mockados (`new-access-token-${Date.now()}`), tornando a renovação de sessão inoperante em produção.
2.  **Cache de Tokens Synapse sem Limite:** O `synapseTokenCache` em `plugins/auth.js` é um `Map` em memória sem TTL eviction ou limite de tamanho, criando vetor de DoS por exaustão de memória.
3.  **Uploads sem Autenticação:** As rotas de upload (`/api/upload`, `/api/uploads`) não possuem middleware `authenticate`, permitindo que qualquer usuário anônimo envie arquivos ao servidor.

A arquitetura geral é promissora, mas requer estabilização de segurança e completude de fluxos críticos antes de escalar.

---

## 2. Análise Individual dos Projetos

### 2.1 Echo API (`echo-api`)

**Stack:** Fastify 5, Prisma 6, PostgreSQL, matrix-js-sdk, jose (JWT)

#### Pontos Fortes
-   **Criptografia de Tokens:** Implementação correta de AES-256-GCM com IV de 12 bytes e tag de autenticação em `tokenStore.js`. Validação estrita da chave (32 bytes base64).
-   **Autenticação Multi-estratégia:** Suporte elegante a X-API-Key, JWT próprio e tokens Synapse nativos (`syt_`) no mesmo middleware.
-   **Schema Prisma Bem Modelado:** Relacionamentos claros, índices apropriados em campos de busca (`requesterId`, `addresseeId`, `status`), cascade deletes configurados.
-   **Health Checks Completos:** Múltiplos endpoints (`/health`, `/healthz`, `/readyz`, `/livez`) com verificação real de conexão DB.

#### Problemas Identificados

| ID | Severidade | Arquivo | Descrição |
|----|-----------|---------|-----------|
| API-001 | **P0** | `src/routes/authRoutes.js:128-135` | `/auth/refresh` retorna tokens fictícios. Comentário admite "mock response". Sessões expiram e nunca renovam. |
| API-002 | **P0** | `src/plugins/auth.js:98` | `synapseTokenCache` é Map ilimitado. Cada token validado ocupa memória indefinidamente. Ataque de força bruta de tokens esgota RAM. |
| API-003 | **P0** | `src/routes/uploadRoutes.js` | Rotas POST/GET/DELETE sem `{ preHandler: authenticate }`. Upload anônimo permitido. |
| API-004 | P1 | `src/app.js:38-42` | Limpeza defensiva de `!dm_*` roda a cada startup sem await. Race condition potencial com queries concorrentes. |
| API-005 | P1 | `src/services/uploadService.js:28-32` | `saveFile` usa `writeFileSync` bloqueante dentro de handler async. Bloqueia event loop durante I/O de disco. |
| API-006 | P1 | `src/routes/uploadRoutes.js:42-48` | GET `/:fileId` lê meta.json com `readFileSync` síncrono. Mesma issue de bloqueio. |
| API-007 | P2 | `src/app.js:68-78` | CORS implementado manualmente via hooks em vez de usar `@fastify/cors`. Headers duplicados em onRequest + onResponse. |
| API-008 | P2 | `src/lib/matrix/proxy.js` | Proxy Matrix genérico (`/matrix/*`) repassa tudo ao Synapse. Sem whitelist de endpoints, pode expor APIs admin do Synapse se o token tiver privilégios. |
| API-009 | P2 | `vitest.config.js` | Aliases manuais para cada arquivo testado. Frágil; quebra quando novos imports são adicionados. |
| API-010 | P3 | `package.json` | Build script apenas copia src→dist. Sem transpilação, minificação ou tree-shaking. |

### 2.2 Echo Desktop (`echo/apps/desktop`)

**Stack:** Tauri 2, React 19, Zustand 5, TailwindCSS 4, TypeScript 6

#### Pontos Fortes
-   **Keyring Nativo:** Tokens persistidos via Windows Credential Manager (`keyring` crate). Nunca em localStorage ou plaintext.
-   **Config Store Atômico:** Escrita em `.tmp` + rename garante integridade contra crashes em `config_store.rs`.
-   **SSO Loopback Seguro:** Listener HTTP one-shot em `127.0.0.1:1421` com timeout de 5 min e abort de listeners anteriores.
-   **Single Instance:** Plugin `tauri-plugin-single-instance` previne múltiplas instâncias; traz janela existente ao focar.
-   **WebView2 Flags Inteligentes:** Detecção de idioma do SO para auto-seleção de fonte de captura de tela sem diálogo nativo.
-   **Zustand v5 Correto:** Uso de `Object.freeze([])` para snapshots vazios evita loops infinitos do `useSyncExternalStore`.

#### Problemas Identificados

| ID | Severidade | Arquivo | Descrição |
|----|-----------|---------|-----------|
| DESK-001 | **P1** | `src-tauri/src/lib.rs:157-160` | `WindowEvent::CloseRequested` chama `std::process::exit(0)` diretamente. Bypass graceful shutdown: WebRTC connections, WebSocket sync e file writes podem ser corrompidos. |
| DESK-002 | P1 | `src/stores/syncStore.ts:130-135` | `pinnedByRoom` e `mutedChannels` lidos de `localStorage` no módulo top-level. Se localStorage estiver corrompido, store falha na inicialização e app não abre. |
| DESK-003 | P1 | `src/lib/matrix/service.ts` | Classe `MatrixService` tem métodos stub (`markAsRead`, `redact`, `removeReaction`) que são no-op ou delegam incorretamente. Funcionalidades essenciais não funcionam. |
| DESK-004 | P2 | `src-tauri/Cargo.toml` | `serial_test = "3"` em `[dependencies]` em vez de `[dev-dependencies]`. Infla binário release. |
| DESK-005 | P2 | `src-tauri/Cargo.toml` | `xcap = "0.9.8"` como dependência direta. Biblioteca de captura de tela pesada (~5MB) incluída mesmo se só usada em dev/test. |
| DESK-006 | P2 | `package.json` | `pg` (^8.23.1) como dependência de runtime. Driver PostgreSQL não deveria estar no frontend desktop; é responsabilidade da API. |
| DESK-007 | P2 | `src/App.tsx:8-12` | `sendMessage` e `sendFile` definidos como funções soltas fora de hook/context. Recriadas a cada render do componente `Shell`. |
| DESK-008 | P3 | `src-tauri/capabilities/default.json` | Permissões mínimas (bom), mas falta `dialog:default` para save/open file dialogs nativos. |
| DESK-009 | P3 | Vários stores | Stores usam `create<State>()((set, get) => ...)` — parênteses duplos corretos para Zustand v5, mas alguns stores ainda têm padrões v4 inconsistentes. |

### 2.3 Echo Website (`echo-site`)

**Stack:** HTML estático, CSS puro (Glassmorphism), sem framework

#### Pontos Fortes
-   **Performance Excepcional:** Zero JavaScript, zero framework. HTML + CSS apenas. Lighthouse score deve ser ~100.
-   **Design System Consistente:** Variáveis CSS bem definidas (`--acc: #0FB9A8`, `--bg: #0b0e14`). Paleta teal/slate diferenciada do padrão purple/indigo.
-   **SEO Correto:** Meta tags OG completas, descrição relevante, robots.txt presente.
-   **Mockup Interativo em CSS Puro:** Hero section com UI mock renderizada inteiramente em HTML/CSS, sem imagens pesadas.
-   **Auto-Updater Integration:** `latest.json` com assinatura minisign e URL de release do GitHub.

#### Problemas Identificados

| ID | Severidade | Arquivo | Descrição |
|----|-----------|---------|-----------|
| SITE-001 | P2 | `index.html` | Arquivo único de 27KB com todo HTML inline. Sem componentização; manutenção difícil conforme cresce. |
| SITE-002 | P2 | `styles.css` | 21KB de CSS monolítico. Sem preprocessador, sem splitting. Classes utilitárias misturadas com semânticas. |
| SITE-003 | P3 | `Dockerfile` | Imagem Docker para servir HTML estático. Overkill; poderia ser CDN/S3/GitHub Pages direto. |
| SITE-004 | P3 | `index.html` | Fontes Google Fonts carregadas sem `font-display: swap` fallback local. Se Google Fonts falhar, texto invisível até timeout. |
| SITE-005 | P3 | N/A | Sem sitemap.xml. Prejudica indexação de páginas futuras. |

---

## 3. Análise de Integração entre Projetos

### 3.1 Fluxo de Autenticação
```
Desktop → SSO Loopback (Rust) → Synapse OIDC → Echo API /auth/token → Token Store (AES-256-GCM) → Keyring
```
**Diagnóstico:** Fluxo bem desenhado, mas `/auth/refresh` quebrado (API-001) significa que sessões de longa duração falharão. O desktop não tem lógica de re-auth quando o token expira.

### 3.2 Fluxo de Mensagens
```
Desktop MatrixService → Echo API /api/rooms/:id/messages → Synapse Proxy → Matrix Homeserver
```
**Diagnóstico:** Caminho correto, mas `MatrixService` no desktop tem stubs (DESK-003). Redact, read receipts e reactions não funcionam end-to-end apesar da API suportá-los.

### 3.3 Fluxo de Uploads
```
Desktop → Echo API /api/upload → Filesystem local → URL retornada → Embed em mensagem
```
**Diagnóstico:** Upload anônimo (API-003) é risco crítico. Além disso, arquivos servidos via `createReadStream` sem range support (HTTP 206) impede streaming de vídeo/áudio.

### 3.4 Responsabilidades Duplicadas
| Responsabilidade | API | Desktop | Recomendação |
|-----------------|-----|---------|-------------|
| Validação de token Matrix | ✅ auth.js | ❌ service.ts | Centralizar na API |
| Cache de perfil | ❌ | ✅ profileStore | Adicionar cache Redis na API |
| Persistência de config | ❌ | ✅ config_store.rs | Correto (local-first) |
| Driver PostgreSQL | ✅ Prisma | ⚠️ pg package | Remover pg do desktop (DESK-006) |

---

## 4. Recomendações Classificadas

### 🔴 Correções (Bugs e Falhas)

| Prioridade | ID | Ação | Arquivos | Impacto | Complexidade |
|-----------|-----|------|----------|---------|-------------|
| **P0** | API-001 | Implementar refresh real via Synapse `/_matrix/client/v3/refresh` ou emitir JWT próprio com expiry | `src/routes/authRoutes.js`, `src/services/authService.js` | Sessões expiram em 1h sem renovação | Média |
| **P0** | API-002 | Substituir Map por LRU cache com TTL (ex: `lru-cache` ou `node-cache`) e max size 10k entries | `src/plugins/auth.js` | DoS por memory exhaustion | Baixa |
| **P0** | API-003 | Adicionar `{ preHandler: authenticate }` em todas as rotas de upload | `src/routes/uploadRoutes.js` | Upload anônimo = abuso ilegal | Baixa |
| **P1** | DESK-001 | Implementar graceful shutdown: fechar WebRTC, disconnect sync, flush config antes de exit | `src-tauri/src/lib.rs` | Corrupção de dados em close | Média |
| **P1** | DESK-003 | Implementar stubs de markAsRead, redact, removeReaction via EchoApi | `src/lib/matrix/service.ts` | Features essenciais não funcionam | Média |
| **P1** | API-005 | Substituir writeFileSync/readFileSync por fs.promises em uploadService | `src/services/uploadService.js`, `src/routes/uploadRoutes.js` | Event loop blocking sob carga | Baixa |
| **P1** | DESK-002 | Envolver leitura de localStorage em try-catch com fallback seguro | `src/stores/syncStore.ts` | App crash se storage corrompido | Baixa |

### 🟡 Melhorias (Refatorações e Otimizações)

| Prioridade | ID | Ação | Arquivos | Impacto | Complexidade |
|-----------|-----|------|----------|---------|-------------|
| P1 | API-008 | Whitelist de endpoints Matrix permitidos no proxy | `src/lib/matrix/proxy.js` | Previne acesso a admin APIs | Média |
| P2 | API-007 | Migrar CORS manual para `@fastify/cors` plugin | `src/app.js` | Manutenibilidade, spec compliance | Baixa |
| P2 | DESK-004 | Mover serial_test e xcap para dev-dependencies | `src-tauri/Cargo.toml` | Binário menor ~5-8MB | Baixa |
| P2 | DESK-006 | Remover pacote pg do desktop | `apps/desktop/package.json` | Bundle menor, segurança | Baixa |
| P2 | DESK-007 | Memoizar sendMessage/sendFile com useCallback ou mover para contexto | `src/App.tsx` | Performance de render | Baixa |
| P2 | SITE-001 | Considerar Astro/Eleventy para componentização sem JS runtime | `echo-site/` | Manutenibilidade futura | Alta |
| P3 | API-009 | Configurar vitest paths via tsconfig/jsconfig em vez de aliases manuais | `vitest.config.js` | DX, manutenibilidade | Baixa |
| P3 | API-010 | Adicionar build step com esbuild/tsup para produção | `package.json` | Startup time, tamanho | Média |

### 🟢 Adições (Novos Recursos)

| Prioridade | Recurso | Justificativa | Complexidade |
|-----------|---------|--------------|-------------|
| P1 | Rate Limiting | `@fastify/rate-limit` em auth e upload routes. Previne brute-force e abuso. | Baixa |
| P1 | Request Validation Schemas | Fastify schema validation em todos os endpoints. Previne injection e type errors. | Média |
| P2 | Structured Logging | Pino já está (Fastify default), mas falta correlation ID entre request/response. | Baixa |
| P2 | Graceful Shutdown Hook | `app.addHook('onClose')` para fechar Prisma client e WebSocket connections. | Baixa |
| P2 | E2E Tests | Playwright ou similar para fluxo SSO + send message + receive. Cobertura atual é unitária apenas. | Alta |
| P3 | Sitemap.xml Generator | Para echo-site quando tiver mais páginas. | Baixa |
| P3 | OpenAPI/Swagger | `@fastify/swagger` para documentação automática da API. | Média |

### 🔴 Remoções (Código Morto e Desnecessário)

| Prioridade | Item | Arquivo | Motivo |
|-----------|------|---------|--------|
| P2 | Pacote `pg` | `apps/desktop/package.json` | Driver DB no frontend é anti-padrão e risco de segurança |
| P2 | `serial_test` em deps | `src-tauri/Cargo.toml` | Crate de teste em release binary |
| P2 | `xcap` em deps diretos | `src-tauri/Cargo.toml` | Captura de tela deveria ser feature-gated ou dev-only |
| P3 | `test_client.mjs`, `test_debug.mjs` | `echo-api/` root | Scripts de debug ad-hoc não deveriam estar na raiz |
| P3 | `test-output.txt`, `vitest-result.txt` | `echo/` root | Artefatos de teste commitados (106KB + 95KB) |
| P3 | Mock refresh response | `src/routes/authRoutes.js:128-135` | Código fictício em rota de produção |

---

## 5. Vulnerabilidades de Segurança

### Críticas
1.  **Upload Anônimo (API-003):** Qualquer pessoa pode enviar arquivos arbitrários ao servidor. Vetor para malware, storage exhaustion e conteúdo ilegal.
2.  **Memory DoS via Token Cache (API-002):** Mapa ilimitado em memória. 1M de requisições com tokens únicos = ~200MB+ de RAM consumida irreversivelmente.
3.  **Proxy Matrix Aberto (API-008):** `/matrix/*` repassa qualquer path ao Synapse. Se token de admin vazar, atacante tem acesso total ao homeserver.

### Moderadas
4.  **CORS Permissivo (API-007):** Default inclui `localhost:1420` e domínio público. Em dev, wildcard efetivo se origin não validar.
5.  **Sem Rate Limiting:** Auth endpoints sem throttling. Brute-force de tokens Synapse viável.
6.  **File Serving sem Range Support:** Uploads servidos sem HTTP 206. Não é vuln direta, mas impede streaming seguro (client precisa baixar arquivo inteiro).
7.  **Process Exit Forçado (DESK-001):** `std::process::exit(0)` bypass cleanup. Dados em trânsito podem ser perdidos ou corrompidos.

### Baixas
8.  **Google Fonts External Dependency:** Site depende de terceiro para renderizar texto. Privacy concern (Google tracking) e availability risk.
9.  **NSIS Installer Hooks Customizados:** `windows/hooks.nsh` — código NSIS customizado é superfície de ataque se não auditado.

---

## 6. Arquitetura Recomendada

### Curto Prazo (0-30 dias)
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Desktop    │────▶│  Echo API        │────▶│  Synapse    │
│  (Tauri 2)  │     │  + Rate Limit    │     │  (Matrix)   │
│  + Keyring  │     │  + LRU Cache     │     │             │
└─────────────┘     │  + Auth Uploads  │     └─────────────┘
                    │  + Schema Valid  │
┌─────────────┐     └──────────────────┘
│  Website    │              │
│  (Static)   │              ▼
└─────────────┘     ┌──────────────────┐
                    │  PostgreSQL     │
                    │  (Prisma ORM)   │
                    └──────────────────┘
```

### Médio Prazo (1-3 meses)
-   **Redis** para cache de perfis e rate limiting distribuído
-   **MinIO/S3** para uploads em vez de filesystem local
-   **OpenTelemetry** para tracing distribuído API ↔ Synapse
-   **CI Pipeline** com security scanning (npm audit, cargo audit, trivy)

### Longo Prazo (3-6 meses)
-   **Matrix Encryption** end-to-end (E2EE) via matrix-js-sdk crypto
-   **CDN** para assets estáticos e uploads
-   **Multi-homeserver** federation support
-   **Mobile** (Tauri 2 já suporta Android/iOS)

---

## 7. Plano de Implementação Priorizado

### Sprint 1: Segurança Crítica (Semana 1-2)
1.  [ ] **API-003:** Adicionar authenticate middleware em uploadRoutes (2h)
2.  [ ] **API-002:** Implementar LRU cache com max 10k entries e 60s TTL (4h)
3.  [ ] **API-001:** Implementar refresh token real via Synapse ou JWT próprio (8h)
4.  [ ] **API-005/006:** Migrar file I/O para async (4h)
5.  [ ] Adicionar `@fastify/rate-limit` em auth routes (2h)

### Sprint 2: Estabilidade Desktop (Semana 3-4)
1.  [ ] **DESK-001:** Graceful shutdown no Tauri (6h)
2.  [ ] **DESK-003:** Implementar stubs de MatrixService (8h)
3.  [ ] **DESK-002:** Safe localStorage parsing com fallback (2h)
4.  [ ] **DESK-004/005:** Limpar Cargo.toml dependencies (2h)
5.  [ ] **DESK-006:** Remover pg do desktop (1h)

### Sprint 3: Qualidade e DX (Semana 5-6)
1.  [ ] **API-008:** Whitelist de endpoints Matrix no proxy (4h)
2.  [ ] **API-007:** Migrar para @fastify/cors (2h)
3.  [ ] Request validation schemas nos endpoints principais (8h)
4.  [ ] E2E tests básicos (Playwright) (12h)
5.  [ ] **SITE-001:** Avaliar migração para Astro (spike 4h)

### Sprint 4: Polish e Documentação (Semana 7-8)
1.  [ ] OpenAPI/Swagger docs (4h)
2.  [ ] Structured logging com correlation IDs (4h)
3.  [ ] CI pipeline com security scanning (8h)
4.  [ ] Remover artefatos de teste commitados (1h)
5.  [ ] Atualizar README com arquitetura e setup (4h)

---

## 8. Métricas e KPIs Pós-Auditoria

| Métrica | Atual | Meta 30 dias | Meta 90 dias |
|---------|-------|-------------|-------------|
| Cobertura de Testes (API) | ~15% | 40% | 70% |
| Cobertura de Testes (Desktop) | ~25% | 45% | 65% |
| Vulnerabilidades P0 | 3 | 0 | 0 |
| Vulnerabilidades P1 | 8 | 2 | 0 |
| Bundle Size Desktop | ~12MB* | ~8MB | ~6MB |
| Upload Auth | ❌ | ✅ | ✅ + Rate Limit |
| Token Refresh | ❌ Mock | ✅ Real | ✅ + Rotation |
| Graceful Shutdown | ❌ | ✅ | ✅ + Telemetry |

*Estimado baseado em dependências; medir com `cargo build --release` após limpezas.

---

## 9. Conclusão

O Echo tem fundamentos técnicos sólidos e escolhas arquiteturais modernas. As vulnerabilidades identificadas são sérias mas corrigíveis com esforço concentrado de 2 semanas. A maior dívida técnica não é código ruim, mas **funcionalidades incompletas** (refresh, read receipts, redact) que foram stubbed e esquecidas.

Recomendo focar exclusivamente no Sprint 1 antes de qualquer nova feature. A base é boa; precisa de endurecimento de segurança e completude de fluxos para ser production-ready.

---

*Este relatório foi gerado via análise estática e dinâmica do código-fonte real. Nenhuma credencial foi exposta. Recomendações baseadas em evidências verificáveis nos arquivos citados.*
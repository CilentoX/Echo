# 🗺️ Roadmap Echo — Correções e Melhorias

> Planejamento estratégico para evolução do Echo em 4 fases priorizadas.
> Última atualização: 2026-11-10

---

## 📊 Status Atual (Diagnóstico)

### ✅ Pontos Fortes
- **Arquitetura moderna**: Tauri v2 (Rust) + React 19 + Matrix Synapse + Fastify
- **Self-hosted e open-source**: controle total dos dados
- **SSO via Google OIDC** bem implementado (loopback listener)
- **SSE para voz em tempo real** (<20ms latency)
- **Convites HTML bonitos** com deep link `echo://invite/`
- **Keyring nativo** para armazenamento seguro de tokens
- **Schema Prisma bem modelado** (guildas, canais, cargos, amizades)

### ⚠️ Gaps Críticos Identificados
1. **Sem E2EE** — Matrix suporta criptografia ponta-a-ponta, mas não está habilitada
2. **WebRTC mesh** não escala além de ~6 peers por canal de voz
3. **Sem observabilidade** — logs estruturados, métricas, tracing
4. **Push-to-talk sem global shortcut** — precisa focar na janela
5. **Rate limiting genérico** — 300 req/min global, sem granularidade por endpoint
6. **Sem documentação OpenAPI/Swagger** — rotas difíceis de consumir
7. **Sem circuit breaker** em chamadas externas (Matrix proxy)
8. **Tipagem fraca** em algumas rotas Fastify (sem TypeBox/JSON Schema)
9. **Sem testes E2E** — apenas unitários isolados
10. **Heartbeat de voz agressivo** (2s) pode sobrecarregar API em guildas grandes

### 🔧 Plugins Instalados para Acelerar
| Plugin | Uso no Roadmap |
|---|---|
| **superpowers** | TDD e debugging sistemático em todas as fases |
| **frontend-design** | Fases 1 e 3 (UI polish, design system) |
| **design** | Fase 3 (acessibilidade, design system) |
| **backend-design** | Fases 2 e 3 (padrões Fastify/Prisma) |
| **audit-suite** | Code review em toda PR |
| **cto-toolkit** | Fase 3 (arquitetura SFU/microserviços) |
| **software-framework** | Debugging científico de bugs complexos |
| **prism** | Conventional commits e PR workflow |

---

## 🚀 Fase 1 — Quick Wins (1-2 semanas)

> **Objetivo**: Melhorias de baixo esforço com impacto imediato em UX e estabilidade.

### 1.1 🎨 UI/UX Polish
- [ ] **Correção do layout de bolhas** em telas <1200px (responsividade)
- [ ] **Skeleton loaders** em listas de guildas/canais ao fazer sync
- [ ] **Toasts de erro** mais informativos (traduzir erros Matrix para PT-BR)
- [ ] **Indicador de digitação** (typing indicator) em canais de texto
- [ ] **Preview de imagens** antes do envio (confirmar upload >5MB)

**Plugin recomendado**: `frontend-design` + `design`

### 1.2 ⚡ Performance Frontend
- [ ] **Virtualização** da lista de mensagens com `@tanstack/react-virtual` (>1000 msgs)
- [ ] **Lazy loading** de imagens/vídeos com `IntersectionObserver`
- [ ] **Memoização** de componentes pesados (MessageBubble, RichEmbed)
- [ ] **Bundle splitting** por feature (voice, chat, guilds)

### 1.3 🛡️ Quick Security
- [ ] **Validação Zod/TypeBox** em todos os inputs do usuário
- [ ] **Sanitização HTML** rigorosa em mensagens Markdown (DOMPurify)
- [ ] **Limite de tamanho** em uploads (10MB já ok, mas validar no frontend também)
- [ ] **Expiração de tokens** — renovar automaticamente antes do vencimento

**Plugin recomendado**: `backend-design` (security reflexes)

### 1.4 🎤 Voice Channel Quick Fixes
- [ ] **Indicador visual claro** de quem está falando (speaking ring animado)
- [ ] **Mute/deafen feedback** — tooltip explicando o estado
- [ ] **Auto-reconnect** quando conexão SSE cair
- [ ] **Toast de entrada/saída** de participantes (com som opcional)

---

## 🛠️ Fase 2 — Fortalecimento (2-4 semanas)

> **Objetivo**: Estabilidade e qualidade de código.

### 2.1 🧪 Testing
- [ ] **Testes E2E** com Playwright (login, criar guilda, entrar em canal)
- [ ] **Testes de integração** Fastify + Supertest (fluxos completos)
- [ ] **Coverage mínimo 80%** em services críticos (auth, guild, voice)
- [ ] **Mutation testing** com Stryker para validar qualidade dos testes
- [ ] **CI matrix** — testar em Windows, Linux, macOS

**Plugin recomendado**: `superpowers` (TDD discipline)

### 2.2 📚 Documentation
- [ ] **OpenAPI/Swagger** para todas as rotas echo-api (`@fastify/swagger`)
- [ ] **ADR (Architecture Decision Records)** para decisões importantes
- [ ] **Storybook** para componentes React
- [ ] **Guia de contribuição** (CONTRIBUTING.md)
- [ ] **Changelog automatizado** com semantic-release

**Plugin recomendado**: `prism` (conventional commits)

### 2.3 🔌 Resilience
- [ ] **Circuit breaker** em chamadas ao Synapse (`@fastify/circuit-breaker`)
- [ ] **Retry com backoff exponencial** em falhas transitórias
- [ ] **Queue de mensagens offline** — sync quando reconectar
- [ ] **Graceful degradation** — UI funciona mesmo sem API (cached data)

### 2.4 ⌨️ Global Shortcuts
- [ ] **Push-to-talk global** com `@tauri-apps/plugin-global-shortcut`
- [ ] **Mute/deafen global** — atalhos funcionam fora da janela
- [ ] **Atalhos personalizáveis** pelo usuário
- [ ] **Overlay de status** quando mutado fora da janela

**Plugin recomendado**: `cto-toolkit` (Rust/Tauri skills)

---

## 🏗️ Fase 3 — Evolução Arquitetural (1-2 meses)

> **Objetivo**: Escalabilidade, segurança avançada e novas capacidades.

### 3.1 🔐 End-to-End Encryption (E2EE)
- [ ] **Habilitar Matrix E2EE** em DMs privadas
- [ ] **Cross-signing** para verificação de dispositivos
- [ ] **Backup de chaves** no keyring do SO
- [ ] **UI de verificação** de sessões (emoji comparison)
- [ ] **Indicadores visuais** de salas encriptadas (cadeado verde)

**Referência**: Matrix SDK Crypto, Olm/Megolm protocols

### 3.2 🎙️ SFU (Selective Forwarding Unit)
- [ ] **Substituir mesh WebRTC** por SFU para escalar >6 peers
- [ ] **Avaliar LiveKit** vs **mediasoup** vs **ion-sfu**
- [ ] **Deploy dedicado** no Coolify (serviço separado)
- [ ] **Fallback para mesh** em chamadas pequenas (<4 peers)
- [ ] **Simulcast** — qualidade adaptativa por banda

**Plugin recomendado**: `cto-toolkit` (architecture decisions)

### 3.3 🎨 Design System
- [ ] **Tokens de design** centralizados (cores, spacing, typography)
- [ ] **Componentes Radix customizados** — Echo UI kit
- [ ] **Temas customizáveis** — dark/light + guild themes
- [ ] **Acessibilidade WCAG 2.1 AA** — navegação por teclado, screen readers
- [ ] **i18n** — suporte a múltiplos idiomas (i18next)

**Plugin recomendado**: `design` + `frontend-design`

### 3.4 📱 Mobile & Multi-Platform
- [ ] **Tauri Mobile** — build para Android/iOS
- [ ] **PWA** — versão web instalável
- [ ] **Sync cross-device** — histórico, settings, presença
- [ ] **Notificações push** nativas (iOS/Android)

### 3.5 🤖 Bots & Integrações
- [ ] **API de bots** — webhooks para integrações
- [ ] **Slash commands** customizáveis
- [ ] **Integrações** — GitHub, Jira, YouTube, Spotify
- [ ] **App directory** — marketplace de bots

---

## 🌟 Fase 4 — Diferenciais Competitivos (2-3 meses)

> **Objetivo**: Features únicas que diferenciam o Echo de Discord/Slack.

### 4.1 🧠 AI-Native Features
- [ ] **Resumo automático** de threads longas (Claude/GPT integration)
- [ ] **Tradução em tempo real** de mensagens
- [ ] **Transcrição de voz** com whisper.cpp local
- [ ] **Moderação assistida** por IA (detecção de spam/toxicidade)
- [ ] **Assistente pessoal** — "Echo, agende uma reunião amanhã às 15h"

### 4.2 🎮 Gaming & Streaming
- [ ] **Screen share com áudio** do sistema
- [ ] **Picture-in-picture** persistente
- [ ] **Streaming de baixa latência** (<500ms) para espectadores
- [ ] **Integração com Twitch/YouTube** — sync de chat
- [ ] **Game detection** — mostrar "Jogando X" automaticamente

### 4.3 🏢 Enterprise Features
- [ ] **SSO corporativo** — SAML, Azure AD, Okta
- [ ] **Audit logs** — trilha de auditoria para compliance
- [ ] **Data residency** — escolher região do servidor
- [ ] **DLP (Data Loss Prevention)** — bloquear envio de dados sensíveis
- [ ] **Admin console** — painel de gestão centralizado

### 4.4 🌐 Federation & Interop
- [ ] **Bridge com Slack** — mensagens bidirecionais
- [ ] **Bridge com Discord** — sync de canais específicos
- [ ] **Bridge com Telegram/WhatsApp** — DMs cross-platform
- [ ] **ActivityPub** — federação com Mastodon/Lemmy
- [ ] **XMPP gateway** — interoperabilidade legada

### 4.5 🔮 Experimental
- [ ] **Voice cloning** para TTS personalizado (ElevenLabs)
- [ ] **Spatial audio** — som 3D em canais de voz
- [ ] **AR/VR rooms** — Apple Vision Pro, Meta Quest
- [ ] **Blockchain identity** — DID para autenticação descentralizada
- [ ] **Local-first architecture** — CRDTs para sync offline robusto

---

## 📈 Critérios de Sucesso por Fase

### Fase 1 — Quick Wins
- [ ] Lighthouse score >90 em performance
- [ ] Zero crashes em sessão de 1 hora
- [ ] Tempo de carregamento inicial <2s
- [ ] NPS >50 em pesquisa com usuários beta

### Fase 2 — Fortalecimento
- [ ] Coverage >80% em código crítico
- [ ] P95 latency API <200ms
- [ ] Zero regressões em testes E2E por 2 semanas consecutivas
- [ ] Documentação OpenAPI cobrindo 100% das rotas

### Fase 3 — Evolução
- [ ] Suporte a 50+ peers em voice channel (SFU)
- [ ] E2EE habilitado em 100% das DMs
- [ ] 3+ temas customizáveis
- [ ] 5+ integrações externas funcionando

### Fase 4 — Diferenciais
- [ ] 1 feature AI-native em produção
- [ ] 1 bridge com plataforma externa ativa
- [ ] Mobile apps publicados nas stores
- [ ] 1000+ DAU (daily active users)

---

## 🎯 Próximas Ações Imediatas (Esta Semana)

1. **Priorizar Fase 1** — escolher 3 quick wins para atacar
2. **Configurar CI/CD** — GitHub Actions para build + test automático
3. **Criar branch `feat/roadmap-2026-q4`** para work organizado
4. **Agendar review semanal** — 30min toda sexta para revisar progresso
5. **Abrir issues granulares** — cada checkbox vira uma issue no GitHub

### Sugestão de Ordem de Ataque
```
Semana 1:  1.2 (Performance) + 1.3 (Security)
Semana 2:  1.1 (UI) + 1.4 (Voice fixes)
Semana 3:  2.1 (Testing) + 2.2 (Docs)
Semana 4:  2.3 (Resilience) + 2.4 (Global shortcuts)
Mês 2:     Início Fase 3
```

---

## 📚 Referências & Recursos

### Matrix & E2EE
- [Matrix Spec - E2EE](https://spec.matrix.org/v1.9/client-server-api/#end-to-end-encryption)
- [matrix-rust-sdk crypto](https://github.com/matrix-org/matrix-rust-sdk)
- [Matrix Encryption Primer](https://matrix.org/docs/guides/e2e-encryption)

### WebRTC & SFU
- [LiveKit Docs](https://docs.livekit.io/)
- [mediasoup Architecture](https://mediasoup.org/documentation/v3/)
- [ion-sfu](https://github.com/pion/ion-sfu)

### Tauri v2
- [Tauri Plugin System](https://v2.tauri.app/develop/plugins/)
- [Awesome Tauri](https://github.com/tauri-apps/awesome-tauri)
- [Global Shortcut Plugin](https://github.com/tauri-apps/plugins-workspace/tree/v2/packages/global-shortcut)

### Fastify
- [Fastify Ecosystem](https://fastify.dev/ecosystem/)
- [Type Provider TypeBox](https://fastify.dev/docs/latest/Reference/Type-Providers/)
- [Circuit Breaker Plugin](https://github.com/fastify/fastify-circuit-breaker)

### Testing
- [Playwright Docs](https://playwright.dev/)
- [Vitest Guide](https://vitest.dev/guide/)
- [Stryker Mutator](https://stryker-mutator.io/)

### Observability
- [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/)
- [Prometheus Fastify](https://github.com/jeromenerf/fastify-prometheus)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)

---

## 📝 Como Usar Este Roadmap

1. **Revisão mensal**: atualizar checkboxes concluídos
2. **Issue por tarefa**: cada `- [ ]` vira uma issue no GitHub
3. **Labels semânticas**: `phase-1`, `phase-2`, `quick-win`, `breaking-change`
4. **Milestones por fase**: Q4-2026-Phase-1, Q1-2027-Phase-2, etc.
5. **Celebra marcos**: cada fase concluída merece um blog post/changelog

---

*Este roadmap é um documento vivo. Atualize conforme prioridades mudam e aprendizados surgem.*

**Última revisão**: 2026-11-10 por Lucas Cilento + Claude
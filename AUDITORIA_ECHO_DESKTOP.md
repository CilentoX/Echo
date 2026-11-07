# Auditoria Técnica — Echo Desktop (Tauri 2)

**Data:** 2026-11-07  
**Escopo:** `apps/desktop` (frontend React + backend Rust/Tauri)  
**Versão:** 0.1.16  
**Arquivos analisados:** 244 arquivos fonte, 71 testes, 6 módulos Rust

---

## 1. Resumo Executivo

O Echo Desktop demonstra uma arquitetura Tauri 2 madura com escolhas técnicas sólidas: keyring nativo para credenciais, config store atômico em Rust, SSO loopback seguro e Zustand v5 correto. O sistema de hidratação offline-first via `desktopStorage` é um diferencial arquitetural forte.

No entanto, a auditoria identificou **3 problemas críticos (P0)**, **5 problemas de alta prioridade (P1)** e diversas oportunidades de otimização. Os riscos mais urgentes são:

1. **Mismatch Keyring TS↔Rust:** O frontend envia 6 parâmetros (`userId`, `token`, `refreshToken`, `deviceId`, `apiBaseUrl`, `expiresAt`) mas o Rust aceita apenas 2 (`user_id`, `token`). Os campos extras são silenciosamente ignorados, tornando refresh token, device ID e expiry invisíveis ao sistema de persistência.
2. **Comandos Keyring Genéricos Inexistentes:** O frontend chama `set_item`, `get_item`, `remove_item` via `invoke()` mas esses comandos **não existem** no `lib.rs`. A função `useKeyring.setItem("echo:session", ...)` na `MatrixService.loginWithCode()` falha silenciosamente.
3. **Polling Loop Agressivo:** O sync usa `setInterval(4000ms)` chamando `loadOlder()` a cada 4 segundos no canal ativo. Sem cursor/paginação, isso gera requisições redundantes e risco de duplicação de eventos sob latência.

A base é production-ready para funcionalidades core (login, mensagens, voz). Os gaps estão na persistência completa de sessão e na eficiência do sync.

---

## 2. Pontos Fortes da Arquitetura

### 2.1 Segurança e Credenciais
- **Keyring Nativo:** Tokens armazenados via Windows Credential Manager (`keyring` crate), nunca em localStorage ou plaintext.
- **SSO Loopback Seguro:** Listener HTTP one-shot em `127.0.0.1:1421` com timeout de 5 min, abort de listeners anteriores e validação de estado.
- **CSP Restritiva:** `default-src 'self'; script-src 'self'` — sem eval, sem inline scripts.
- **Single Instance:** Plugin previne múltiplas instâncias; traz janela existente ao focar via link `echo://invite/`.

### 2.2 Performance e UX
- **Hidratação Offline-First:** `desktopStorage.hydrateStoresFromLocal()` popula stores instantaneamente no boot antes de qualquer request de rede.
- **Config Store Atômico:** Escrita em `.tmp` + rename em Rust garante integridade contra crashes.
- **Zustand v5 Correto:** Uso de `Object.freeze([])` para snapshots vazios evita loops infinitos do `useSyncExternalStore`.
- **WebView2 Flags Inteligentes:** Detecção de idioma do SO para auto-seleção de fonte de captura sem diálogo nativo.

### 2.3 Voz e Mídia
- **WebRTC Completo:** Implementação real com ICE candidates, offer/answer, VAD via AnalyserNode e heartbeat de presença.
- **Captura de Tela Nativa:** `xcap` crate com `spawn_blocking` para enumeração de monitores/janelas sem bloquear async runtime.
- **Sinalização via Echo API:** `sendVoiceSignal` integrado ao backend para troca de SDP/candidates.

### 2.4 Testes
- **71 arquivos de teste** cobrindo stores, componentes e serviços.
- **Testes Rust reais** no `keyring_cmds.rs` com roundtrip no Credential Manager.

---

## 3. Problemas Identificados

### 🔴 Críticos (P0)

| ID | Arquivo | Descrição | Impacto | Evidência |
|----|---------|-----------|---------|-----------|
| DESK-P0-001 | `src/lib/storage/keyring.ts:14-24` + `src-tauri/src/keyring_cmds.rs:38-40` | **Mismatch de parâmetros:** Frontend envia `{userId, token, refreshToken, deviceId, apiBaseUrl, expiresAt}` mas Rust `store_token(user_id, token)` aceita apenas 2 args. Campos extras são descartados silenciosamente pelo Tauri. | Refresh token nunca persiste → sessões expiram sem renovação. Device ID perdido → histórico de dispositivos quebrado. Expiry ignorado → cliente não sabe quando renovar proativamente. | `invoke("store_token", { userId, token, refreshToken, deviceId, apiBaseUrl, expiresAt })` vs `pub fn store_token(user_id: &str, token: &str)` |
| DESK-P0-002 | `src/lib/storage/keyring.ts:68-88` + `src-tauri/src/lib.rs` | **Comandos genéricos inexistentes:** `set_item`, `get_item`, `remove_item` chamados via `invoke()` não estão registrados no `invoke_handler`. `useKeyring.setItem("echo:session", ...)` em `MatrixService.loginWithCode()` falha silenciosamente (catch vazio). | Sessão salva via `MatrixService.loginWithCode()` não persiste. Usuário perde login após restart se usar fluxo alternativo. | `grep "set_item\|get_item\|remove_item" lib.rs` retorna vazio. `catch {}` engole erro. |
| DESK-P0-003 | `src/lib/matrix/wiring.ts:123-166` | **Polling agressivo sem cursor:** `setInterval(4000ms)` chama `loadOlder(activeChannelId, 20)` a cada 4s. Sem token `from`/cursor, retorna os mesmos eventos repetidamente. Dedupe por `eventId` previne corrupção mas gera tráfego desnecessário. | ~900 req/hora por canal ativo. Sob latência >4s, requests acumulam. Bateria/CPU em mobile. Rate limit risk no Synapse. | `matrixService.loadOlder(activeChannelId, 20)` sem parâmetro `from`. Interval fixo 4000ms. |

### 🟡 Alta Prioridade (P1)

| ID | Arquivo | Descrição | Impacto | Complexidade |
|----|---------|-----------|---------|-------------|
| DESK-P1-001 | `src-tauri/src/lib.rs:157-160` | **Exit forçado sem cleanup:** `WindowEvent::CloseRequested` chama `std::process::exit(0)`. WebRTC peers, WebSocket sync, file writes atômicos e VAD intervals são terminados abruptamente. | Corrupção potencial de config.json/cache.json em escrita. Peers órfãos no servidor de voz. | Média |
| DESK-P1-002 | `src/App.tsx:8-12` | **Funções soltas fora de hook:** `sendMessage` e `sendFile` definidas como arrow functions no módulo scope. Recriadas a cada render do `Shell` component, causando re-renders desnecessários em children que as recebem como props. | Performance de render degradada em chats longos. | Baixa |
| DESK-P1-003 | `src/stores/syncStore.ts:130-155` | **localStorage parsing no módulo top-level:** `pinnedByRoom`, `mutedChannels`, `mutedGuilds`, `guildEmojis`, `guildCategories` lidos com `JSON.parse(localStorage.getItem(...))` durante import. Se localStorage estiver corrompido, store falha na inicialização e app crasha. | App não abre se storage corrompido. Try-catch existe mas retorna `{}` — perda silenciosa de dados do usuário. | Baixa |
| DESK-P1-004 | `src/lib/matrix/service.ts:95-110` | **Stubs no-op:** `removeReaction`, `markAsRead`, `redact` são métodos vazios ou delegam incorretamente. Funcionalidades essenciais de chat não funcionam end-to-end. | Usuário não pode desmarcar leitura, remover reações ou deletar mensagens próprias. UI mostra botões que não fazem nada. | Média |
| DESK-P1-005 | `package.json` | **Driver `pg` (^8.23.1) em dependencies:** Pacote PostgreSQL no bundle do desktop. `grep` confirma zero imports reais no src — é dependência fantasma. | Bundle inflado ~2-3MB. Superfície de ataque desnecessária. Confusão arquitetural (DB é responsabilidade da API). | Baixa |

### 🟢 Média/Baixa Prioridade (P2-P3)

| ID | Severidade | Arquivo | Descrição |
|----|-----------|---------|-----------|
| DESK-P2-001 | P2 | `Cargo.toml` | `serial_test = "3"` em `[dependencies]` em vez de `[dev-dependencies]`. Crate de teste em binário release. |
| DESK-P2-002 | P2 | `Cargo.toml` | `xcap = "0.9.8"` como dep direta (~5MB). Deveria ser feature-gated ou dev-only se só usada em capturer. |
| DESK-P2-003 | P2 | `src/lib/matrix/wiring.ts:42` | `pollingTimer` global sem cleanup em hot-reload dev. Múltiplos timers acumulam em HMR. |
| DESK-P2-004 | P2 | `tauri.conf.json` | Falta permissão `dialog:default` para save/open file dialogs nativos. Uploads usam input HTML fallback. |
| DESK-P3-001 | P3 | `src/stores/voiceStore.ts` | `connectVoice` calcula ping como `18 + Math.random() * 12` — valor fictício. Deveria medir RTT real via WebRTC stats. |
| DESK-P3-002 | P3 | `src/lib/media/webrtcVoice.ts:28-35` | STUN servers hardcoded (Google, Cloudflare, Mozilla). Deveriam vir de config/env para permitir TURN privado. |
| DESK-P3-003 | P3 | Vários stores | Padrão Zustand inconsistente: alguns usam `create<State>()((set, get) => ...)` (v5 correto), outros ainda têm padrões v4. |

---

## 4. Análise de Integração Frontend ↔ Backend Rust

### 4.1 Contrato Keyring (QUEBRADO)

```
Frontend (keyring.ts)          Backend (keyring_cmds.rs)
─────────────────────          ─────────────────────────
invoke("store_token", {        pub fn store_token(
  userId,                        user_id: &str,
  token,                         token: &str
  refreshToken,    ← PERDIDO   )
  deviceId,        ← PERDIDO
  apiBaseUrl,      ← PERDIDO
  expiresAt        ← PERDIDO
})
```

**Correção necessária:** Expandir `StoredToken` struct e `store_token` para aceitar todos os campos, ou serializar como JSON no campo `token`.

### 4.2 Comandos Faltantes

O frontend espera uma interface key-value genérica (`set_item`/`get_item`/`remove_item`) que não existe no backend. Duas opções:
1. **Implementar no Rust** como wrapper sobre keyring com service dinâmico.
2. **Remover do frontend** e usar apenas `store_token`/`load_token`/`clear_token` tipados.

Recomendação: Opção 2. A interface genérica é desnecessária dado que apenas tokens de sessão são persistidos no keyring. Config/cache já usam `config_store.rs`.

### 4.3 Sync Architecture

```
wiring.ts pollingLoop (4s)
    ↓
matrixService.loadOlder(channelId, 20)
    ↓
echoApi.loadOlder(roomId, limit)
    ↓
Echo API → Synapse /messages?limit=20
    ↓
applyEvent() com dedupe por eventId
```

**Problema:** Sem parâmetro `from` (pagination token), Synapse retorna sempre as últimas 20 mensagens. O dedupe previne duplicação visual mas não evita o tráfego redundante.

**Correção:** Armazenar `oldestEventId` por canal no syncStore e passar como `from` no próximo poll. Ou migrar para WebSocket sync real quando o backend suportar.

---

## 5. Plano de Implementação Priorizado

### Sprint 1: Correções Críticas (Semana 1)

| # | Ação | Arquivos | Tempo Est. |
|---|------|----------|-----------|
| 1 | Expandir `StoredToken` e `store_token` para aceitar refreshToken, deviceId, apiBaseUrl, expiresAt | `keyring_cmds.rs`, `keyring.ts` | 3h |
| 2 | Remover `set_item`/`get_item`/`remove_item` do frontend; usar apenas comandos tipados | `keyring.ts`, `service.ts` | 2h |
| 3 | Adicionar cursor `from` ao polling loop; armazenar oldestEventId por canal | `wiring.ts`, `syncStore.ts` | 4h |
| 4 | Implementar graceful shutdown no Tauri (fechar WebRTC, flush config, disconnect sync) | `lib.rs` | 4h |

### Sprint 2: Estabilidade e Performance (Semana 2)

| # | Ação | Arquivos | Tempo Est. |
|---|------|----------|-----------|
| 5 | Memoizar `sendMessage`/`sendFile` com `useCallback` ou mover para contexto | `App.tsx` | 1h |
| 6 | Envolver localStorage parsing em try-catch robusto com migration/fallback | `syncStore.ts` | 2h |
| 7 | Implementar stubs reais de `markAsRead`, `redact`, `removeReaction` via EchoApi | `service.ts` | 4h |
| 8 | Remover `pg` do package.json | `package.json` | 30min |
| 9 | Mover `serial_test` para dev-dependencies | `Cargo.toml` | 30min |

### Sprint 3: Polish (Semana 3)

| # | Ação | Arquivos | Tempo Est. |
|---|------|----------|-----------|
| 10 | Adicionar permissão `dialog:default` no capabilities | `default.json` | 30min |
| 11 | Extrair STUN servers para config/env | `webrtcVoice.ts`, `desktopConfig.ts` | 1h |
| 12 | Medir ping real via WebRTC RTCPeerConnection.getStats() | `voiceStore.ts`, `webrtcVoice.ts` | 3h |
| 13 | Cleanup de pollingTimer em HMR/dev mode | `wiring.ts` | 1h |

---

## 6. Métricas Pós-Correção

| Métrica | Atual | Meta Sprint 1 | Meta Sprint 3 |
|---------|-------|--------------|--------------|
| Persistência de Refresh Token | ❌ Perdido | ✅ Completo | ✅ + Rotação |
| Comandos Keyring Faltantes | 3 missing | 0 | 0 |
| Req/hora por canal (polling) | ~900 | ~50 (com cursor) | ~10 (WebSocket) |
| Graceful Shutdown | ❌ exit(0) | ✅ Cleanup completo | ✅ + Telemetry |
| Bundle Size (estimado) | ~12MB | ~10MB (-pg) | ~8MB (-xcap feat) |
| Stubs MatrixService | 3 no-op | 0 | 0 |
| Cobertura de Testes | 71 arquivos | 75+ | 85+ |

---

## 7. Conclusão

O Echo Desktop tem uma base arquitetural **sólida e acima da média** para um projeto Tauri 2. As escolhas de keyring nativo, config store atômico, hidratação offline-first e WebRTC real demonstram maturidade técnica.

Os 3 problemas P0 são **bugs de integração frontend↔backend** (contrato keyring quebrado, comandos faltantes, polling sem cursor) — não falhas de design. São corrigíveis em ~13 horas de trabalho concentrado.

Após o Sprint 1, o Echo Desktop estará pronto para uso em produção com funcionalidades core confiáveis. Os sprints subsequentes são polish e otimização, não correções de sobrevivência.

---

*Este relatório foi gerado via análise estática do código-fonte real. Nenhuma credencial foi exposta. Todas as evidências são verificáveis nos arquivos citados.*
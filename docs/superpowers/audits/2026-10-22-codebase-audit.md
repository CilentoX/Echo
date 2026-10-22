# Auditoria do Codebase Eco — 2026-10-22

Fonte: auditoria completa de apps/desktop/src (explorer subagent). Relatório fiel abaixo.

## Resumo dos fluxos

### 1. Boot/Sessão
App.tsx → SessionGate → loadSession (keyring/Rust) → enterShell → matrixService.restoreSession → setMyUserId → startSyncWiring → startClient → AppShell.
- Token inválido no boot: coberto (M_UNKNOWN_TOKEN/M_MISSING_TOKEN pré-primeiro-sync → rejectSession → login).
- Rede cai: coberto (SyncStatusIndicator "Reconectando…").
- **BUG B1**: erro de auth APÓS primeiro sync nunca desloga (`wiring.ts:81` exige `!hasSynced`).
- **BUG B2**: logout inexistente — "Sair da conta" em Settings.tsx:323 não tem onClick; stopSyncWiring/clearSession só chamados de SessionGate.tsx:34-38.
- keyring.ts:20-29: deviceId nunca persistido (null), refreshToken não salvo.

### 2. Updater
runStartupUpdateCheck → beginCheck → checkPluginUpdate → [update? beginDownload → downloadAndInstall → markReady] — senão nada.
- **BUG B3**: sem update, `!update → return false` sem reset() (updater.ts:21) → banner "Verificando atualizações…" infinito (reportado pelo usuário).
- Sem progresso de download (sem callback onProgress); falha de download 100% silenciosa.

### 3. Guilda/Canais
Primeiro syncing → loadInitialData → listGuilds → setGuilds; troca de guilda → subscribe → listChannels.
- **BUG B4 (reportado "nome bugado ao reinstalar")**: createGuild (service.ts:158-163) grava m.room.name via createRoom({name}); listGuilds (service.ts:144) lê m.space.name ?? room.roomId → após relogin, rail mostra o room ID bruto. editGuild (service.ts:190-195) escreve m.space.name — dois campos de nome divergentes.
- **BUG B5**: canal criado não aparece na sidebar — ChannelSidebar.tsx:161-163 só setActiveChannel, nunca setChannels; wiring.ts:29 loadedGuilds bloqueia refetch.
- Sem listeners de Room.name/RoomState — nomes de outros dispositivos nunca atualizam (initialDataLoaded congela tudo).
- unreadCount de guilda = contador da room Space, não agrega canais, congelado pós-boot.
- EditGuildModal: useState(guild.name) inicializa 1× → nome stale ao reabrir (linha 16); "Deletar guilda" (104-111) faz nada.
- Busca de canais (ChannelSidebar.tsx:106-111) é input sem filtro (UI morta).

### 4. Chat
Room.timeline → normalizeTimelineEvent (só m.room.message com body string) → applyEvent (dedupe eventId) → timelineByChannel → ChatPane → groupMessages (gap 5min) → MessageBubble.
- Envio otimista OK (pending-* → resolvePending/removePending + rollback com draft restaurado).
- **BUG B6**: NENHUM histórico carrega — sem scrollback/paginação; só eventos live; canal antigo aparece vazio ("Nenhuma mensagem ainda").
- **BUG B7**: ChatPane aninhado — shell/ChatPane.tsx:72 tem overflow-y-auto próprio + features/chat/ChatPane.tsx com scroll container interno; scrollRef interno inerte → auto-scroll não rola, composer rola junto. Duplicação de channelName.
- **BUG B8**: reações 100% locais (useState em ChatPane.tsx:79-87); m.reaction nunca enviado/agregado; normalizeTimelineEvent descarta.
- **BUG B9**: typing é mock — App.tsx:15 `TYPING_USERS: string[] = []`; sem sendTyping/listener.
- **BUG B10**: m.room.redaction/m.replace/m.image/m.file ignorados (service.ts:259-272); mensagens apagadas continuam visíveis; botSenders hardcoded App.tsx:16.
- Sem ordenação por originServerTs no appendEvent (syncStore.ts:40-47); threadReplies prop morta; sem read receipts.

### 5. Presença/Membros
MemberList é placeholder puro ("Os membros aparecem aqui…", MemberList.tsx:44-48). Sem consumo de membership/presence em todo o codebase. Tela morta por design da Fase 1.

### 6. Shell
Layout 4 colunas OK; overlays resetam em breakpoint OK.
- B7 é o bug estrutural principal.
- useBreakpoints sem debounce (re-render por pixel, menor).
- Overlay sidebar sem backdrop/Escape (menor); modais sem focus-trap/Escape.

### 7. Telas
- **BUG B11 (CRÍTICO — pior achado)**: GoogleLoginScreen.tsx:37-40 cria MatrixService PRÓPRIO se `service` não passado; SessionGate.tsx:96 NÃO passa service → login aplica sessão no service local; enterShell(session, clientActive=true) pula restoreSession no singleton (SessionGate.tsx:41-42) → startSyncWiring chama startSync no singleton sem client → requireClient() lança → NADA sincroniza após login fresh. Só funciona após restart (caminho keyring). Mascarado porque o teste do fluxo usou sessão restaurada.
- GoogleLoginScreen: sem botão cancelar (usuário fecha browser → UI presa até timeout 5min); erro genérico descarta código do SsoLoginError (48-50).
- Settings: 100% decorativo — botões sem handler (286, 295, 309, 316, 323); DEFAULT_DEVICES fake (settingsStore.ts:39-52); store NÃO persistido; classe Tailwind dinâmica `bg-${...}` (Settings.tsx:134) provavelmente não gera no JIT v4.
- Profile: mock — profileStore nunca populado da sessão; badges/conexões hardcoded (Profile.tsx:308-338); edição não persiste; avatar sem handler; joinedAt null.

### 8. MatrixService
- Consistente com MatrixClientLike; requireClient lança Error genérico.
- listChannels retorna [] silenciosamente em guilda desconhecida; wiring marca loaded e nunca retenta.
- loginWithSsoToken correto (descarta client anônimo); refresh_token capturado mas nunca usado.
- startSync: sem listeners de Room.name/RoomMember/Room.receipt/Room.redaction.
- extractSyncError: ERROR sem data → errcode undefined (não desloga, não diferencia).

## Bugs por impacto (ordem)

1. **B11** login fresh não sincroniza (crítico, mascarado por restart)
2. **B4** nome de guilda vira room ID após relogin (reportado)
3. **B3** banner updater infinito sem update (reportado)
4. **B6** histórico de mensagens nunca carrega
5. **B7** auto-scroll/composer quebrados (ChatPane aninhado)
6. **B1** auth error pós-primeiro-sync não desloga
7. **B2** logout inexistente (botão decorativo)
8. **B5** canal criado não aparece na sidebar
9. **B8** reações locais-only (invisíveis a outros)
10. **B9** typing mock (TYPING_USERS = [])
11. **B10** redaction/edit/mídia ignorados
12. EditGuildModal stale + "Deletar guilda" fake
13. Guildas/canais congelados pós-primeiro-sync (sem listeners RoomState)
14. Settings 100% decorativo (botões mortos, store não persistido, classe Tailwind dinâmica)
15. Profile mock (store nunca populado, badges hardcoded)
16. MemberList placeholder (por design Fase 1)
17. Menores: SSO sem cancelar/erro genérico; deviceId/refresh_token não persistidos; unreadCount congelado; busca canais sem filtro; timeline sem ordenação; modais sem Escape/focus-trap.

## Mock vs Real (resumo)
Real: login SSO, persistência sessão keyring, sync loop, envio de mensagens, criação/edição guilda+canal (server-side), auto-updater (parcial), layout shell.
Mock: typing, reações (local), threads, membros/presença, mídia, devices, Settings/Profile inteiros, badges, busca, "deletar guilda", logout.

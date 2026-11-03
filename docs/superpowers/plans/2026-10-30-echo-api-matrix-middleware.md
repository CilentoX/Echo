# Echo API as Matrix Middleware/Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Echo API into the single gateway for all Matrix traffic — desktop app talks only to Echo API; Echo API proxies/transforms requests to Synapse, controlling images, nicknames, profiles, guilds, messages, media, and all data.

**Architecture:** Desktop → Echo API (Fastify) → Synapse (Matrix). Echo API intercepts, validates, enriches, and stores everything: uploads go to Echo API storage (with optional Synapse mirror), profiles/nicknames live in Echo API DB, guild/channel metadata synced to Echo API, all Matrix events pass through Echo API for audit/control.

**Tech Stack:** Fastify (Echo API), matrix-js-sdk (Synapse client inside Echo API), Prisma/PostgreSQL (Echo API DB), Tauri/React (Desktop), WebSocket proxy for `/sync` and realtime.

**Spec:** This plan itself is the spec — the architecture decision is the requirement.

## Global Constraints

- Desktop MUST NOT call Synapse directly — all traffic via `https://echo-api.litteris.online`
- Echo API holds the source of truth for: user profiles (nickname, avatar, banner, bio, links), guild profiles, chat media (images + audio), room metadata
- Synapse remains the realtime engine; Echo API proxies `/sync`, `/send`, `/media`, `/profile`, `/rooms`, `/spaces`, `/members`, `/typing`, `/receipts`, `/reactions`
- Nickname = `display_name` in Echo API DB, synced to Matrix `m.room.member` displayname on profile update
- All uploads: Echo API stores file → returns Echo API URL → also uploads to Synapse media repo → returns `mxc://` for Matrix events
- WebSocket `/sync` proxied transparently with auth injection
- No Appwrite dependency — fully removed
- Conventional Commits, PT-BR responses, existing code style preserved

## Review Focus

1. **Auth token handling** — Echo API must inject user's access_token on proxied requests; token refresh on 401
2. **WebSocket /sync proxy** — must stream without buffering; handle reconnection; inject `since` token
3. **Media upload dual-write** — Echo API storage primary, Synapse mirror; failure modes (one succeeds, other fails)
4. **Nickname ↔ displayName sync** — Echo API nickname persists; on profile set, also call Matrix `setDisplayName`; race conditions
5. **Request/response transformation** — Echo API may rewrite URLs (mxc:// → Echo API CDN), strip/internalize fields; ensure Matrix clients still work

---

### Task 1: Echo API — Matrix Client Instance & Auth Proxy Foundation

**Files:**
- Create: `echo-api/src/lib/matrix/client.js` — singleton Matrix client per user session
- Create: `echo-api/src/lib/matrix/proxy.js` — generic proxy handler (request → Synapse → response)
- Modify: `echo-api/src/app.js` — register proxy routes prefix `/matrix`
- Test: `echo-api/tests/matrix/client.test.js`, `echo-api/tests/matrix/proxy.test.js`

**Interfaces:**
- Produces: `getMatrixClient(userId, accessToken) → MatrixClientLike`, `proxyToMatrix(request, reply, matrixPath) → void`

- [ ] **Step 1: Write failing test for Matrix client factory**
  - `getMatrixClient` creates client with user's access_token, baseUrl from env
  - Reuses client per userId (cache)

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Implement `client.js`**
  - Use `matrix-js-sdk` `createClient({ baseUrl, accessToken, userId })`
  - Cache by `userId` in Map; expose `invalidateUser(userId)`

- [ ] **Step 4: Write failing test for generic proxy**
  - `proxyToMatrix` forwards method, headers, body, query to Synapse
  - Injects `Authorization: Bearer <accessToken>` from request auth
  - Returns Synapse response (status, headers, body)

- [ ] **Step 5: Run test → FAIL**

- [ ] **Step 6: Implement `proxy.js`**
  - Use `undici` or `fetch` to forward to `SYNAPSE_URL + matrixPath`
  - Copy relevant headers (content-type, accept), strip host
  - Handle streaming for `/sync` (see Task 3)

- [ ] **Step 7: Register `/matrix/*` routes in `app.js`**
  - All `/matrix/*` → `proxyToMatrix` with auth check

- [ ] **Step 8: Run tests → PASS**

- [ ] **Step 9: Commit**
  ```bash
  git add echo-api/src/lib/matrix/ echo-api/tests/matrix/ echo-api/src/app.js
  git commit -m "feat(api): add Matrix client factory and generic proxy foundation"
  ```

---

### Task 2: Echo API — Auth Middleware & User Context

**Files:**
- Modify: `echo-api/src/plugins/auth.js` — extend to decode/validate JWT or API key, attach `request.user = { userId, accessToken, deviceId }`
- Create: `echo-api/src/lib/auth/tokenStore.js` — store/retrieve user access_tokens (encrypted at rest)
- Test: `echo-api/tests/auth/tokenStore.test.js`, `echo-api/tests/auth/middleware.test.js`

**Interfaces:**
- Consumes: `getMatrixClient` from Task 1
- Produces: `request.user` on all authenticated routes; `getUserAccessToken(userId) → string`, `storeUserTokens(userId, accessToken, refreshToken, deviceId) → void`

- [ ] **Step 1: Write failing test for token store**
  - `storeUserTokens` saves encrypted; `getUserAccessToken` returns decrypted
  - Uses Prisma model `UserToken` (new)

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Add Prisma model `UserToken`**
  ```prisma
  model UserToken {
    userId      String @unique
    accessToken String  // encrypted
    refreshToken String? // encrypted
    deviceId    String?
    updatedAt   DateTime @updatedAt
  }
  ```
  Run `prisma migrate dev`

- [ ] **Step 4: Implement `tokenStore.js`**
  - Encrypt with `crypto` (AES-256-GCM, key from `TOKEN_ENCRYPTION_KEY` env)
  - Prisma upsert/findUnique

- [ ] **Step 5: Write failing test for auth middleware**
  - Valid `X-API-Key` → `request.user` populated with `userId`, `accessToken` from tokenStore
  - Invalid/missing → 401

- [ ] **Step 6: Run test → FAIL**

- [ ] **Step 7: Implement auth middleware**
  - Verify `X-API-Key` (existing) OR `Authorization: Bearer <jwt>` (new, for desktop)
  - On success: fetch `accessToken` from tokenStore, attach to `request.user`

- [ ] **Step 8: Run tests → PASS**

- [ ] **Step 9: Commit**
  ```bash
  git add echo-api/prisma/schema.prisma echo-api/src/lib/auth/ echo-api/src/plugins/auth.js echo-api/tests/auth/
  git commit -m "feat(api): add user token store and auth middleware with user context"
  ```

---

### Task 3: Echo API — WebSocket /sync Proxy (Streaming)

**Files:**
- Create: `echo-api/src/lib/matrix/syncProxy.js` — handles `/sync` WebSocket proxy with streaming
- Modify: `echo-api/src/app.js` — register `GET /matrix/sync` with `websocket: true`
- Test: `echo-api/tests/matrix/syncProxy.test.js`

**Interfaces:**
- Consumes: `getMatrixClient`, `request.user` from Task 2
- Produces: `handleSyncProxy(request, reply) → void` (streams Synapse `/sync` to client)

- [ ] **Step 1: Write failing test for sync proxy**
  - Opens WebSocket to Synapse `/sync?timeout=30000&since=...`
  - Pipes messages bidirectionally
  - Injects `access_token` on initial connect
  - Handles reconnection on disconnect

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Implement `syncProxy.js`**
  - Use `@fastify/websocket` or raw `ws` upgrade
  - On client connect: create Synapse WebSocket with `access_token` query param
  - Pipe `client → synapse` and `synapse → client` (transform if needed)
  - On Synapse close: attempt reconnect with latest `since` token
  - Timeout handling (30s default)

- [ ] **Step 4: Register WebSocket route in `app.js`**
  - `app.register(async (fastify) => { fastify.get('/matrix/sync', { websocket: true }, handleSyncProxy) })`

- [ ] **Step 5: Run tests → PASS**

- [ ] **Step 6: Commit**
  ```bash
  git add echo-api/src/lib/matrix/syncProxy.js echo-api/src/app.js echo-api/tests/matrix/syncProxy.test.js
  git commit -m "feat(api): add streaming /sync WebSocket proxy to Synapse"
  ```

---

### Task 4: Echo API — Media Upload/Download Proxy (Dual-Write)

**Files:**
- Create: `echo-api/src/services/chatMediaService.js` — saveChatMedia (from earlier), getChatMedia, deleteChatMedia
- Create: `echo-api/src/routes/chatMediaRoutes.js` — `POST /api/media/chat`, `GET /api/media/chat/:mediaId`, `DELETE /api/media/chat/:mediaId`
- Modify: `echo-api/src/services/uploadService.js` — add `uploadToSynapse(file, accessToken) → mxcUri`
- Test: `echo-api/tests/services/chatMediaService.test.js`, `echo-api/tests/routes/chatMediaRoutes.test.js`

**Interfaces:**
- Consumes: `uploadService.uploadToSynapse`, `request.user.accessToken`
- Produces: `chatMediaService.saveChatMedia(userId, file, roomId?) → { mediaId, url, mxcUri, thumbnailUrl? }`

- [ ] **Step 1: Write failing test for `saveChatMedia` (dual-write)**
  - Saves file to Echo API storage (`/uploads/chat/{userId}/{mediaId}`)
  - Uploads to Synapse via `uploadToSynapse` → gets `mxc://`
  - Returns both URLs; DB record with `synapseMxcUri`
  - Allowed MIME: images + audio (ogg, mp3, mpeg, webm, m4a, wav)

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Implement `chatMediaService.saveChatMedia`**
  - Generate `mediaId` (UUID), sanitize `roomId` for path
  - Write file to disk; create DB record `ChatMedia`
  - Call `uploadService.uploadToSynapse(file, accessToken)` → store `mxcUri`
  - Return `{ mediaId, url: \`/api/media/chat/${mediaId}\`, mxcUri, thumbnailUrl }`

- [ ] **Step 4: Write failing test for `uploadToSynapse`**
  - Uses `matrix-js-sdk` client.uploadContent with user's access_token
  - Returns `mxc://` URI

- [ ] **Step 5: Run test → FAIL**

- [ ] **Step 6: Implement `uploadService.uploadToSynapse`**
  - Create throwaway Matrix client with user's access_token
  - `client.uploadContent(file, { name, type })` → `content_uri`

- [ ] **Step 7: Create routes `chatMediaRoutes.js`**
  - `POST /api/media/chat` (multipart) → `saveChatMedia`
  - `GET /api/media/chat/:mediaId` → serve file (range requests for audio)
  - `DELETE /api/media/chat/:mediaId` → delete file + DB + attempt Synapse redact

- [ ] **Step 8: Run tests → PASS**

- [ ] **Step 9: Commit**
  ```bash
  git add echo-api/src/services/chatMediaService.js echo-api/src/services/uploadService.js echo-api/src/routes/chatMediaRoutes.js echo-api/tests/
  git commit -m "feat(api): add chat media dual-write (Echo API primary + Synapse mirror)"
  ```

---

### Task 5: Echo API — Profile/Nickname Management (Source of Truth)

**Files:**
- Modify: `echo-api/prisma/schema.prisma` — add `nickname` to `UserProfile`
- Modify: `echo-api/src/services/userProfileService.js` — add `setNickname`, `getNickname`, sync to Matrix
- Modify: `echo-api/src/routes/userProfileRoutes.js` — `PATCH /api/profiles/me/nickname`
- Create: `echo-api/src/lib/matrix/profileSync.js` — `syncDisplayNameToMatrix(userId, accessToken, nickname) → void`
- Test: `echo-api/tests/services/userProfileService.test.js`, `echo-api/tests/routes/userProfileRoutes.test.js`

**Interfaces:**
- Consumes: `getMatrixClient`, `request.user.accessToken`
- Produces: `userProfileService.setNickname(userId, nickname) → UserProfile`, `profileSync.syncDisplayNameToMatrix(userId, accessToken, nickname) → void`

- [ ] **Step 1: Write failing test for nickname in Prisma**
  - `UserProfile` has `nickname String? @unique` (or non-unique, indexed)
  - Migration runs

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Add `nickname` to `UserProfile` model**
  ```prisma
  model UserProfile {
    userId    String @unique
    nickname  String? @unique  // or just @index
    avatarUrl String?
    bannerUrl String?
    bio       String?
    links     Json   @default("[]")
  }
  ```

- [ ] **Step 4: Write failing test for `setNickname`**
  - Updates `nickname` in DB
  - Calls `profileSync.syncDisplayNameToMatrix` with user's access_token
  - Returns updated profile

- [ ] **Step 5: Run test → FAIL**

- [ ] **Step 6: Implement `profileSync.syncDisplayNameToMatrix`**
  - `getMatrixClient(userId, accessToken).setDisplayName(nickname)`

- [ ] **Step 7: Implement `userProfileService.setNickname`**
  - Validate: 1-32 chars, no control chars
  - Prisma update; call sync; return profile

- [ ] **Step 8: Add route `PATCH /api/profiles/me/nickname`**
  - Body: `{ nickname }`
  - Returns updated profile

- [ ] **Step 9: Run tests → PASS**

- [ ] **Step 10: Commit**
  ```bash
  git add echo-api/prisma/schema.prisma echo-api/src/services/userProfileService.js echo-api/src/lib/matrix/profileSync.js echo-api/src/routes/userProfileRoutes.js echo-api/tests/
  git commit -m "feat(api): add nickname as source of truth, synced to Matrix displayName"
  ```

---

### Task 6: Echo API — Guild/Channel Metadata Sync

**Files:**
- Modify: `echo-api/prisma/schema.prisma` — add `GuildProfile` fields: `topic`, `isPrivate`, `maxMembers`; add `ChannelProfile` model
- Modify: `echo-api/src/services/guildProfileService.js` — sync create/update/delete to Matrix (Space/Room)
- Create: `echo-api/src/lib/matrix/spaceSync.js` — `createSpace`, `updateSpace`, `deleteSpace`, `createRoom`, `updateRoom`, `deleteRoom`
- Test: `echo-api/tests/services/guildProfileService.test.js`, `echo-api/tests/lib/matrix/spaceSync.test.js`

**Interfaces:**
- Consumes: `getMatrixClient`, `request.user.accessToken`
- Produces: `guildProfileService.createGuild(data) → { guildId, matrixSpaceId }`, `spaceSync.createSpace(accessToken, data) → spaceId`

- [ ] **Step 1: Write failing test for `GuildProfile` + `ChannelProfile` models**
  - `GuildProfile`: add `matrixSpaceId String? @unique`, `topic String?`, `isPrivate Boolean @default(false)`, `maxMembers Int?`
  - `ChannelProfile`: `id String @id @default(cuid())`, `guildId String`, `matrixRoomId String @unique`, `name String`, `topic String?`, `type String @default("text")`, `category String?`, `createdAt DateTime @default(now())`
  - Relation: `GuildProfile` has many `ChannelProfile`

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Add Prisma models, migrate**

- [ ] **Step 4: Write failing test for `spaceSync.createSpace`**
  - Creates Matrix Space (`m.space`) with name, avatar, topic
  - Returns `spaceId` (roomId)

- [ ] **Step 5: Run test → FAIL**

- [ ] **Step 6: Implement `spaceSync.js`**
  - `createSpace`: `client.createRoom({ visibility: 'private', preset: 'private_chat', initial_state: [{ type: 'm.room.create', content: { type: 'm.space' } }, { type: 'm.room.name', content: { name } }, ...] })`
  - `createRoom`: child of space via `m.space.child` state event
  - `updateSpace`/`updateRoom`: send state events (name, topic, avatar)
  - `deleteSpace`/`deleteRoom`: `client.leaveRoom` + `client.forgetRoom` (or redact)

- [ ] **Step 7: Integrate in `guildProfileService`**
  - `createGuild`: call `spaceSync.createSpace`, save `matrixSpaceId`
  - `createChannel`: call `spaceSync.createRoom`, save `ChannelProfile`
  - `updateGuild`/`updateChannel`: call sync
  - `deleteGuild`/`deleteChannel`: call sync + cascade

- [ ] **Step 8: Run tests → PASS**

- [ ] **Step 9: Commit**
  ```bash
  git add echo-api/prisma/schema.prisma echo-api/src/services/guildProfileService.js echo-api/src/lib/matrix/spaceSync.js echo-api/tests/
  git commit -m "feat(api): add guild/channel metadata sync with Matrix Spaces/Rooms"
  ```

---

### Task 7: Echo API — Message Send/Edit/Redact/React Proxy

**Files:**
- Create: `echo-api/src/routes/messageRoutes.js` — `POST /api/rooms/:roomId/messages`, `PUT /api/rooms/:roomId/messages/:eventId`, `DELETE /api/rooms/:roomId/messages/:eventId`, `POST /api/rooms/:roomId/messages/:eventId/reactions`
- Create: `echo-api/src/services/messageService.js` — send, edit, redact, react (calls Matrix client)
- Test: `echo-api/tests/routes/messageRoutes.test.js`, `echo-api/tests/services/messageService.test.js`

**Interfaces:**
- Consumes: `getMatrixClient`, `request.user.accessToken`, `chatMediaService` (for mxcUri resolution)
- Produces: `messageService.sendMessage(roomId, body, msgtype?, mxcUri?) → eventId`

- [ ] **Step 1: Write failing test for `sendMessage` proxy**
  - Accepts `{ body, msgtype?, mediaId? }`
  - If `mediaId`: resolve to `mxcUri` via `chatMediaService`
  - Calls Matrix `sendMessage`/`sendEvent` with `msgtype: m.text|m.file|m.image|m.audio`
  - Returns `{ eventId, timestamp }`

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Implement `messageService.sendMessage`**
  - Switch on `msgtype`: text → `sendMessage`; file/image/audio → `sendEvent` with `m.file`/`m.image`/`m.audio` content + `url: mxcUri`, `info: { mimetype, size }`
  - For `m.audio`: add `info.duration` if available

- [ ] **Step 4: Add routes for edit, redact, react**
  - `PUT /messages/:eventId` → `m.replace`
  - `DELETE /messages/:eventId` → `redactEvent`
  - `POST /messages/:eventId/reactions` → `m.reaction` with `m.relates_to`

- [ ] **Step 5: Run tests → PASS**

- [ ] **Step 6: Commit**
  ```bash
  git add echo-api/src/routes/messageRoutes.js echo-api/src/services/messageService.js echo-api/tests/
  git commit -m "feat(api): add message send/edit/redact/react proxy to Matrix"
  ```

---

### Task 8: Echo API — Members, Typing, Presence, Read Receipts Proxy

**Files:**
- Create: `echo-api/src/routes/memberRoutes.js` — `GET /api/rooms/:roomId/members`, `POST /api/rooms/:roomId/invite`, `POST /api/rooms/:roomId/kick`, `POST /api/rooms/:roomId/ban`, `PUT /api/rooms/:roomId/power-levels`
- Create: `echo-api/src/routes/realtimeRoutes.js` — `PUT /api/rooms/:roomId/typing`, `PUT /api/rooms/:roomId/receipt`, `GET /api/users/:userId/presence`
- Test: `echo-api/tests/routes/memberRoutes.test.js`, `echo-api/tests/routes/realtimeRoutes.test.js`

**Interfaces:**
- Consumes: `getMatrixClient`, `request.user.accessToken`
- Produces: Standard Matrix member/typing/presence/receipt operations proxied

- [ ] **Step 1: Write failing tests for each endpoint**
  - Members: list, invite, kick, ban, power levels
  - Typing: `PUT /typing { typing: true, timeout?: 30000 }`
  - Receipt: `PUT /receipt { eventId, receiptType: 'm.read' }`
  - Presence: `GET /presence` → `client.getPresence(userId)`

- [ ] **Step 2: Run tests → FAIL**

- [ ] **Step 3: Implement routes using Matrix client methods**
  - Members: `client.getJoinedRoomMembers`, `client.invite`, `client.kick`, `client.ban`, `client.setPowerLevel`
  - Typing: `client.sendTyping(roomId, typing, timeout)`
  - Receipt: `client.sendReadReceipt`
  - Presence: `client.getPresence` / `client.setPresence`

- [ ] **Step 4: Run tests → PASS**

- [ ] **Step 5: Commit**
  ```bash
  git add echo-api/src/routes/memberRoutes.js echo-api/src/routes/realtimeRoutes.js echo-api/tests/
  git commit -m "feat(api): add members/typing/presence/receipts proxy to Matrix"
  ```

---

### Task 9: Desktop — Replace Matrix SDK with Echo API Client

**Files:**
- Create: `apps/desktop/src/lib/api/echoApi.ts` — full typed client for Echo API (auth, media, profiles, guilds, messages, sync, members, realtime)
- Modify: `apps/desktop/src/lib/matrix/instance.ts` — remove direct Matrix client, delegate to `echoApi`
- Modify: `apps/desktop/src/lib/matrix/service.ts` — rewrite all methods to call `echoApi` instead of Matrix SDK
- Modify: `apps/desktop/src/lib/matrix/wiring.ts` — adapt sync handlers to Echo API `/sync` proxy format
- Modify: `apps/desktop/src/features/auth/SessionGate.tsx` — login via Echo API (not direct SSO)
- Modify: `apps/desktop/src/lib/appwrite/*` — **DELETE** (remove Appwrite entirely)
- Modify: `apps/desktop/package.json` — remove `appwrite`, `@phosphor-icons/react` (keep if used elsewhere), `matrix-js-sdk` (move to Echo API only)
- Test: `apps/desktop/src/lib/api/echoApi.test.ts`, `apps/desktop/src/lib/matrix/service.test.ts`

**Interfaces:**
- Consumes: Echo API endpoints from Tasks 1-8
- Produces: `echoApi` singleton with same interface as old `matrixService` + auth

- [ ] **Step 1: Write failing test for `echoApi.loginWithGoogle()`**
  - Calls `POST /auth/google` (new endpoint) → returns `{ session, user }`
  - Stores session in keyring

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Add `POST /auth/google` to Echo API (Task 10, but define interface here)**
  - Echo API initiates SSO flow, returns session

- [ ] **Step 4: Implement `echoApi.ts`**
  - Base class with `request(method, path, body, headers)` → adds `X-API-Key` + `Authorization: Bearer <accessToken>`
  - Methods: `getUserProfile`, `patchUserProfile`, `uploadChatMedia`, `getGuilds`, `createGuild`, `getChannels`, `createChannel`, `sendMessage`, `loadOlder`, `sendReaction`, `setTyping`, `markAsRead`, `getMembers`, `inviteUser`, `kickUser`, `banUser`, `setPowerLevel`, `connectSync(handlers)` → WebSocket

- [ ] **Step 5: Write failing test for `echoApi.connectSync`**
  - Opens WebSocket to `/matrix/sync`
  - Parses messages → calls handlers (`onEvent`, `onStatus`, `onTyping`, `onPresence`, `onMembers`, `onReaction`, `onReadReceipt`)
  - Auto-reconnect with backoff

- [ ] **Step 6: Run test → FAIL**

- [ ] **Step 7: Implement `connectSync`**
  - WebSocket with `access_token` query param
  - Message parser: `type: 'event' | 'status' | 'typing' | 'presence' | 'members' | 'reaction' | 'receipt'`
  - Heartbeat / reconnect logic

- [ ] **Step 8: Rewrite `MatrixService` methods to delegate to `echoApi`**
  - Each method: `return echoApi.xxx(...)`
  - Keep same TypeScript interface for zero downstream changes

- [ ] **Step 9: Update `SessionGate` login flow**
  - Call `echoApi.loginWithGoogle()` instead of `runSsoLogin(matrixService)`
  - On success: `echoApi.connectSync(wiringHandlers)`

- [ ] **Step 10: Remove Appwrite imports/code**
  - Delete `src/lib/appwrite/`
  - Remove `appwrite` from `package.json`
  - Remove `useImageUploadWithMatrix`, `useImageUpload`

- [ ] **Step 11: Run desktop tests → PASS**

- [ ] **Step 12: Commit**
  ```bash
  git add apps/desktop/src/lib/api/echoApi.ts apps/desktop/src/lib/matrix/ apps/desktop/src/features/auth/ apps/desktop/package.json
  git rm -r apps/desktop/src/lib/appwrite
  git commit -m "feat(desktop): replace Matrix SDK with Echo API client; remove Appwrite"
  ```

---

### Task 10: Echo API — SSO Login Endpoint (Google → Matrix Token Exchange)

**Files:**
- Create: `echo-api/src/routes/authRoutes.js` — `POST /auth/google`, `POST /auth/token`, `POST /auth/refresh`
- Create: `echo-api/src/services/authService.js` — `initiateGoogleSso(redirectUrl) → { loginUrl, state }`, `exchangeCodeForTokens(code) → { accessToken, refreshToken, deviceId, userId }`
- Modify: `echo-api/src/app.js` — register `/auth` routes (no API key required)
- Test: `echo-api/tests/routes/authRoutes.test.js`, `echo-api/tests/services/authService.test.js`

**Interfaces:**
- Consumes: Synapse OIDC config (`SYNAPSE_GOOGLE_CLIENT_ID`, `SYNAPSE_GOOGLE_CLIENT_SECRET`, `SYNAPSE_URL`)
- Produces: `authService.exchangeCodeForTokens(code) → { accessToken, refreshToken, deviceId, userId }`

- [ ] **Step 1: Write failing test for `initiateGoogleSso`**
  - Builds Synapse SSO redirect URL: `${SYNAPSE_URL}/_synapse/client/oidc/redirect/google?redirectUrl=...`
  - Returns `{ loginUrl, state }`

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Implement `authService.initiateGoogleSso`**
  - Generate `state` (CSRF), store in short-lived cache (Redis or memory with TTL)
  - Build URL with `redirectUrl` pointing to Echo API `/auth/callback`

- [ ] **Step 4: Write failing test for `exchangeCodeForTokens`**
  - Calls Synapse `/_synapse/client/oidc/callback` with `code` + `state`
  - Parses response: `access_token`, `refresh_token`, `device_id`, `user_id`
  - Stores tokens in `tokenStore` (Task 2)
  - Returns tokens

- [ ] **Step 5: Run test → FAIL**

- [ ] **Step 6: Implement `exchangeCodeForTokens`**
  - `POST ${SYNAPSE_URL}/_synapse/client/oidc/callback` with form data
  - Validate `state` matches cache
  - Call `tokenStore.storeUserTokens(userId, accessToken, refreshToken, deviceId)`

- [ ] **Step 7: Create routes**
  - `GET /auth/google` → redirect to `loginUrl` (for desktop: return JSON `{ loginUrl }`)
  - `GET /auth/callback` → receive Synapse redirect, exchange code, set secure cookie or return tokens
  - `POST /auth/token` → desktop exchanges `code` for tokens (alternative to callback)
  - `POST /auth/refresh` → use `refresh_token` to get new `access_token`, update store

- [ ] **Step 8: Run tests → PASS**

- [ ] **Step 9: Commit**
  ```bash
  git add echo-api/src/routes/authRoutes.js echo-api/src/services/authService.js echo-api/src/app.js echo-api/tests/
  git commit -m "feat(api): add Google SSO login endpoint with Matrix token exchange"
  ```

---

### Task 11: Desktop — Keyring Session Format Update & Auto-Reconnect

**Files:**
- Modify: `apps/desktop/src/lib/storage/keyring.ts` — update `Session` type to include `refreshToken`, `deviceId`, `apiBaseUrl`
- Modify: `apps/desktop/src/features/auth/SessionGate.tsx` — use `echoApi.refreshSession()` on startup if access token expired
- Modify: `apps/desktop/src/lib/api/echoApi.ts` — add `refreshSession() → Session`
- Test: `apps/desktop/src/lib/storage/keyring.test.ts`, `apps/desktop/src/features/auth/SessionGate.test.tsx`

**Interfaces:**
- Consumes: `echoApi.refreshSession`, `echoApi.connectSync`
- Produces: Updated `Session` type, resilient boot flow

- [ ] **Step 1: Write failing test for updated `Session` type**
  - `Session = { userId, accessToken, refreshToken, deviceId, apiBaseUrl, expiresAt }`

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Update `keyring.ts` types and `saveSession`/`loadSession`**

- [ ] **Step 4: Write failing test for `echoApi.refreshSession`**
  - Calls `POST /auth/refresh` with `refreshToken`
  - Returns new `Session`, updates keyring

- [ ] **Step 5: Run test → FAIL**

- [ ] **Step 6: Implement `echoApi.refreshSession`**

- [ ] **Step 7: Update `SessionGate` boot flow**
  - Load session → if expired: `await echoApi.refreshSession()` → if fails: clear session → login
  - Then `echoApi.connectSync(wiringHandlers)`

- [ ] **Step 8: Run tests → PASS**

- [ ] **Step 9: Commit**
  ```bash
  git add apps/desktop/src/lib/storage/keyring.ts apps/desktop/src/features/auth/SessionGate.tsx apps/desktop/src/lib/api/echoApi.ts apps/desktop/tests/
  git commit -m "feat(desktop): update session format with refresh token; add auto-reconnect on boot"
  ```

---

### Task 12: Cleanup & Verification — Remove Dead Code, Full Integration Test

**Files:**
- Delete: `apps/desktop/src/lib/matrix/api/` (all Matrix SDK API wrappers)
- Delete: `apps/desktop/src/lib/matrix/types.ts` (if unused)
- Modify: `apps/desktop/src/lib/matrix/instance.ts` — export `echoApi` as `matrixService` alias for gradual compat
- Test: `apps/desktop/src/test/integration.test.tsx` (manual E2E checklist)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Clean build, working app

- [ ] **Step 1: Remove unused Matrix SDK API files**
  - `auth.ts`, `sync.ts`, `messages.ts`, `guilds.ts`, `channels.ts`, `members.ts`, `profile.ts`, `media.ts`

- [ ] **Step 2: Update `instance.ts` to export `echoApi` as default**

- [ ] **Step 3: Run `pnpm build` in desktop → PASS**

- [ ] **Step 4: Run `pnpm test` in desktop → PASS**

- [ ] **Step 5: Run `pnpm test` in echo-api → PASS**

- [ ] **Step 6: Manual E2E checklist**
  - [ ] Login with Google → lands in shell
  - [ ] Create guild → appears in rail, #geral auto-created
  - [ ] Send text message → appears in chat
  - [ ] Send image → uploads to Echo API, shows in chat (thumbnail)
  - [ ] Send audio → uploads to Echo API, plays in chat
  - [ ] Edit nickname in Profile → updates in MemberList, persists after reload
  - [ ] Typing indicator works
  - [ ] Presence shows online/offline
  - [ ] Reactions work
  - [ ] Scrollback loads older messages
  - [ ] Reopen app → auto-login, sync restores

- [ ] **Step 7: Commit**
  ```bash
  git add -A
  git commit -m "chore: cleanup dead Matrix SDK code; full integration verified"
  ```

---

**Plan complete and saved to `docs/superpowers/plans/2026-10-30-echo-api-matrix-middleware.md`. Please review the plan. Which execution approach would you prefer?**

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end. Runs well with a mid-tier session model, since the plan carries the design.

**For this plan I recommend Subagent-driven, because the 12 tasks have tight interface dependencies (each task consumes interfaces from previous ones) and a shipped mistake in the proxy layer would break the entire desktop app. Does the plan capture what you want, and which approach should we use?**
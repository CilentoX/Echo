# MatrixService Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1100-line monolithic `MatrixService` class into focused domain modules (Auth, Sync, Messages, Guilds, Channels, Media, Profile, Presence) with a clean facade, preserving all existing behavior and test compatibility.

**Architecture:** Extract domain-specific APIs into separate files under `lib/matrix/api/`, each with a single responsibility. A lightweight `MatrixService` facade re-exports all methods, maintaining the exact same public interface so zero callers need changes. The singleton instance in `instance.ts` remains unchanged.

**Tech Stack:** TypeScript, matrix-js-sdk 44.x, Zustand 5, Vitest + React Testing Library

**Spec:** This plan (self-contained)

---

## Global Constraints

- **Zero breaking changes** to public `MatrixService` API — all existing imports (`import { matrixService } from "@/lib/matrix/instance"`) must continue working
- **Test compatibility** — existing mocks in `SessionGate.test.tsx`, `ChatPane.test.tsx`, `Profile.test.tsx`, `GoogleLoginScreen.test.tsx`, `App.test.tsx` must pass without modification
- **TypeScript strict mode** — no `any` in new code, branded types preserved
- **Singleton pattern** — `instance.ts` exports same `matrixService` instance
- **Wiring unchanged** — `wiring.ts` continues calling `matrixService.startSyncHandlers()`, `matrixService.listGuilds()`, etc.
- **No new dependencies** — only restructure existing code

---

## Review Focus

| Input / Condition | Expected Behavior | Test Location |
|-------------------|-------------------|---------------|
| Expired/revoked access token during active sync | `onAuthFailure` called, session cleared, user redirected to login | `wiring.ts` `handleStatus` + `SessionGate.test.tsx` |
| Concurrent `createGuild` + `createChannel` calls | Both succeed, channel linked to guild via `m.space.child` | `CommunityRail.tsx` + `ChannelSidebar.tsx` integration |
| Optimistic message replaced by confirmed event | `localId` → `eventId` swap preserves order, no duplicate | `ChatPane.test.tsx` + `syncStore.applyEvent` |
| Large message history (500+ messages/room) | Pagination works, memory bounded, scroll position stable | Future: `loadOlder` + virtualization |
| Network error during media upload | Fallback to Matrix native upload, user sees retry option | `Composer.tsx` + `ImageCropModal.tsx` |

---

## File Structure After Refactor

```
src/lib/matrix/
├── api/
│   ├── auth.ts           # loginWithSsoToken, restoreSession, getSsoLoginUrl, logout
│   ├── sync.ts           # startSyncHandlers, stopSync, SyncHandlers types
│   ├── messages.ts       # sendMessage, sendFile, sendReaction, removeReaction, redact, markAsRead, loadOlder, editMessage
│   ├── guilds.ts         # listGuilds, createGuild, deleteGuild, leaveGuild, editGuild
│   ├── channels.ts       # listChannels, createChannel, joinChannel, leaveChannel
│   ├── media.ts          # uploadMedia, mxcUrlToHttp, getMediaUrl
│   ├── profile.ts        # getDisplayName, setDisplayName, getAvatarUrl, setAvatarUrl, getBannerUrl, setUserBanner, getUserProfile, getUserBanner
│   ├── presence.ts       # setTyping, setPresence, getUserId, getAccessToken, getBaseUrl
│   └── members.ts        # listMembers, inviteUser, kickUser, banUser, setPowerLevel
├── service.ts            # Facade: re-exports all APIs, maintains singleton client state
├── instance.ts           # Unchanged: export const matrixService = new MatrixService(...)
├── wiring.ts             # Unchanged: imports from instance.ts
├── types.ts              # Unchanged (maybe add branded types for new APIs)
├── sso.ts                # Unchanged
└── index.ts              # Barrel export: export * from './service'; export * from './types';
```

---

## Task Breakdown

### Task 1: Create `lib/matrix/api/auth.ts`

**Files:**
- Create: `src/lib/matrix/api/auth.ts`
- Modify: `src/lib/matrix/service.ts` (remove auth methods)
- Test: `src/features/auth/GoogleLoginScreen.test.tsx` (existing, should pass unchanged)

**Interfaces:**
- Consumes: `MatrixClientLike`, `ClientFactory`, `Session`, `ECHO_HOMESERVER_URL` from `../types` and `../sso`
- Produces: `loginWithSsoToken(loginToken: string) => Promise<Session>`, `restoreSession(session: Session) => void`, `getSsoLoginUrl(redirectUrl: string, idpId?: string) => string`, `logout() => Promise<void>`

- [ ] **Step 1: Write failing test for auth module**
  - Create `src/lib/matrix/api/auth.test.ts` with tests for `loginWithSsoToken`, `restoreSession`, `getSsoLoginUrl`
  - Mock `matrix-js-sdk` client factory
  - Verify token exchange, session reconstruction, SSO URL generation

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/lib/matrix/api/auth.test.ts`
  - Expected: FAIL (module doesn't exist)

- [ ] **Step 3: Implement `auth.ts`**
  - Extract lines 64-103 from `service.ts` (`loginWithSsoToken`, `restoreSession`, `getSsoLoginUrl`)
  - Add `logout()` method: calls `client?.logout()` then `this.client = null`
  - Accept `baseUrl` and `clientFactory` in constructor
  - Maintain `defaultClientFactory` for tests

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/lib/matrix/api/auth.test.ts`
  - Expected: PASS

- [ ] **Step 5: Update `service.ts` to delegate to AuthApi**
  - Import `AuthApi` from `./api/auth`
  - Add private `authApi: AuthApi` field
  - Initialize in constructor: `this.authApi = new AuthApi(baseUrl, clientFactory)`
  - Delegate `loginWithSsoToken`, `restoreSession`, `getSsoLoginUrl`, `logout` to `this.authApi`

- [ ] **Step 6: Run all auth-related tests**
  - Run: `pnpm vitest run src/features/auth/`
  - Expected: All PASS

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/matrix/api/auth.ts src/lib/matrix/api/auth.test.ts src/lib/matrix/service.ts
  git commit -m "refactor(matrix): extract AuthApi to lib/matrix/api/auth.ts"
  ```

---

### Task 2: Create `lib/matrix/api/sync.ts`

**Files:**
- Create: `src/lib/matrix/api/sync.ts`
- Modify: `src/lib/matrix/service.ts` (remove sync methods)
- Test: `src/lib/matrix/wiring.ts` (existing integration), `src/features/auth/SessionGate.test.tsx`

**Interfaces:**
- Consumes: `MatrixClientLike`, `SyncHandlers` (from `../types`), `DEFAULT_START_CLIENT_OPTS`
- Produces: `startSyncHandlers(handlers: SyncHandlers) => void`, `stopSync() => void`

- [ ] **Step 1: Write failing test for sync module**
  - Create `src/lib/matrix/api/sync.test.ts`
  - Test `startSyncHandlers` registers all listeners, `stopSync` removes them
  - Verify `startClient` called with `DEFAULT_START_CLIENT_OPTS`

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/lib/matrix/api/sync.test.ts`
  - Expected: FAIL

- [ ] **Step 3: Implement `sync.ts`**
  - Extract lines 116-188 from `service.ts` (`startSyncHandlers`, `stopSync`)
  - Extract `SYNC_STATE_STATUS`, `extractSyncError`, listener fields
  - Accept `client` instance in constructor (shared with other APIs)

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/lib/matrix/api/sync.test.ts`
  - Expected: PASS

- [ ] **Step 5: Update `service.ts` to delegate to SyncApi**
  - Import `SyncApi` from `./api/sync`
  - Add private `syncApi: SyncApi` field
  - Initialize after client creation
  - Delegate `startSyncHandlers`, `stopSync`

- [ ] **Step 6: Run wiring + session tests**
  - Run: `pnpm vitest run src/lib/matrix/wiring.test.ts src/features/auth/SessionGate.test.tsx`
  - Expected: All PASS

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/matrix/api/sync.ts src/lib/matrix/api/sync.test.ts src/lib/matrix/service.ts
  git commit -m "refactor(matrix): extract SyncApi to lib/matrix/api/sync.ts"
  ```

---

### Task 3: Create `lib/matrix/api/messages.ts`

**Files:**
- Create: `src/lib/matrix/api/messages.ts`
- Modify: `src/lib/matrix/service.ts` (remove message methods)
- Test: `src/features/chat/ChatPane.test.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `MatrixClientLike`, `NormalizedEvent` (from `../types`)
- Produces: `sendMessage(roomId, body) => Promise<string>`, `sendFile(roomId, file, body?) => Promise<string>`, `sendReaction(roomId, targetEventId, emoji) => Promise<string>`, `removeReaction(roomId, reactionEventId) => Promise<void>`, `redact(roomId, eventId) => Promise<void>`, `markAsRead(roomId, eventId) => Promise<void>`, `loadOlder(roomId, limit?) => Promise<NormalizedEvent[]>`, `editMessage(roomId, eventId, newBody) => Promise<void>`

- [ ] **Step 1: Write failing test for messages module**
  - Create `src/lib/matrix/api/messages.test.ts`
  - Test each method with mocked client
  - Verify event content structure for `m.text`, `m.file`, `m.reaction`

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/lib/matrix/api/messages.test.ts`
  - Expected: FAIL

- [ ] **Step 3: Implement `messages.ts`**
  - Extract lines 191-267 from `service.ts` (`sendMessage`, `sendFile`, `sendReaction`, `removeReaction`, `markAsRead`, `redact`, `loadOlder`)
  - Add `editMessage` (new: `m.room.message` with `m.new_content` + `m.relates_to`)
  - Add `setTyping` (move from presence later, or keep here)
  - Accept `client` in constructor

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/lib/matrix/api/messages.test.ts`
  - Expected: PASS

- [ ] **Step 5: Update `service.ts` to delegate to MessagesApi**
  - Import `MessagesApi` from `./api/messages`
  - Add private `messagesApi: MessagesApi` field
  - Initialize with shared client
  - Delegate all message methods

- [ ] **Step 6: Run chat + app tests**
  - Run: `pnpm vitest run src/features/chat/ChatPane.test.tsx src/App.test.tsx`
  - Expected: All PASS

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/matrix/api/messages.ts src/lib/matrix/api/messages.test.ts src/lib/matrix/service.ts
  git commit -m "refactor(matrix): extract MessagesApi to lib/matrix/api/messages.ts"
  ```

---

### Task 4: Create `lib/matrix/api/guilds.ts`

**Files:**
- Create: `src/lib/matrix/api/guilds.ts`
- Modify: `src/lib/matrix/service.ts` (remove guild methods)
- Test: `src/features/shell/CommunityRail.tsx`, `src/features/guild/GuildDropdownContent.tsx`, `src/features/shell/AppShell.tsx`

**Interfaces:**
- Consumes: `MatrixClientLike`, `GuildSummary`, `Visibility`, `Preset`, `isSpace`, `stateEventName` (from `../types` and local)
- Produces: `listGuilds() => Promise<GuildSummary[]>`, `createGuild(data) => Promise<GuildSummary>`, `deleteGuild(guildId) => Promise<void>`, `leaveGuild(guildId) => Promise<void>`, `editGuild(guildId, data) => Promise<void>`

- [ ] **Step 1: Write failing test for guilds module**
  - Create `src/lib/matrix/api/guilds.test.ts`
  - Test `listGuilds` filters `m.space` rooms, `createGuild` creates space + #geral channel, `editGuild` sends state events

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/lib/matrix/api/guilds.test.ts`
  - Expected: FAIL

- [ ] **Step 3: Implement `guilds.ts`**
  - Extract lines 402-472 from `service.ts` (`listGuilds`, `createGuild`, `deleteGuild`, `leaveGuild`, `editGuild`)
  - Move `isSpace`, `stateEventName` helpers to this file (or shared utils)
  - Accept `client` in constructor

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/lib/matrix/api/guilds.test.ts`
  - Expected: PASS

- [ ] **Step 5: Update `service.ts` to delegate to GuildsApi**
  - Import `GuildsApi` from `./api/guilds`
  - Add private `guildsApi: GuildsApi` field
  - Delegate all guild methods

- [ ] **Step 6: Run guild-related tests**
  - Run: `pnpm vitest run src/features/shell/CommunityRail.test.tsx src/features/guild/`
  - Expected: All PASS (create tests if missing)

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/matrix/api/guilds.ts src/lib/matrix/api/guilds.test.ts src/lib/matrix/service.ts
  git commit -m "refactor(matrix): extract GuildsApi to lib/matrix/api/guilds.ts"
  ```

---

### Task 5: Create `lib/matrix/api/channels.ts`

**Files:**
- Create: `src/lib/matrix/api/channels.ts`
- Modify: `src/lib/matrix/service.ts` (remove channel methods)
- Test: `src/features/shell/ChannelSidebar.tsx`, `src/lib/matrix/wiring.ts` (loadChannelsFor)

**Interfaces:**
- Consumes: `MatrixClientLike`, `ChannelSummary`, `Visibility`, `Preset`, `isSpace`
- Produces: `listChannels(guildId) => Promise<ChannelSummary[]>`, `createChannel(guildId, data) => Promise<ChannelSummary>`, `joinChannel(channelId) => Promise<void>`, `leaveChannel(channelId) => Promise<void>`

- [ ] **Step 1: Write failing test for channels module**
  - Create `src/lib/matrix/api/channels.test.ts`
  - Test `listChannels` reads `m.space.child` state events, `createChannel` links via `m.space.child`

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/lib/matrix/api/channels.test.ts`
  - Expected: FAIL

- [ ] **Step 3: Implement `channels.ts`**
  - Extract lines 474-563 from `service.ts` (`listChannels`, `createChannel`)
  - Add `joinChannel` (call `client.join(channelId)`), `leaveChannel` (call `client.leave(channelId)`)
  - Accept `client` in constructor

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/lib/matrix/api/channels.test.ts`
  - Expected: PASS

- [ ] **Step 5: Update `service.ts` to delegate to ChannelsApi**
  - Import `ChannelsApi` from `./api/channels`
  - Add private `channelsApi: ChannelsApi` field
  - Delegate all channel methods

- [ ] **Step 6: Run channel + wiring tests**
  - Run: `pnpm vitest run src/lib/matrix/wiring.test.ts src/features/shell/ChannelSidebar.test.tsx`
  - Expected: All PASS

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/matrix/api/channels.ts src/lib/matrix/api/channels.test.ts src/lib/matrix/service.ts
  git commit -m "refactor(matrix): extract ChannelsApi to lib/matrix/api/channels.ts"
  ```

---

### Task 6: Create `lib/matrix/api/media.ts`

**Files:**
- Create: `src/lib/matrix/api/media.ts`
- Modify: `src/lib/matrix/service.ts` (remove media methods)
- Test: `src/components/media/ImageCropModal.tsx`, `src/features/profile/Profile.test.tsx`

**Interfaces:**
- Consumes: `MatrixClientLike`, `File`
- Produces: `uploadMedia(file) => Promise<string>`, `mxcUrlToHttp(mxcUrl, width?, height?, ...) => string | null`

- [ ] **Step 1: Write failing test for media module**
  - Create `src/lib/matrix/api/media.test.ts`
  - Test `uploadMedia` returns `mxc://` URI, `mxcUrlToHttp` builds correct HTTP URL

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/lib/matrix/api/media.test.ts`
  - Expected: FAIL

- [ ] **Step 3: Implement `media.ts`**
  - Extract lines 282-289 (`uploadMedia`) and 341-344 (`mxcUrlToHttp`) from `service.ts`
  - Accept `client` in constructor

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/lib/matrix/api/media.test.ts`
  - Expected: PASS

- [ ] **Step 5: Update `service.ts` to delegate to MediaApi**
  - Import `MediaApi` from `./api/media`
  - Add private `mediaApi: MediaApi` field
  - Delegate `uploadMedia`, `mxcUrlToHttp`

- [ ] **Step 6: Run media-related tests**
  - Run: `pnpm vitest run src/features/profile/Profile.test.tsx src/components/media/`
  - Expected: All PASS

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/matrix/api/media.ts src/lib/matrix/api/media.test.ts src/lib/matrix/service.ts
  git commit -m "refactor(matrix): extract MediaApi to lib/matrix/api/media.ts"
  ```

---

### Task 7: Create `lib/matrix/api/profile.ts`

**Files:**
- Create: `src/lib/matrix/api/profile.ts`
- Modify: `src/lib/matrix/service.ts` (remove profile methods)
- Test: `src/features/profile/Profile.test.tsx`, `src/features/auth/OnboardingScreen.tsx`

**Interfaces:**
- Consumes: `MatrixClientLike`, `UserProfile`, `RoomLike`
- Produces: `getDisplayName(userId?) => Promise<string | null>`, `setDisplayName(name) => Promise<void>`, `getAvatarUrl(userId?) => Promise<string | null>`, `setAvatarUrl(url) => Promise<void>`, `getBannerUrl(userId?) => Promise<string | null>`, `setUserBanner(userId, url) => Promise<void>`, `getUserProfile(userId) => Promise<UserProfile>`, `getUserBanner(userId) => Promise<string | null>`

- [ ] **Step 1: Write failing test for profile module**
  - Create `src/lib/matrix/api/profile.test.ts`
  - Test each getter/setter, `getUserProfile` aggregates, banner uses DM room with `echo.user.banner` state

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/lib/matrix/api/profile.test.ts`
  - Expected: FAIL

- [ ] **Step 3: Implement `profile.ts`**
  - Extract lines 269-324 (`getDisplayName`, `setDisplayName`, `getAvatarUrl`, `setAvatarUrl`, `getBannerUrl`, `getUserProfile`) and 346-400 (`getUserBanner`, `setUserBanner`, `_findBannerEventId`) from `service.ts`
  - Accept `client` in constructor

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/lib/matrix/api/profile.test.ts`
  - Expected: PASS

- [ ] **Step 5: Update `service.ts` to delegate to ProfileApi**
  - Import `ProfileApi` from `./api/profile`
  - Add private `profileApi: ProfileApi` field
  - Delegate all profile methods

- [ ] **Step 6: Run profile + onboarding tests**
  - Run: `pnpm vitest run src/features/profile/Profile.test.tsx src/features/auth/OnboardingScreen.test.tsx`
  - Expected: All PASS

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/matrix/api/profile.ts src/lib/matrix/api/profile.test.ts src/lib/matrix/service.ts
  git commit -m "refactor(matrix): extract ProfileApi to lib/matrix/api/profile.ts"
  ```

---

### Task 8: Create `lib/matrix/api/presence.ts`

**Files:**
- Create: `src/lib/matrix/api/presence.ts`
- Modify: `src/lib/matrix/service.ts` (remove presence/typing methods)
- Test: `src/lib/matrix/wiring.ts` (typing/presence handlers)

**Interfaces:**
- Consumes: `MatrixClientLike`
- Produces: `setTyping(roomId, isTyping) => Promise<void>`, `setPresence(state) => Promise<void>`, `getUserId() => string | null`, `getAccessToken() => string | null`, `getBaseUrl() => string`

- [ ] **Step 1: Write failing test for presence module**
  - Create `src/lib/matrix/api/presence.test.ts`
  - Test `setTyping` sends `m.typing`, `setPresence` calls SDK, getters return client values

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/lib/matrix/api/presence.test.ts`
  - Expected: FAIL

- [ ] **Step 3: Implement `presence.ts`**
  - Extract lines 252-255 (`setTyping`), 326-339 (`getUserId`, `getAccessToken`, `getBaseUrl`) from `service.ts`
  - Add `setPresence(state)` → `client.setPresence({ presence: state })`
  - Accept `client` in constructor

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/lib/matrix/api/presence.test.ts`
  - Expected: PASS

- [ ] **Step 5: Update `service.ts` to delegate to PresenceApi**
  - Import `PresenceApi` from `./api/presence`
  - Add private `presenceApi: PresenceApi` field
  - Delegate all presence methods

- [ ] **Step 6: Run wiring tests**
  - Run: `pnpm vitest run src/lib/matrix/wiring.test.ts`
  - Expected: All PASS

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/matrix/api/presence.ts src/lib/matrix/api/presence.test.ts src/lib/matrix/service.ts
  git commit -m "refactor(matrix): extract PresenceApi to lib/matrix/api/presence.ts"
  ```

---

### Task 9: Create `lib/matrix/api/members.ts`

**Files:**
- Create: `src/lib/matrix/api/members.ts`
- Modify: `src/lib/matrix/service.ts` (remove member methods)
- Test: `src/features/shell/MemberList.tsx`, `src/features/shell/MemberDropdownContent.tsx`, `src/lib/matrix/wiring.ts` (loadMembersFor)

**Interfaces:**
- Consumes: `MatrixClientLike`, `MemberSummary`
- Produces: `listMembers(roomId) => Promise<MemberSummary[]>`, `inviteUser(roomId, userId) => Promise<void>`, `kickUser(roomId, userId, reason?) => Promise<void>`, `banUser(roomId, userId, reason?) => Promise<void>`, `setPowerLevel(roomId, userId, level) => Promise<void>`

- [ ] **Step 1: Write failing test for members module**
  - Create `src/lib/matrix/api/members.test.ts`
  - Test `listMembers` maps joined members with presence/avatar, moderation methods call correct SDK APIs

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/lib/matrix/api/members.test.ts`
  - Expected: FAIL

- [ ] **Step 3: Implement `members.ts`**
  - Extract lines 565-581 (`listMembers`) from `service.ts`
  - Add `inviteUser` (`client.invite(roomId, userId)`), `kickUser` (`client.kick(roomId, userId, reason)`), `banUser` (`client.ban(roomId, userId, reason)`), `setPowerLevel` (`client.setPowerLevel(roomId, userId, level)`)
  - Accept `client` in constructor

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/lib/matrix/api/members.test.ts`
  - Expected: PASS

- [ ] **Step 5: Update `service.ts` to delegate to MembersApi**
  - Import `MembersApi` from `./api/members`
  - Add private `membersApi: MembersApi` field
  - Delegate all member methods

- [ ] **Step 6: Run member-related tests**
  - Run: `pnpm vitest run src/features/shell/MemberList.test.tsx src/features/shell/MemberDropdownContent.test.tsx`
  - Expected: All PASS (create tests if missing)

- [ ] **Step 7: Commit**
  ```bash
  git add src/lib/matrix/api/members.ts src/lib/matrix/api/members.test.ts src/lib/matrix/service.ts
  git commit -m "refactor(matrix): extract MembersApi to lib/matrix/api/members.ts"
  ```

---

### Task 10: Update `service.ts` Facade & Barrel Export

**Files:**
- Modify: `src/lib/matrix/service.ts` (final facade), `src/lib/matrix/index.ts` (create barrel)
- Test: Full test suite

**Interfaces:**
- Consumes: All API classes from `./api/*`
- Produces: Single `MatrixService` class with identical public API to original

- [ ] **Step 1: Update `service.ts` to compose all APIs**
  - Constructor creates all API instances sharing the same `client` reference
  - All public methods delegate to respective API
  - Maintain `clientFactory` injection for tests
  - Keep `createClient`, `requireClient` private helpers

- [ ] **Step 2: Create `index.ts` barrel export**
  ```typescript
  export * from './service';
  export * from './types';
  export * from './api/auth';
  export * from './api/sync';
  export * from './api/messages';
  export * from './api/guilds';
  export * from './api/channels';
  export * from './api/media';
  export * from './api/profile';
  export * from './api/presence';
  export * from './api/members';
  ```

- [ ] **Step 3: Run full test suite**
  - Run: `pnpm vitest run`
  - Expected: All PASS (zero regressions)

- [ ] **Step 4: Verify build**
  - Run: `pnpm tauri build` (or `pnpm build` for web)
  - Expected: Successful build

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/matrix/service.ts src/lib/matrix/index.ts
  git commit -m "refactor(matrix): complete MatrixService facade + barrel export"
  ```

---

### Task 11: Cleanup & Documentation

**Files:**
- Modify: `src/lib/matrix/types.ts` (add any missing branded types for new APIs)
- Create: `docs/architecture/matrix-service.md` (architecture decision record)

- [ ] **Step 1: Verify no unused imports in service.ts**
  - Remove any dead code, unused helper functions

- [ ] **Step 2: Add JSDoc to each API class**
  - Document purpose, constructor params, key methods

- [ ] **Step 3: Write ADR**
  - Document why split, module boundaries, future extension points

- [ ] **Step 4: Final full test run**
  - Run: `pnpm vitest run --coverage`
  - Expected: Coverage ≥ 80% on new API files

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/matrix/types.ts docs/architecture/matrix-service.md
  git commit -m "docs(matrix): add ADR for MatrixService modularization"
  ```

---

## Execution Order

```
Task 1 (Auth) → Task 2 (Sync) → Task 3 (Messages) → Task 4 (Guilds) 
    → Task 5 (Channels) → Task 6 (Media) → Task 7 (Profile) 
    → Task 8 (Presence) → Task 9 (Members) → Task 10 (Facade) → Task 11 (Cleanup)
```

Each task is independently testable. Tasks 1-9 can be parallelized in pairs since they only touch `service.ts` delegation. Tasks 10-11 require all APIs complete.

---

## Estimated Effort

| Task | Estimate | Risk |
|------|----------|------|
| 1 Auth | 2h | Low — well-isolated |
| 2 Sync | 2h | Medium — wiring integration |
| 3 Messages | 3h | High — most callers, optimistic UI |
| 4 Guilds | 2h | Low |
| 5 Channels | 2h | Low |
| 6 Media | 1h | Low |
| 7 Profile | 2h | Medium — banner DM logic |
| 8 Presence | 1h | Low |
| 9 Members | 2h | Medium — moderation APIs |
| 10 Facade | 1h | Low |
| 11 Cleanup | 1h | Low |
| **Total** | **~19h** | |

---

## Success Criteria

- [ ] All existing tests pass without modification
- [ ] `MatrixService` public API identical (zero caller changes)
- [ ] Each API module < 200 lines, single responsibility
- [ ] New unit tests for each API module (≥ 80% coverage)
- [ ] Build succeeds (`pnpm tauri build`)
- [ ] No TypeScript errors (`pnpm tsc --noEmit`)
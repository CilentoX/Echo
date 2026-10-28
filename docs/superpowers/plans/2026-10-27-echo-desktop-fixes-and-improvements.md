# Echo Desktop Fixes and Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical bugs (B1-B11), resolve TypeScript errors, fix failing tests, and implement missing Discord-parity features (P0-P3) to achieve a production-ready Matrix client.

**Architecture:** The plan follows a dependency-ordered approach: first fix infrastructure bugs (auth/sync/logout) that block everything else, then resolve TypeScript errors and test infrastructure, then implement missing features in priority order (P0→P3). Each task produces independently testable changes with clear interfaces.

**Tech Stack:** Tauri 2, React 19, TypeScript 5, Vite 8, Tailwind 4, Zustand v5, matrix-js-sdk v44, Phosphor Icons, shadcn/ui (Radix UI), Vitest, React Testing Library, Appwrite SDK.

**Spec:**
- `docs/architecture/echo-desktop-rewrite-design.md` (refactor goals G1-G8)
- `docs/architecture/discord-replication-design.md` (feature gaps P0-P3)
- `docs/audits/echo-desktop-audit-2026-10-24.md` (bugs B1-B11 + 15 minor)

## Global Constraints

- **No mocks in production code** — all wiring must use real Matrix SDK (G4).
- **Dark-first semantic palette** — tokens in `src/styles/tokens.css`; no hardcoded hex colors.
- **Tailwind v4** — use `@theme inline` CSS variables; no `tailwind.config.js`.
- **Zustand v5** — stores use `useSyncExternalStore`; selectors return stable `EMPTY` arrays.
- **Conventional Commits** — English messages; format: `type(scope): description`.
- **Phase 1 scope only** — text channels, DMs, reactions, history, typing; voice/video deferred.
- **No new dependencies** without explicit approval.

## Review Focus

| Input / Failure Mode | Expected Behavior | Test Pinning |
|----------------------|-------------------|--------------|
| Fresh login (no prior sync) | Full guild/channel/member sync completes; UI shows guilds immediately | Task 1.3: integration test for `startSyncWiring` → `loadInitialData` |
| Auth token revoked mid-session (M_UNKNOWN_TOKEN) | Immediate logout + store reset; no stale data shown | Task 1.4: `handleStatus` with `M_UNKNOWN_TOKEN` calls `onAuthFailure` |
| User clicks logout button | Full session teardown; returns to login screen | Task 2.2: `performLogout` → `stopSyncWiring` → stores reset |
| Network flakiness during sync | "Reconectando…" indicator; no logout; auto-reconnect | Task 1.4: `handleStatus` with network error keeps session |
| Created channel via modal | Appears in sidebar immediately; auto-selected | Task 3.3: `CreateChannelModal.onCreated` → `setChannels` + `setActiveChannel` |
| Message history scroll-up | Older messages prepended; no duplicate eventIds; scroll position preserved | Task 4.2: `loadOlder` → `prependEvents` dedupe |
| Reaction added via UI | Sent to server via `m.reaction`; appears in timeline; persists on reload | Task 5.2: `sendReaction` → `matrixService.sendReaction` → `applyReaction` |
| Typing indicator received | Shows "X está digitando…" in channel header; clears on timeout | Task 6.1: `onTyping` → `uiStore.setTypingUsers` aggregation |

---

### Task 1: Fix Critical Auth/Sync Bugs (B11, B1, B3, B4)

**Files:**
- Modify: `src/lib/matrix/wiring.ts:87-104` (handleStatus)
- Modify: `src/lib/matrix/wiring.ts:107-149` (startSyncWiring)
- Modify: `src/lib/matrix/wiring.ts:152-166` (stopSyncWiring)
- Modify: `src/lib/matrix/instance.ts` (ensure `startSync` returns guilds on fresh login)
- Test: `src/lib/matrix/wiring.test.ts` (new)

**Interfaces:**
- Consumes: `matrixService.startSyncHandlers`, `matrixService.listGuilds`, `matrixService.listChannels`, `matrixService.listMembers`
- Produces: `startSyncWiring(onAuthFailure)`, `stopSyncWiring()`, `loadInitialData()`

- [ ] **Step 1.1: Write failing test for fresh login sync (B11)**

```typescript
// wiring.test.ts
test("fresh login loads guilds, channels, members and selects first channel", async () => {
  const onAuthFailure = vi.fn();
  const guilds = [{ guildId: "g1", name: "Guild One", avatarUrl: null, unreadCount: 0 }];
  const channels = [{ channelId: "c1", name: "general", guildId: "g1", type: "text" }];
  const members = [{ userId: "@me:hs", displayName: "Me", avatarUrl: null }];

  matrixService.listGuilds.mockResolvedValue(guilds);
  matrixService.listChannels.mockResolvedValue(channels);
  matrixService.listMembers.mockResolvedValue(members);

  startSyncWiring(onAuthFailure);
  await vi.waitFor(() => expect(useSyncStore.getState().guilds).toEqual(guilds));
  await vi.waitFor(() => expect(useSyncStore.getState().channelsByGuild.g1).toEqual(channels));
  expect(useUiStore.getState().activeChannelId).toBe("c1");
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx vitest run src/lib/matrix/wiring.test.ts`
Expected: FAIL — `loadInitialData` not called on first "syncing" transition.

- [ ] **Step 1.3: Fix `handleStatus` to trigger `loadInitialData` on first "syncing" (B11)**

In `wiring.ts:87-104`, ensure `loadInitialData()` is awaited when `status === "syncing" && !initialDataLoaded`. The current code has this but `initialDataLoaded` flag may not reset properly on re-login. Add explicit reset of `initialDataLoaded = false` in `stopSyncWiring` (already there at line 157) and verify `startSyncWiring` sets it correctly.

- [ ] **Step 1.4: Fix auth error handling to logout on any auth failure (B1)**

In `handleStatus` (line 99-103), the check `isAuthError(error)` only handles `M_UNKNOWN_TOKEN`/`M_MISSING_TOKEN`. Ensure `onAuthFailure` is called for these codes **at any time**, not just on first sync. Current logic is correct; verify no early return prevents it.

- [ ] **Step 1.5: Fix updater banner infinite loop (B3)**

This is likely in Tauri updater config or a UI component polling. Search for "updater" or "update" in `src/` — if in `src-tauri/`, it's Rust side. If in React, find the banner component and add a dismissal flag in `uiStore` or `settingsStore`.

- [ ] **Step 1.6: Fix guild name becoming room ID after relogin (B4)**

In `ChannelSidebar.tsx:51`, `activeGuild` is derived from `guilds.find(g => g.guildId === activeGuildId)`. If `guilds` array is empty or stale after relogin, `activeGuild` is null and header shows "Echo". Fix: ensure `loadInitialData` populates `guilds` before UI reads it. Add a guard: if `activeGuildId` set but `guilds` empty, defer header render until guilds load.

- [ ] **Step 1.7: Run tests to verify fixes**

Run: `npx vitest run src/lib/matrix/wiring.test.ts`
Expected: PASS

- [ ] **Step 1.8: Commit**

```bash
git add src/lib/matrix/wiring.ts src/lib/matrix/wiring.test.ts
git commit -m "fix(auth): resolve fresh login sync (B11), auth error logout (B1), guild name relogin (B4)"
```

---

### Task 2: Fix Logout Flow (B2)

**Files:**
- Modify: `src/features/auth/logout.ts` (performLogout)
- Modify: `src/lib/matrix/wiring.ts:152-166` (stopSyncWiring)
- Test: `src/features/auth/logout.test.ts` (new)

**Interfaces:**
- Consumes: `stopSyncWiring()`, `matrixService.logout()`
- Produces: `performLogout(): Promise<void>`

- [ ] **Step 2.1: Write failing test for logout**

```typescript
// logout.test.ts
test("performLogout stops sync, clears stores, and calls matrix logout", async () => {
  const stopSyncWiringSpy = vi.spyOn(wiring, "stopSyncWiring");
  const matrixLogoutSpy = vi.spyOn(matrixService, "logout");

  await performLogout();

  expect(stopSyncWiringSpy).toHaveBeenCalled();
  expect(matrixLogoutSpy).toHaveBeenCalled();
  expect(useSyncStore.getState().guilds).toEqual([]);
  expect(useUiStore.getState().myUserId).toBeNull();
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/logout.test.ts`
Expected: FAIL — `performLogout` likely missing or incomplete.

- [ ] **Step 2.3: Implement `performLogout` in `logout.ts`**

```typescript
import { stopSyncWiring } from "@/lib/matrix/wiring";
import { matrixService } from "@/lib/matrix/instance";

export async function performLogout(): Promise<void> {
  stopSyncWiring();           // resets stores, clears flags
  await matrixService.logout(); // revokes token server-side
}
```

- [ ] **Step 2.4: Verify `stopSyncWiring` resets all state (B2)**

In `wiring.ts:152-166`, confirm:
- `matrixService.stopSync()` called
- `unsubscribeUi` cleaned up
- `started`, `initialDataLoaded` = false
- `loadedGuilds`, `typingByRoom` cleared
- `useSyncStore.getState().reset()` called
- `useUiStore` myUserId/activeGuild/activeChannel = null

- [ ] **Step 2.5: Run test to verify it passes**

Run: `npx vitest run src/features/auth/logout.test.ts`
Expected: PASS

- [ ] **Step 2.6: Commit**

```bash
git add src/features/auth/logout.ts src/features/auth/logout.test.ts
git commit -m "fix(auth): implement performLogout (B2)"
```

---

### Task 3: Fix Created Channel Not Appearing in Sidebar (B5)

**Files:**
- Modify: `src/features/shell/ChannelSidebar.tsx:196-210` (CreateChannelModal onCreated)
- Test: `src/features/shell/ChannelSidebar.test.tsx` (new)

**Interfaces:**
- Consumes: `matrixService.createChannel`, `useSyncStore.setChannels`, `useUiStore.setActiveChannel`
- Produces: Channel appears in sidebar immediately after creation

- [ ] **Step 3.1: Write failing test for channel creation**

```typescript
// ChannelSidebar.test.tsx
test("created channel appears in sidebar and is selected", async () => {
  const { getByRole } = render(<ChannelSidebar />);
  // Open modal, fill form, submit
  // Wait for onCreated callback
  const newChannel = { channelId: "new-c", name: "new-channel", guildId: "g1", type: "text" };
  await act(async () => {
    // simulate onCreated
  });
  expect(screen.getByText("new-channel")).toBeInTheDocument();
  expect(useUiStore.getState().activeChannelId).toBe("new-c");
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npx vitest run src/features/shell/ChannelSidebar.test.tsx`
Expected: FAIL — `onCreated` callback not updating store correctly.

- [ ] **Step 3.3: Fix `onCreated` in ChannelSidebar.tsx (B5)**

Current code (lines 203-208):
```typescript
onCreated={(channel) => {
  setActiveChannel(channel.channelId);
  setChannels(activeGuildId ?? "", [
    { ...channel, unreadCount: 0 },
    ...(Array.isArray(allChannels) ? allChannels : []),
  ]);
}}
```

Issue: `allChannels` is a selector snapshot (stable `EMPTY` array), not reactive. Replace with direct store read:
```typescript
onCreated={(channel) => {
  setActiveChannel(channel.channelId);
  const current = useSyncStore.getState().channelsByGuild[activeGuildId ?? ""] ?? [];
  setChannels(activeGuildId ?? "", [
    { ...channel, unreadCount: 0 },
    ...current,
  ]);
}}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `npx vitest run src/features/shell/ChannelSidebar.test.tsx`
Expected: PASS

- [ ] **Step 3.5: Commit**

```bash
git add src/features/shell/ChannelSidebar.tsx src/features/shell/ChannelSidebar.test.tsx
git commit -m "fix(sidebar): created channel appears immediately (B5)"
```

---

### Task 4: Implement Message History / Pagination (B6)

**Files:**
- Modify: `src/lib/matrix/wiring.ts:169-174` (loadOlder)
- Modify: `src/features/chat/MessageList.tsx` (new or existing — add scroll listener)
- Test: `src/lib/matrix/wiring.test.ts` (extend), `src/features/chat/MessageList.test.tsx` (new)

**Interfaces:**
- Consumes: `matrixService.loadOlder(channelId, limit)`, `syncStore.prependEvents`
- Produces: `loadOlder(channelId, limit): Promise<void>`

- [ ] **Step 4.1: Write failing test for loadOlder**

```typescript
// wiring.test.ts (extend)
test("loadOlder prepends events without duplicates", async () => {
  const oldEvents = [
    { eventId: "old-1", roomId: "c1", sender: "@a:hs", content: { msgtype: "m.text", body: "old" } },
    { eventId: "old-2", roomId: "c1", sender: "@a:hs", content: { msgtype: "m.text", body: "older" } },
  ];
  matrixService.loadOlder.mockResolvedValue(oldEvents);

  // Seed timeline with existing event
  useSyncStore.getState().applyEvent({ eventId: "existing", roomId: "c1", ... });

  await loadOlder("c1", 20);

  const timeline = useSyncStore.getState().timelineByChannel.c1;
  expect(timeline.map(e => e.eventId)).toEqual(["old-2", "old-1", "existing"]);
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `npx vitest run src/lib/matrix/wiring.test.ts`
Expected: FAIL — `prependEvents` may have dedupe bug or `loadOlder` not implemented.

- [ ] **Step 4.3: Fix `prependEvents` dedupe logic (B6)**

In `syncStore.ts:101-110`, current code:
```typescript
prependEvents: (channelId, events) =>
  set((state) => {
    const timeline = state.timelineByChannel[channelId] ?? [];
    const existingIds = new Set(timeline.map((m) => m.eventId));
    const newestFirst = [...events].reverse();
    const merged = [...newestFirst, ...timeline.filter((m) => !existingIds.has(m.eventId))];
    return { timelineByChannel: { ...state.timelineByChannel, [channelId]: merged } };
  }),
```

This is correct — it reverses events (oldest first) then prepends. Verify `matrixService.loadOlder` returns oldest→newest.

- [ ] **Step 4.4: Add scroll-up listener in MessageList**

Create or modify `MessageList.tsx` to detect scroll near top and call `loadOlder`. Use `IntersectionObserver` on a sentinel element at top of list.

- [ ] **Step 4.5: Run tests to verify**

Run: `npx vitest run src/lib/matrix/wiring.test.ts src/features/chat/MessageList.test.tsx`
Expected: PASS

- [ ] **Step 4.6: Commit**

```bash
git add src/lib/matrix/wiring.ts src/features/chat/MessageList.tsx src/features/chat/MessageList.test.tsx
git commit -m "feat(chat): implement message history pagination (B6)"
```

---

### Task 5: Fix Nested Scroll / Auto-scroll (B7)

**Files:**
- Modify: `src/features/chat/MessageList.tsx` (ensure single scroll container)
- Modify: `src/features/chat/ChatContent.tsx` (parent layout)
- Test: `src/features/chat/MessageList.test.tsx` (extend)

**Interfaces:**
- Consumes: `syncStore.selectTimeline`, `wiring.loadOlder`
- Produces: Single scrollable area with auto-scroll on new messages

- [ ] **Step 5.1: Audit current scroll containers**

Search for `overflow-y-auto` or `overflow-auto` in `ChatPane.tsx`, `ChatContent.tsx`, `MessageList.tsx`. There should be exactly **one** scroll container — the message list itself.

- [ ] **Step 5.2: Fix layout to have single scroll container (B7)**

In `ChatPane.tsx:72`, `<div className="flex-1 px-4 py-4">{children}</div>` — remove `overflow` here.
In `MessageList.tsx`, ensure the list wrapper has `overflow-y-auto` and `flex-1`.

- [ ] **Step 5.3: Implement auto-scroll on new message**

In `MessageList`, use `useEffect` watching `timeline.length` — if user scrolled to bottom (within 100px), `scrollIntoView` the new message. If user scrolled up, show "new messages" toast (deferred).

- [ ] **Step 5.4: Write test for auto-scroll behavior**

```typescript
test("auto-scrolls when at bottom, stays when scrolled up", () => {
  // Render with long timeline
  // Simulate new message
  // Verify scrollTop = scrollHeight - clientHeight
});
```

- [ ] **Step 5.5: Run tests**

Run: `npx vitest run src/features/chat/MessageList.test.tsx`
Expected: PASS

- [ ] **Step 5.6: Commit**

```bash
git add src/features/chat/MessageList.tsx src/features/chat/ChatContent.tsx
git commit -m "fix(chat): single scroll container + auto-scroll (B7)"
```

---

### Task 6: Implement Real Reactions (B8)

**Files:**
- Modify: `src/lib/matrix/instance.ts` (add `sendReaction`)
- Modify: `src/lib/matrix/wiring.ts` (ensure `onReaction` wired)
- Modify: `src/features/chat/MessageBubble.tsx` (reaction UI + send)
- Test: `src/lib/matrix/instance.test.ts` (new), `src/features/chat/MessageBubble.test.tsx` (extend)

**Interfaces:**
- Consumes: `matrix-js-sdk` `sendEvent` for `m.reaction`
- Produces: `matrixService.sendReaction(roomId, eventId, emoji): Promise<void>`

- [ ] **Step 6.1: Add `sendReaction` to MatrixService (B8)**

In `instance.ts`, add:
```typescript
async sendReaction(roomId: string, eventId: string, emoji: string): Promise<void> {
  const content = {
    "m.relates_to": {
      rel_type: "m.annotation",
      event_id: eventId,
      key: emoji,
    },
  };
  await this.client.sendEvent(roomId, "m.reaction", content);
}
```

- [ ] **Step 6.2: Wire reaction UI in MessageBubble**

In `MessageBubble.tsx`, add reaction picker button → on select call `matrixService.sendReaction`. Reaction display already uses `selectReactions(eventId)` from syncStore.

- [ ] **Step 6.3: Write test for reaction send + receive**

```typescript
test("sending reaction calls SDK and appears in timeline", async () => {
  const sendReactionSpy = vi.spyOn(matrixService, "sendReaction").mockResolvedValue();
  // Click reaction button, pick emoji
  await act(async () => { /* click */ });
  expect(sendReactionSpy).toHaveBeenCalledWith("room", "event", "👍");
  // Verify applyReaction called via onReaction handler
});
```

- [ ] **Step 6.4: Run tests**

Run: `npx vitest run src/features/chat/MessageBubble.test.tsx`
Expected: PASS

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/matrix/instance.ts src/features/chat/MessageBubble.tsx
git commit -m "feat(chat): real reactions via m.reaction (B8)"
```

---

### Task 7: Implement Real Typing Indicators (B9)

**Files:**
- Modify: `src/lib/matrix/instance.ts` (verify `setTyping` sends `m.typing`)
- Modify: `src/features/chat/ChatInput.tsx` (debounced typing on input)
- Test: `src/lib/matrix/instance.test.ts` (extend), `src/features/chat/ChatInput.test.tsx` (new)

**Interfaces:**
- Consumes: `matrix-js-sdk` `sendTyping`
- Produces: `matrixService.setTyping(roomId, typing): Promise<void>`

- [ ] **Step 7.1: Verify `setTyping` in instance.ts (B9)**

Current `wiring.ts:185-187` calls `matrixService.setTyping`. Check `instance.ts` has:
```typescript
async setTyping(roomId: string, typing: boolean): Promise<void> {
  await this.client.sendTyping(roomId, typing, 30000); // 30s timeout
}
```

- [ ] **Step 7.2: Add debounced typing in ChatInput**

In `ChatInput.tsx`, on `onChange`, debounce 500ms → call `wiring.setTyping(roomId, true)`. On blur or stop typing, `setTyping(false)`. Cleanup on unmount.

- [ ] **Step 7.3: Write test for typing send/receive**

```typescript
test("typing indicator sent on input, cleared on stop", async () => {
  const setTypingSpy = vi.spyOn(matrixService, "setTyping");
  // Type in input
  await act(async () => { fireEvent.change(input, { target: { value: "hi" } }); });
  expect(setTypingSpy).toHaveBeenCalledWith("room", true);
  // Wait for debounce + timeout
  await act(async () => { await new Promise(r => setTimeout(r, 600)); });
  expect(setTypingSpy).toHaveBeenCalledWith("room", false);
});
```

- [ ] **Step 7.4: Run tests**

Run: `npx vitest run src/features/chat/ChatInput.test.tsx`
Expected: PASS

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/matrix/instance.ts src/features/chat/ChatInput.tsx
git commit -m "feat(chat): real typing indicators (B9)"
```

---

### Task 8: Implement Redaction, Edit, Media Handling (B10)

**Files:**
- Modify: `src/lib/matrix/instance.ts` (add `redactEvent`, `editEvent`, `sendMedia`)
- Modify: `src/features/chat/MessageBubble.tsx` (context menu: edit/delete)
- Modify: `src/features/chat/ChatInput.tsx` (media upload button)
- Test: `src/lib/matrix/instance.test.ts` (extend), `src/features/chat/MessageBubble.test.tsx` (extend)

**Interfaces:**
- Consumes: `matrix-js-sdk` `redactEvent`, `sendEvent` (m.room.message with `m.new_content`), `uploadContent` + `sendEvent` (m.image/m.file)
- Produces: `matrixService.redactEvent(roomId, eventId, reason?)`, `matrixService.editEvent(roomId, eventId, newBody)`, `matrixService.sendMedia(roomId, file)`

- [ ] **Step 8.1: Add redaction, edit, media to MatrixService (B10)**

In `instance.ts`:
```typescript
async redactEvent(roomId: string, eventId: string, reason?: string): Promise<void> {
  await this.client.redactEvent(roomId, eventId, reason);
}

async editEvent(roomId: string, eventId: string, newBody: string): Promise<void> {
  await this.client.sendEvent(roomId, "m.room.message", {
    msgtype: "m.text",
    body: newBody,
    "m.new_content": { msgtype: "m.text", body: newBody },
    "m.relates_to": { rel_type: "m.replace", event_id: eventId },
  });
}

async sendMedia(roomId: string, file: File): Promise<void> {
  const { uri } = await this.client.uploadContent(file, { name: file.name, type: file.type });
  const msgtype = file.type.startsWith("image/") ? "m.image" : "m.file";
  await this.client.sendEvent(roomId, "m.room.message", {
    msgtype,
    body: file.name,
    url: uri,
    info: { mimetype: file.type, size: file.size },
  });
}
```

- [ ] **Step 8.2: Add context menu to MessageBubble (edit/delete)**

Right-click or hover menu → "Editar" calls `editEvent`, "Apagar" calls `redactEvent`.

- [ ] **Step 8.3: Add media upload button to ChatInput**

File input → on select call `sendMedia`.

- [ ] **Step 8.4: Write tests**

```typescript
test("redact sends m.room.redaction", async () => { ... });
test("edit sends m.replace", async () => { ... });
test("media upload + send", async () => { ... });
```

- [ ] **Step 8.5: Run tests**

Run: `npx vitest run src/lib/matrix/instance.test.ts src/features/chat/MessageBubble.test.tsx`
Expected: PASS

- [ ] **Step 8.6: Commit**

```bash
git add src/lib/matrix/instance.ts src/features/chat/MessageBubble.tsx src/features/chat/ChatInput.tsx
git commit -m "feat(chat): redaction, edit, media handling (B10)"
```

---

### Task 9: Fix TypeScript Errors (8 errors)

**Files:**
- Modify: `src/components/media/MxcImage.tsx:1,2,44,72,139`
- Modify: `src/features/profile/Profile.test.tsx:44`
- Modify: `src/features/profile/Profile.tsx:162`
- Modify: `src/features/profile/types.ts:2`

**Interfaces:** N/A — cleanup only

- [ ] **Step 9.1: Fix `MxcImage.tsx` unused imports (lines 1, 2, 44, 72)**

Remove `useEffect`, `getMxcMediaId`, `method`, `maxRetries` if unused. Fix line 139: `src={httpUrl}` — `httpUrl` is `string | null`, `img.src` expects `string | undefined`. Change to `src={httpUrl ?? undefined}`.

- [ ] **Step 9.2: Fix `Profile.test.tsx:44` unused `onOpenChange`**

Remove from destructuring or prefix with `_`.

- [ ] **Step 9.3: Fix `Profile.tsx:162` unused `avatarUrl`**

Remove from destructuring: `const { displayName, username, appwriteAvatarUrl, nickname } = useProfileStore();`

- [ ] **Step 9.4: Fix `types.ts:2` unused `ReactNode`**

Remove import.

- [ ] **Step 9.5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 9.6: Commit**

```bash
git add src/components/media/MxcImage.tsx src/features/profile/Profile.test.tsx src/features/profile/Profile.tsx src/features/profile/types.ts
git commit -m "fix(types): resolve 8 TypeScript errors"
```

---

### Task 10: Fix Profile Tests (Appwrite Connection)

**Files:**
- Modify: `src/features/profile/Profile.test.tsx` (mock Appwrite)
- Modify: `src/test/setup.ts` (global mocks)

**Interfaces:** N/A — test infrastructure

- [ ] **Step 10.1: Add Appwrite mock to test setup**

In `src/test/setup.ts`, mock `@/lib/appwrite/storage`:
```typescript
vi.mock("@/lib/appwrite/storage", () => ({
  uploadImage: vi.fn().mockResolvedValue("https://example.com/avatar.png"),
}));
```

- [ ] **Step 10.2: Fix Profile.test.tsx to use mocked store**

Ensure `useProfileStore` returns test data without real Appwrite calls.

- [ ] **Step 10.3: Run tests**

Run: `npx vitest run src/features/profile/Profile.test.tsx`
Expected: PASS (3 previously failing tests now pass)

- [ ] **Step 10.4: Commit**

```bash
git add src/test/setup.ts src/features/profile/Profile.test.tsx
git commit -m "fix(test): mock Appwrite for profile tests"
```

---

### Task 11: Implement P0 Discord Parity — Threads in Sidebar

**Files:**
- Create: `src/features/shell/ThreadSidebar.tsx`
- Modify: `src/features/shell/ChannelSidebar.tsx` (integrate threads)
- Modify: `src/stores/syncStore.ts` (add `threadsByChannel`)
- Test: `src/features/shell/ThreadSidebar.test.tsx`

**Interfaces:**
- Consumes: `matrixService.listThreads(channelId)`, `syncStore.setThreads`
- Produces: Thread list in sidebar, click opens thread view

- [ ] **Step 11.1: Add threads to syncStore**

Add `threadsByChannel: Record<string, ThreadSummary[]>`, `setThreads(channelId, threads)`, selectors.

- [ ] **Step 11.2: Implement ThreadSidebar component**

Mirror `ChannelSidebar` structure — list threads for active channel, click to open.

- [ ] **Step 11.3: Wire thread loading in wiring.ts**

In `loadChannelsFor`, also load threads for each channel (or on demand when channel selected).

- [ ] **Step 11.4: Write tests**

- [ ] **Step 11.5: Commit**

```bash
git add src/stores/syncStore.ts src/features/shell/ThreadSidebar.tsx src/features/shell/ChannelSidebar.tsx
git commit -m "feat(sidebar): threads in sidebar (P0)"
```

---

### Task 12: Implement P0 Discord Parity — Mentions & Notifications

**Files:**
- Modify: `src/lib/matrix/instance.ts` (push rules / mention detection)
- Modify: `src/features/chat/MessageList.tsx` (highlight mentions)
- Modify: `src/stores/uiStore.ts` (add `unreadMentions`)
- Test: `src/lib/matrix/instance.test.ts` (extend)

**Interfaces:**
- Consumes: Matrix push rules, `m.receipt` for mention tracking
- Produces: Mention badge in sidebar, toast notification, highlight in message

- [ ] **Step 12.1: Add mention detection in MessageList**

Check `event.content.body` for `@username` or `@room` — highlight with accent color.

- [ ] **Step 12.2: Add unread mention count to channel/guild**

In `syncStore`, track `unreadMentionsByChannel` and roll up to guild.

- [ ] **Step 12.3: Implement native notification (settings already exist)**

Use `navigator.serviceWorker` + Push API or Tauri notification API.

- [ ] **Step 12.4: Write tests**

- [ ] **Step 12.5: Commit**

```bash
git add src/features/chat/MessageList.tsx src/stores/syncStore.ts src/stores/uiStore.ts
git commit -m "feat(notifications): mentions + native notifications (P0)"
```

---

### Task 13: Implement P1 — Search (Messages, Users, Channels)

**Files:**
- Create: `src/features/search/SearchModal.tsx`
- Modify: `src/lib/matrix/instance.ts` (add `searchMessages`, `searchUsers`)
- Modify: `src/stores/uiStore.ts` (search state)
- Test: `src/features/search/SearchModal.test.tsx`

**Interfaces:**
- Consumes: `matrix-js-sdk` `search` API
- Produces: Cmd+K modal with results grouped by type

- [ ] **Step 13.1: Add search methods to MatrixService**
- [ ] **Step 13.2: Create SearchModal with keyboard shortcut (Cmd+K)**
- [ ] **Step 13.3: Write tests**
- [ ] **Step 13.4: Commit**

---

### Task 14: Implement P1 — Pin Messages, Announcements, Role Colors

**Files:**
- Modify: `src/lib/matrix/instance.ts` (pin/announcement events)
- Modify: `src/features/chat/MessageList.tsx` (pinned message bar)
- Modify: `src/stores/syncStore.ts` (pinned events, role colors)
- Test: new

---

### Task 15: Implement P2 — Message Threads UI, Reactions Picker, Markdown Rendering

**Files:**
- Create: `src/features/chat/ThreadView.tsx`
- Modify: `src/components/emoji/EmojiPicker.tsx` (ensure accessible)
- Modify: `src/features/chat/MessageBubble.tsx` (markdown via `remark`/`markdown-it`)
- Test: new

---

### Task 16: Implement P2 — Keyboard Shortcuts, Compact Mode

**Files:**
- Create: `src/hooks/useKeyboardShortcuts.ts`
- Modify: `src/stores/settingsStore.ts` (compact mode setting)
- Modify: `src/features/chat/MessageList.tsx` (compact density)
- Test: new

---

### Task 17: Implement P3 — Voice/Video Prep, Bots/Webhooks, E2E Encryption

**Files:**
- Create: `src/features/calls/` (stubs)
- Create: `src/lib/crypto/` (Olm/Verde setup)
- Modify: `src/lib/matrix/instance.ts` (crypto init)
- Test: new

---

### Task 18: Polish & Accessibility Audit

**Files:**
- Modify: All interactive components (ARIA, focus management)
- Modify: `src/styles/tokens.css` (contrast verification)
- Test: `npx vitest run --coverage`

---

## Execution Order Summary

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| **Critical Bugs** | 1, 2 | None |
| **Data Flow** | 3, 4, 5 | Task 1 |
| **Core Features** | 6, 7, 8 | Task 1 |
| **TypeScript/Tests** | 9, 10 | None (parallel) |
| **P0 Parity** | 11, 12 | Task 1, 4 |
| **P1 Parity** | 13, 14 | Task 11, 12 |
| **P2 Parity** | 15, 16 | Task 11 |
| **P3 Prep** | 17 | Task 1 |
| **Polish** | 18 | All above |

## Recommended Execution Method

**Subagent-driven** — because:
- 18 tasks with clear but interdependent interfaces (stores, wiring, MatrixService)
- Critical bugs (Tasks 1-2) must be correct before features build on them
- Independent reviewer per task catches store wiring bugs early
- Native execution risks cascading errors if Task 1 has subtle bug

Does the plan capture what you want? Should we proceed with subagent-driven execution?
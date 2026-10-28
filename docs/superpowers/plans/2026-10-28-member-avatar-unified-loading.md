# Member Avatar Unified Loading Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix member avatar infinite loading spinner by creating a unified user profile fetch function and proper fallback chain (Matrix avatar → Appwrite avatar → initials).

**Architecture:** Add `getUserProfile(userId)` to MatrixService that returns all profile data in one SDK call. Update MemberDropdownContent to use this function with proper fallback chain. Ensure profileStore loads on shell mount for "my user" avatar.

**Tech Stack:** Tauri 2, React 19, TypeScript 5, matrix-js-sdk v44, Zustand v5, shadcn/ui

**Spec:** docs/architecture/echo-desktop-rewrite-design.md (refactor goals G1-G8)

## Global Constraints

- **No mocks in production code** — all wiring must use real Matrix SDK (G4).
- **Dark-first semantic palette** — tokens in `src/styles/tokens.css`; no hardcoded hex colors.
- **Tailwind v4** — use `@theme inline` CSS variables.
- **Zustand v5** — stores use stable selectors with `useShallow` where needed.
- **Conventional Commits** — English messages; format: `type(scope): description`.
- **No new dependencies** without explicit approval.

## Review Focus

| Input / Failure Mode | Expected Behavior | Test Pinning |
|----------------------|-------------------|--------------|
| User has no Matrix avatar | Shows Appwrite avatar URL as fallback (for my user) or initials | Task 2.3: MemberDropdownContent with null avatarUrl |
| User has Appwrite avatar but no Matrix avatar | Appwrite URL used for my user, initials for others | Task 2.3: appwriteAvatarUrl fallback |
| loadProfile not called on shell mount | Avatar spinner never resolves | Task 1.2: Shell calls loadProfile on mount |
| Matrix API returns null avatar_url | Falls back to initials immediately, no spinner | Task 2.3: null avatar → initials |
| MxcImage receives null mxcUrl | Shows fallback immediately, no loading spinner | Already fixed in MxcImage.tsx |

---

### Task 1: Ensure profileStore loads on shell mount

**Files:**
- Modify: `src/App.tsx` — ensure `loadProfile()` is called when Shell mounts

**Interfaces:**
- Consumes: `useProfileStore((s) => s.loadProfile)`
- Produces: Profile data loaded into store before MemberDropdownContent renders

- [ ] **Step 1: Verify Shell calls loadProfile on mount**

Check `src/App.tsx` Shell component - it already calls `loadProfile()` in useEffect. Verify it works correctly.

- [ ] **Step 2: Test loadProfile is called**

Run existing test suite to verify no regressions.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix(profile): ensure loadProfile called on shell mount"
```

---

### Task 2: Add unified getUserProfile to MatrixService

**Files:**
- Modify: `src/lib/matrix/instance.ts` — add `getUserProfile(userId)` method
- Modify: `src/lib/matrix/service.ts` — add `getUserProfile(userId)` implementation
- Modify: `src/lib/matrix/types.ts` — add `UserProfile` type if needed
- Test: `src/lib/matrix/service.test.ts` or extend existing tests

**Interfaces:**
- Consumes: `matrixService.getProfileInfo(userId)` from SDK
- Produces: `getUserProfile(userId: string): Promise<{ displayName: string | null; avatarUrl: string | null; bannerUrl: string | null }>`

- [ ] **Step 1: Add UserProfile type to types.ts**

```typescript
export interface UserProfile {
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
}
```

- [ ] **Step 2: Add getUserProfile to service.ts**

```typescript
async getUserProfile(userId: string): Promise<UserProfile> {
  const res = await this.requireClient().getProfileInfo(userId);
  return {
    displayName: res.displayname ?? null,
    avatarUrl: res.avatar_url ?? null,
    bannerUrl: (res as { banner_url?: string }).banner_url ?? null,
  };
}
```

- [ ] **Step 3: Add getUserProfile to instance.ts**

Export the method from the singleton `matrixService`.

- [ ] **Step 4: Write test for getUserProfile**

Test that it calls `getProfileInfo` once and returns all three fields.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/service.ts src/lib/matrix/instance.ts src/lib/matrix/types.ts
git commit -m "feat(matrix): add getUserProfile unified fetch"
```

---

### Task 3: Update MemberDropdownContent with unified profile fetch + fallback

**Files:**
- Modify: `src/features/shell/MemberDropdownContent.tsx`

**Interfaces:**
- Consumes: `matrixService.getUserProfile(userId)`, `useProfileStore` for Appwrite URLs
- Produces: Avatar rendered with fallback chain: Matrix → Appwrite (my user only) → initials

- [ ] **Step 1: Refactor MemberDropdownContent to use getUserProfile**

Replace individual `getDisplayName`, `getAvatarUrl`, `getUserBanner` calls with single `getUserProfile(userId)` call.

- [ ] **Step 2: Add Appwrite fallback for "my user"**

For `isMyUser`, if Matrix avatarUrl is null, try `appwriteAvatarUrl` from profileStore.

- [ ] **Step 3: Show initials immediately when no avatar available**

If both Matrix and Appwrite URLs are null, show initials immediately (no spinner).

- [ ] **Step 4: Write test for fallback chain**

Test that MemberDropdownContent shows initials when both URLs are null, and shows Appwrite URL when available for my user.

- [ ] **Step 5: Commit**

```bash
git add src/features/shell/MemberDropdownContent.tsx
git commit -m "fix(member): unified profile fetch + avatar fallback chain"
```

---

## Execution Order Summary

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| Profile loading | Task 1 | None |
| Unified API | Task 2 | None |
| Component fix | Task 3 | Task 1, Task 2 |

## Recommended Execution Method

**Native** — 3 small tasks with clear interfaces; fastest to execute inline. The user has already explicitly chosen inline execution for this session.

Does the plan capture what you want? Should we proceed with execution?
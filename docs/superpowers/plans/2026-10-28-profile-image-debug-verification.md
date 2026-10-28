# Profile Image Debug Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trace the complete profile image flow (Matrix → store → component → MxcImage) and fix why images don't appear in MemberDropdownContent.

**Architecture:** Systematic verification of each layer in the chain: Matrix SDK → matrixService → getUserProfile → MemberDropdownContent → MxcImage → network request.

**Tech Stack:** React 19, TypeScript 5, matrix-js-sdk v44, Zustand v5, MxcImage component

**Spec:** docs/architecture/echo-desktop-rewrite-design.md

## Global Constraints

- **No mocks in production** — trace real data flow
- **Dark-first palette** — tokens in `src/styles/tokens.css`
- **Conventional Commits** — English messages

## Review Focus

| Input / Failure Mode | Expected Behavior | Test Pinning |
|----------------------|-------------------|--------------|
| Matrix SDK returns avatar_url | Stored in UserProfile, passed to MxcImage | Task 1: verify getUserProfile returns avatarUrl |
| MxcImage receives mxc:// URL | Converts to HTTP, renders image | Task 2: verify MxcImage gets correct URL |
| MxcImage receives null URL | Shows initials immediately | Task 3: verify fallback chain |
| MemberDropdownContent gets profile | Renders avatar with effectiveAvatarUrl | Task 4: verify component receives data |
| getUserProfile timeout | Shows initials after 5s | Task 5: verify timeout fallback |

---

### Task 1: Verify Matrix SDK → matrixService → getUserProfile returns avatarUrl

**Files:**
- Read: `src/lib/matrix/service.ts` (getUserProfile)
- Read: `src/lib/matrix/instance.ts` (matrixService export)
- Test: `src/lib/matrix/service.test.ts` (new)

**Interfaces:**
- Consumes: `matrix-js-sdk` `getProfileInfo(userId)`
- Produces: `getUserProfile(userId): Promise<UserProfile>` with `avatarUrl`

- [ ] **Step 1.1: Add debug logging to getUserProfile**

```typescript
async getUserProfile(userId: string): Promise<UserProfile> {
  const res = await this.requireClient().getProfileInfo(userId);
  console.debug("[getUserProfile] raw response:", res);
  return {
    displayName: res.displayname ?? null,
    avatarUrl: res.avatar_url ?? null,
    bannerUrl: (res as { banner_url?: string }).banner_url ?? null,
    bio: null,
    role: null,
  };
}
```

- [ ] **Step 1.2: Test in browser console**

Open devtools, run:
```js
// In console after login
const profile = await matrixService.getUserProfile("@me:litteris.online");
console.log("Profile:", profile);
```

- [ ] **Step 1.3: Verify avatar_url is returned**

Check if `avatar_url` is `mxc://...` or `null` or missing.

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/matrix/service.ts
git commit -m "debug(matrix): add logging to getUserProfile"
```

---

### Task 2: Verify MemberDropdownContent receives profile with avatarUrl

**Files:**
- Read: `src/features/shell/MemberDropdownContent.tsx`
- Test: `src/features/shell/MemberDropdownContent.test.tsx` (new)

**Interfaces:**
- Consumes: `matrixService.getUserProfile(userId)`
- Produces: `profile.avatarUrl` → `effectiveAvatarUrl` → `MxcImage mxcUrl`

- [ ] **Step 2.1: Add debug logging to MemberDropdownContent**

```tsx
useEffect(() => {
  // ... existing code ...
  const load = async () => {
    try {
      const fetched = await Promise.race([...]);
      console.debug("[MemberDropdownContent] fetched profile:", fetched);
      if (!cancelled) {
        setProfile(fetched);
        setLoading(false);
      }
    } catch (e) {
      console.error("[MemberDropdownContent] load error:", e);
      if (!cancelled) {
        setProfile(null);
        setLoading(false);
      }
    }
  };
  load();
}, [userId]);
```

- [ ] **Step 2.2: Add debug to effectiveAvatarUrl**

```tsx
const effectiveAvatarUrl = isMyUser
  ? (profile?.avatarUrl ?? myAppwriteAvatarUrl ?? null)
  : (profile?.avatarUrl ?? null);

console.debug("[MemberDropdownContent] effectiveAvatarUrl:", effectiveAvatarUrl, { isMyUser, profileAvatar: profile?.avatarUrl, myAppwriteAvatarUrl });
```

- [ ] **Step 2.3: Test in browser**

Open dropdown, check console for:
- `[MemberDropdownContent] fetched profile:`
- `[MemberDropdownContent] effectiveAvatarUrl:`

- [ ] **Step 2.4: Commit**

```bash
git add src/features/shell/MemberDropdownContent.tsx
git commit -m "debug(member): add logging to profile fetch and effectiveAvatarUrl"
```

---

### Task 3: Verify MxcImage receives and processes mxcUrl

**Files:**
- Read: `src/components/media/MxcImage.tsx`
- Test: `src/components/media/MxcImage.test.tsx` (new)

**Interfaces:**
- Consumes: `mxcUrl` prop
- Produces: `<img src={httpUrl}>` or fallback

- [ ] **Step 3.1: Add debug logging to MxcImage**

```tsx
export default function MxcImage({
  mxcUrl,
  // ... other props
}: { ... }) {
  console.debug("[MxcImage] received mxcUrl:", mxcUrl);
  // ... rest of component
}
```

- [ ] **Step 3.2: Verify httpUrl conversion**

```tsx
const httpUrl = !mxcUrl
  ? null
  : mxcUrl.startsWith("data:") || mxcUrl.startsWith("blob:") || mxcUrl.startsWith("http")
    ? mxcUrl
    : width && height
      ? mxcToThumbnail(mxcUrl, width, height, "crop")
      : mxcToHttp(mxcUrl);

console.debug("[MxcImage] httpUrl:", httpUrl, { mxcUrl, width, height });
```

- [ ] **Step 3.2: Test in browser**

Open dropdown, check console for:
- `[MxcImage] received mxcUrl:`
- `[MxcImage] httpUrl:`

- [ ] **Step 3.3: Verify network request**

Open Network tab, filter "Img", click dropdown → check if request fires and status.

- [ ] **Step 3.4: Commit**

```bash
git add src/components/media/MxcImage.tsx
git commit -m "debug(media): add logging to MxcImage mxcUrl processing"
```

---

### Task 4: Verify fallback chain (Matrix → Appwrite → initials)

**Files:**
- Read: `src/features/shell/MemberDropdownContent.tsx`
- Read: `src/stores/profileStore.ts`
- Test: `src/features/shell/MemberDropdownContent.test.tsx`

**Interfaces:**
- Consumes: `profile?.avatarUrl`, `myAppwriteAvatarUrl` (from profileStore)
- Produces: `effectiveAvatarUrl` passed to MxcImage

- [ ] **Step 4.1: Verify profileStore has appwriteAvatarUrl**

```tsx
// In MemberDropdownContent
const myAppwriteAvatarUrl = useProfileStore((state) => state.appwriteAvatarUrl);
console.debug("[MemberDropdownContent] myAppwriteAvatarUrl:", myAppwriteAvatarUrl);
```

- [ ] **Step 4.2: Verify loadProfile populates appwriteAvatarUrl**

```tsx
// In profileStore.ts loadProfile
loadProfile: async () => {
  // ...
  console.debug("[profileStore] loadProfile result:", { avatarUrl, appwriteAvatarUrl, displayName });
},
```

- [ ] **Step 4.3: Test fallback chain**

If Matrix avatarUrl is null, check if myAppwriteAvatarUrl is used.

- [ ] **Step 4.4: Commit**

```bash
git add src/stores/profileStore.ts src/features/shell/MemberDropdownContent.tsx
git commit -m "debug(profile): add logging to fallback chain"
```

---

### Task 5: Verify MxcImage network request and CORS

**Files:**
- Read: `src/lib/media/mxc.ts` (mxcToHttp, mxcToThumbnail)
- Test: Network tab manual verification

**Interfaces:**
- Consumes: `mxc://server/mediaId`
- Produces: `https://server/_matrix/media/v3/download/...`

- [ ] **Step 5.1: Verify mxcToHttp conversion**

```typescript
// In mxc.ts
export function mxcToHttp(mxcUrl: string): string {
  const match = mxcUrl.match(/^mxc:\/\/([^\/]+)\/(.+)$/);
  if (!match) return mxcUrl;
  const [, server, mediaId] = match;
  const url = `https://${server}/_matrix/media/v3/download/${server}/${mediaId}`;
  console.debug("[mxcToHttp] converted:", { mxcUrl, url });
  return url;
}
```

- [ ] **Step 5.2: Check Network tab for 404/403/CORS errors**

Open dropdown → Network tab → look for:
- Request URL format
- Response status (200, 404, 403, CORS error)
- Response headers (Content-Type, CORS headers)

- [ ] **Step 5.3: Test direct URL in browser**

Copy the generated HTTP URL, paste in new tab → should show image or error.

- [ ] **Step 5.4: Commit**

```bash
git add src/lib/media/mxc.ts
git commit -m "debug(media): add logging to mxcToHttp conversion"
```

---

### Task 6: Clean up debug logs after verification

**Files:**
- All files modified above

**Interfaces:** N/A

- [ ] **Step 6.1: Remove all debug console.debug/log statements**

- [ ] **Step 6.2: Run full test suite**

```bash
npx vitest run
npx tsc --noEmit
```

- [ ] **Step 6.3: Commit clean version**

```bash
git add .
git commit -m "fix(profile): remove debug logs, image display verified"
```

---

## Execution Order Summary

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| Data source | Task 1 | None |
| Component receive | Task 2 | Task 1 |
| Image component | Task 3 | Task 2 |
| Fallback chain | Task 4 | Task 2 |
| Network/CORS | Task 5 | Task 3 |
| Cleanup | Task 6 | Tasks 1-5 |

## Recommended Execution Method

**Native** — Sequential debugging tasks with immediate feedback in browser console. Fastest for interactive debugging.

---

**Next steps:** Please review the plan. Should we proceed with Task 1 (verify getUserProfile returns avatarUrl)?
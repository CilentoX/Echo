# Profile System Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical profile system issues: avatar missing in MemberDropdown for own user, incomplete loadProfile, and prepare global profile (banner/bio) via Appwrite Database.

**Architecture:** Fix data flow in 3 layers — (1) MemberDropdown fallback chain, (2) profileStore.loadProfile expansion, (3) Appwrite Database integration for global profiles. Each fix is isolated, testable, and follows existing patterns.

**Tech Stack:** React 19, TypeScript, Zustand, Matrix JS SDK, Appwrite SDK, Vitest

**Spec:** Based on comprehensive audit of profile system (stores, hooks, components, upload flow, MemberDropdown)

---

## Global Constraints

- **Zero breaking changes** to public APIs (`MatrixService`, `useProfileStore`, `useProfileEditor`)
- **Follow existing patterns** — Zustand stores, React hooks, TypeScript branded types
- **TDD mandatory** — write failing test first, then implement, then verify
- **Preserve fallback chains** — localStorage (Appwrite) → Matrix mxc:// → initials
- **All 127 existing matrix tests must pass** after each task

## Review Focus

| Input / Failure Mode | Expected Behavior | Test Location |
|----------------------|-------------------|---------------|
| Own user opens MemberDropdown | Avatar shows (Appwrite localStorage → Matrix mxc://) | MemberDropdownContent test |
| Other user opens MemberDropdown | Avatar shows (Matrix mxc:// from getUserProfile) | MemberDropdownContent test |
| Profile tab opens first time | loadProfile loads bio, role, nickname, joinedAt | profileStore test |
| Global profile missing in Appwrite DB | getGlobalProfile returns null gracefully | ProfileApi test |
| Banner upload with no Matrix support | Falls back to Appwrite only, no error | useImageUploadWithMatrix test |

---

## Task 1: Fix MemberDropdown Avatar Fallback Chain

**Files:**
- Modify: `apps/desktop/src/features/shell/MemberDropdownContent.tsx:131-136`
- Test: `apps/desktop/src/features/shell/MemberDropdownContent.test.tsx` (create)

**Interfaces:**
- Consumes: `matrixService.getUserProfile(userId)` → `UserProfile { avatarUrl: string | null }`
- Produces: Correct `effectiveAvatarUrl` for both own and other users

- [ ] **Step 1: Write failing test for own user avatar**
```typescript
it("shows own user avatar from profile.avatarUrl when myAppwriteAvatarUrl is null", () => {
  // Setup: isMyUser=true, myAppwriteAvatarUrl=null, profile.avatarUrl="mxc://avatar"
  // Expect: effectiveAvatarUrl === "mxc://avatar"
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run apps/desktop/src/features/shell/MemberDropdownContent.test.tsx::shows own user avatar`
Expected: FAIL (current logic prioritizes myAppwriteAvatarUrl which is null)

- [ ] **Step 3: Fix fallback chain in MemberDropdownContent.tsx:131-136**
```typescript
// Change from:
const effectiveAvatarUrl = isMyUser
  ? (myAppwriteAvatarUrl ?? profile?.avatarUrl ?? null)
  : (profile?.avatarUrl ?? null);

// To:
const effectiveAvatarUrl = profile?.avatarUrl 
  ?? (isMyUser ? myAppwriteAvatarUrl : null)
  ?? null;
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run apps/desktop/src/features/shell/MemberDropdownContent.test.tsx`
Expected: PASS

- [ ] **Step 5: Run all matrix tests**
Run: `npx vitest run apps/desktop/src/lib/matrix/`
Expected: 127/127 PASS

- [ ] **Step 6: Commit**
```bash
git add apps/desktop/src/features/shell/MemberDropdownContent.tsx apps/desktop/src/features/shell/MemberDropdownContent.test.tsx
git commit -m "fix(profile): correct avatar fallback chain in MemberDropdown
- Prioritize profile.avatarUrl (Matrix) over myAppwriteAvatarUrl (localStorage)
- Own user now shows avatar from getUserProfile when localStorage empty
- Other users unchanged (already used profile.avatarUrl)
- Added MemberDropdownContent test coverage"
```

---

## Task 2: Expand loadProfile to Load Full Profile Data

**Files:**
- Modify: `apps/desktop/src/stores/profileStore.ts:69-90`
- Test: `apps/desktop/src/stores/profileStore.test.ts` (extend)

**Interfaces:**
- Consumes: `matrixService.getUserProfile()` → `UserProfile { bio, role, ... }`
- Produces: `profileStore` state with `bio`, `role`, `nickname`, `joinedAt` populated

- [ ] **Step 1: Write failing test for bio/role loading**
```typescript
it("loadProfile populates bio and role from getUserProfile", async () => {
  // Mock getUserProfile to return { bio: "Hello", role: "Admin" }
  // Call loadProfile()
  // Expect: profileStore.bio === "Hello", profileStore.role === "Admin"
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run apps/desktop/src/stores/profileStore.test.ts::loadProfile populates bio`
Expected: FAIL (loadProfile doesn't call getUserProfile)

- [ ] **Step 4: Expand loadProfile in profileStore.ts:69-90**
```typescript
loadProfile: async () => {
  try {
    const [avatar, banner, displayName, userProfile] = await Promise.all([
      matrixService.getAvatarUrl(),
      matrixService.getBannerUrl(),
      matrixService.getDisplayName(),
      matrixService.getUserProfile(), // NEW: fetch full profile
    ]);

    const persistedAvatar = localStorage.getItem("echo:appwriteAvatarUrl");
    const persistedBanner = localStorage.getItem("echo:appwriteBannerUrl");

    set({
      avatarUrl: avatar ?? null,
      bannerUrl: banner ?? null,
      displayName: displayName ?? "",
      bio: userProfile?.bio ?? null,      // NEW
      role: userProfile?.role ?? null,    // NEW
      // nickname/joinedAt from Matrix sync or userProfile if available
      appwriteAvatarUrl: persistedAvatar ?? null,
      appwriteBannerUrl: persistedBanner ?? null,
    });
  } catch {
    // falha silenciosa
  }
}
```

- [ ] **Step 5: Run test to verify it passes**
Run: `npx vitest run apps/desktop/src/stores/profileStore.test.ts`
Expected: PASS

- [ ] **Step 6: Run all matrix tests**
Run: `npx vitest run apps/desktop/src/lib/matrix/`
Expected: 127/127 PASS

- [ ] **Step 7: Commit**
```bash
git add apps/desktop/src/stores/profileStore.ts apps/desktop/src/stores/profileStore.test.ts
git commit -m "feat(profile): expand loadProfile to fetch full user profile
- loadProfile now calls getUserProfile() for bio, role, nickname
- Profile tab shows bio/role immediately on open
- Falls back gracefully if getUserProfile fails
- All 127 matrix tests pass"
```

---

## Task 3: Prepare Appwrite Database for Global Profiles (Banner/Bio)

**Files:**
- Docs: `docs/appwrite/user_profiles_collection.md` (create)
- Modify: `apps/desktop/src/lib/appwrite/profiles.ts` (verify)
- Test: `apps/desktop/src/lib/matrix/api/profile.test.ts` (extend)

**Interfaces:**
- Consumes: Appwrite Database collection `user_profiles` with attributes
- Produces: `getGlobalProfile(userId)` returns banner, bio, links from DB

- [ ] **Step 1: Document collection schema**
Create `docs/appwrite/user_profiles_collection.md` with exact attributes.

- [ ] **Step 2: Verify profiles.ts works with real collection**
No code change needed — `getGlobalProfile` already implemented. Verify it returns correct shape.

- [ ] **Step 3: Add test for global profile with banner/bio**
```typescript
it("getUserProfile merges Matrix avatar + Appwrite banner/bio", async () => {
  // Mock getProfileInfo for avatar
  // Mock getGlobalProfile for bannerUrl, bio
  // Expect merged result with both sources
});
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run apps/desktop/src/lib/matrix/api/profile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add docs/appwrite/user_profiles_collection.md apps/desktop/src/lib/matrix/api/profile.test.ts
git commit -m "feat(profile): document Appwrite global profiles collection
- Collection: user_profiles (userId unique, avatarUrl, bannerUrl, bio, links)
- ProfileApi.getGlobalProfile ready to consume
- ProfileTab will show banner/bio from DB when available
- All tests pass"
```

---

## Task 4: Complete Profile Test Coverage

**Files:**
- Modify: `apps/desktop/src/features/profile/Profile.test.tsx`
- Test: Same file (extend)

**Interfaces:**
- Consumes: `ImageUploadWithEdit` mock with `editable`, `onRemove` props
- Produces: Full coverage of edit mode, avatar/banner upload, save/cancel

- [ ] **Step 1: Extend ImageUploadWithEdit mock**
Add support for `editable`, `onRemove`, `appwriteUrl`, `initials` props.

- [ ] **Step 2: Add tests for edit mode interactions**
```typescript
it("opens crop editor when clicking avatar in edit mode", async () => {
  // Click "Editar perfil" → click avatar → expect ImageEditor open
});
```

- [ ] **Step 3: Add tests for save/cancel flow**
```typescript
it("saves changes and updates store", async () => {
  // Edit fields → click Salvar → expect setDisplayName called
});
```

- [ ] **Step 4: Run tests**
Run: `npx vitest run apps/desktop/src/features/profile/Profile.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src/features/profile/Profile.test.tsx
git commit -m "test(profile): complete Profile.test.tsx coverage
- Mock ImageUploadWithEdit with editable, onRemove, appwriteUrl
- Cover edit mode: click avatar → crop editor → save
- Cover form fields: displayName, nickname, bio
- Cover cancel/restore flow
- All Profile tests pass"
```

---

## Execution Order

1. **Task 1** (Critical - Avatar MemberDropdown) → Immediate UX fix
2. **Task 2** (Medium - loadProfile) → Profile tab completeness  
3. **Task 3** (Medium - Appwrite DB) → Banner/bio persistence
4. **Task 4** (Low - Tests) → Confidence & regression prevention

Each task is independent, produces working software, and maintains 127/127 matrix tests passing.

---

## Estimated Effort

| Task | Complexity | Est. Time |
|------|------------|-----------|
| 1. MemberDropdown Avatar | Low | ~30 min |
| 2. loadProfile Expansion | Low | ~45 min |
| 3. Appwrite DB Setup | Medium | ~60 min (includes manual console steps) |
| 4. Test Coverage | Medium | ~60 min |

**Total:** ~3-4 hours for complete fix
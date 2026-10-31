# Eliminate Appwrite — Migrate to Echo API for Profile/Guild Images

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Appwrite dependency entirely. Use Echo API (PostgreSQL + local file storage) for all profile/guild images (avatars, banners) and profile data. Chat media already uses Echo API (Tasks 1-2 done).

**Architecture:** Echo API becomes the single backend for structured data (profiles, guilds) and blob storage (images). Desktop app calls Echo API REST endpoints directly. No more Appwrite SDK, no more dual-write to Matrix + Appwrite.

**Tech Stack:** Fastify, Prisma, PostgreSQL, local filesystem storage (already in Echo API), React/Zustand frontend.

**Spec:** This plan replaces the Appwrite integration documented in `docs/appwrite/user_profiles_collection.md` and the current code in `apps/desktop/src/lib/appwrite/`.

---

## Global Constraints

- **No Appwrite SDK** in desktop app — remove `appwrite` from `package.json` dependencies
- **Echo API is source of truth** for avatar/banner URLs (stored in PostgreSQL `user_profiles` and `guild_profiles`)
- **Matrix displayName/avatar** still synced via `matrixService.setDisplayName()` / `setAvatarUrl()` for Matrix compatibility
- **File storage** stays on VPS disk via Echo API `/uploads` (already implemented for chat media)
- **All image uploads** go through Echo API endpoints (`POST /api/upload/profile`, `POST /api/upload/guild`)
- **Profile data** (bio, links, nickname) stored in Echo API PostgreSQL, not Appwrite

---

## File Map

### Echo API (Backend) — New/Modified
| File | Responsibility |
|------|----------------|
| `src/routes/uploadRoutes.js` | Add `POST /api/upload/profile` and `POST /api/upload/guild` endpoints |
| `src/services/uploadService.js` | Add `saveProfileImage()` and `saveGuildImage()` helpers |
| `src/routes/userProfileRoutes.js` | PATCH/GET already work — ensure `nickname` field supported (separate plan) |
| `src/routes/guildProfileRoutes.js` | PATCH/GET already work |
| `prisma/schema.prisma` | No changes needed (avatarUrl, bannerUrl already exist) |

### Desktop App — Remove
| File | Reason |
|------|--------|
| `src/lib/appwrite/` (entire directory) | All Appwrite logic removed |
| `package.json` | Remove `appwrite` dependency |

### Desktop App — Modify
| File | Change |
|------|--------|
| `src/main.tsx` | Remove `pingAppwrite()` call |
| `src/lib/api/config.ts` | Ensure `ECHO_API_CONFIG.baseUrl` used for uploads |
| `src/stores/profileStore.ts` | Remove `appwriteAvatarUrl`, `appwriteBannerUrl` fields; remove localStorage persistence for them |
| `src/features/profile/hooks/useProfileEditor.ts` | Remove Appwrite upload calls; use Echo API |
| `src/features/profile/tabs/ProfileTab.tsx` | Replace `useImageUploadWithMatrix` with Echo API upload hook |
| `src/components/onboarding/AvatarUpload.tsx` | Use Echo API upload |
| `src/components/ImageUploadButton.tsx` | Use Echo API upload |
| `src/features/guild/CreateGuildModal.tsx` | Use Echo API upload for guild icon/banner |
| `src/features/guild/EditGuildModal.tsx` | Use Echo API upload for guild icon/banner |
| `src/features/guild/tabs/GuildProfileTab.tsx` | Remove hardcoded Appwrite URLs; use Echo API URLs |
| `src/lib/appwrite/useImageUploadWithMatrix.ts` | Delete — replace with `useImageUploadWithEchoApi.ts` |
| `src/lib/appwrite/useImageUpload.ts` | Delete |
| `src/lib/appwrite/storage.ts` | Delete — `uploadImage` replaced by Echo API call |

---

## Review Focus

1. **Image upload fails silently** — User sees no error when upload fails; profile appears unchanged. Test: network error during upload shows toast/error.
2. **Old Appwrite URLs still rendered** — Existing users have `appwriteAvatarUrl` in localStorage; migration reads them once then clears. Test: fresh install has no Appwrite URLs.
3. **Guild icon/banner not persisted** — CreateGuildModal/EditGuildModal upload to Echo API and PATCH guild profile. Test: guild avatar visible after create/edit.
4. **Nickname still not saved** — This plan doesn't add `nickname` to Prisma/API; separate plan needed. Test: nickname field in ProfileTab saves to Echo API (when API supports it).
5. **Race condition: upload + profile patch** — Upload returns URL, then PATCH profile with that URL. If PATCH fails, orphan file on disk. Test: PATCH failure rolls back (or accept orphan; cleanup job later).

---

## Task Breakdown

### Task 1: Echo API — Add Profile/Guild Image Upload Endpoints

**Files:**
- Modify: `echo-api/src/services/uploadService.js`
- Modify: `echo-api/src/routes/uploadRoutes.js`
- Test: `echo-api/src/routes/uploadRoutes.test.js` (new)

**Interfaces:**
- Produces: `uploadService.saveProfileImage(file, userId)` → `{ fileId, url, path, mimeType, size }`
- Produces: `uploadService.saveGuildImage(file, guildId)` → `{ fileId, url, path, mimeType, size }`
- Produces: `POST /api/upload/profile` (multipart: `file`, `userId`) → uploads to `/uploads/profile/{userId}/`, returns URL
- Produces: `POST /api/upload/guild` (multipart: `file`, `guildId`) → uploads to `/uploads/guild/{guildId}/`, returns URL

- [ ] **Step 1: Write failing test for `saveProfileImage`**

```javascript
// echo-api/src/routes/uploadRoutes.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadService } from "../services/uploadService.js";

describe("uploadService.saveProfileImage", () => {
  it("saves image to profile subdirectory and returns public URL", async () => {
    const mockFile = {
      filename: "avatar.png",
      mimetype: "image/png",
      toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-image-data")),
    };
    const result = await uploadService.saveProfileImage(mockFile, "@user:echo.litteris.online");
    expect(result.url).toContain("/uploads/profile/");
    expect(result.url).toContain("@user_echo.litteris.online");
    expect(result.mimeType).toBe("image/png");
  });

  it("rejects non-image MIME types", async () => {
    const mockFile = {
      filename: "test.pdf",
      mimetype: "application/pdf",
      toBuffer: vi.fn().mockResolvedValue(Buffer.from("pdf")),
    };
    await expect(uploadService.saveProfileImage(mockFile, "@user:echo.litteris.online"))
      .rejects.toThrow("Tipo de arquivo não permitido");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (`saveProfileImage` not defined)

- [ ] **Step 3: Implement `saveProfileImage(file, userId)` in `uploadService.js`**
  - Sanitize `userId` for filesystem (replace `@:` with `_`)
  - Save to `{UPLOAD_DIR}/profile/{sanitizedUserId}/{uuid}{ext}`
  - Return `{ fileId, originalName, mimeType, size, url, path }`
  - Use same `ALLOWED_MIME_TYPES` (images only)

- [ ] **Step 4: Implement `saveGuildImage(file, guildId)`** (same pattern, `/guild/{sanitizedGuildId}/`)

- [ ] **Step 5: Add routes in `uploadRoutes.js`**
  - `POST /api/upload/profile` — expects `file` + `userId` field → calls `saveProfileImage`
  - `POST /api/upload/guild` — expects `file` + `guildId` field → calls `saveGuildImage`
  - Both require `X-API-Key` auth (already via plugin)

- [ ] **Step 6: Write route tests** (integration style with fastify.inject)

- [ ] **Step 7: Run all tests — expect PASS**

- [ ] **Step 8: Commit**
```bash
git add echo-api/src/services/uploadService.js echo-api/src/routes/uploadRoutes.js echo-api/src/routes/uploadRoutes.test.js
git commit -m "feat(api): add profile/guild image upload endpoints"
```

---

### Task 2: Desktop — Create Echo API Image Upload Hook

**Files:**
- Create: `apps/desktop/src/lib/api/useImageUpload.ts`
- Test: `apps/desktop/src/lib/api/useImageUpload.test.ts`

**Interfaces:**
- Consumes: `ECHO_API_CONFIG.baseUrl` from `config.ts`
- Produces: `useImageUpload()` → `{ uploadAvatar(file), uploadBanner(file), uploadGuildIcon(file, guildId), uploadGuildBanner(file, guildId) }`
- Each returns `Promise<string>` = public HTTP URL from Echo API

- [ ] **Step 1: Write failing test for `uploadAvatar`**

```typescript
// apps/desktop/src/lib/api/useImageUpload.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImageUpload } from "./useImageUpload";

global.fetch = vi.fn();

describe("useImageUpload", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uploads avatar to Echo API and returns URL", async () => {
    (fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://api.echo.litteris.online/uploads/profile/@user_echo.litteris.online/abc123.png" }),
    });

    const { result } = renderHook(() => useImageUpload());
    let url: string;
    await act(async () => {
      url = await result.current.uploadAvatar(new File(["test"], "avatar.png", { type: "image/png" }));
    });
    expect(url).toContain("api.echo.litteris.online/uploads/profile/");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/upload/profile"),
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "X-API-Key": expect.any(String) }) })
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `useImageUpload.ts`**
  - `uploadAvatar(file)` → `POST /api/upload/profile` with `userId` from `matrixService.getUserId()`
  - `uploadBanner(file)` → same endpoint
  - `uploadGuildIcon(file, guildId)` → `POST /api/upload/guild`
  - `uploadGuildBanner(file, guildId)` → `POST /api/upload/guild`
  - Include `X-API-Key` header from `import.meta.env.VITE_ECHO_API_KEY` (or stored in config)
  - Return the `url` from response JSON

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src/lib/api/useImageUpload.ts apps/desktop/src/lib/api/useImageUpload.test.ts
git commit -m "feat(desktop): add useImageUpload hook for Echo API"
```

---

### Task 3: Desktop — Remove Appwrite from Profile Store

**Files:**
- Modify: `apps/desktop/src/stores/profileStore.ts`
- Test: `apps/desktop/src/stores/profileStore.test.ts`

**Interfaces:**
- Removes: `appwriteAvatarUrl`, `appwriteBannerUrl`, `setAppwriteAvatarUrl`, `setAppwriteBannerUrl`
- Removes: localStorage keys `echo:appwriteAvatarUrl`, `echo:appwriteBannerUrl`
- `loadProfile()` now gets avatar/banner from `matrixService.getUserProfile()` (which calls Echo API via ProfileApi)

- [ ] **Step 1: Write failing test for removed fields**

```typescript
// apps/desktop/src/stores/profileStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useProfileStore } from "./profileStore";

describe("profileStore without Appwrite", () => {
  beforeEach(() => useProfileStore.getState().reset());

  it("does not have appwriteAvatarUrl or appwriteBannerUrl fields", () => {
    const state = useProfileStore.getState();
    expect("appwriteAvatarUrl" in state).toBe(false);
    expect("appwriteBannerUrl" in state).toBe(false);
    expect("setAppwriteAvatarUrl" in state).toBe(false);
    expect("setAppwriteBannerUrl" in state).toBe(false);
  });

  it("loadProfile does not read localStorage for Appwrite URLs", () => {
    localStorage.setItem("echo:appwriteAvatarUrl", "https://old.appwrite.url/avatar.png");
    // loadProfile should not use this value
    // (test via mocking matrixService.getUserProfile)
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (fields still exist)

- [ ] **Step 3: Edit `profileStore.ts`**
  - Remove `appwriteAvatarUrl`, `appwriteBannerUrl` from state
  - Remove `setAppwriteAvatarUrl`, `setAppwriteBannerUrl` actions
  - Remove localStorage read/write in `loadProfile` and `reset`
  - `loadProfile` uses `matrixService.getUserProfile()` which already merges Matrix + Echo API data

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src/stores/profileStore.ts apps/desktop/src/stores/profileStore.test.ts
git commit -m "refactor(desktop): remove Appwrite fields from profileStore"
```

---

### Task 4: Desktop — Update ProfileTab to Use Echo API Upload

**Files:**
- Modify: `apps/desktop/src/features/profile/tabs/ProfileTab.tsx`
- Modify: `apps/desktop/src/features/profile/hooks/useProfileEditor.ts`
- Delete: `apps/desktop/src/lib/appwrite/useImageUploadWithMatrix.ts`

**Interfaces:**
- Consumes: `useImageUpload` from Task 2
- `useProfileEditor.saveChanges` calls `matrixService.patchGlobalProfile` with `avatarUrl`/`bannerUrl` from Echo API upload

- [ ] **Step 1: Write failing test for ProfileTab avatar upload**

```typescript
// apps/desktop/src/features/profile/tabs/ProfileTab.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfileTab } from "./ProfileTab";
import { useImageUpload } from "@/lib/api/useImageUpload";

vi.mock("@/lib/api/useImageUpload", () => ({
  useImageUpload: () => ({
    uploadAvatar: vi.fn().mockResolvedValue("https://api.echo.litteris.online/uploads/profile/abc.png"),
    uploadBanner: vi.fn().mockResolvedValue("https://api.echo.litteris.online/uploads/profile/def.png"),
  }),
}));

describe("ProfileTab with Echo API upload", () => {
  it("calls uploadAvatar when avatar changed in edit mode", async () => {
    // render ProfileTab in edit mode, click avatar, select file
    // verify useImageUpload.uploadAvatar called
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (still uses `useImageUploadWithMatrix`)

- [ ] **Step 3: Edit `ProfileTab.tsx`**
  - Replace `import { useImageUploadWithMatrix } from "@/lib/appwrite/useImageUploadWithMatrix"` with `import { useImageUpload } from "@/lib/api/useImageUpload"`
  - Use `uploadAvatar`/`uploadBanner` from new hook

- [ ] **Step 4: Edit `useProfileEditor.ts`**
  - Remove Appwrite upload logic (already only calls `patchGlobalProfile` with URLs)
  - Ensure `saveChanges` passes Echo API URLs to `patchGlobalProfile`

- [ ] **Step 5: Delete `useImageUploadWithMatrix.ts`**

- [ ] **Step 6: Run tests — expect PASS**

- [ ] **Step 7: Commit**
```bash
git add apps/desktop/src/features/profile/tabs/ProfileTab.tsx apps/desktop/src/features/profile/hooks/useProfileEditor.ts
git rm apps/desktop/src/lib/appwrite/useImageUploadWithMatrix.ts
git commit -m "refactor(desktop): ProfileTab uses Echo API for image uploads"
```

---

### Task 5: Desktop — Update Onboarding AvatarUpload

**Files:**
- Modify: `apps/desktop/src/components/onboarding/AvatarUpload.tsx`
- Test: `apps/desktop/src/components/onboarding/AvatarUpload.test.tsx`

**Interfaces:**
- Consumes: `useImageUpload` from Task 2
- `onChange` callback receives Echo API URL

- [ ] **Step 1: Write failing test**

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Edit `AvatarUpload.tsx`**
  - Replace `import { uploadImage } from "@/lib/appwrite/storage"` with `useImageUpload`
  - Call `uploadAvatar(file)` and pass result to `onChange`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src/components/onboarding/AvatarUpload.tsx
git commit -m "refactor(desktop): Onboarding AvatarUpload uses Echo API"
```

---

### Task 6: Desktop — Update ImageUploadButton & Guild Modals

**Files:**
- Modify: `apps/desktop/src/components/ImageUploadButton.tsx`
- Modify: `apps/desktop/src/features/guild/CreateGuildModal.tsx`
- Modify: `apps/desktop/src/features/guild/EditGuildModal.tsx`
- Test: respective test files

**Interfaces:**
- All use `useImageUpload` with `uploadGuildIcon` / `uploadGuildBanner`
- CreateGuildModal: after upload, include `iconUrl`/`bannerUrl` in `matrixService.createGuild()` data
- EditGuildModal: after upload, call `matrixService.editGuild()` with new URLs

- [ ] **Step 1-6: Similar pattern — write tests, replace Appwrite imports, run, commit**

---

### Task 7: Desktop — Update GuildProfileTab (Remove Hardcoded Appwrite URLs)

**Files:**
- Modify: `apps/desktop/src/features/guild/tabs/GuildProfileTab.tsx`
- Test: `apps/desktop/src/features/guild/tabs/GuildProfileTab.test.tsx`

**Interfaces:**
- Removes hardcoded `VITE_APPWRITE_ENDPOINT` / `VITE_APPWRITE_BUCKET_ID` / `VITE_APPWRITE_PROJECT_ID` URL construction
- Uses `guildProfile.avatarUrl` / `guildProfile.bannerUrl` directly (already HTTP URLs from Echo API)

- [ ] **Step 1: Write failing test** (render with guild profile, verify no Appwrite URL construction)

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Edit `GuildProfileTab.tsx`**
  - Remove lines 161, 178, 209, 226 that construct Appwrite URLs
  - Use `guildProfile.avatarUrl` and `guildProfile.bannerUrl` directly

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**
```bash
git add apps/desktop/src/features/guild/tabs/GuildProfileTab.tsx
git commit -m "refactor(desktop): GuildProfileTab uses Echo API URLs directly"
```

---

### Task 8: Desktop — Clean Up Appwrite Files & Dependencies

**Files:**
- Delete: `apps/desktop/src/lib/appwrite/` (entire directory)
- Modify: `apps/desktop/package.json` — remove `appwrite` dependency
- Modify: `apps/desktop/src/main.tsx` — remove `pingAppwrite` import and call
- Modify: `apps/desktop/src/lib/api/config.ts` — remove any Appwrite config if present

- [ ] **Step 1: Delete `apps/desktop/src/lib/appwrite/` directory**

- [ ] **Step 2: Edit `package.json`** — remove `"appwrite": "^29.1.0"` from dependencies

- [ ] **Step 3: Edit `main.tsx`** — remove lines 7-10 (pingAppwrite import and call)

- [ ] **Step 4: Run `pnpm install` in `apps/desktop`** — verify no Appwrite references

- [ ] **Step 5: Run full test suite** — `pnpm test` in `apps/desktop`

- [ ] **Step 6: Commit**
```bash
git rm -r apps/desktop/src/lib/appwrite/
git add apps/desktop/package.json apps/desktop/src/main.tsx
git commit -m "chore(desktop): remove Appwrite dependency and all related code"
```

---

### Task 9: Integration Test & Verification

**Files:** None new — run existing tests and manual verification

- [ ] **Step 1: Run Echo API tests** — `cd echo-api && npm test`
- [ ] **Step 2: Run Desktop tests** — `cd apps/desktop && pnpm test`
- [ ] **Step 3: Build Desktop** — `cd apps/desktop && pnpm build`
- [ ] **Step 4: Manual smoke test** (if environment available)
  - Login → Onboarding → avatar upload works
  - Profile → edit avatar/banner → saves to Echo API
  - Create guild → upload icon/banner → visible in guild list
  - Edit guild → change icon/banner → updates

- [ ] **Step 5: Commit any final fixes**

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-10-30-eliminate-appwrite.md`. Please review the plan. Which execution approach would you prefer?**

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end. Runs well with a mid-tier session model, since the plan carries the design.

**For this plan I recommend Native, because** the tasks are highly sequential (each depends on the previous hook/endpoints), the interface contracts are simple (upload → URL), and a single implementer can maintain context across all 9 tasks efficiently. Does the plan capture what you want, and which approach should we use?
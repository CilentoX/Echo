# MemberList Avatar Fix - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix MemberList sidebar to show member avatars (not just initials) by adding avatarUrl to MemberSummary and updating listMembers to fetch avatar URLs.

**Architecture:** Add avatarUrl to MemberSummary type → Update listMembers in service.ts to fetch avatarUrl from RoomMember → Update MemberList to use MxcImage with avatarUrl.

**Tech Stack:** TypeScript, React, matrix-js-sdk, Zustand

**Spec:** docs/architecture/echo-desktop-rewrite-design.md

## Global Constraints
- No new dependencies
- Follow existing patterns (MxcImage for avatars)
- TypeScript strict mode

## Review Focus
| Input / Failure Mode | Expected Behavior |
|----------------------|-------------------|
| Member has Matrix avatar | Shows avatar image in MemberList |
| Member has no avatar | Shows initials |
| My user in MemberList | Shows Appwrite avatar fallback |

---

### Task 1: Add avatarUrl to MemberSummary type

**Files:**
- Modify: `src/lib/matrix/types.ts` (MemberSummary interface)

**Interfaces:**
- Produces: `MemberSummary.avatarUrl?: string | null`

- [ ] **Step 1.1: Add avatarUrl to MemberSummary**

```typescript
export interface MemberSummary {
  userId: string;
  displayName: string;
  presence: PresenceState;
  avatarUrl?: string | null;  // NEW
}
```

- [ ] **Step 1.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

### Task 2: Update listMembers to fetch avatarUrl

**Files:**
- Modify: `src/lib/matrix/service.ts` (listMembers function)

**Interfaces:**
- Consumes: `RoomMember.avatarUrl` from SDK
- Produces: `MemberSummary[]` with avatarUrl populated

- [ ] **Step 2.1: Update listMembers to include avatarUrl**

```typescript
async listMembers(roomId: string): Promise<MemberSummary[]> {
  const client = this.requireClient();
  const room = client.getRoom(roomId);
  if (!room) return [];
  const members = room.getJoinedMembers();
  const out: MemberSummary[] = [];
  for (const m of members) {
    out.push({
      userId: m.userId,
      displayName: m.name ?? m.userId,
      presence: m.user?.presence ? mapPresence(m.user.presence) : "offline",
      avatarUrl: m.avatarUrl ?? null,  // NEW
    });
  }
  return out;
}
```

- [ ] **Step 2.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

### Task 3: Update MemberList to use MxcImage

**Files:**
- Modify: `src/features/shell/MemberList.tsx`

**Interfaces:**
- Consumes: `member.avatarUrl` from MemberSummary
- Produces: Member avatar rendered with MxcImage

- [ ] **Step 3.1: Import MxcImage**

```typescript
import MxcImage from "@/components/media/MxcImage";
```

- [ ] **Step 3.2: Update member avatar rendering**

Replace lines 179-186 (static div with initials) with MxcImage:

```tsx
<div className="relative w-8 h-8 shrink-0">
  {member.avatarUrl ? (
    <MxcImage
      mxcUrl={member.avatarUrl}
      alt="Avatar"
      className="w-8 h-8 rounded-full object-cover border-2 border-bd bg-surf2"
    />
  ) : (
    <div className="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm text-txt shadow-sm border-4 border-surf bg-acc">
      {initial}
    </div>
  )}
  <span
    className={`absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-bg shrink-0 ${presenceColor}`}
  />
</div>
```

- [ ] **Step 3.3: Add myAppwriteAvatarUrl fallback for my user**

```tsx
const myAppwriteAvatarUrl = useProfileStore((state) => state.appwriteAvatarUrl);
const effectiveAvatarUrl = isMe ? (member.avatarUrl ?? myAppwriteAvatarUrl ?? null) : (member.avatarUrl ?? null);
```

- [ ] **Step 3.4: Import useProfileStore**

```typescript
import { useProfileStore } from "@/stores/profileStore";
```

- [ ] **Step 3.5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

### Task 4: Run tests and verify

**Files:** All modified files

- [ ] **Step 4.1: Run TypeScript check**

Run: `npx tsc --noEmit`

- [ ] **Step 4.2: Run related tests**

Run: `npx vitest run src/test/MemberList.test.tsx src/test/CommunityRail.test.tsx src/test/AppShell.test.tsx`

- [ ] **Step 4.3: Commit**

```bash
git add -A
git commit -m "fix(memberlist): show member avatars in sidebar

- Add avatarUrl to MemberSummary type
- Update listMembers to fetch avatarUrl from RoomMember
- Update MemberList to render avatars with MxcImage + fallback chain
- My user shows Appwrite avatar fallback"
```

---

## Execution Order

| Phase | Tasks |
|-------|-------|
| Type & Service | Task 1, Task 2 |
| Component | Task 3 |
| Verify | Task 4 |

## Recommended Execution

**Native** - Sequential implementation with immediate verification.
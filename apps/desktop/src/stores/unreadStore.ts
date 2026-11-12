import { create } from "zustand";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useProfileStore } from "@/stores/profileStore";
import { detectMention } from "@/lib/notifications/mentionDetector";

// --- Persistence helpers ---

function loadLastReadEvents(): Record<string, string> {
 try {
 const raw = localStorage.getItem("echo:lastReadEvents");
 return raw ? JSON.parse(raw) : {};
 } catch {
 return {};
 }
}

function persistLastReadEvents(map: Record<string, string>): void {
 try {
 localStorage.setItem("echo:lastReadEvents", JSON.stringify(map));
 } catch {}
}

// --- Store interface ---

export interface UnreadState {
 /** Unread message count per channel (key = channelId / roomId). */
 unreadByChannel: Record<string, number>;
 /** Mention/highlight count per channel (subset of unread). */
 mentionsByChannel: Record<string, number>;
 /** Unread DM count per friend (key = friend userId). */
 unreadByDm: Record<string, number>;
 /** Last read eventId per room — persisted to localStorage. */
 lastReadEventByRoom: Record<string, string>;

 // Actions
 incrementUnread(roomId: string, isMention: boolean): void;
 markRead(roomId: string, eventId: string): void;
 resetRoom(roomId: string): void;
 resetAll(): void;
 computeInitialUnreads(): void;

 // Derived selectors (use via selector functions below)
 getGuildUnread(guildId: string): number;
 getGuildMentions(guildId: string): number;
 getTotalUnread(): number;
 getTotalMentions(): number;
}

export const useUnreadStore = create<UnreadState>()((set, get) => ({
 unreadByChannel: {},
 mentionsByChannel: {},
 unreadByDm: {},
 lastReadEventByRoom: loadLastReadEvents(),

 incrementUnread: (roomId, isMention) => {
 const friends = useFriendsStore.getState().friends;
 const isDm = friends.some((f) => f.directRoomId === roomId);

 set((state) => {
 if (isDm) {
 const friend = friends.find((f) => f.directRoomId === roomId);
 const key = friend?.userId ?? roomId;
 const current = state.unreadByDm[key] ?? 0;
 return { unreadByDm: { ...state.unreadByDm, [key]: current + 1 } };
 }

 const currentUnread = state.unreadByChannel[roomId] ?? 0;
 const currentMentions = state.mentionsByChannel[roomId] ?? 0;
 return {
 unreadByChannel: { ...state.unreadByChannel, [roomId]: currentUnread + 1 },
 mentionsByChannel: isMention
 ? { ...state.mentionsByChannel, [roomId]: currentMentions + 1 }
 : state.mentionsByChannel,
 };
 });
 },

 markRead: (roomId, eventId) => {
 const friends = useFriendsStore.getState().friends;
 const isDm = friends.some((f) => f.directRoomId === roomId);

 set((state) => {
 const nextLastRead = { ...state.lastReadEventByRoom, [roomId]: eventId };
 persistLastReadEvents(nextLastRead);

 if (isDm) {
 const friend = friends.find((f) => f.directRoomId === roomId);
 const key = friend?.userId ?? roomId;
 const nextDm = { ...state.unreadByDm };
 delete nextDm[key];
 return { lastReadEventByRoom: nextLastRead, unreadByDm: nextDm };
 }

 const nextUnread = { ...state.unreadByChannel };
 delete nextUnread[roomId];
 const nextMentions = { ...state.mentionsByChannel };
 delete nextMentions[roomId];
 return {
 lastReadEventByRoom: nextLastRead,
 unreadByChannel: nextUnread,
 mentionsByChannel: nextMentions,
 };
 });
 },

 resetRoom: (roomId) => {
 set((state) => {
 const nextUnread = { ...state.unreadByChannel };
 delete nextUnread[roomId];
 const nextMentions = { ...state.mentionsByChannel };
 delete nextMentions[roomId];
 return { unreadByChannel: nextUnread, mentionsByChannel: nextMentions };
 });
 },

 resetAll: () => {
 set({
 unreadByChannel: {},
 mentionsByChannel: {},
 unreadByDm: {},
 lastReadEventByRoom: {},
 });
 try {
 localStorage.removeItem("echo:lastReadEvents");
 } catch {}
 },

 computeInitialUnreads: () => {
 const syncState = useSyncStore.getState();
 const myUserId = useUiStore.getState().myUserId;
 const profileName = useProfileStore.getState().displayName;
 const lastRead = get().lastReadEventByRoom;
 const friends = useFriendsStore.getState().friends;
 const dmRoomIds = new Set(friends.map((f) => f.directRoomId).filter(Boolean) as string[]);

 const newUnread: Record<string, number> = {};
 const newMentions: Record<string, number> = {};
 const newDmUnread: Record<string, number> = {};

 for (const [roomId, timeline] of Object.entries(syncState.timelineByChannel)) {
 if (!timeline || timeline.length === 0) continue;

 const lastReadEventId = lastRead[roomId];
 const otherMessages = timeline.filter((e: any) => e.sender !== myUserId);

 if (!lastReadEventId) {
 // No read marker → all messages unread (cap at 999)
 const count = Math.min(otherMessages.length, 999);
 if (count > 0) {
 if (dmRoomIds.has(roomId)) {
 const friend = friends.find((f) => f.directRoomId === roomId);
 const key = friend?.userId ?? roomId;
 newDmUnread[key] = count;
 } else {
 newUnread[roomId] = count;
 // Count mentions in bulk
 const mentionCount = otherMessages.filter((e: any) =>
 detectMention(e.body ?? "", myUserId ?? "", profileName, (e as any).formattedBody)
 ).length;
 if (mentionCount > 0) newMentions[roomId] = mentionCount;
 }
 }
 continue;
 }

 // Find index of last read event, count everything after it
 const readIdx = timeline.findIndex((e: any) => e.eventId === lastReadEventId);
 if (readIdx === -1) continue; // Read marker refers to event not in current timeline

 const unreadEvents = timeline.slice(readIdx + 1).filter((e: any) => e.sender !== myUserId);
 if (unreadEvents.length > 0) {
 if (dmRoomIds.has(roomId)) {
 const friend = friends.find((f) => f.directRoomId === roomId);
 const key = friend?.userId ?? roomId;
 newDmUnread[key] = Math.min(unreadEvents.length, 999);
 } else {
 newUnread[roomId] = Math.min(unreadEvents.length, 999);
 const mentionCount = unreadEvents.filter((e: any) =>
 detectMention(e.body ?? "", myUserId ?? "", profileName, (e as any).formattedBody)
 ).length;
 if (mentionCount > 0) newMentions[roomId] = mentionCount;
 }
 }
 }

 set({
 unreadByChannel: newUnread,
 mentionsByChannel: newMentions,
 unreadByDm: newDmUnread,
 });
 },

 // --- Derived selectors (called as functions, not reactive hooks) ---

 getGuildUnread: (guildId) => {
 const channels = useSyncStore.getState().channelsByGuild[guildId] ?? [];
 let total = 0;
 for (const ch of channels) {
 total += get().unreadByChannel[ch.channelId] ?? 0;
 }
 return total;
 },

 getGuildMentions: (guildId) => {
 const channels = useSyncStore.getState().channelsByGuild[guildId] ?? [];
 let total = 0;
 for (const ch of channels) {
 total += get().mentionsByChannel[ch.channelId] ?? 0;
 }
 return total;
 },

 getTotalUnread: () => {
 const state = get();
 let total = 0;
 for (const v of Object.values(state.unreadByChannel)) total += v;
 for (const v of Object.values(state.unreadByDm)) total += v;
 return total;
 },

 getTotalMentions: () => {
 const state = get();
 let total = 0;
 for (const v of Object.values(state.mentionsByChannel)) total += v;
 return total;
 },
}));
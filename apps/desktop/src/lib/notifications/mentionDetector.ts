/**
 * Detects whether a message body contains a mention of the current user.
 *
 * Checks (in order):
 * 1. Full MXID match (`@user:homeserver.tld`)
 * 2. Display name match with word boundaries (case-insensitive)
 * 3. Matrix pill links in formatted_body (`https://matrix.to/#/@user:...`)
 * 4. Broadcast mentions: @everyone, @here, @room
 */
export function detectMention(
 body: string,
 myUserId: string,
 myDisplayName: string | null,
 formattedBody?: string,
): boolean {
 if (!body) return false;

 // 1. Full MXID match
 if (myUserId && body.includes(myUserId)) return true;

 // 2. Display name with word boundary (case-insensitive)
 if (myDisplayName && myDisplayName.length > 0) {
 const escaped = myDisplayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
 const regex = new RegExp(`\\b${escaped}\\b`, "i");
 if (regex.test(body)) return true;
 }

 // 3. Matrix pill links in formatted_body
 if (formattedBody) {
 if (myUserId && formattedBody.includes(myUserId)) return true;
 }

 // 4. Broadcast mentions
 if (/\b@(everyone|here|room)\b/i.test(body)) return true;

 return false;
}
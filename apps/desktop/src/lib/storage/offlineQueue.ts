/**
 * Offline Message Queue for Echo Desktop.
 *
 * Persists failed messages to localStorage and retries them
 * when connectivity is restored. Survives app restarts.
 */

const QUEUE_KEY = "echo:offlineQueue";
const MAX_QUEUE_SIZE = 50;

export interface QueuedMessage {
  id: string;
  roomId: string;
  body: string;
  replyToEventId?: string;
  /** ISO timestamp of when the message was queued. */
  queuedAt: string;
  /** Number of retry attempts so far. */
  attempts: number;
}

function loadQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMessage[]): void {
  try {
    // Trim to max size, keeping newest
    const trimmed = queue.slice(-MAX_QUEUE_SIZE);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function enqueueMessage(msg: Omit<QueuedMessage, "queuedAt" | "attempts">): void {
  const queue = loadQueue();
  queue.push({
    ...msg,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  saveQueue(queue);
}

export function getQueuedMessages(): QueuedMessage[] {
  return loadQueue();
}

export function removeQueuedMessage(id: string): void {
  const queue = loadQueue();
  saveQueue(queue.filter((m) => m.id !== id));
}

export function markRetryAttempt(id: string): void {
  const queue = loadQueue();
  const idx = queue.findIndex((m) => m.id === id);
  if (idx !== -1) {
    queue[idx].attempts += 1;
    saveQueue(queue);
  }
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Drains the offline queue by attempting to send each message.
 * Removes successfully sent messages; keeps failed ones for next drain.
 * Returns the number of messages successfully drained.
 */
export async function drainOfflineQueue(
  sendMessage: (roomId: string, body: string, options?: { replyToEventId?: string }) => Promise<string>,
  onProgress?: (sent: number, total: number) => void,
): Promise<number> {
  const queue = loadQueue();
  if (queue.length === 0) return 0;

  let sent = 0;
  const remaining: QueuedMessage[] = [];

  for (const msg of queue) {
    try {
      await sendMessage(msg.roomId, msg.body, {
        ...(msg.replyToEventId ? { replyToEventId: msg.replyToEventId } : {}),
      });
      sent++;
    } catch {
      // Keep in queue for next attempt, but cap retries at 10
      if (msg.attempts < 10) {
        remaining.push({ ...msg, attempts: msg.attempts + 1 });
      }
    }
    onProgress?.(sent, queue.length);
  }

  saveQueue(remaining);
  return sent;
}
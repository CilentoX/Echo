import type { NormalizedEvent } from "@/lib/matrix/types";

/** Gap máximo entre mensagens do mesmo autor para continuarem agrupadas. */
export const GROUP_GAP_MS = 5 * 60 * 1000;

export interface MessageGroup {
  sender: string;
  events: NormalizedEvent[];
}

/**
 * Agrupa a timeline em blocos por autor: um novo grupo abre quando o
 * sender muda OU quando o gap desde a última mensagem passa de 5 minutos.
 * Assume eventos em ordem cronológica (como chegam do sync).
 */
export function groupMessages(events: readonly NormalizedEvent[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    const tail = last?.events[last.events.length - 1];
    const sameGroup =
      last !== undefined &&
      tail !== undefined &&
      last.sender === event.sender &&
      event.originServerTs - tail.originServerTs <= GROUP_GAP_MS;
    if (sameGroup && last) {
      last.events.push(event);
    } else {
      groups.push({ sender: event.sender, events: [event] });
    }
  }
  return groups;
}

/** "@lucas:hs" → "lucas"; remetentes locais ("Você") passam direto. */
export function senderLabel(sender: string): string {
  if (sender.startsWith("@")) {
    const localpart = sender.slice(1).split(":")[0];
    return localpart || sender;
  }
  return sender;
}

import { cdnAsset } from './utils/cdnAssets'

const EVENT_TICKET_TAIL_ASSETS: Record<'饭局' | '酒局', string> = {
  '饭局': '/assets/lovart/lovart-event-ticket-tail-dining-20260630-v2.webp',
  '酒局': '/assets/lovart/lovart-event-ticket-tail-drinks-20260630-v2.webp',
}

/**
 * Resolve the CDN URL for the event-ticket payment tail illustration.
 * Unknown event types fall back to the dining (饭局) variant to keep the
 * ticket visually complete.
 */
export function getEventTicketTailAsset(eventType?: string): string {
  const path = (eventType && EVENT_TICKET_TAIL_ASSETS[eventType as keyof typeof EVENT_TICKET_TAIL_ASSETS]) ?? EVENT_TICKET_TAIL_ASSETS['饭局']
  return cdnAsset(path)
}

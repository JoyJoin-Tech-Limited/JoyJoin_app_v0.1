import {
  getEventPool,
  type ApiTransport,
  type BlindBoxEventDetail,
  type EventPoolSummary,
} from '@shared/api'

function joinLocation(pool: EventPoolSummary): string | undefined {
  const parts = [pool.city, pool.district]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : undefined
}

export function mapEventPoolToEventDetail(pool: EventPoolSummary): BlindBoxEventDetail {
  return {
    ...pool,
    id: pool.id,
    title: pool.title,
    dateTime: pool.dateTime,
    location: joinLocation(pool),
    type: pool.eventType,
    status: pool.status,
    attendeeCount: pool.currentParticipants ?? pool.registrationCount,
    description: pool.description,
    source: 'event_pool',
  }
}

export async function loadEventDetail(
  api: ApiTransport,
  eventId: string,
): Promise<BlindBoxEventDetail> {
  try {
    const pool = await getEventPool(api, eventId)
    return mapEventPoolToEventDetail(pool)
  } catch (poolError) {
    try {
      return await api<BlindBoxEventDetail>({
        path: `/api/blind-box-events/${encodeURIComponent(eventId)}`,
      })
    } catch (legacyError) {
      throw legacyError instanceof Error ? legacyError : poolError
    }
  }
}

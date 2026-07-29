interface EventFeedbackPayloadInput {
  rating: number
  comment: string
  connections: string[]
}

export function buildEventFeedbackPayload({
  rating,
  comment,
  connections,
}: EventFeedbackPayloadInput) {
  return {
    ...(rating > 0 ? { rating } : {}),
    comment: comment.trim() || undefined,
    connections,
  }
}

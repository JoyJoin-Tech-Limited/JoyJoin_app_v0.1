import { Image } from '@tarojs/components'
import { useState } from 'react'
import type { EventParticipantSummary } from '@shared/api'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import MissingArchetypePlaceholder from '../../../components/mascot/MissingArchetypePlaceholder'

/**
 * ParticipantAvatar — shared attendee/selector avatar for the event-feedback
 * steps. Extracted from index.tsx (2026-10-16 Batch C) to keep the page under
 * the harness gate's 1800-line limit. Page-local; consumed by the connections
 * grid, the wechat-step selection recap, and the wrap-up attendee rows.
 *
 * All styles live in `../index.scss` — NO .scss side-effect import here
 * (subpackage WXSS chunking trap, see AGENTS.md §15).
 */
export default function ParticipantAvatar({
  participant,
  name,
  size = 80,
  attendee = false,
  mini = false,
  large = false,
  onAssetError,
}: {
  participant: EventParticipantSummary
  name: string
  size?: number
  attendee?: boolean
  /** 56rpx circle for the wechat-step selection recap stack (Batch B #13). */
  mini?: boolean
  /** 112rpx circle for the 2-column connections grid cards (Batch C #9). */
  large?: boolean
  /** Archetype-head dual-tier asset failure — wrapup rows only (telemetry). */
  onAssetError?: () => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  // Archetype may arrive as an id ('koala') or a legacy nameCn ('树洞考拉');
  // resolveArchetype handles both (same pattern as TablemateCard).
  const archetypeId = participant.archetype
    ? resolveArchetype(participant.archetype)?.id ?? null
    : null

  // Identity chain (2026-10-16): photo first — at the table the user saw faces,
  // so the approved profile image is the strongest recall anchor; then the
  // archetype head; then the brand logo mark. The initials circle is retired
  // per brand canon (MissingArchetypePlaceholder docblock).
  if (participant.avatarUrl && !imageFailed) {
    return (
      <Image
        className={`event-feedback__participant-avatar ${attendee ? 'event-feedback__participant-avatar--attendee' : ''} ${mini ? 'event-feedback__participant-avatar--mini' : ''} ${large ? 'event-feedback__participant-avatar--large' : ''}`}
        src={participant.avatarUrl}
        mode='aspectFill'
        ariaLabel={`${name}的头像`}
        lazyLoad
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (archetypeId) {
    // fallback='none': the page-owned avatar wrapper keeps a tinted ring even
    // in the local+CDN double-fail case, and canon bans initials — the
    // onAssetError callback is what makes that case observable (telemetry).
    return (
      <ArchetypeHead
        archetype={archetypeId}
        size={size}
        fallback='none'
        onAssetError={onAssetError}
      />
    )
  }

  return <MissingArchetypePlaceholder size={size} />
}

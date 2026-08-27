// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Structural invariant (sprint contract post-reveal-phase0, AC-10 / M3):
 * the cancel flow must stay a thin, policy-aware gate in front of the
 * existing cancelPoolRegistration path. If a future refactor drops the
 * matched-state affordance, hardcodes one dialog variant, leaks the exiter's
 * identity into the placeholder, or skips the cache bust, this test fails.
 *
 * Guards:
 * - matched-state (排桌完成) cancel affordance wired through handleCancel
 * - dialog copy switches on the server-computed per-registration cancelPolicy
 *   (absent → refundable/legacy variant; client never reads feature flags)
 * - M3 exact strings + destructive dialog chrome (confirmColor DANGER)
 * - success toast copy + bustRegistrationCaches on success
 * - neutral 「排桌中…」 vacated-seat placeholder (no member identity)
 * - shrink / collapse in-page notice cards driven from server state
 */

const PAGE_SOURCE = resolve(__dirname, '..', 'index.tsx')
const CONTROLLER_SOURCE = resolve(__dirname, '..', 'useMatchingStatusController.ts')
const SECTIONS_SOURCE = resolve(__dirname, '..', 'MatchingStatusSections.tsx')
const GROUP_DETAIL_SOURCE = resolve(__dirname, '..', '..', 'pool-group-detail', 'index.tsx')
const VACATED_SEAT_SOURCE = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'components',
  'TablemateCard',
  'VacatedSeatCard.tsx',
)
const VACANCY_LIB_SOURCE = resolve(__dirname, '..', '..', '..', 'lib', 'matching', 'groupSeatVacancy.ts')

describe('matching-status cancel policy dialog wiring (post-reveal Phase 0)', () => {
  const page = readFileSync(PAGE_SOURCE, 'utf-8')
  const controller = readFileSync(CONTROLLER_SOURCE, 'utf-8')
  const sections = readFileSync(SECTIONS_SOURCE, 'utf-8')
  const groupDetail = readFileSync(GROUP_DETAIL_SOURCE, 'utf-8')
  const vacatedSeat = readFileSync(VACATED_SEAT_SOURCE, 'utf-8')
  const vacancyLib = readFileSync(VACANCY_LIB_SOURCE, 'utf-8')

  it('surfaces a cancel affordance in the matched state, wired through handleCancel', () => {
    expect(page).toContain("matchStatus === 'matched' ? (")
    expect(page).toContain('matching-status__cancel-row matching-status__cancel-row--matched')
    // Both the pending and matched cancel rows route through the same handler.
    const cancelRowMatches = page.match(/matching-status__cancel-row/g) ?? []
    expect(cancelRowMatches.length).toBeGreaterThanOrEqual(2)
    expect(controller).toContain('const handleCancel = useCallback')
    expect(controller).toContain('await cancelPoolRegistration(apiRequest, registrationId)')
  })

  it('switches the dialog copy on the server-computed cancelPolicy (M3 exact strings)', () => {
    expect(controller).toContain("registration?.cancelPolicy === 'non_refundable'")
    // Refundable (pre-reveal / legacy-absent) variant.
    expect(controller).toContain('取消后报名费将全额退回')
    // Non-refundable (post-reveal) variant.
    expect(controller).toContain('现在取消将不退还报名费。这桌的伙伴们会收到通知哦。')
    // Buttons: 「再想想」 is the safe exit, 「确认取消」 carries the danger color.
    expect(controller).toContain("confirmText: '确认取消'")
    expect(controller).toContain("cancelText: '再想想'")
    expect(controller).toContain('confirmColor: DANGER_COLOR')
  })

  it('never reads feature flags on the client for the cancel decision', () => {
    expect(controller).not.toContain('noRefundAfterReveal')
    expect(controller).not.toContain('preRevealRefundEnabled')
    expect(controller).not.toContain('NO_REFUND_AFTER_REVEAL')
    expect(controller).not.toContain('featureFlags')
  })

  it('shows the M3 success toast and busts registration caches on success', () => {
    expect(controller).toContain('已取消，期待下次见到你')
    expect(controller).toContain("from '../../lib/api/registrationCacheBust'")
    expect(controller).toContain('bustRegistrationCaches(queryClient')
  })

  it('renders the vacated seat as a neutral placeholder with no exiter identity', () => {
    expect(vacatedSeat).toContain('排桌中…')
    expect(vacatedSeat).toContain('vacated-seat-card__label')
    // Placeholder takes no member-ish props — identity can never leak through it.
    expect(vacatedSeat).not.toContain('PoolGroupMemberSummary')
    expect(vacatedSeat).not.toContain('displayName')
    expect(vacatedSeat).not.toContain('archetype')
    // Rendered at list level in both group views (TablemateCard untouched).
    expect(sections).toContain('<VacatedSeatCard')
    expect(sections).toContain('vacatedSeatCount = 0')
    expect(groupDetail).toContain('<VacatedSeatCard')
    expect(page).toContain('vacatedSeatCount={vacatedSeatCount}')
    expect(vacancyLib).toContain('resolveGroupSeatVacancy')
  })

  it('renders the shrink notice with the actual remaining headcount', () => {
    expect(page).toContain('有位伙伴临时有事来不了，今晚是温馨的')
    expect(page).toContain('groupDisplayCount')
    expect(groupDetail).toContain('有位伙伴临时有事来不了，今晚是温馨的')
    expect(groupDetail).toContain('groupSeatVacancy.displayCount')
  })

  it('renders the collapse notice with the M2 distinct copy on both surfaces', () => {
    expect(page).toContain('这次没能成行')
    expect(page).toContain('已为你优先保留下一场的排桌资格')
    expect(groupDetail).toContain('这次没能成行')
    expect(groupDetail).toContain('已为你优先保留下一场的排桌资格')
    // Collapse is driven from server state: was-matched registration flipped
    // to unmatched (assignedGroupId discriminator — no new polling).
    expect(controller).toContain('isCollapsedRegistration')
    expect(controller).toContain("matchStatus === 'unmatched'")
    expect(controller).toContain('registration?.assignedGroupId')
    expect(groupDetail).toContain('isCollapsedGroup')
  })

  it('drives vacancy from server state via existing query patterns only', () => {
    // pool-group-detail rides the shared REGISTRATIONS_QUERY_KEY cache —
    // no new polling introduced for notices.
    expect(groupDetail).toContain('REGISTRATIONS_QUERY_KEY')
    expect(groupDetail).not.toContain('refetchInterval')
    // Baseline memory follows the jj_revealed_ storage pattern.
    expect(vacancyLib).toContain('jj_group_seat_count_')
    expect(controller).toContain('readGroupSeatBaseline')
    expect(controller).toContain('writeGroupSeatBaseline')
  })
})

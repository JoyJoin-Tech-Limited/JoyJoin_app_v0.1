import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 2026-07-28 device-recording audit (活动详情): the 时间 row rendered a raw
// ISO string and the 状态 row rendered the raw English enum (`active`).
// Same-day support pivot: the placeholder QR card became a native WeChat
// customer-service session button (open-type="contact") — no asset to
// maintain, user never leaves the mini program. Source locks for all three.

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(resolve(here, '..', 'index.tsx'), 'utf-8')
const scss = readFileSync(resolve(here, '..', 'index.scss'), 'utf-8')

describe('event-detail data hygiene (2026-07-28)', () => {
  it('formats the event time via formatEventDateTime (no raw ISO leak)', () => {
    expect(tsx).toContain('formatEventDateTime(event.dateTime)')
    expect(tsx).not.toContain("event.dateTime ?? '时间待定'")
  })

  it('localizes pool status via getEventPoolStatusLabel (no raw `active`)', () => {
    expect(tsx).toContain('getEventPoolStatusLabel(event.status)')
    expect(tsx).not.toContain('{event.status}</Text>')
    // The status row now carries the same icon slot as its sibling rows.
    const statusRow = tsx.split('getEventPoolStatusLabel(event.status)')[0] ?? ''
    expect(statusRow).toContain('event-detail__icon-slot')
  })
})

describe('event-detail native customer-service entry (2026-07-28)', () => {
  it('opens the WeChat customer-service session via open-type="contact"', () => {
    expect(tsx).toContain("openType='contact'")
    expect(tsx).toContain('sessionFrom={`event-detail:${eventId}`}')
    // Agent context: the session carries a mini-program card of this event.
    expect(tsx).toContain('showMessageCard')
    expect(tsx).toContain('sendMessageTitle={event.title')
  })

  it('tracks the tap through the events analytics pipeline', () => {
    expect(tsx).toContain("eventsAnalytics.track('support_contact_tap'")
    expect(tsx).toContain("location: 'event-detail'")
  })

  it('ships CSS for the button and keeps zero QR references', () => {
    expect(scss).toContain('&__support-btn')
    expect(tsx).not.toContain('customer-service-support')
    expect(tsx).not.toContain('supportQrSrc')
    expect(tsx).not.toContain('previewImage')
    expect(tsx).not.toContain('showMenuByLongpress')
    expect(scss).not.toContain('&__support-qr')
    expect(scss).not.toContain('&__support-helper')
  })
})

// 2026-10-16 feedback activation + action-bar redesign. These lock the two
// reconciliation decisions that are easy to silently regress: the locked state
// must stay tappable (native `disabled` swallows the teaching toast in WeChat)
// and the live/open overlap must not stack two solid-primary CTAs.
describe('event-detail action bar (2026-10-16 feedback activation)', () => {
  const openFeedbackBlock = tsx.slice(
    tsx.indexOf('{showOpenFeedback ?'),
    tsx.indexOf('</Button>', tsx.indexOf('{showOpenFeedback ?')),
  )
  const lockedBlock = tsx.slice(
    tsx.indexOf("event-detail__cta--locked'"),
    tsx.indexOf('</Button>', tsx.indexOf("event-detail__cta--locked'")),
  )
  const doneBlock = tsx.slice(
    tsx.indexOf("event-detail__cta--done'"),
    tsx.indexOf('</Button>', tsx.indexOf("event-detail__cta--done'")),
  )

  it('demotes 去评价 to --secondary while the live 进入破冰 CTA is present', () => {
    expect(openFeedbackBlock).toContain('icebreakerTarget')
    expect(openFeedbackBlock).toContain('event-detail__cta--secondary')
    expect(scss).toContain('&--secondary')
  })

  it('keeps the locked state tappable — no native `disabled` (aria-disabled only)', () => {
    expect(lockedBlock).toContain('onClick={handleFeedbackTap}')
    expect(lockedBlock).toContain('aria-disabled')
    expect(lockedBlock).not.toMatch(/\sdisabled\b/)
    expect(tsx).toContain("Taro.showToast({ title: '活动结束后才能评价哦'")
  })

  it('keeps the submitted state non-interactive (native `disabled` allowed)', () => {
    expect(doneBlock).toMatch(/\sdisabled\b/)
    expect(doneBlock).not.toContain('onClick')
  })

  it('renders the bar as a ScrollView flex sibling, never position:fixed', () => {
    expect(scss).toMatch(/&__action-bar\s*\{[^}]*flex-shrink:\s*0/)
    expect(scss).not.toMatch(/&__action-bar\s*\{[^}]*position:\s*fixed/)
  })
})

// 2026-10-16 fix: the pool 进入破冰 CTA used to be gated on
// `status ∈ {started, active, ongoing}` — a set the server never writes for
// pools — while a group id only exists once the status is matching/matched.
// The CTA was therefore unreachable in production (only test pools, parked on
// `active`, ever showed it). Pools now use the dateTime window helper.
describe('event-detail pool icebreaker window (2026-10-16 fix)', () => {
  it('derives pool liveness from the dateTime window, not the status set', () => {
    expect(tsx).toContain("from '../../lib/utils/eventLiveWindow'")
    expect(tsx).toContain('isWithinPoolIcebreakerWindow({ status: event?.status, dateTime: event?.dateTime })')
    expect(tsx).toContain('const icebreakerLive = isPoolEvent ? poolIcebreakerOpen : isActiveEvent')
  })

  it('resolves the group id only while that window is open', () => {
    expect(tsx).toContain('enabled: isPoolEvent && poolIcebreakerOpen')
    expect(tsx).not.toContain('enabled: isPoolEvent && isActiveEvent')
  })

  it('gates the icebreaker target on the merged liveness (both families)', () => {
    expect(tsx).toContain('const icebreakerTarget = !icebreakerLive')
    expect(tsx).not.toContain('const icebreakerTarget = !isActiveEvent')
  })
})

// 2026-10-16 render-caught fix: the platform's built-in disabled styling
// outranks a single class (H5 runtime injects
// `taro-button-core[disabled] { color: rgba(255,255,255,.6) }` (0,1,1);
// WeChat's `button[disabled]:not([type])` sits higher). The custom-coloured
// `--done` CTA therefore inherited the platform colour and rendered
// white-on-white — invisible until we re-asserted the state from an ancestor
// (0,3,0). Lock the override so the next disabled CTA can't regress the same way.
describe('event-detail done CTA survives the platform disabled styling', () => {
  it('re-asserts the confirmed state from an ancestor selector', () => {
    expect(scss).toContain('&__action-stack .event-detail__cta--done[disabled]')
    expect(scss).toContain('color: $color-success-text-on-light')
  })

  it('still keeps native disabled for real interactivity blocking', () => {
    expect(tsx).toMatch(/event-detail__cta--done[\s\S]{0,300}?\sdisabled\b/)
  })
})

// 2026-10-21 T46 audit CONCERN C2 source-lock (merge gate): the P0c flow strip
// and P0e FAQ accordion are pool-event-only trust layers with a frozen
// insertion order — info card → flow strip → FAQ accordion → 活动介绍 →
// support card. A blind-box/legacy detail must render neither (fail-closed =
// hide), and the FAQ must stay downstream of the strip (it answers questions
// the strip raises).
describe('event-detail trust layer insertion order (2026-10-21 lock)', () => {
  it('renders EventFlowStrip between the info card and 活动介绍', () => {
    const flowIdx = tsx.indexOf('<EventFlowStrip />')
    const faqIdx = tsx.indexOf('<EventFaqAccordion ')
    const descIdx = tsx.indexOf('event-detail__description-title')
    expect(flowIdx).toBeGreaterThan(-1)
    expect(faqIdx).toBeGreaterThan(flowIdx)
    expect(descIdx).toBeGreaterThan(faqIdx)
  })

  it('gates both trust layers behind isPoolEvent (blind-box detail renders neither)', () => {
    // Each layer is wrapped in its own `{isPoolEvent ? (...) : null}` block.
    const flowIdx = tsx.indexOf('<EventFlowStrip />')
    const faqIdx = tsx.indexOf('<EventFaqAccordion ')
    const gateBefore = (idx: number) => {
      const slice = tsx.slice(Math.max(0, idx - 400), idx)
      return slice.includes('{isPoolEvent ? (')
    }
    expect(gateBefore(flowIdx)).toBe(true)
    expect(gateBefore(faqIdx)).toBe(true)
    // The pool-source discriminator stays the `event?.source === 'event_pool'` check.
    expect(tsx).toContain("const isPoolEvent = event?.source === 'event_pool'")
  })

  it('passes the fail-closed refund flag into the accordion, never a raw user read', () => {
    expect(tsx).toContain('preRevealRefundEnabled={preRevealRefundEnabled}')
    expect(tsx).toContain("user?.features?.preRevealRefundEnabled === true")
    expect(tsx).not.toContain('<EventFaqAccordion preRevealRefundEnabled={user?.features')
  })

  it('@use\'s both component SCSSs into the page SCSS (no TSX side-effect import)', () => {
    expect(scss).toContain('EventFlowStrip')
    expect(scss).toContain('EventFaqAccordion')
    expect(tsx).not.toMatch(/^import\s+['"]\.\.\/\.\.\/\.\.\/components\/event-detail\/.*\.scss['"]/m)
  })
})

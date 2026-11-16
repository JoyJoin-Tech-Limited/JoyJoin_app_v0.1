import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(resolve(__dirname, '../routes/domains/analytics.ts'), 'utf8')
const client = readFileSync(resolve(__dirname, '../../../mini-program/src/lib/analytics/discoverAnalytics.ts'), 'utf8')
const EVENTS = ['deal_card_impression', 'deal_card_tap', 'redeem_page_open', 'deal_credential_present']

describe('venue-deal discover analytics whitelist', () => {
  it('client union 与 server DISCOVER_EVENT_TYPES 同名注册四个事件', () => {
    for (const event of EVENTS) {
      expect(client).toContain(`| '${event}'`)
      expect(route).toContain(`"${event}"`)
    }
    expect(route).toContain('new Set<DiscoverEventType>(DISCOVER_EVENT_TYPES)')
  })

  it('非法事件保持 fail-open 200，不落库', () => {
    expect(route).toContain('!ALLOWED_DISCOVER_EVENT_TYPES.has(eventType as DiscoverEventType)')
    expect(route).toContain('invalid eventType')
  })
})

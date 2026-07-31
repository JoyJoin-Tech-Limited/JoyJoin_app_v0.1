import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/overlays/BonusGateOverlay.tsx'),
  'utf8',
)

describe('BonusGateOverlay PM contract', () => {
  it('lets host and players record sentiment before the host decides', () => {
    expect(source).toContain('isHost && !hasVoted')
    expect(source).toContain("onClick={() => handleSentiment('want')}")
    expect(source).toContain("onClick={() => handleSentiment('pass')}")
    expect(source).toContain("onClick={() => handleHostRespond(true)}")
    expect(source).toContain('sentimentSummary.wantCount')
  })
})

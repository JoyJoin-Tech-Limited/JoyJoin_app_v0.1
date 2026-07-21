import assert from 'node:assert/strict'
import test from 'node:test'

import { verifyDeploymentFreshness } from '../verify-deployment-freshness.mjs'

test('accepts the current main commit', () => {
  assert.doesNotThrow(() => verifyDeploymentFreshness('a'.repeat(40), 'a'.repeat(40)))
})

test('rejects an older queued deployment candidate', () => {
  assert.throws(
    () => verifyDeploymentFreshness('a'.repeat(40), 'b'.repeat(40)),
    /Refusing stale deployment/,
  )
})

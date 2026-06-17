import { cdnAsset, localAsset } from './apps/mini-program/src/lib/utils/cdnAssets.ts'

const cases = [
  { input: '/assets/personality/archetypes/corgi.webp', expected: 'https://joyjoinapp.com/static/assets/personality/archetypes/corgi.webp' },
  { input: '/assets/ceremony/pool-registration-success.webp', expected: 'https://joyjoinapp.com/static/assets/ceremony/pool-registration-success.webp' },
  { input: '/assets/mascot/homeWelcome.webp', expected: 'https://joyjoinapp.com/static/assets/mascot/homeWelcome.webp' },
  { input: '/assets/icons/phase/phase-warmup.webp', expected: 'https://joyjoinapp.com/static/assets/icons/phase/phase-warmup.webp' },
  { input: '/assets/icons/reaction/reaction-like.webp', expected: 'https://joyjoinapp.com/static/assets/icons/reaction/reaction-like.webp' },
]

let passed = 0
let failed = 0
for (const c of cases) {
  const actual = cdnAsset(c.input)
  if (actual === c.expected) {
    console.log(`✅ ${c.input} -> ${actual}`)
    passed++
  } else {
    console.log(`❌ ${c.input}`)
    console.log(`   expected: ${c.expected}`)
    console.log(`   actual:   ${actual}`)
    failed++
  }
}

console.log(`\n${passed} passed, ${failed} failed`)

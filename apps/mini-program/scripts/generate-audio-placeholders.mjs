#!/usr/bin/env node
// S9 audio seasoning — placeholder track generator (2026-08-12)
//
// Generates valid, playable sub-1s WAV placeholders for the six S1-grammar
// tracks. Final timbres are a DES sound-design follow-up; these exist so the
// CDN manifest pipeline has real files (every localPath must exist) and the
// grammar mirror is audible end-to-end.
//
// Re-run: node scripts/generate-audio-placeholders.mjs
// Output: src/assets/audio/*.wav (44-byte PCM header + samples)
//
// Track characters mirror the haptic grammar:
//   nudge        single mid tick          (single tone)
//   host-nudge   two light taps           (double tone — NEVER the group nudge)
//   your-turn    heavy beat + light echo  (low then high)
//   confirm      single instant light     (high short tick)
//   reveal       the only long one        (low sustained)
//   celebration  rising three-pulse       (low → mid → high)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'audio')
const SAMPLE_RATE = 22050

// ── tiny WAV writer ──────────────────────────────────────────────────────────
function writeWav(filePath, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples.length * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2)
  }
  fs.writeFileSync(filePath, buffer)
}

function tone(freqHz, ms, volume = 0.5, fadeMs = 12) {
  const count = Math.floor((SAMPLE_RATE * ms) / 1000)
  const fade = Math.floor((SAMPLE_RATE * fadeMs) / 1000)
  const samples = []
  for (let i = 0; i < count; i += 1) {
    let env = 1
    if (i < fade) env = i / fade
    else if (i > count - fade) env = (count - i) / fade
    samples.push(Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE) * volume * env)
  }
  return samples
}

function silence(ms) {
  const count = Math.floor((SAMPLE_RATE * ms) / 1000)
  return new Array(count).fill(0)
}

// ── tracks (all ≤ 800ms — AUDIO_MAX_TRACK_MS) ────────────────────────────────
const TRACKS = {
  's1-nudge.wav': tone(880, 120, 0.5),
  's1-host-nudge.wav': [...tone(660, 90, 0.45), ...silence(90), ...tone(660, 90, 0.45)],
  's1-your-turn.wav': [...tone(440, 120, 0.6), ...silence(90), ...tone(880, 90, 0.35)],
  's1-confirm.wav': tone(1100, 60, 0.35),
  's1-reveal.wav': tone(330, 300, 0.5),
  's1-celebration.wav': [
    ...tone(520, 90, 0.45),
    ...silence(90),
    ...tone(660, 90, 0.5),
    ...silence(120),
    ...tone(780, 90, 0.55),
  ],
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const [name, samples] of Object.entries(TRACKS)) {
  const filePath = path.join(OUT_DIR, name)
  writeWav(filePath, samples)
  console.log(`generated ${name} (${samples.length} samples, ${((samples.length * 2 + 44) / 1024).toFixed(1)}KB)`)
}
console.log(`\n${Object.keys(TRACKS).length} placeholder tracks written to ${path.relative(ROOT, OUT_DIR)}/`)

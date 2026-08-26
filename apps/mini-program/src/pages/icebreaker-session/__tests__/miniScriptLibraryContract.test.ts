import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const modalSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/overlays/MiniScriptConfigModal.tsx'),
  'utf8',
)
const hookSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/hooks/useMiniScriptGeneration.ts'),
  'utf8',
)

describe('MiniScript host library contract', () => {
  it('routes style cards into a script library rather than the old genre-only page', () => {
    expect(modalSource).toContain("type PickerStage = 'style' | 'library'")
    expect(modalSource).toContain("setStage('library')")
    expect(modalSource).toContain('已有剧本')
    expect(modalSource).toContain('正在创作')
    expect(modalSource).toContain("['queued', 'generating', 'validating', 'fallback', 'persisting']")
    expect(modalSource).toContain('setInterval(() => void onLoadLibrary(selectedStyle), 1500)')
  })

  it('loads and selects scripts through the canonical top-level routes', () => {
    expect(hookSource).toContain("path: `/api/miniscript/library?socialSessionId=")
    expect(hookSource).toContain("path: '/api/miniscript/select'")
    expect(hookSource).toContain("path: '/api/miniscript/generate'")
  })
})

import { describe, expect, it } from 'vitest'
import { getGameModeConfig } from '@shared/miniscriptGameModes'
import { buildMiniScriptGenerationPrompt, MINISCRIPT_GENERATION_PROMPT_VERSION } from '../ai/miniscriptPrompts'

describe('MiniScript selected label prompt context', () => {
  it('keeps the established prompt and appends the chosen host label', () => {
    const base = buildMiniScriptGenerationPrompt({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
      config: getGameModeConfig(['light_reasoning']),
    })
    const labeled = buildMiniScriptGenerationPrompt({
      playerCount: 4,
      style: 'modern_urban',
      genres: ['light_reasoning'],
      config: getGameModeConfig(['light_reasoning']),
      selectedLabel: '现代都市',
    })

    expect(MINISCRIPT_GENERATION_PROMPT_VERSION).toBe('miniscript-generate-v3.2')
    expect(labeled.system).toBe(base.system)
    expect(labeled.user.replace('\n【主持人已选标签】现代都市\n', '')).toBe(base.user)
    expect(labeled.user).toContain('【主持人已选标签】现代都市')
  })
})

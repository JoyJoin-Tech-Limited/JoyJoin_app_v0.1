import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FlashNpcDialogueScene } from './FlashUi'

const flashStyles = readFileSync(resolve(process.cwd(), 'src/pages/alang/flash.scss'), 'utf8')

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
}))

describe('Flash NPC natural idle motion', () => {
  const npc = { slug: 'shiqi', name: '拾柒', animal: '乌鸦' }

  it('keeps the base art static and breathes only a local masked layer', () => {
    const { container } = render(<FlashNpcDialogueScene npc={npc} speech='先看看这本册子。' motion={{ ambient: 'breathe' }} />)
    const base = container.querySelector('.flash-dialogue-scene__image')
    const layer = container.querySelector('.flash-dialogue-scene__breath-layer')
    expect(base).toBeInTheDocument()
    expect(container.querySelector('.flash-dialogue-scene__breath-window')).toContainElement(layer as HTMLElement)
    expect(layer).toHaveAttribute('src', base?.getAttribute('src'))
    expect(container.querySelector('.flash-dialogue-scene__blink-frame')).not.toBeInTheDocument()
    expect(flashStyles).not.toMatch(/\.flash-dialogue-scene--breathe\s+\.flash-dialogue-scene__image\s*\{[^}]*animation/)
    expect(flashStyles).toMatch(/\.flash-dialogue-scene--breathe\s+\.flash-dialogue-scene__breath-layer\s*\{[^}]*flash-story-breathe/)
  })

  it('renders blink only when a reviewed frame URL is present and disables idle layers for reduced motion', () => {
    const { container } = render(<FlashNpcDialogueScene npc={npc} speech='我们继续。' motion={{ ambient: 'drift', blinkAssetUrl: 'https://cdn.example.com/reviewed.webp', blinkIntervalSeconds: 7 }} />)
    expect(container.querySelector('.flash-dialogue-scene__breath-layer')).not.toBeInTheDocument()
    expect(container.querySelector('.flash-dialogue-scene__blink-frame')).toHaveAttribute('src', 'https://cdn.example.com/reviewed.webp')
    expect(flashStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.flash-dialogue-scene__breath-layer,[\s\S]*?\.flash-dialogue-scene__blink-frame/)
    expect(flashStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.flash-dialogue-scene__breath-layer,[\s\S]*?animation:\s*none\s*!important/)
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PixelAvatarFallback, {
  PIXEL_AVATAR_ARCHETYPE_IDS,
  type PixelAvatarArchetypeId,
} from './PixelAvatarFallback'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

const LABELS: Record<PixelAvatarArchetypeId, string> = {
  corgi: '社牛柯基',
  rooster: '小太阳鸡',
  hamster_praise: '夸夸仓鼠',
  fox: '寻宝狐',
  dolphin_calm: '机灵海豚',
  spider: '人脉蛛',
  koala: '树洞考拉',
  octopus: '脑洞章鱼',
  owl: '好奇猫头鹰',
  elephant: '靠谱大象',
  turtle: '慢热龟',
  cat: '小透明猫',
}

describe('PixelAvatarFallback', () => {
  it.each(PIXEL_AVATAR_ARCHETYPE_IDS)('accepts and labels canonical archetype %s', (archetypeId) => {
    const { container } = render(<PixelAvatarFallback archetypeId={archetypeId} variant='compact' />)

    expect(screen.getByRole('img', {
      name: `${LABELS[archetypeId]}像素伙伴，仅保留不可脱的基础背心与安全短裤`,
    })).toBeInTheDocument()
    expect(container.querySelector(`[data-archetype="${archetypeId}"]`)).toHaveClass(`pixel-avatar--${archetypeId}`)
  })

  it('keeps the safe base clothing when no equipment is supplied', () => {
    const { container } = render(<PixelAvatarFallback archetypeId='turtle' />)

    expect(container.querySelector('.pixel-avatar__base-top')).toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar__base-bottom')).toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar__base-shoe')).not.toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('不可脱的基础背心与安全短裤')
    expect(container.querySelector('.pixel-avatar__scene')).not.toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar__shadow')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(0)
  })

  it('fails safely for an unknown runtime archetype', () => {
    const { container } = render(<PixelAvatarFallback archetypeId='legacy-bear' />)

    expect(container.querySelector('[data-archetype="owl"]')).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('使用默认形象')
  })

})

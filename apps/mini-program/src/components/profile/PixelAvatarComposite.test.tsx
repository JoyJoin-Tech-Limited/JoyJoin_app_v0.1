import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EquipmentItem, EquipmentOutfit, EquipmentSlot } from '../../lib/profile/equipmentApi'
import PixelAvatarComposite from './PixelAvatarComposite'

vi.mock('@tarojs/components', () => ({
  View: ({ children, catchMove: _catchMove, hoverClass: _hoverClass, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, lazyLoad: _lazyLoad, ...props }: any) => <img {...props} />,
}))

const SLOT_ORDER: EquipmentSlot[] = ['top', 'bottom', 'shoes', 'accessory']

function makeItem(slot: EquipmentSlot): EquipmentItem {
  return {
    id: `${slot}-item`,
    slug: `corgi-${slot}`,
    name: `${slot} 初始装备`,
    description: null,
    slot,
    rarity: 'common',
    assetKey: `equipment/starter/corgi/${slot}/v1`,
    compatibleArchetypes: ['corgi'],
  }
}

function makeOutfit(overrides: Partial<EquipmentOutfit> = {}): EquipmentOutfit {
  return {
    topItemId: 'top-item',
    bottomItemId: 'bottom-item',
    shoesItemId: 'shoes-item',
    accessoryItemId: 'accessory-item',
    version: 1,
    ...overrides,
  }
}

const itemsById = new Map(SLOT_ORDER.map((slot) => {
  const item = makeItem(slot)
  return [item.id, item] as const
}))

describe('PixelAvatarComposite', () => {
  it('keeps the permanent modest body and renders all equipped cropped layers', () => {
    const { container } = render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit()}
        itemsById={itemsById}
      />,
    )

    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('data-permanent-underwear', 'true')
    expect(image.getAttribute('aria-label')).toContain('基础背心和安全短裤固定保留')
    expect(container.querySelector('.pixel-avatar-composite__body')).toHaveAttribute(
      'src',
      expect.stringMatching(/\/body-front-v2\.[a-f0-9]{12}\.webp/),
    )

    for (const slot of SLOT_ORDER) {
      const layer = container.querySelector(`.pixel-avatar-composite__layer--${slot}`)
      expect(layer).toBeInTheDocument()
      expect(layer).toHaveAttribute(
        'src',
        expect.stringMatching(new RegExp(`/${slot}/layer-v2\\.[a-f0-9]{12}\\.webp`)),
      )
      expect((layer as HTMLElement).style.left).not.toBe('')
      expect((layer as HTMLElement).style.width).not.toBe('')
    }
  })

  it('immediately removes an unequipped slot without removing the permanent base', () => {
    const { container, rerender } = render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit()}
        itemsById={itemsById}
      />,
    )

    rerender(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit({ topItemId: null })}
        itemsById={itemsById}
      />,
    )

    expect(container.querySelector('.pixel-avatar-composite__layer--top')).not.toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar-composite__layer--bottom')).toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('data-permanent-underwear', 'true')
  })

  it('reuses the same raster files while moving the whole scene and depth layers together', () => {
    const { container, rerender } = render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit()}
        itemsById={itemsById}
        frameId='left-far'
      />,
    )

    const leftBodySrc = container.querySelector('.pixel-avatar-composite__body')?.getAttribute('src')
    const leftTop = container.querySelector('.pixel-avatar-composite__layer--top') as HTMLElement
    const leftTopSrc = leftTop.getAttribute('src')
    const leftTransform = leftTop.style.transform
    expect((container.querySelector('.pixel-avatar-composite__scene') as HTMLElement).style.transform)
      .toContain('scaleX(0.9)')

    rerender(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit()}
        itemsById={itemsById}
        frameId='right-far'
      />,
    )

    const rightTop = container.querySelector('.pixel-avatar-composite__layer--top') as HTMLElement
    expect(container.querySelector('.pixel-avatar-composite__body')?.getAttribute('src')).toBe(leftBodySrc)
    expect(rightTop.getAttribute('src')).toBe(leftTopSrc)
    expect(rightTop.style.transform).not.toBe(leftTransform)
    expect(screen.getByRole('img')).toHaveAttribute('data-frame', 'right-far')
  })

  it('falls back to the safe clothed code-native avatar when the body cannot load', () => {
    const { container } = render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit()}
        itemsById={itemsById}
      />,
    )

    fireEvent.error(container.querySelector('.pixel-avatar-composite__body') as Element)

    expect(container.querySelector('.pixel-avatar__base-top')).toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar__base-bottom')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(0)
    expect(container.querySelector('.pixel-avatar-composite__body')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(/装备图层已暂时隐藏/)
  })

  it('keeps the base visible and offers a retry when an equipment layer fails', () => {
    const { container } = render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit()}
        itemsById={itemsById}
      />,
    )

    fireEvent.error(container.querySelector('.pixel-avatar-composite__layer--accessory') as Element)

    expect(container.querySelector('.pixel-avatar-composite__layer--accessory')).not.toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar-composite__layer--top')).toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(/1件装备图片未加载/)

    fireEvent.click(screen.getByRole('button', { name: '1件装备图片未加载，重新加载' }))

    expect(container.querySelector('.pixel-avatar-composite__layer--accessory')).toBeInTheDocument()
    expect(screen.getByRole('img')).not.toHaveAccessibleName(/装备图片未加载/)
  })

  it('offers a retry from the safe clothed fallback when the body image fails', () => {
    const { container } = render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit()}
        itemsById={itemsById}
      />,
    )

    fireEvent.error(container.querySelector('.pixel-avatar-composite__body') as Element)
    fireEvent.click(screen.getByRole('button', { name: '重新加载形象图片' }))

    expect(container.querySelector('.pixel-avatar-composite__body')).toBeInTheDocument()
  })

  it('announces a persisted equipment item whose artwork is not published yet', () => {
    const unavailableTop: EquipmentItem = {
      ...makeItem('top'),
      id: 'pool-top',
      name: '地点限定上装',
      assetKey: 'equipment/pools/venue/demo/top/v1',
    }
    const unavailableItems = new Map(itemsById)
    unavailableItems.set(unavailableTop.id, unavailableTop)
    const { container } = render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit({ topItemId: unavailableTop.id })}
        itemsById={unavailableItems}
      />,
    )

    expect(container.querySelector('.pixel-avatar-composite__layer--top')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAccessibleName('1件装备素材准备中')
    expect(screen.getByRole('img')).toHaveAccessibleName(/1件装备素材准备中/)
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeInTheDocument()
  })
})

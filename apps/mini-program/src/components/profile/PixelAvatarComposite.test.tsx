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

function makeSpiderItem(slot: EquipmentSlot): EquipmentItem {
  return {
    ...makeItem(slot),
    slug: `spider-${slot}`,
    assetKey: `equipment/starter/spider/${slot}/v1`,
    compatibleArchetypes: ['spider'],
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
  it('uses the pose-locked approved spider art for the complete starter outfit', () => {
    const spiderItems = new Map(SLOT_ORDER.map((slot) => {
      const item = makeSpiderItem(slot)
      return [item.id, item] as const
    }))
    const { container } = render(
      <PixelAvatarComposite
        archetypeId='spider'
        outfit={makeOutfit()}
        itemsById={spiderItems}
      />,
    )

    expect(container.querySelector('.pixel-avatar-composite__body--approved-starter'))
      .toHaveAttribute('src', expect.stringContaining('/profile-pixel/archetypes/spider/base-v1.webp'))
    expect(container.querySelectorAll('.pixel-avatar-composite__layer')).toHaveLength(0)
  })

  it('keeps the approved complete spider pose through pseudo-3D turntable frames', () => {
    const spiderItems = new Map(SLOT_ORDER.map((slot) => {
      const item = makeSpiderItem(slot)
      return [item.id, item] as const
    }))
    const { container, rerender } = render(
      <PixelAvatarComposite
        archetypeId='spider'
        outfit={makeOutfit()}
        itemsById={spiderItems}
        frameId='left-far'
      />,
    )

    const approvedSrc = container.querySelector('.pixel-avatar-composite__body--approved-starter')
      ?.getAttribute('src')
    expect(approvedSrc).toContain('/profile-pixel/archetypes/spider/base-v1.webp')
    expect(container.querySelectorAll('.pixel-avatar-composite__layer')).toHaveLength(0)

    rerender(
      <PixelAvatarComposite
        archetypeId='spider'
        outfit={makeOutfit()}
        itemsById={spiderItems}
        frameId='right-far'
      />,
    )

    expect(container.querySelector('.pixel-avatar-composite__body--approved-starter'))
      .toHaveAttribute('src', approvedSrc)
    expect(container.querySelectorAll('.pixel-avatar-composite__layer')).toHaveLength(0)
  })

  it('returns to independent spider layers as soon as one starter item is removed', () => {
    const spiderItems = new Map(SLOT_ORDER.map((slot) => {
      const item = makeSpiderItem(slot)
      return [item.id, item] as const
    }))
    const { container } = render(
      <PixelAvatarComposite
        archetypeId='spider'
        outfit={makeOutfit({ accessoryItemId: null })}
        itemsById={spiderItems}
      />,
    )

    expect(container.querySelector('.pixel-avatar-composite__body--approved-starter')).not.toBeInTheDocument()
    expect(container.querySelector('.pixel-avatar-composite__layer--top')).toBeInTheDocument()
  })

  it('recovers from an approved starter image failure when the outfit changes its body source', () => {
    const spiderItems = new Map(SLOT_ORDER.map((slot) => {
      const item = makeSpiderItem(slot)
      return [item.id, item] as const
    }))
    const { container, rerender } = render(
      <PixelAvatarComposite
        archetypeId='spider'
        outfit={makeOutfit()}
        itemsById={spiderItems}
      />,
    )

    fireEvent.error(container.querySelector('.pixel-avatar-composite__body') as Element)
    expect(container.querySelector('.pixel-avatar__base-top')).toBeInTheDocument()

    rerender(
      <PixelAvatarComposite
        archetypeId='spider'
        outfit={makeOutfit({ accessoryItemId: null })}
        itemsById={spiderItems}
      />,
    )

    expect(container.querySelector('.pixel-avatar-composite__body')).toHaveAttribute(
      'src',
      expect.stringMatching(/\/body-front-v2\.[a-f0-9]{12}\.webp/),
    )
    expect(container.querySelector('.pixel-avatar-composite__layer--top')).toBeInTheDocument()
  })

  it('uses the atlas-derived approved full-starter look for a complete non-spider starter outfit', () => {
    const { container } = render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit()}
        itemsById={itemsById}
      />,
    )

    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('data-permanent-underwear', 'true')
    expect(container.querySelector('.pixel-avatar-composite__body--approved-starter')).toHaveAttribute(
      'src',
      expect.stringMatching(/\/archetypes\/corgi\/full-starter-v2\.[a-f0-9]{12}\.webp/),
    )
    expect(container.querySelectorAll('.pixel-avatar-composite__layer')).toHaveLength(0)
  })

  it('keeps the permanent modest body and renders all equipped cropped layers', () => {
    const { container } = render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit({ accessoryItemId: null })}
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

    for (const slot of SLOT_ORDER.filter((slot) => slot !== 'accessory')) {
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
        outfit={makeOutfit({ accessoryItemId: null })}
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
        outfit={makeOutfit({ accessoryItemId: null })}
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
        outfit={makeOutfit({ shoesItemId: null })}
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

  it('renders placement slot hotspots on the front frame and forwards taps', () => {
    const onSlotTap = vi.fn()
    render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit({ accessoryItemId: null })}
        itemsById={itemsById}
        onSlotTap={onSlotTap}
        slotHotspots={[
          { slot: 'top', label: '查看上装', placement: { left: 85, top: 194, width: 296, height: 290 } },
          { slot: 'shoes', label: '查看鞋子', placement: { left: 135, top: 584, width: 260, height: 135 } },
        ]}
      />,
    )

    const topHotspot = screen.getByRole('button', { name: '查看上装' })
    expect(topHotspot).toHaveStyle({ left: `${(85 / 512) * 100}%`, top: `${(194 / 768) * 100}%` })
    fireEvent.click(topHotspot)
    expect(onSlotTap).toHaveBeenCalledWith('top')

    fireEvent.click(screen.getByRole('button', { name: '查看鞋子' }))
    expect(onSlotTap).toHaveBeenCalledWith('shoes')
  })

  it('hides slot hotspots off the front frame instead of misaligning them', () => {
    render(
      <PixelAvatarComposite
        archetypeId='corgi'
        outfit={makeOutfit({ accessoryItemId: null })}
        itemsById={itemsById}
        frameId='right-near'
        onSlotTap={() => {}}
        slotHotspots={[
          { slot: 'top', label: '查看上装', placement: { left: 85, top: 194, width: 296, height: 290 } },
        ]}
      />,
    )

    expect(screen.queryByRole('button', { name: '查看上装' })).not.toBeInTheDocument()
  })
})

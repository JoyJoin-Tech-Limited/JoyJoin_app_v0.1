import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EquipmentItem, EquipmentOutfit } from '../../lib/profile/equipmentApi'
import PixelAvatarTurntable, { getPixelAvatarFrameIndexAfterDrag } from './PixelAvatarTurntable'

vi.mock('@tarojs/components', () => ({
  View: ({
    children,
    catchMove,
    hoverClass: _hoverClass,
    ...props
  }: any) => <div data-catch-move={String(Boolean(catchMove))} {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, lazyLoad: _lazyLoad, ...props }: any) => <img {...props} />,
}))

const outfit: EquipmentOutfit = {
  topItemId: 'top-item',
  bottomItemId: null,
  shoesItemId: null,
  accessoryItemId: null,
  version: 1,
}

const topItem: EquipmentItem = {
  id: 'top-item',
  slug: 'corgi-top',
  name: '初始上装',
  description: null,
  slot: 'top',
  rarity: 'common',
  assetKey: 'equipment/starter/corgi/top/v1',
  compatibleArchetypes: ['corgi'],
}

const itemsById = new Map([[topItem.id, topItem]])

function renderTurntable(onFrameChange = vi.fn()) {
  return {
    onFrameChange,
    ...render(
      <PixelAvatarTurntable
        archetypeId='corgi'
        outfit={outfit}
        itemsById={itemsById}
        onFrameChange={onFrameChange}
      />,
    ),
  }
}

describe('PixelAvatarTurntable', () => {
  it('moves through five bounded stops with accessible buttons and resets to front', () => {
    const { container, onFrameChange } = renderTurntable()
    const right = screen.getByRole('button', { name: '向右一档' })

    fireEvent.click(right)
    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-frame', 'right-near')
    fireEvent.click(right)
    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-frame', 'right-far')
    expect(right).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(right)
    expect(onFrameChange).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: '回到正面视角' }))
    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-frame', 'front')
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '3')
  })

  it('locks a horizontal drag to the avatar and changes the shared scene stop', () => {
    const { container } = renderTurntable()
    const slider = screen.getByRole('slider')

    fireEvent.touchStart(slider, { touches: [{ clientX: 220, clientY: 120 }] })
    fireEvent.touchMove(slider, { touches: [{ clientX: 110, clientY: 124 }] })

    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-frame', 'right-far')
    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-drag-axis', 'horizontal')
    expect(slider).toHaveAttribute('data-catch-move', 'true')

    fireEvent.touchEnd(slider, { changedTouches: [{ clientX: 110, clientY: 124 }] })
    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-drag-axis', 'idle')
  })

  it('leaves a vertical gesture to the page scroll instead of rotating the avatar', () => {
    const { container, onFrameChange } = renderTurntable()
    const slider = screen.getByRole('slider')

    fireEvent.touchStart(slider, { touches: [{ clientX: 180, clientY: 90 }] })
    fireEvent.touchMove(slider, { touches: [{ clientX: 176, clientY: 152 }] })

    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-frame', 'front')
    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-drag-axis', 'vertical')
    expect(slider).toHaveAttribute('data-catch-move', 'false')
    expect(onFrameChange).not.toHaveBeenCalled()
  })

  it('clears axis lock on touchCancel so a later gesture still works', () => {
    const { container } = renderTurntable()
    const slider = screen.getByRole('slider')

    fireEvent.touchStart(slider, { touches: [{ clientX: 180, clientY: 100 }] })
    fireEvent.touchMove(slider, { touches: [{ clientX: 130, clientY: 102 }] })
    fireEvent.touchCancel(slider)
    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-drag-axis', 'idle')

    fireEvent.touchStart(slider, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(slider, { touches: [{ clientX: 154, clientY: 102 }] })
    expect(container.querySelector('.pixel-avatar-turntable')).toHaveAttribute('data-frame', 'front')
  })

  it('calculates drag stops without wrapping beyond either edge', () => {
    expect(getPixelAvatarFrameIndexAfterDrag(2, -52)).toBe(3)
    expect(getPixelAvatarFrameIndexAfterDrag(2, 52)).toBe(1)
    expect(getPixelAvatarFrameIndexAfterDrag(0, 520)).toBe(0)
    expect(getPixelAvatarFrameIndexAfterDrag(4, -520)).toBe(4)
  })
})

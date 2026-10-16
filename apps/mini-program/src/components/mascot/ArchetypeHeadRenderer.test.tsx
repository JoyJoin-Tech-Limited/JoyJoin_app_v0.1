import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ArchetypeHeadRenderer from './ArchetypeHeadRenderer'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, lazyLoad: _lazyLoad, ...props }: any) => <img {...props} />,
}))

// 2026-10-16: the local→CDN double fail is the one asset-failure mode that
// otherwise renders as an empty ring on `fallback='none'` surfaces (the
// event-feedback wrap-up rows). `onAssetError` is what makes it observable —
// these locks keep the callback firing on the CDN tier only, exactly once.
//
// Note: in the vitest env `TARO_APP_CDN_BASE_URL` is unset, so both tiers
// resolve to the same string — the tests re-query the <img> after each error
// instead of asserting src changes.

describe('ArchetypeHeadRenderer onAssetError (2026-10-16)', () => {
  it('does not fire on the first (local bundle) tier failure', () => {
    const onAssetError = vi.fn()
    const { container } = render(
      <ArchetypeHeadRenderer archetype='corgi' fallback='none' onAssetError={onAssetError} />,
    )

    const img = container.querySelector('.archetype-head__image')
    expect(img).toBeTruthy()
    fireEvent.error(img as Element)
    expect(onAssetError).not.toHaveBeenCalled()
  })

  it('fires exactly once when both tiers fail', () => {
    const onAssetError = vi.fn()
    const { container } = render(
      <ArchetypeHeadRenderer archetype='corgi' fallback='none' onAssetError={onAssetError} />,
    )

    fireEvent.error(container.querySelector('.archetype-head__image') as Element)
    // Re-query: the re-render swaps the handler to the CDN-tier one.
    fireEvent.error(container.querySelector('.archetype-head__image') as Element)

    expect(onAssetError).toHaveBeenCalledTimes(1)
  })

  it('renders nothing on double failure when fallback is none', () => {
    const onAssetError = vi.fn()
    const { container } = render(
      <ArchetypeHeadRenderer archetype='corgi' fallback='none' onAssetError={onAssetError} />,
    )

    fireEvent.error(container.querySelector('.archetype-head__image') as Element)
    fireEvent.error(container.querySelector('.archetype-head__image') as Element)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.archetype-head')).toBeNull()
  })

  it('stays silent when the consumer does not pass onAssetError', () => {
    const { container } = render(<ArchetypeHeadRenderer archetype='corgi' fallback='none' />)

    fireEvent.error(container.querySelector('.archetype-head__image') as Element)
    expect(() => {
      fireEvent.error(container.querySelector('.archetype-head__image') as Element)
    }).not.toThrow()
    expect(container.querySelector('img')).toBeNull()
  })

  it('never fires for a null archetype (no asset request is made)', () => {
    const onAssetError = vi.fn()
    const { container } = render(<ArchetypeHeadRenderer fallback='none' onAssetError={onAssetError} />)

    expect(container.querySelector('img')).toBeNull()
    expect(onAssetError).not.toHaveBeenCalled()
  })
})

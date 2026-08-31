import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import PoolRegistrationInclusions, {
  InclusionTileIcon,
} from '../PoolRegistrationInclusions'
import { POOL_INCLUSION_TILES } from '@shared/copy/poolRegistrationInclusionsCopy'

const mockConfig = vi.hoisted(() => ({
  autoErrorAlt: null as string | null,
}))

vi.mock('../../../hooks/useDeviceTier', () => ({
  useDeviceTier: () => ({ isDegradation: false }),
}))

vi.mock('@tarojs/components', async () => {
  const actual = await vi.importActual<typeof import('@tarojs/components')>('@tarojs/components')
  return {
    ...actual,
    View: (props: Record<string, unknown>) => <div {...props} />,
    Text: (props: Record<string, unknown>) => <span {...props} />,
    Image: (props: Record<string, unknown>) => {
      useEffect(() => {
        if (
          mockConfig.autoErrorAlt &&
          props['aria-label'] === mockConfig.autoErrorAlt &&
          props.onError
        ) {
          ;(props.onError as () => void)()
        }
      }, [])
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-testid='taro-image'
          src={String(props.src)}
          alt={String(props['aria-label'] ?? '')}
        />
      )
    },
  }
})

describe('PoolRegistrationInclusions', () => {
  it('renders all four locked tiles with copy and image assets', () => {
    mockConfig.autoErrorAlt = null
    render(<PoolRegistrationInclusions visible reduceMotion={false} />)

    for (const tile of POOL_INCLUSION_TILES) {
      expect(screen.getByText(tile.title)).toBeInTheDocument()
      expect(screen.getByText(tile.subtitle)).toBeInTheDocument()
      if (tile.icon.kind !== 'image') {
        throw new Error(`expected image icon for tile ${tile.id}`)
      }
      const image = screen.getByAltText(tile.title)
      expect(image).toHaveAttribute('src', tile.icon.src)
    }
  })

  it('uses hidden class when not visible', () => {
    mockConfig.autoErrorAlt = null
    const { container } = render(
      <PoolRegistrationInclusions visible={false} reduceMotion={false} />,
    )
    expect(container.querySelector('.pool-reg-inclusions--hidden')).not.toBeNull()
  })

  it('uses static class when reduceMotion is true', () => {
    mockConfig.autoErrorAlt = null
    const { container } = render(
      <PoolRegistrationInclusions visible reduceMotion={true} />,
    )
    const root = container.querySelector('.pool-reg-inclusions')
    expect(root?.classList.contains('pool-reg-inclusions--static')).toBe(true)
  })
})

describe('InclusionTileIcon', () => {
  it('falls back to a JoyJoinIcon glyph when an image fails to load', () => {
    const tile = POOL_INCLUSION_TILES[0]
    if (tile.icon.kind !== 'image') {
      throw new Error('expected image icon for the first tile')
    }
    mockConfig.autoErrorAlt = tile.icon.alt

    render(<InclusionTileIcon tile={tile} />)

    // The broken image should be replaced by the JoyJoinIcon glyph mapping for 🎮.
    const image = screen.getByTestId('taro-image')
    expect(image).toHaveAttribute('src', expect.stringContaining('category-play'))
  })
})

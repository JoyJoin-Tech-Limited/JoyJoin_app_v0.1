import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FlashNpcPortrait, FlashNpcSceneBackdrop } from './FlashUi'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Image: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

describe('Flash artwork rendering contract', () => {
  it('uses bundled headshots for every built-in NPC', () => {
    const slugs = ['alang', 'lizi', 'momo', 'shiqi', 'atuan']

    for (const slug of slugs) {
      const { container, unmount } = render(
        <FlashNpcPortrait npc={{ slug, name: slug }} />,
      )
      expect(container.querySelector('img')?.getAttribute('src'))
        .toBe(`/pages/alang/assets/npcs/headshots/${slug}.jpg`)
      unmount()
    }
  })

  it('uses the server-owned avatar for an extensible NPC and falls back safely', () => {
    const { container, getByText } = render(
      <FlashNpcPortrait
        npc={{
          slug: 'custom-npc',
          name: '新角色',
          avatarUrl: 'https://joyjoinapp.com/static/flash/custom-npc.webp',
        }}
      />,
    )
    const image = container.querySelector('img') as HTMLImageElement
    expect(image.getAttribute('src')).toBe('https://joyjoinapp.com/static/flash/custom-npc.webp')

    fireEvent.error(image)
    expect(getByText('新')).toBeTruthy()
  })

  it.each(['radar', 'task', 'feedback'] as const)(
    'renders the bundled %s scene background',
    (scene) => {
      const { container } = render(<FlashNpcSceneBackdrop scene={scene} />)
      expect(container.querySelector('img')?.getAttribute('src'))
        .toBe(`/pages/alang/assets/backgrounds/${scene}-paper-scene.jpg`)
    },
  )
})

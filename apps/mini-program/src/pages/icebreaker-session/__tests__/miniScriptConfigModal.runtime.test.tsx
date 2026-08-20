import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MINISCRIPT_CATALOG } from '@shared/miniscriptCatalog'
import { MiniScriptConfigModal, type MiniScriptConfigModalProps } from '../overlays/MiniScriptConfigModal'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: ({ src, className }: { src?: string; className?: string }) => (
    <img src={src} className={className} />
  ),
  ScrollView: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  RootPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('../../../lib/utils/cdnAssets', () => ({
  cdnAsset: (path: string) => path,
}))

vi.mock('../../../components/ui/AiGenerationShell', () => ({
  default: () => null,
}))

vi.mock('../../../components/ui/Button', () => ({
  default: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
  }) => (
    <button type='button' className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

const FIRST_STYLE = MINISCRIPT_CATALOG.styles[0]!
const FIRST_GENRE = MINISCRIPT_CATALOG.genres[0]! // 轻推理 — the single default genre
const SECOND_GENRE = MINISCRIPT_CATALOG.genres[1]!

function buildProps(overrides: Partial<MiniScriptConfigModalProps> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    isSubmitting: false,
    generationStatus: null,
    scripts: [],
    isLibraryLoading: false,
    libraryError: null,
    onLoadLibrary: vi.fn(async () => {}),
    onSelectScript: vi.fn(async () => true),
    onSubmit: vi.fn(async () => true),
    ...overrides,
  } satisfies MiniScriptConfigModalProps
}

describe('MiniScriptConfigModal runtime behavior', () => {
  it('keeps the picked style across parent re-renders (poll ticks must not wipe selection)', () => {
    // Regression: the reset effect used to re-run on every render because the
    // default initialGenres spread created a new array identity each time,
    // wiping selectedStyle within a frame of the tap — the host could never
    // leave the style grid and no generate request ever left the device.
    const props = buildProps()
    const { getByRole, getByText, rerender, container } = render(
      <MiniScriptConfigModal {...props} />,
    )

    expect(getByText('选择剧本类型')).toBeTruthy()

    fireEvent.click(getByRole('button', { name: `${FIRST_STYLE.label}，查看已有剧本` }))
    expect(getByText('已有剧本')).toBeTruthy()
    expect(getByText('这个类型还没有现成剧本')).toBeTruthy()
    expect(container.querySelector('.ms-modal__hero-label')?.textContent).toBe(FIRST_STYLE.label)

    // Simulate the session page's 3s poll re-rendering the modal with identical props.
    for (let i = 0; i < 3; i++) {
      rerender(<MiniScriptConfigModal {...props} />)
    }

    expect(getByText('已有剧本')).toBeTruthy()
    expect(container.querySelector('.ms-modal__hero-label')?.textContent).toBe(FIRST_STYLE.label)
    expect(getByRole('button', { name: '生成新剧本' })).toBeTruthy()
  })

  it('keeps genre toggles across re-renders and submits the selected style and genres', () => {
    const props = buildProps()
    const { getByRole, rerender } = render(<MiniScriptConfigModal {...props} />)

    fireEvent.click(getByRole('button', { name: `${FIRST_STYLE.label}，查看已有剧本` }))

    // New default: exactly one genre (轻推理 = FIRST_GENRE) is preselected.
    fireEvent.click(getByRole('button', { name: `${FIRST_GENRE.label}，已选择` }))
    expect(
      getByRole('button', { name: `${FIRST_GENRE.label}，未选择` }),
    ).toBeTruthy()

    // A poll-tick re-render must not resurrect the deselected genre.
    rerender(<MiniScriptConfigModal {...props} />)
    expect(
      getByRole('button', { name: `${FIRST_GENRE.label}，未选择` }),
    ).toBeTruthy()

    fireEvent.click(getByRole('button', { name: `${SECOND_GENRE.label}，未选择` }))
    fireEvent.click(getByRole('button', { name: '生成新剧本' }))
    expect(props.onSubmit).toHaveBeenCalledTimes(1)
    expect(props.onSubmit).toHaveBeenCalledWith({
      style: FIRST_STYLE.key,
      genres: [SECOND_GENRE.key],
      lite: false,
      selectedLabel: FIRST_STYLE.label,
    })
  })

  it('resets the picker only when the modal transitions closed → open', () => {
    const props = buildProps()
    const { getByRole, getByText, queryByText, rerender, container } = render(
      <MiniScriptConfigModal {...props} />,
    )

    fireEvent.click(getByRole('button', { name: `${FIRST_STYLE.label}，查看已有剧本` }))
    expect(getByText('已有剧本')).toBeTruthy()

    rerender(<MiniScriptConfigModal {...props} open={false} />)
    expect(queryByText('已有剧本')).toBeNull()

    rerender(<MiniScriptConfigModal {...props} open />)
    expect(getByText('选择剧本类型')).toBeTruthy()
    expect(container.querySelector('.ms-modal__hero-label')).toBeNull()
  })
})

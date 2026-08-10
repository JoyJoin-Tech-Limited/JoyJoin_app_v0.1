import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AiGenerationShell from '../AiGenerationShell'

vi.mock('@tarojs/components', () => ({
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  View: (props: Record<string, unknown>) => <div {...props} />,
  Button: (props: Record<string, unknown>) => <button {...props} />,
  RootPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    eventCenter: {
      on: vi.fn(),
      off: vi.fn(),
    },
    getSystemInfoSync: () => ({}),
  },
  eventCenter: {
    on: vi.fn(),
    off: vi.fn(),
  },
  getSystemInfoSync: () => ({}),
}))

vi.mock('../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: (id: string) => `/mascot/${id}.webp`,
}))

vi.mock('../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

const STEPS = [
  { label: '构思故事背景', description: '根据风格与题材搭建世界观' },
  { label: '塑造角色与任务' },
  { label: '串联剧情与线索' },
  { label: '保存剧本' },
]

describe('AiGenerationShell', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <AiGenerationShell
        visible={false}
        phase='generating'
        title='正在生成剧本…'
        steps={STEPS}
        progress={45}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders generating state with progress bar', () => {
    const { getByRole, getByLabelText } = render(
      <AiGenerationShell
        visible
        phase='generating'
        title='正在生成剧本…'
        steps={STEPS}
        progress={45}
        progressLabel='生成进度 45%'
      />,
    )

    const progressbar = getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '45')
    expect(getByLabelText(/生成进度/)).toBeTruthy()
  })

  it('marks steps as completed based on progress', () => {
    const { container } = render(
      <AiGenerationShell
        visible
        phase='generating'
        title='正在生成剧本…'
        steps={STEPS}
        progress={70}
      />,
    )

    const completed = container.querySelectorAll('.ai-gen-shell__step--completed')
    expect(completed.length).toBeGreaterThanOrEqual(2)
    expect(completed.length).toBeLessThanOrEqual(3)
  })

  it('shows error state with retry and close actions', () => {
    const onRetry = vi.fn()
    const onCancel = vi.fn()
    const { getByText } = render(
      <AiGenerationShell
        visible
        phase='error'
        title='error'
        steps={STEPS}
        errorTitle='生成失败'
        errorDescription='网络开小差了'
        retryLabel='再试一次'
        cancelLabel='取消'
        onRetry={onRetry}
        onCancel={onCancel}
      />,
    )

    expect(getByText('生成失败')).toBeTruthy()
    expect(getByText('网络开小差了')).toBeTruthy()
    expect(getByText('再试一次')).toBeTruthy()
    expect(getByText('取消')).toBeTruthy()
  })

  it('shows confirm state with confirm and cancel actions', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { getByText } = render(
      <AiGenerationShell
        visible
        phase='confirm'
        title='确认生成？'
        steps={STEPS}
        confirmLabel='开始生成'
        cancelLabel='再想想'
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(getByText('确认生成？')).toBeTruthy()
    expect(getByText('开始生成')).toBeTruthy()
    expect(getByText('再想想')).toBeTruthy()
  })

  it('renders success state', () => {
    const { getByText } = render(
      <AiGenerationShell
        visible
        phase='success'
        title='title'
        steps={STEPS}
        successTitle='剧本已生成'
        successSubtitle='准备进入角色分配'
      />,
    )

    expect(getByText('剧本已生成')).toBeTruthy()
    expect(getByText('准备进入角色分配')).toBeTruthy()
  })

  it('renders inline mode without overlay wrapper', () => {
    const { container } = render(
      <AiGenerationShell
        visible
        mode='inline'
        phase='generating'
        title='正在生成…'
        steps={STEPS}
        progress={10}
      />,
    )

    expect(container.querySelector('.ai-gen-shell--inline')).toBeTruthy()
  })
})

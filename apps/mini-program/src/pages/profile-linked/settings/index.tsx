import { getUserCoupons } from '@shared/api'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { useQuery } from '@tanstack/react-query'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useRef, useState } from 'react'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { useMiniPageGate } from '../../../hooks/navigation/useMiniPageGate'
import { apiRequest } from '../../../lib/api/api'
import {
  clearMiniProgramAuthSession,
  getApiErrorStatusCode,
  isUnauthorizedApiError,
} from '../../../lib/api/authSession'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { openMiniProgramPaymentPage } from '../../../lib/payment/paymentEntry'
import { haptics } from '../../../lib/utils/haptics'
import { logError, logInfo } from '../../../lib/utils/logger'
import './index.scss'

type SettingsAction =
  | 'edit-profile'
  | 'rewards'
  | 'invite'
  | 'benefits'
  | 'events'
  | 'terms'

interface SettingsRow {
  action: SettingsAction
  label: string
  description: string
  emoji: string
  iconTier?: 'ui' | 'semantic'
}

const SETTINGS_ROWS: SettingsRow[] = [
  {
    action: 'edit-profile',
    label: '编辑资料',
    description: '更新昵称、介绍与个人信息',
    emoji: '✏️',
  },
  {
    action: 'rewards',
    label: '奖励福利',
    description: '查看已获得和可使用的奖励',
    emoji: '🏆',
  },
  {
    action: 'invite',
    label: '邀请好友',
    description: '把悦聚分享给想一起出发的人',
    emoji: '🤝',
    iconTier: 'semantic',
  },
  {
    action: 'benefits',
    label: '我的权益',
    description: '查看报名与账户权益',
    emoji: '🎁',
  },
  {
    action: 'events',
    label: '我的足迹',
    description: '回看参加过和正在进行的活动',
    emoji: '👣',
    iconTier: 'ui',
  },
  {
    action: 'terms',
    label: '服务条款',
    description: '了解服务规则与隐私约定',
    emoji: '📄',
  },
]

export default function ProfileSettingsPage() {
  const { authLoading, authUser, renderGate } = useMiniPageGate()
  const logoutPromptLockRef = useRef(false)
  const [pendingAction, setPendingAction] = useState<SettingsAction | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const couponsQuery = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
    enabled: !authLoading && !!authUser,
    staleTime: 30_000,
  })

  const runSettingsAction = async (action: SettingsAction) => {
    if (pendingAction || isLoggingOut) return

    try {
      haptics('light')
    } catch {
      // Optional device feedback must never block a settings destination.
    }
    setPendingAction(action)

    try {
      switch (action) {
        case 'edit-profile':
          await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile })
          break
        case 'rewards':
          await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.rewards })
          break
        case 'invite':
          await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.invite })
          break
        case 'benefits':
          await openMiniProgramPaymentPage({ currentUserId: authUser?.id })
          break
        case 'events':
          await Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
          break
        case 'terms':
          await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.terms })
          break
      }
    } catch (error) {
      try {
        logError('[ProfileSettings] Navigation failed', {
          action,
          message: error instanceof Error ? error.message : String(error),
        })
      } catch {
        // Diagnostic logging must not suppress the visible recovery message.
      }
      try {
        await Taro.showToast({
          title: '页面没有打开，请稍后再试',
          icon: 'none',
        })
      } catch {
        // The row returns to its normal state in finally even if toast is unavailable.
      }
    } finally {
      setPendingAction(null)
    }
  }

  const handleLogout = async () => {
    if (logoutPromptLockRef.current || pendingAction || isLoggingOut) return

    logoutPromptLockRef.current = true
    try {
      haptics('medium')
    } catch {
      // Optional device feedback must never block logout confirmation.
    }

    try {
      const confirmation = await Taro.showModal({
        title: '退出登录',
        content: '确认退出当前账号吗？下次进入时需要重新登录。',
        confirmText: '确认退出',
        cancelText: '再等等',
        confirmColor: '#EF4444',
      })

      if (!confirmation.confirm) return

      setIsLoggingOut(true)
      try {
        logInfo('[ProfileSettings] User confirmed logout')
      } catch {
        // Diagnostic logging must never block logout.
      }

      try {
        await apiRequest<{ message: string }>({
          path: '/api/auth/logout',
          method: 'POST',
          handleUnauthorized: false,
        })

        clearMiniProgramAuthSession({ mode: 'hard' })
        await Taro.reLaunch({ url: `${MINI_PROGRAM_ROUTES.index}?auth=logout` })
      } catch (error) {
        if (isUnauthorizedApiError(error)) {
          clearMiniProgramAuthSession({ mode: 'hard' })
          await Taro.reLaunch({ url: `${MINI_PROGRAM_ROUTES.index}?auth=logout` })
          return
        }

        try {
          logError('[ProfileSettings] Logout failed', {
            statusCode: getApiErrorStatusCode(error),
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        } catch {
          // Diagnostic logging must never hide the logout failure.
        }
        try {
          await Taro.showToast({
            title: getErrorMessage('logout-failed'),
            icon: 'none',
            duration: 3000,
          })
        } catch {
          // Keep the current page and unlock the action if toast is unavailable.
        }
      } finally {
        setIsLoggingOut(false)
      }
    } finally {
      logoutPromptLockRef.current = false
    }
  }

  const couponCount = couponsQuery.data?.count ?? 0

  return renderGate(
    <View className='profile-settings'>
      <ScrollView
        className='profile-settings__scroll'
        scrollY
        enhanced
        showScrollbar={false}
      >
        <View className='profile-settings__intro'>
          <View className='profile-settings__intro-mark' aria-hidden='true'>
            <JoyJoinIcon emoji='⚙️' tier='ui' size={42} />
          </View>
          <View className='profile-settings__intro-copy'>
            <Text className='profile-settings__title'>设置与服务</Text>
            <Text className='profile-settings__subtitle'>账号资料和常用服务，都收在这里。</Text>
          </View>
        </View>

        <View className='profile-settings__section'>
          <Text className='profile-settings__section-label'>账号与服务</Text>
          <View className='profile-settings__card'>
            {SETTINGS_ROWS.map((row, index) => {
              const isPending = pendingAction === row.action
              const isRewards = row.action === 'rewards'
              const rewardsMeta = couponsQuery.isLoading
                ? '正在读取'
                : couponsQuery.isError
                  ? '稍后查看'
                  : couponCount > 0
                    ? `${couponCount} 项`
                    : null

              return (
                <View
                  key={row.action}
                  className={`profile-settings__row${index > 0 ? ' profile-settings__row--divided' : ''}${isPending ? ' profile-settings__row--busy' : ''}`}
                  hoverClass='profile-settings__row--pressed'
                  hoverStayTime={80}
                  onClick={() => void runSettingsAction(row.action)}
                  role='button'
                  aria-label={`${row.label}${isPending ? '，正在打开' : ''}`}
                  aria-disabled={!!pendingAction || isLoggingOut}
                  data-testid={`profile-settings-${row.action}`}
                >
                  <View className='profile-settings__icon-well' aria-hidden='true'>
                    <JoyJoinIcon
                      emoji={row.emoji}
                      tier={row.iconTier}
                      size={38}
                      className='profile-settings__icon'
                    />
                  </View>
                  <View className='profile-settings__row-copy'>
                    <Text className='profile-settings__row-label'>{row.label}</Text>
                    <Text className='profile-settings__row-description'>
                      {isPending ? '正在打开…' : row.description}
                    </Text>
                  </View>
                  {isRewards && rewardsMeta && (
                    <Text
                      className={`profile-settings__meta${couponCount > 0 && !couponsQuery.isLoading ? ' profile-settings__meta--active' : ''}`}
                      aria-live='polite'
                    >
                      {rewardsMeta}
                    </Text>
                  )}
                  <View className='profile-settings__chevron' aria-hidden='true' />
                </View>
              )
            })}
          </View>
        </View>

        <View className='profile-settings__logout'>
          <Button
            variant='secondary'
            className='profile-settings__logout-button'
            loading={isLoggingOut}
            disabled={!!pendingAction}
            onClick={() => void handleLogout()}
            aria-label={isLoggingOut ? '正在退出登录' : '退出登录'}
          >
            <Text className='profile-settings__logout-text'>退出登录</Text>
          </Button>
          <Text className='profile-settings__logout-hint'>退出不会删除你的活动、故事或个人资料。</Text>
        </View>

        <View className='profile-settings__safe-area' />
      </ScrollView>
    </View>,
    '正在打开你的设置…',
  )
}

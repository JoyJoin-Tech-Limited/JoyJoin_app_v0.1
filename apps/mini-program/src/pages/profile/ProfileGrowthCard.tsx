import { Text, View } from '@tarojs/components'
import { CountUpText } from '../../components/ui/CountUpText'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import type { getProfileGrowthSummary, getStreakMilestoneTeaser } from './profileConstants'

// The page owns the SCSS so all profile-page__* selectors stay in its WXSS.
export default function ProfileGrowthCard({
  isLoading,
  isError,
  growth,
  visibleGrowthProgress,
  growthLevelLabel,
  activityStreak,
  streakTeaser,
  streakContinuationTarget,
  onStreakTap,
}: {
  isLoading: boolean
  isError: boolean
  growth: ReturnType<typeof getProfileGrowthSummary>
  visibleGrowthProgress: number
  growthLevelLabel: string
  activityStreak: number
  streakTeaser: ReturnType<typeof getStreakMilestoneTeaser>
  streakContinuationTarget: number | null
  onStreakTap: () => void
}) {
  return (
    <View className='profile-page__growth-card'>
      <View
        className='profile-page__growth'
        aria-label={isLoading
          ? '潮流值正在加载'
          : `潮流值 ${growth.current}，${visibleGrowthProgress}%`}
      >
        <View className='profile-page__growth-heading'>
          <Text className='profile-page__growth-label'>潮流值</Text>
          {isLoading ? (
            <Text className='profile-page__growth-value'>—</Text>
          ) : (
            <CountUpText
              className='profile-page__growth-value'
              value={growth.current}
              duration={600}
              easing='brandBezier'
              cadenceFloorMs={33}
            />
          )}
          {!isLoading && growth.nextTarget !== null && (
            <Text className='profile-page__growth-target'>/{growth.nextTarget}</Text>
          )}
        </View>
        <View className='profile-page__growth-progress'>
          <View
            className='profile-page__growth-progress-bar'
            style={{ transform: `scaleX(${visibleGrowthProgress / 100})` }}
          >
            <View className='profile-page__growth-progress-sheen' aria-hidden='true' />
          </View>
        </View>
        {isError ? (
          <Text className='profile-page__growth-level'>成长记录稍后会自动刷新</Text>
        ) : (
          <View className='profile-page__growth-foot'>
            <View className='profile-page__level-plate'>
              <View className='profile-page__level-plate-spark' aria-hidden='true' />
              <Text className='profile-page__level-plate-text'>{growthLevelLabel}</Text>
            </View>
            {activityStreak > 0 && (
              <View
                className={`profile-page__streak-capsule${streakTeaser || streakContinuationTarget != null ? ' profile-page__streak-capsule--near-milestone' : ''}`}
                data-testid='profile-streak-capsule'
                hoverClass='profile-page__streak-capsule--pressed'
                onClick={onStreakTap}
                role='button'
                aria-label={`连续 ${activityStreak} 周，去活动页保持连击`}
              >
                <View className='profile-page__streak-main'>
                  <JoyJoinIcon emoji='🔥' tier='chemistry' size={28} className='profile-page__streak-icon' />
                  <Text className='profile-page__streak-text'>连续 {activityStreak} 周</Text>
                </View>
                {streakContinuationTarget != null ? (
                  <Text className='profile-page__streak-hint'>再 1 场续到 {streakContinuationTarget} 周</Text>
                ) : streakTeaser ? (
                  <Text className='profile-page__streak-hint'>再 1 周，潮流值 +{streakTeaser.xp}</Text>
                ) : null}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

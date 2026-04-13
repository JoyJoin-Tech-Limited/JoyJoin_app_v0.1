import { Component } from 'react'
import Taro from '@tarojs/taro'
import { CoverImage, CoverView } from '@tarojs/components'
import { MINI_PROGRAM_TAB_ITEMS } from '../lib/tabBarConfig'
import { MINI_PROGRAM_ROUTES } from '../lib/onboardingRoutes'
import type { CustomTabBarSyncState, MiniProgramCenterState } from '../lib/centerTabRouting'
import './index.scss'

const DEFAULT_CENTER_STATE: MiniProgramCenterState = {
  label: '去参与',
  showBadge: false,
  action: {
    kind: 'discover',
    navigation: 'switchTab',
    url: MINI_PROGRAM_ROUTES.discover,
  },
}

export interface TabBadgeCounts {
  discover: number
  activities: number
  chat: number
}

interface State extends CustomTabBarSyncState {
  badges: TabBadgeCounts
}

export default class CustomTabBar extends Component<unknown, State> {
  static options = {
    addGlobalClass: true,
  }

  state: State = {
    selected: 0,
    center: DEFAULT_CENTER_STATE,
    badges: { discover: 0, activities: 0, chat: 0 },
  }

  syncState = (nextState: CustomTabBarSyncState & { badges?: TabBadgeCounts }) => {
    const { badges, ...rest } = nextState
    this.setState((prev) => ({
      ...prev,
      ...rest,
      badges: badges ?? prev.badges,
    }))
  }

  setSelected = (selected: number) => {
    this.setState((currentState) => ({
      ...currentState,
      selected,
    }))
  }

  setCenterState = (center: MiniProgramCenterState) => {
    this.setState((currentState) => ({
      ...currentState,
      center,
    }))
  }

  setBadges = (badges: TabBadgeCounts) => {
    this.setState((currentState) => ({
      ...currentState,
      badges,
    }))
  }

  handleTabTap = (index: number, url: string) => {
    this.setSelected(index)
    Taro.switchTab({ url })
  }

  handleCenterTap = () => {
    const { action } = this.state.center

    if (action.navigation === 'switchTab') {
      Taro.switchTab({ url: action.url })
      return
    }

    Taro.navigateTo({ url: action.url })
  }

  getBadgeCount(tabKey: string): number {
    const { badges } = this.state
    switch (tabKey) {
      case 'discover':
        return badges.discover
      case 'events':
        return badges.activities
      case 'connections':
        return badges.chat
      default:
        return 0
    }
  }

  renderBadge(count: number) {
    if (count <= 0) return null

    const displayText = count > 99 ? '99+' : String(count)

    return (
      <CoverView className='joy-custom-tab-bar__item-badge'>
        <CoverView className='joy-custom-tab-bar__item-badge-text'>
          {displayText}
        </CoverView>
      </CoverView>
    )
  }

  renderTabItem(startIndex: number, endIndex: number) {
    const { selected } = this.state

    return MINI_PROGRAM_TAB_ITEMS.slice(startIndex, endIndex).map((item, indexOffset) => {
      const index = startIndex + indexOffset
      const isActive = selected === index
      const badgeCount = this.getBadgeCount(item.key)

      return (
        <CoverView
          key={item.key}
          className='joy-custom-tab-bar__item'
          onClick={() => this.handleTabTap(index, item.url)}
        >
          <CoverImage
            className={`joy-custom-tab-bar__item-icon${isActive ? ' joy-custom-tab-bar__item-icon--active' : ''}`}
            src={isActive ? item.componentSelectedIconPath : item.componentIconPath}
          />
          {this.renderBadge(badgeCount)}
          <CoverView
            className={`joy-custom-tab-bar__item-label${isActive ? ' joy-custom-tab-bar__item-label--active' : ''}`}
          >
            {item.text}
          </CoverView>
        </CoverView>
      )
    })
  }

  render() {
    const { center } = this.state

    return (
      <CoverView className='joy-custom-tab-bar'>
        <CoverView className='joy-custom-tab-bar__surface'>
          <CoverView className='joy-custom-tab-bar__border' />
          <CoverView className='joy-custom-tab-bar__center' onClick={this.handleCenterTap}>
            <CoverView className='joy-custom-tab-bar__center-outer-ring'>
              <CoverView className='joy-custom-tab-bar__center-button'>
                <CoverImage
                  className='joy-custom-tab-bar__center-logo'
                  src='../assets/box_logo_archetypes.png'
                />
                {center.showBadge ? <CoverView className='joy-custom-tab-bar__center-badge' /> : null}
              </CoverView>
            </CoverView>
            <CoverView className='joy-custom-tab-bar__center-label'>{center.label}</CoverView>
          </CoverView>

          <CoverView className='joy-custom-tab-bar__row'>
            <CoverView className='joy-custom-tab-bar__side'>
              {this.renderTabItem(0, 2)}
            </CoverView>

            <CoverView className='joy-custom-tab-bar__center-gap' />

            <CoverView className='joy-custom-tab-bar__side'>
              {this.renderTabItem(2, 4)}
            </CoverView>
          </CoverView>
        </CoverView>
      </CoverView>
    )
  }
}
# WeChat Mini Program Implementation Reference

> **Status:** Supplemental guide — **not** the architecture or routing source of truth for the shipped client.
>
> **Shipped client (launch-primary):** [`apps/mini-program`](../apps/mini-program/) — **Taro 4 + React 18**. Page registration, main package vs **subpackage** (`pages/onboarding`), **`preloadRule`** (from `MINI_PROGRAM_PRELOAD_RULES`), and **`lazyCodeLoading: 'requiredComponents'`** are defined or wired in [`apps/mini-program/src/lib/onboarding/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboarding/onboardingRoutes.ts) and [`app.config.ts`](../apps/mini-program/src/app.config.ts). Auth/API: [`apps/mini-program/src/lib/api/api.ts`](../apps/mini-program/src/lib/api/api.ts). Native custom tab bar: [`apps/mini-program/README.md`](../apps/mini-program/README.md).
>
> **Read first for active work:** [`apps/mini-program/README.md`](../apps/mini-program/README.md) · [`docs/PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md) · [`.github/skills/mini-program-frontend-excellence/SKILL.md`](../.github/skills/mini-program-frontend-excellence/SKILL.md) · [`docs/perf.md`](./perf.md) (mini-program package loading).

## Overview

The sections below (WXML/WXSS/legacy `miniprogram/` tree) are **historical translation patterns** for turning design ideas into raw Mini Program primitives. The **JoyJoin product** does **not** ship that vanilla structure — it ships the Taro workspace above. Use this file when you need low-level WeChat API or rpx reminders; use **`apps/mini-program`** for every product change.

## Prerequisites

- WeChat Developer Tools
- WeChat Mini Program Account
- Basic understanding of WXML/WXSS/JavaScript

## Project Structure (historical example — not the repo layout)

The tree below is a **generic** vanilla Mini Program layout for illustration. The real repo uses **`apps/mini-program/src/`** with Taro pages under `pages/` and config driven by **`lib/onboardingRoutes.ts`**.

```
miniprogram/
├── pages/
│   ├── landing/
│   │   ├── landing.wxml
│   │   ├── landing.wxss
│   │   ├── landing.js
│   │   └── landing.json
│   └── ...
├── components/
│   ├── feature-card/
│   │   ├── feature-card.wxml
│   │   ├── feature-card.wxss
│   │   ├── feature-card.js
│   │   └── feature-card.json
│   └── ...
├── images/
├── app.json
├── app.wxss
└── app.js
```

## Landing Page Implementation

### WXML Template

```xml
<!-- pages/landing/landing.wxml -->
<view class="container safe-area">
  
  <!-- Brand Header -->
  <view class="brand-section">
    <text class="brand-text gradient-text">JoyJoin</text>
    <text class="tagline">悦聚，让对的相遇不再错过</text>
  </view>
  
  <!-- Feature Grid -->
  <view class="features-grid">
    <block wx:for="{{features}}" wx:key="id">
      <view 
        class="feature-card"
        style="transform: rotate({{item.tilt}}deg);"
        bind:tap="onFeatureTap"
        data-index="{{index}}"
        hover-class="card-hover"
        hover-stay-time="100"
      >
        <image class="feature-icon" src="{{item.icon}}" mode="aspectFit" />
        <text class="feature-title">{{item.title}}</text>
        <text class="feature-desc" wx:if="{{item.desc}}">{{item.desc}}</text>
      </view>
    </block>
  </view>
  
  <!-- Sticky Button -->
  <view class="button-container">
    <button 
      class="primary-button"
      bind:tap="onMainAction"
      hover-class="button-hover"
      hover-stay-time="100"
    >
      看看我会遇见谁
    </button>
  </view>
  
  <!-- Secondary Actions -->
  <view class="secondary-actions">
    <text class="login-link" bind:tap="goToLogin">已有账号登录</text>
  </view>
  
  <!-- Legal -->
  <view class="legal-section">
    <checkbox-group bind:change="onAgreementChange">
      <label class="legal-label">
        <checkbox 
          value="agreed"
          checked="{{agreed}}"
          class="agree-checkbox"
        />
        <text class="legal-text">
          我已阅读并同意
          <text class="legal-link" bind:tap="openUserAgreement">《用户协议》</text>
          和
          <text class="legal-link" bind:tap="openPrivacyPolicy">《隐私政策》</text>
        </text>
      </label>
    </checkbox-group>
  </view>
  
</view>
```

### WXSS Styling

```css
/* pages/landing/landing.wxss */

/* Container */
.container {
  width: 100vw;
  min-height: 100vh;
  background: linear-gradient(to bottom, #FAFAFA, #FFF5F7, #FFE4E1);
  padding: 40rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* Safe Area */
.safe-area {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* Brand Section */
.brand-section {
  flex: none;
  text-align: center;
  padding-top: 60rpx;
  padding-bottom: 40rpx;
}

.brand-text {
  font-size: 64rpx;
  font-weight: 700;
  display: block;
  margin-bottom: 20rpx;
}

/* Gradient Text - WeChat doesn't support background-clip, use image instead */
.gradient-text {
  /* Option 1: Use gradient image */
  /* For true gradient text, create a gradient image */
  color: #FF6B9D;
}

.tagline {
  font-size: 32rpx;
  color: #666;
  font-weight: 400;
}

/* Features Grid */
.features-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30rpx;
  padding: 60rpx 0;
  align-content: center;
}

/* Feature Card */
.feature-card {
  width: 330rpx;
  height: 280rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  box-shadow: 0 16rpx 32rpx rgba(0, 0, 0, 0.08);
  padding: 40rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-out;
}

.card-hover {
  transform: rotate(0deg) scale(0.98) !important;
  opacity: 0.9;
}

.feature-icon {
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 20rpx;
}

.feature-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  text-align: center;
  margin-bottom: 10rpx;
}

.feature-desc {
  font-size: 24rpx;
  color: #666;
  text-align: center;
}

/* Button Container */
.button-container {
  flex: none;
  padding: 20rpx 0;
}

/* Primary Button */
.primary-button {
  width: 670rpx;
  height: 96rpx;
  background: linear-gradient(135deg, #FF6B9D, #A86BFF);
  border-radius: 48rpx;
  color: #FFFFFF;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  line-height: 96rpx;
  text-align: center;
  transform: rotate(0.8deg);
}

.primary-button::after {
  border: none;
}

.button-hover {
  opacity: 0.9;
  transform: rotate(0.8deg) scale(0.98);
}

/* Secondary Actions */
.secondary-actions {
  flex: none;
  text-align: center;
  padding: 20rpx 0;
}

.login-link {
  font-size: 28rpx;
  color: #A86BFF;
  font-weight: 400;
}

/* Legal Section */
.legal-section {
  flex: none;
  padding: 20rpx 0;
}

.legal-label {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
}

.agree-checkbox {
  flex: none;
  margin-top: 4rpx;
}

.legal-text {
  font-size: 22rpx;
  color: #999;
  line-height: 1.6;
}

.legal-link {
  color: #A86BFF;
}

/* Responsive - Small Screens */
@media (max-width: 320px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
  
  .feature-card {
    transform: rotate(0deg) !important;
  }
}
```

### JavaScript Logic

```javascript
// pages/landing/landing.js
Page({
  data: {
    features: [
      { 
        id: 1,
        icon: '/images/icon-group.png', 
        title: '4-6人智能匹配', 
        desc: '告别尴尬社交', 
        tilt: -1.5 
      },
      { 
        id: 2,
        icon: '/images/icon-test.png', 
        title: '易图测试', 
        desc: '', 
        tilt: 1.2 
      },
      { 
        id: 3,
        icon: '/images/icon-algorithm.png', 
        title: '算法匹配', 
        desc: '', 
        tilt: 0.8 
      },
      { 
        id: 4,
        icon: '/images/icon-game.png', 
        title: '破冰游戏', 
        desc: '', 
        tilt: -1.2 
      }
    ],
    agreed: false
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad(options) {
    console.log('[Landing] Page loaded', options);
    
    // Track page view
    this.trackPageView();
  },

  /**
   * Feature card tap handler
   */
  onFeatureTap(e) {
    const index = e.currentTarget.dataset.index;
    const feature = this.data.features[index];
    
    console.log('[Landing] Feature tapped:', feature.title);
    
    // Haptic feedback
    wx.vibrateShort({
      type: 'light'
    });
    
    // Optional: Navigate to feature detail
    // wx.navigateTo({
    //   url: `/pages/feature-detail/feature-detail?id=${feature.id}`
    // });
  },

  /**
   * Main CTA handler
   */
  onMainAction() {
    console.log('[Landing] Main CTA clicked');
    
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意协议',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // Haptic feedback
    wx.vibrateShort({
      type: 'medium'
    });
    
    // Navigate to personality test
    wx.navigateTo({
      url: '/pages/personality-test/personality-test'
    });
  },

  /**
   * Login link handler
   */
  goToLogin() {
    console.log('[Landing] Login clicked');
    
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  /**
   * Agreement checkbox change
   */
  onAgreementChange(e) {
    const agreed = e.detail.value.includes('agreed');
    this.setData({ agreed });
    console.log('[Landing] Agreement:', agreed);
  },

  /**
   * Open user agreement
   */
  openUserAgreement() {
    console.log('[Landing] User agreement clicked');
    
    wx.navigateTo({
      url: '/pages/agreement/agreement?type=user'
    });
  },

  /**
   * Open privacy policy
   */
  openPrivacyPolicy() {
    console.log('[Landing] Privacy policy clicked');
    
    wx.navigateTo({
      url: '/pages/agreement/agreement?type=privacy'
    });
  },

  /**
   * Track page view (analytics)
   */
  trackPageView() {
    // Implement your analytics tracking here
    // Example: wx.reportAnalytics('page_view', { page: 'landing' });
  }
});
```

### Page Configuration

```json
{
  "navigationBarTitleText": "悦聚 JoyJoin",
  "navigationBarBackgroundColor": "#FAFAFA",
  "navigationBarTextStyle": "black",
  "backgroundColor": "#FAFAFA",
  "enablePullDownRefresh": false,
  "disableScroll": false
}
```

## Reusable Component Example

### Feature Card Component

**WXML** (`components/feature-card/feature-card.wxml`):
```xml
<view 
  class="feature-card"
  style="transform: rotate({{tilt}}deg);"
  bind:tap="onTap"
  hover-class="card-hover"
  hover-stay-time="100"
>
  <image class="feature-icon" src="{{icon}}" mode="aspectFit" />
  <text class="feature-title">{{title}}</text>
  <text class="feature-desc" wx:if="{{description}}">{{description}}</text>
</view>
```

**WXSS** (`components/feature-card/feature-card.wxss`):
```css
.feature-card {
  width: 330rpx;
  height: 280rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  box-shadow: 0 16rpx 32rpx rgba(0, 0, 0, 0.08);
  padding: 40rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-out;
}

.card-hover {
  transform: rotate(0deg) scale(0.98) !important;
  opacity: 0.9;
}

.feature-icon {
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 20rpx;
}

.feature-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  text-align: center;
  margin-bottom: 10rpx;
}

.feature-desc {
  font-size: 24rpx;
  color: #666;
  text-align: center;
}
```

**JavaScript** (`components/feature-card/feature-card.js`):
```javascript
Component({
  properties: {
    icon: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    description: {
      type: String,
      value: ''
    },
    tilt: {
      type: Number,
      value: 0
    }
  },

  methods: {
    onTap() {
      // Haptic feedback
      wx.vibrateShort({ type: 'light' });
      
      // Trigger parent event
      this.triggerEvent('tap', {
        title: this.data.title
      });
    }
  }
});
```

**Configuration** (`components/feature-card/feature-card.json`):
```json
{
  "component": true,
  "usingComponents": {}
}
```

## rpx Unit Conversion

WeChat Mini Program uses **rpx** (responsive pixel) units where:
- **750rpx = 100% screen width**
- 1rpx adapts to different screen sizes automatically

**Conversion from design (px)**:
```
rpx = px * 2
```

**Example conversions**:
- 20px → 40rpx
- 165px → 330rpx
- 48px → 96rpx

## WeChat APIs

### Navigation

```javascript
// Navigate to page (with back button)
wx.navigateTo({
  url: '/pages/detail/detail?id=123'
});

// Redirect to page (no back button)
wx.redirectTo({
  url: '/pages/result/result'
});

// Switch tab (bottom navigation)
wx.switchTab({
  url: '/pages/home/home'
});

// Go back
wx.navigateBack({
  delta: 1 // Number of pages to go back
});
```

### Haptic Feedback

```javascript
// Light vibration (20ms)
wx.vibrateShort({
  type: 'light'
});

// Medium vibration (40ms)
wx.vibrateShort({
  type: 'medium'
});

// Heavy vibration (60ms)
wx.vibrateShort({
  type: 'heavy'
});

// Long vibration (400ms)
wx.vibrateLong();
```

### Toast/Modal

```javascript
// Show toast
wx.showToast({
  title: '成功',
  icon: 'success',
  duration: 2000
});

// Show loading
wx.showLoading({
  title: '加载中...',
  mask: true
});

wx.hideLoading();

// Show modal
wx.showModal({
  title: '提示',
  content: '确定要删除吗？',
  success(res) {
    if (res.confirm) {
      console.log('User confirmed');
    }
  }
});
```

### Network Requests

```javascript
wx.request({
  url: 'https://api.joyjoin.com/user/profile',
  method: 'GET',
  header: {
    'Authorization': 'Bearer ' + token
  },
  success(res) {
    console.log('Response:', res.data);
  },
  fail(err) {
    console.error('Request failed:', err);
  }
});
```

### Storage

```javascript
// Set storage
wx.setStorageSync('key', value);

// Get storage
const value = wx.getStorageSync('key');

// Remove storage
wx.removeStorageSync('key');

// Clear all storage
wx.clearStorageSync();
```

## Limitations & Workarounds

### 1. Gradient Text

WeChat doesn't support `background-clip: text` for gradient text.

**Workaround**:
- Use a gradient image instead
- Or use solid color approximation

```xml
<!-- Option 1: Image -->
<image src="/images/brand-gradient-text.png" class="brand-text" />

<!-- Option 2: Solid color -->
<text class="brand-text" style="color: #FF6B9D;">JoyJoin</text>
```

### 2. Custom Fonts

WeChat Mini Programs support limited custom fonts.

**Workaround**:
- Use system fonts: `-apple-system`, `sans-serif`
- For critical branding, use images

### 3. CSS Grid

WeChat supports CSS Grid, but older devices may have issues.

**Workaround**:
- Use flexbox as fallback
- Test on real devices

### 4. Hover States

Touch devices don't have hover.

**Solution**:
- Use `hover-class` attribute instead
- Set `hover-stay-time` for feedback duration

```xml
<view 
  hover-class="card-hover"
  hover-stay-time="100"
>
  Content
</view>
```

## Testing

### WeChat Developer Tools

1. Download from: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. Create new project
3. Import code
4. Test in simulator and real devices

### Device Testing

**Test on**:
- iOS (iPhone 8, iPhone 12, iPhone 14 Pro)
- Android (various screen sizes)
- Different WeChat versions

### Performance Testing

Use WeChat Developer Tools performance panel:
- Monitor render time
- Check memory usage
- Optimize slow components

## Deployment

1. **Code Review**: Check all pages and components
2. **Version**: Set version in `app.json`
3. **Upload**: Use Developer Tools to upload
4. **Submit**: Submit for review in WeChat Public Platform
5. **Release**: Publish after approval

## Best Practices

### 1. Component Reusability

Create reusable components for common UI elements.

### 2. Data Binding

Use WeChat's data binding efficiently:
```javascript
// Good - batch update
this.setData({
  field1: value1,
  field2: value2
});

// Avoid - multiple updates
this.setData({ field1: value1 });
this.setData({ field2: value2 });
```

### 3. Performance

- Minimize `setData` calls
- Use `wx:if` vs `hidden` appropriately
- Lazy load images
- Implement pagination for lists

### 4. Error Handling

```javascript
wx.request({
  url: 'https://api.joyjoin.com/data',
  success(res) {
    if (res.statusCode === 200) {
      // Success
    } else {
      // Handle error
    }
  },
  fail(err) {
    // Network error
    wx.showToast({
      title: '网络错误',
      icon: 'none'
    });
  }
});
```

## Resources

- **Official Docs**: https://developers.weixin.qq.com/miniprogram/dev/framework/
- **Design Guidelines**: https://developers.weixin.qq.com/miniprogram/design/
- **Component Library**: https://developers.weixin.qq.com/miniprogram/dev/component/
- **API Reference**: https://developers.weixin.qq.com/miniprogram/dev/api/

## Conclusion

Low-level patterns above (rpx, `hover-class`, `wx.request`) still apply inside Taro-generated layers, but **routing, bundling, and auth** are owned by **`apps/mini-program`**.

**Shipped wiring** (same facts as [`docs/perf.md`](./perf.md) §7 — mini-program package loading):

| Mechanism | Location |
|-----------|----------|
| Main package pages, subpackages, preload rule source | [`onboardingRoutes.ts`](../apps/mini-program/src/lib/onboarding/onboardingRoutes.ts) → [`app.config.ts`](../apps/mini-program/src/app.config.ts) (`preloadRule` is built from `MINI_PROGRAM_PRELOAD_RULES`) |
| Onboarding subpackage | `root: pages/onboarding`, seven pages (`MINI_PROGRAM_ONBOARDING_SUBPACKAGE_PAGES`) |
| Preload | `MINI_PROGRAM_PRELOAD_RULES` preloads `pages/onboarding` from **index** and **login** |
| On-demand injection | `lazyCodeLoading: 'requiredComponents'` in `app.config.ts` |

Narrative and guardrails: [`apps/mini-program/README.md`](../apps/mini-program/README.md) (*Package Loading Strategy*). Repeatable cold-entry timing: [`scripts/measure-mini-program-cold-entry.sh`](../scripts/measure-mini-program-cold-entry.sh) (requires local WeChat DevTools CLI; see README *Cold-entry timing probe*).

For framework API questions, prefer Taro and React docs in addition to [WeChat Mini Program official documentation](https://developers.weixin.qq.com/miniprogram/dev/framework/).

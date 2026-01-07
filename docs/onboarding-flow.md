# JoyJoin 注册引导流程

## 流程概览

```
登录页 → 注册(Onboarding) → 性格测试 → 必填资料 → [选填资料] → 引导页(3步) → 发现首页
```

## 步骤详情

### 1. 注册 (Onboarding)

**路由**: `/onboarding`

**页面**: `DuolingoOnboardingPage.tsx`

**数据契约**:
- 输入: 手机号、验证码
- 输出: `user.hasCompletedRegistration = true`

**守护条件**: 用户未完成注册时强制跳转

---

### 2. 性格测试 (Personality Test)

**路由**: `/personality-test`, `/personality-test/complete`, `/personality-test/results`

**页面**: `PersonalityTestPageV4.tsx`, `PersonalityTestResultPage.tsx`

**数据契约**:
- 输入: 氛围测试答案
- 输出: `user.hasCompletedPersonalityTest = true`, `user.archetype`

**守护条件**: 已注册但未完成测试时强制跳转

---

### 3. 必填资料 (Essential Data)

**路由**: `/onboarding/setup`

**页面**: `EssentialDataPage.tsx`

**数据契约**:
- 输入: 昵称、性别、出生年份、感情状态、学历、行业、家乡、常驻城市
- 输出: `user.displayName`, `user.gender`, `user.currentCity` 等

**守护条件**: 已完成测试但缺少必填资料时强制跳转

---

### 4. 选填资料 (Extended Data) - 可选

**路由**: `/onboarding/extended`

**页面**: `ExtendedDataPage.tsx`

**数据契约**:
- 输入: 社交意图、兴趣爱好、社交偏好
- 输出: `user.intent`, `user.interests`, `user.socialPreferences`

**用户可选择跳过**

---

### 5. 引导页 (Guide) - 新增

**路由**: `/guide` 或作为完成后的 overlay

**组件**: `apps/user-client/src/components/guide/`

**内容 (3步)**:
1. **用户画像生成**: 展示原型徽章、概述及匹配原因
2. **盲盒活动流程**: 说明 地区→偏好→匹配→签到→反馈 流程
3. **小悦AI助手**: 介绍 AI 智能体，引导补全画像

**数据契约**:
- 标志: `guideSeen` (localStorage + 服务器同步)
- 触发: 首次完成注册后显示
- 完成: 点击"进入发现"或完成3步后设置 `guideSeen = true`

**用户可点击"跳过"**

---

### 6. 发现首页 (Discover)

**路由**: `/` 或 `/discover`

**页面**: `DiscoverPage.tsx`

---

## 路由守护逻辑

使用 `useAuth` hook 判断当前状态:

```typescript
const { 
  needsRegistration,       // 未完成注册
  needsPersonalityTest,    // 已注册，未完成测试
  needsProfileSetup,       // 已测试，缺少必填资料
} = useAuth();
```

## 状态管理

### 本地缓存

- `joyjoin_essential_data_progress`: 必填资料进度
- `joyjoin_extended_data_progress`: 选填资料进度
- `joyjoin_guide_seen`: 引导页已查看标志

### 服务端同步

- 用户资料通过 `PATCH /api/profile` 保存
- 查询用户通过 `GET /api/auth/user` 获取完整状态

## 性能预算

- 每个步骤 TTI ≤ 2s (p75 移动网络)
- 步骤切换 ≤ 1s
- 参见 `docs/perf.md`

## 开发命令

```bash
npm run dev:user   # 启动用户端开发服务器
npm run check      # TypeScript 类型检查
```

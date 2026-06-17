# JoyJoin Mini-Program Profile Tab — Visual Smoke Test Report

> **Method:** WeChat DevTools has no automated visual-capture API, so this smoke test used the canonical H5-build + Playwright proxy described in `mini-program-screenshot-workflow`. Screenshots were captured at iPhone 13 viewport (1170×1992 physical pixels) against a local mock API server on `http://localhost:5001`.
> 
> **Source changes made to enable the H5 run (kept as safe fixes):**
> - `apps/mini-program/src/hooks/navigation/useCustomTabBarSync.ts` — added a guard so `page.getTabBar()` is only called when it exists. This prevents the H5 runtime from crashing (`e.getTabBar is not a function`) and is a no-op on WeChat where `getTabBar` is always present.
> - `apps/mini-program/src/pages/rewards/index.tsx` — moved two `useMemo` hooks above the loading/error early returns to fix a React hooks-order violation (`Rendered more hooks than during the previous render`) that blanked the Rewards page once data loaded.

## Screenshots captured

All artifacts are in `tmp/screenshots/`.

| # | File | What it shows |
|---|------|---------------|
| 1 | `profile-top.png` | Profile tab viewport (hero, stats, achievements, menu start) |
| 2 | `profile-full.png` | Full-page render of the profile tab |
| 3 | `profile-avatar.png` | Archetype avatar area (cropped in H5 — see notes) |
| 4 | `profile-greeting.png` | Xiaoyue greeting bubble |
| 5 | `profile-menu-row-1.png` | 编辑资料 row + icon |
| 6 | `profile-menu-row-2.png` | 分享我的社交名片 row + icon |
| 7 | `profile-menu-row-3.png` | 奖励福利 row + icon + badge(1) |
| 8 | `profile-menu-row-4.png` | 邀请好友 row + icon |
| 9 | `profile-menu-row-5.png` | 我的权益 row + icon |
| 10 | `profile-menu-row-6.png` | 我的足迹 row + icon |
| 11 | `profile-menu-row-7.png` | 服务条款 row + icon |
| 12 | `profile-scroll-bottom.png` | ScrollView scrolled toward bottom |
| 13 | `profile-scroll-top.png` | ScrollView returned to top |
| 14 | `edit-profile.png` | Edit Profile sub-screen |
| 15 | `rewards.png` | Rewards sub-screen |
| 16 | `invite.png` | Invite sub-screen |
| 17 | `terms.png` | Terms sub-screen |
| 18 | `console.log` | Captured console warnings/errors |

## Check-by-check verdict

| Check | Verdict | Evidence |
|-------|---------|----------|
| Profile tab main screen renders | **PASS** | Hero, name, subtitle, archetype pill, bio, Xiaoyue greeting, stats, achievements and menu all visible. Brand gradient and card styling present. |
| Six 常用功能 menu rows show icons | **WARN** | 7 rows are currently rendered (the recent "分享我的社交名片" row is included when `personalityShareEnabled` is true). All icon wells render, but row 6 (`我的足迹`) shows two symbols in one asset because `icon-footprint.webp` contains both a footprint and a path icon. |
| Archetype avatar rendering | **WARN** | The corgi head source asset is correct, but the H5 `<Image mode="aspectFit">` proxy clips/positions it oddly inside the circular avatar. This appears to be an H5 rendering quirk; verify on a real WeChat runtime before launch. |
| Xiaoyue greeting area | **PASS** | Mascot image and bubble text render correctly; text reads "欢迎来到你的 JoyJoin 基地，在深圳的社牛柯基". |
| Scroll to bottom and back to top | **PASS** | `ScrollView` is scrollable; bottom/top snapshots show different content positions. No scroll trap observed in the proxy. |
| Edit Profile sub-screen | **PASS** | Xiaoyue coach bubble, archetype hero card, form fields and sticky "保存修改" button render. Same H5-only avatar cropping note applies. |
| Rewards sub-screen | **PASS** (after fix) | Hero icon, Xiaoyue coach bubble, stats cards, level progress, coupon asset and redeemable-item list all render. Previously blank due to the hooks-order bug now fixed. |
| Invite sub-screen | **PASS** | Ceremony hero image, referral code card, stats, share/link CTAs and reward tiers render. |
| Terms sub-screen | **PASS** | Banner, section headings, body text and footer render with consistent card styling. |
| Console errors / warnings | **WARN** | Non-fatal warnings: Taro "暂时不支持 API", Chromium `navigator.vibrate` blocked, font decoding warnings for local woff2 copies. One generic `[pageerror] Object` remains; it does not visibly break any screen but should be tracked down. |

## Issues found (ranked)

1. **Rewards page React hooks-order crash** — fixed in this run. Without the fix the Rewards screen went blank after loading.
2. **Footprint menu icon asset** — `src/assets/icons/ui/icon-footprint.webp` contains two graphics in one file, causing the menu row to show a doubled/confusing icon. Recommend replacing with a single-footprint asset.
3. **Archetype avatar H5 clipping** — likely H5-only, but needs a real-device DevTools preview to confirm.
4. **Generic pageerror + font decode warnings** — low-priority cleanup; investigate if they reproduce on WeChat.

## Overall verdict

**PASS with WARNs.**

The Profile tab and its sub-screens are visually coherent, icons are migrated to `JoyJoinIcon/ui`, scroll works, and the recent polish (page-gradient backgrounds, wow-elements, Xiaoyue coaching) is visible. The only functional defect found was the Rewards hooks-order crash, which has been fixed. The footprint icon asset and the H5-only avatar clipping should be verified on a real WeChat runtime before the subpackage migration begins.

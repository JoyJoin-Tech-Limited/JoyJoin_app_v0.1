# Mini-program device QA (launch)

Run these on a **mid-range WeChat** device (not only the devtools simulator). Mark each pass before release.

## Cold start and packages

- [ ] From cold open, log in and reach Discover without a white flash longer than ~1s.
- [ ] First entry into onboarding subpackage after login: transition feels intentional (loading shell, not blank page).
- [ ] Tab bar: switching Discover / Events / Connections / Profile is smooth.

## Matching flow

- [ ] Pool registration success: “开启匹配结果通知” triggers the WeChat subscribe sheet (with `TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS` set in the build env).
- [ ] On matching status while **pending**: waiting UI updates; pull “立即刷新” works.
- [ ] When `POOL_MATCHED` fires: haptic (if supported), overlay stages (match → members → theme) run without duplicate overlays after background/foreground.
- [ ] After overlay: navigation to squad / event detail has no double flash (`redirectTo` / fallback).

## Motion

- [ ] With system or in-app reduced motion: squad unboxing and matching overlays shorten timings and remain usable.
- [ ] Low benchmark device (if available): confirm automatic reduced motion path does not skip critical copy.

## Lists

- [ ] Discover: scroll pool list with 15+ pools; no severe stutter.
- [ ] Events: scroll “我的足迹” with several items; loading skeleton appears then content.

## Icebreaker

- [ ] Enter icebreaker from event: branded loading appears, then phase UI; “同步中…” during refetch is acceptable, not stuck.

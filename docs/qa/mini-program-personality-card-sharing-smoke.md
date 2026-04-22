# Mini-Program Personality Card Sharing — QA Smoke Checklist

> Test surface: `apps/mini-program/src/pages/onboarding/personality-test/results/`  
> Primary client: WeChat Mini Program (iOS + Android)  
> Last updated: 2026-04-22

---

## Pre-Flight

- [ ] Build the mini-program dev build: `npm run dev:weapp --workspace=mini-program`
- [ ] Open WeChat DevTools, select a test device or simulator
- [ ] Complete a personality test to reach the Results page (or use a stored session)
- [ ] Open DevTools Network tab to observe analytics events (`/api/analytics/onboarding`)

---

## 1. Canvas Poster Generation

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 1.1 | Tap "生成并分享卡片" | Button enters loading state; haptic medium feedback | |
| 1.2 | Wait for generation (~1-3s) | Action sheet appears with options | |
| 1.3 | Observe generated poster (Preview) | Image is sharp (no blurry text or borders) | |
| 1.4 | Check poster visual elements | Rainbow sheen visible on card surface; metallic gold border; foil sparkle texture; "★ HOLOGRAPHIC EDITION ★" stamp at bottom; JoyJoin watermark footer | |
| 1.5 | Check poster resolution | File size suggests retina export (1500×2400 to 2250×3600 depending on device DPR) | |

---

## 2. Visible Card — Holographic & Tilt

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 2.1 | Observe visible card on Results page | CSS holographic shimmer sweeps diagonally; corner shines pulse | |
| 2.2 | Tilt device gently (gyroscope) | Card rotates in 3D (`rotateX`/`rotateY` ≤ 10°) smoothly with 0.15s transition | |
| 2.3 | Lay device flat on table | Card returns to neutral rotation within ~0.3s | |
| 2.4 | Touch and drag on card | Touch-driven tilt activates as fallback; feels responsive | |
| 2.5 | Observe "HOLOGRAPHIC EDITION" stamp | Gold gradient bar visible between skill cards and action buttons | |

---

## 3. Frictionless Sharing — Save to Album (Happy Path)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 3.1 | Tap "生成并分享卡片" → select "保存到相册" | Haptic medium; toast "已保存到相册" with success icon | |
| 3.2 | Check device Photos app | Poster PNG exists in album | |
| 3.3 | Verify analytics event | Network tab shows `interaction` event with `action: "share_action_selected"`, `option: "save"` | |
| 3.4 | Verify success analytics | `interaction` event with `action: "share_save_success"` | |

---

## 4. Frictionless Sharing — Permission Denial Flow

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 4.1 | **Precondition:** Go to WeChat Settings → Privacy → Authorized Services → Revoke JoyJoin's album permission | | |
| 4.2 | Return to JoyJoin, tap "生成并分享卡片" → "保存到相册" | Modal appears: "需要相册权限" / "保存卡片到相册需要您授权访问相册。" | |
| 4.3 | Tap "取消" on modal | Modal dismisses; no crash; no toast | |
| 4.4 | Tap "保存到相册" again → tap "去设置" | Opens WeChat mini-program settings page | |
| 4.5 | In settings, enable "保存到相册" permission | Permission toggles on | |
| 4.6 | Return to JoyJoin (auto or manual) | Mini-program resumes; user can retry save | |
| 4.7 | Retry "保存到相册" | Save succeeds; toast "已保存到相册" | |
| 4.8 | Verify denial analytics | `interaction` event with `action: "share_save_permission_denied"` fired at step 4.2 | |

---

## 5. Frictionless Sharing — Share to Friends

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 5.1 | Tap "生成并分享卡片" → "分享给朋友" | Native WeChat share image menu opens with poster | |
| 5.2 | Select a friend/chat | Share succeeds; poster image sent | |
| 5.3 | Verify analytics | `interaction` event with `action: "share_action_selected"`, `option: "share"` | |

---

## 6. Frictionless Sharing — Preview Poster

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6.1 | Tap "生成并分享卡片" → "预览海报" | Full-screen image preview opens with poster | |
| 6.2 | Long-press preview image | Native WeChat context menu appears (save, share, etc.) | |
| 6.3 | Swipe to dismiss | Preview closes gracefully | |
| 6.4 | Verify analytics | `interaction` event with `action: "share_action_selected"`, `option: "preview"` | |

---

## 7. Haptic Feedback

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 7.1 | Tap "生成并分享卡片" | Medium haptic | |
| 7.2 | Generation completes | Success haptic | |
| 7.3 | Tap "邀请朋友也测一下" | Light haptic | |
| 7.4 | Slot machine landing (if re-running test) | Short vibration | |

---

## 8. Error Handling & Edge Cases

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 8.1 | Trigger save failure (e.g., revoke permission mid-save, or storage full) | Toast: "小悦没能把卡片存进相册，可能需要你授权一下~" | |
| 8.2 | Verify error analytics | `interaction` event with `action: "share_save_failed"` and error string | |
| 8.3 | Trigger generation failure (e.g., corrupt archetype asset path) | Toast: "卡片生成遇到小状况，请重试一下~" | |
| 8.4 | Verify error analytics | `error_occurred` event with `errorType: "poster_generation_failed"` | |

---

## 9. Accessibility & Reduced Motion

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 9.1 | Enable system reduced motion (iOS: Settings → Accessibility → Motion → Reduce Motion; Android varies) | Card shimmer and sparkle animations stop or reduce to low-opacity static state | |
| 9.2 | Tilt device with reduced motion on | Tilt still works (it's user-driven, not decorative) | |

---

## 10. Performance & Memory

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 10.1 | Generate poster on low-end Android device | Completes within 3s; no out-of-memory kill | |
| 10.2 | Generate poster on iPhone with high DPR (e.g., 3×) | Image is sharp; no visible lag | |
| 10.3 | Rapidly tap "生成并分享卡片" multiple times | Button disabled during generation; no duplicate canvases rendered | |

---

## Sign-Off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA Agent | | | ☐ PASS / ☐ BLOCK |
| Device matrix | iOS __ / Android __ / WeChat base lib __ | | |
| Notes | | | |

# Mini-Program Personality Card Sharing — QA Smoke Checklist

> Test surface: `apps/mini-program/src/pages/onboarding/personality-test/results/`  
> Primary client: WeChat Mini Program (iOS + Android)  
> Last updated: 2026-10-14 (poster redesign + share-QR band)

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
| 1.1 | Tap **"保存我的氛围卡"** button | Button enters loading state with phase text ("准备素材中…", "正在渲染全息卡面…", "正在生成朋友圈卡片…"); haptic medium feedback | |
| 1.2 | Wait for generation (~1-3s) | Toast "氛围卡已生成"; action sheet appears with options | |
| 1.3 | Observe generated poster (Preview) | Image is sharp (no blurry text or borders) | |
| 1.4 | Check poster visual elements | Warm accent-tinted gradient card; dark typicality chip top-left (e.g. 典型夸夸仓鼠) + `JOYJOIN · 悦聚` lockup top-right; metallic gold border with bevel hairline + corner registration ticks; coin-ringed circular portrait; eyebrow micro-caps `JOYJOIN ARCHETYPE COLLECTION`; archetype name + tagline; rarity line + `图鉴 · <year>` provenance; rank strip (氛围编号 #X + debossed serial); energy bar with quarter tick marks + hint "你在聚会里的持久活力"; two skill cards with accent inner frames; full-width embossed gold **"限量氛围版"** stamp (tracked text); purple CTA band (see 1.7); footer hairline divider + share caption + `JOYJOIN · 悦聚 — 测测你的氛围命格，找到同频的人` | |
| 1.5 | Check poster resolution | DPR capped at 2 for memory safety (portrait: 2160×3120 max; square: 1500×1500 max) | |
| 1.6 | Offline pre-check: enable airplane mode, tap generate | Toast "网络好像断了，请检查连接后再试"; generation not attempted | |
| 1.7 | Check CTA band QR behavior | Logged-in: band shows "12 种氛围命格，你是哪一种？" + "长按识别小程序码，3 分钟测出你的命格" with a white gold-rimmed mini-program code chip on the right. Guest / offline / flag-off: same band, copy-only variant ("微信搜索「悦聚」小程序，3 分钟开测"), no chip. Poster must generate successfully in BOTH modes | |

---

## 1b. Square Moments Poster (朋友圈卡片)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 1b.1 | After poster generation, check action sheet includes "保存朋友圈卡片" | Option is present only when square poster generation succeeded | |
| 1b.2 | On low-end / degradation-tier device | Square poster generation is skipped entirely; square canvas element not rendered; action sheet shows portrait-only options | |
| 1b.3 | Tap "保存朋友圈卡片" | Square poster (750×750) is saved to album; toast "朋友圈卡片" with success icon | |
| 1b.4 | Check square poster visual elements | Dark typicality chip + brand lockup chrome; archetype name; coin-ringed hero; tagline; top 3 traits as compact bars tinted with the archetype accent (NOT purple fallback); energy bar; skill badges; rank chip (氛围编号 #X · debossed serial); purple CTA band ("你是哪一种氛围命格？" + QR chip when logged in, copy-only otherwise) | |
| 1b.5 | Check square poster resolution | DPR capped at 2 (1500×1500 max) | |

---

## 2. Visible Card — Holographic & Tilt

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 2.1 | Observe visible card on Results page | CSS holographic shimmer sweeps diagonally; corner shines pulse | |
| 2.2 | Tilt device gently (gyroscope) | Card rotates in 3D (`rotateX`/`rotateY` ≤ 10°) smoothly with 0.15s transition | |
| 2.3 | Lay device flat on table | Card returns to neutral rotation within ~0.3s | |
| 2.4 | Touch and drag on card | Touch-driven tilt activates as fallback; feels responsive | |
| 2.5 | Observe "限量氛围版" stamp | Gold gradient bar visible between skill cards and action buttons | |

---

## 3. Frictionless Sharing — Save to Album (Happy Path)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 3.1 | Tap "保存我的氛围卡" (or "分享卡片" after first gen) → select "保存到相册" | Haptic medium; toast "已保存到相册" with success icon | |
| 3.2 | Check device Photos app | Portrait poster PNG exists in album | |
| 3.3 | Verify analytics event | Network tab shows `interaction` event with `action: "share_action_selected"`, `option: "save"` | |
| 3.4 | Verify success analytics | `interaction` event with `action: "share_save_success"` | |

---

## 4. Frictionless Sharing — Permission Denial Flow

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 4.1 | **Precondition:** Go to WeChat Settings → Privacy → Authorized Services → Revoke JoyJoin's album permission | | |
| 4.2 | Return to JoyJoin, tap "保存我的氛围卡" / "分享卡片" → "保存到相册" | Modal appears: "需要相册权限" / "保存卡片到相册需要您授权访问相册。" | |
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
| 5.1 | Tap "保存我的氛围卡" → "分享给朋友" | Native WeChat share image menu opens with poster | |
| 5.2 | Select a friend/chat | Share succeeds; poster image sent | |
| 5.3 | Verify analytics | `interaction` event with `action: "share_action_selected"`, `option: "share"` | |

---

## 6. Frictionless Sharing — Preview Poster

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6.1 | Tap "分享卡片" → "预览海报" | Full-screen image preview opens with both posters (or portrait-only if no square) | |
| 6.2 | Long-press preview image | Native WeChat context menu appears (save, share, etc.) | |
| 6.3 | Swipe to dismiss | Preview closes gracefully | |
| 6.4 | Verify analytics | `interaction` event with `action: "share_action_selected"`, `option: "preview"` | |

---

## 6b. Share-QR Friend Conversion Loop (2026-10-14)

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6b.1 | Send the generated poster to a test friend (or second device) via "分享给朋友" | Poster image arrives in chat with the mini-program code chip in the purple band | |
| 6b.2 | Friend long-presses the received image | WeChat context menu shows 「识别图中小程序码」(or equivalent) and recognizes the code | |
| 6b.3 | Friend opens the recognized code | Lands on the personality-test intro page (`pages/onboarding/personality-test/index`) | |
| 6b.4 | Friend completes the test and logs in | Server `login-with-test` receives `referralCode` matching the sharer's code (scene `ic=<code>` → `pendingReferralCode` → login handoff); inviter attribution recorded | |
| 6b.5 | Repeat from a guest (not logged in) sharer | Poster generates fine with the copy-only band (no QR chip); no 401 errors in console | |
| 6b.6 | Admin sets `shareQrCodeEnabled` = false at `/admin/feature-flags`, regenerate | Band renders copy-only variant; server returns 503; no user-facing error | |

---

## 7. Haptic Feedback

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 7.1 | Tap "保存我的氛围卡" / "分享卡片" | Medium haptic | |
| 7.2 | Generation completes | Success haptic | |
| 7.3 | Slot machine landing (if re-running test) | Short vibration | |

---

## 8. Error Handling & Edge Cases

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 8.1 | Trigger save failure (e.g., revoke permission mid-save, or storage full) | Toast: "小悦没能把卡片存进相册，可能需要你授权一下~" | |
| 8.2 | Verify error analytics | `interaction` event with `action: "share_save_failed"` and error string | |
| 8.3 | Trigger generation failure (e.g., corrupt archetype asset path) | Transient failures auto-retry once (toast "正在重试…" shown during retry). If retry also fails: toast "卡片生成遇到小状况，请重试一下~" | |
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
| 10.3 | Rapidly tap "保存我的氛围卡" multiple times | Button disabled during generation; no duplicate canvases rendered; generation-dedup via sendGenerationRef | |

---

## Sign-Off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA Agent | | | ☐ PASS / ☐ BLOCK |
| Device matrix | iOS __ / Android __ / WeChat base lib __ | | |
| Notes | | | |

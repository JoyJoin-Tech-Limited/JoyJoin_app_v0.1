# P2-S2 AC-08 H5 rendered evidence

Captured 2026-11-09 from the Taro H5 production build with Playwright and the installed Google Chrome executable. Viewport: **375×812, DPR 2**, `zh-CN`, `Asia/Shanghai`, reduced motion enabled. Each scenario used a fresh browser context and cleared `localStorage` and `sessionStorage`.

These are H5 rendered artifacts, not WeChat DevTools or real-device evidence.

## API interception and fixtures

- Events primary: `GET /api/shell/events` → `{ user, joinedEvents, notifications, meta }`.
- Events fallback and Center Hub: `GET /api/events/joined` → raw `JoinedEventSummary[]`.
- Error scenarios returned HTTP 500 from both shell and fallback endpoints.
- Loading scenarios held both endpoints open while the loading UI was captured.
- Auth and unrelated endpoints came from `scripts/mock-h5-server.mjs` on port 5001.
- Fixture fields exercised: `id`, `title`, `dateTime`, `finalDateTime`, `status`, `displayStatus`, `eventType`, `city`, `district`, `venueName`, `price`, `registrationId`, `groupId`, `groupSize`, and `feedbackPending`.
- The first-event hero has no dedicated fixture flag. It was triggered by exactly one visible, non-completed joined event with canonical `confirmed` status. The populated upcoming capture proves this path.

## Events matrix

| Scenario | Artifact | What to verify |
|---|---|---|
| Upcoming populated, default | `events-upcoming-populated.png` | 待开始 is selected; first-event hero is visible; confirmed card keeps active copy and countdown. |
| Ongoing populated | `events-ongoing-populated.png` | 进行中 is selected through pre-manual fallback; matched and pending cards retain active status/waiting copy and countdowns. |
| Completed + historical nonterminal + genuine terminal | `events-completed-historical.png` | 已结束 is selected; the past-day pending DTO renders neutral 已结束 with no countdown or feedback pill; the genuine completed DTO retains 圆满结束 and 去评价. |
| Upcoming empty | `events-upcoming-empty.png` | 待开始 remains selected with 暂无待开始的活动 and its scheduling-only empty description. |
| Ongoing empty | `events-ongoing-empty.png` | Manual 进行中 selection remains selected with 暂无进行中的活动 and current-workflow empty copy. |
| Completed empty | `events-completed-empty.png` | Manual 已结束 selection remains selected with 暂无已结束的活动 and historical-record empty copy. |
| Error | `events-error.png` | Shell and fallback failures render 加载失败, safe retry copy, and 重试. |
| Loading | `events-loading.png` | Events skeleton cards render inside the ScrollView content wrapper. |

## Center Hub matrix

| Scenario | Artifact | What to verify |
|---|---|---|
| Fresh ongoing populated | `center-ongoing-populated.png` | Fresh mount selects 进行中; joined cards render without an Events first-event hero. |
| Upcoming populated | `center-upcoming-populated.png` | Manual 待开始 selection shows the upcoming card and keeps the tab selected. |
| Completed + historical nonterminal + genuine terminal | `center-completed-historical.png` | 已结束 is selected; historical pending is neutral 已结束 without countdown/pill; genuine completed retains 圆满结束 and 去评价. |
| Ongoing empty | `center-ongoing-empty.png` | Fresh empty mount stays on 进行中 with bucket-specific copy; no redirect or auto-switch. |
| Upcoming empty | `center-upcoming-empty.png` | 待开始 is selected with 暂无待开始的活动 and scheduling-only copy. |
| Completed empty | `center-completed-empty.png` | 已结束 is selected with 暂无已结束的活动 and historical-record copy. |
| Error | `center-error.png` | The alert state renders 暂时没拿到活动状态 and 重新加载. |
| Loading | `center-loading.png` | The status region renders 正在加载你的活动… with the loading mascot. |
| H5 visibility simulation, before | `center-visibility-before.png` | 待开始 is selected before a synthetic `visibilitychange` event. |
| H5 visibility simulation, after | `center-visibility-after.png` | The same mounted H5 page still has 待开始 selected after the event. This is not native page-stack re-show evidence. |

## Visual spot-check notes

Directly inspected six PNGs: `events-upcoming-populated.png`, `events-ongoing-populated.png`, `events-completed-historical.png`, `center-completed-historical.png`, `center-ongoing-empty.png`, and `events-error.png`.

- Selected-tab contrast, bucket labels, hero, active countdowns, neutral historical cards, terminal feedback pill, empty copy, and error retry UI were visible as expected.
- The historical nonterminal card does not expose its raw pending/matched status visually and has no countdown or terminal-only feedback pill.
- H5 fidelity issues visible in the artifacts: the Center empty-state mascot is horizontally clipped, the Events error illustration is very small, and the Center ongoing-empty subtitle wraps its final character onto a second line. No source change was made during evidence capture.

## Not captured / remaining evidence gaps

- **WeChat DevTools: NOT RUN.** DevTools MCP is not configured in this environment.
- **Real device: NOT RUN.** QR preview and approval require a human.
- The native custom tab bar and other WeChat-only rendering are not represented by these H5 screenshots.
- Native pull-to-refresh was not captured; H5 does not reproduce the WeChat pull-down gesture. Existing focused tests cover refresh invalidation behavior.
- Native Center `useDidShow` re-show and center-tab re-tap persistence are not proven by the synthetic H5 visibility pair. A reload would be a fresh mount, so it was deliberately not presented as re-show evidence.
- Navigation destinations and DTO immutability are covered by the focused real-card/navigation integration tests, not by these static PNGs.

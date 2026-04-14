# Compliance Audit: Social Features and Membership Terminology

Date: 2026-04-14

Audit note:
- Clarified requirement on 2026-04-14: post-event contact exchange is allowed; the restricted behavior is in-app or in-mini-program chat.
- No `cloudfunctions/` directory was found in the repository.
- No source-level `wx.cloud.database()`, `cloud.database()`, or `_openid` peer-message writes were found under `apps/mini-program`.
- The active peer-to-peer risk comes from server-backed REST flows and database persistence, not native mini-program cloud messaging.
- Legacy direct-message tables were already removed in `apps/server/migrations/20260312000000_drop_direct_message_tables.sql`; under the clarified scope, the live concern is event group chat inside the mini-program.

## A. Critical Violations (In-Program Chat)

| File | Feature | Violation Details | Remediation Plan |
| --- | --- | --- | --- |
| apps/mini-program/src/pages/event-coordination/index.tsx | 活动群聊 (Group Chat) | Active in-app user-to-user group chat. The page polls `/api/events/:eventId/messages` every 5 seconds, posts new messages, exposes participant info, and opens a peer-message report flow. Supporting backend endpoints are implemented in `apps/server/src/routes.ts`, with persistence in `apps/server/src/repositories/legacyStorageRepo.ts`. This is peer-to-peer communication inside the mini-program, not merchant support. | Remove the free-text message stream and send box. Replace the main action with a merchant-support entry using the WeChat customer-service plugin, or remove the feature and redirect to a static Help/FAQ page. If event logistics are still needed, keep only a merchant-authored read-only announcement board. |

Under the clarified chat-only restriction, post-event contact exchange and other non-chat coordination surfaces are not classified as violations by this audit. Re-evaluate them separately only if product or legal policy expands from “no in-program chat” to a broader participant-interaction restriction.

## B. Terminology Replacements

| File | Current String | Replacement String |
| --- | --- | --- |
| apps/mini-program/src/pages/discover/index.tsx | 查看会员权益 | 查看专属权益 |
| apps/mini-program/src/pages/profile/index.tsx | 会员权益 | 我的权益 / 专属权益 |
| apps/mini-program/src/pages/blind-box-payment/index.tsx | 开通会员权益 | 解锁专属权益 / 升级体验 |
| apps/mini-program/src/pages/blind-box-payment/index.tsx | 支持会员权益与活动次数包 | 支持专属权益与活动次数包 |
| apps/mini-program/src/pages/blind-box-payment/index.tsx | 悦聚会员专属权益 | 悦聚专属权益 |

Additional terminology note:
- Internal payment identifiers such as `VipSubscriptionPlanKey`, `vip_monthly`, and `vip_quarterly` still exist in source code, but they were not verified as current user-facing strings in the mini-program UI. They are lower urgency than the visible copy above, but still worth normalizing later to avoid future leakage into product copy, analytics labels, or admin tooling.

## C. Allowed Features (Do Not Touch)

- No source-level mini-program implementation of `<contact-button>`, `open-type="contact"`, or `wx.openCustomerServiceChat` was found under `apps/mini-program/src`.
- Contact exchange that hands users off to an external channel after the event is allowed under the clarified requirement, so the `连接` flow is no longer part of the blocked remediation scope.
- Support-only implementation found outside the mini-program and exempt from social-feature removal:
  - `apps/user-client/src/components/WechatServiceQRCard.tsx`
  - `apps/user-client/src/pages/CommunityJoinPage.tsx`
  - `apps/user-client/src/pages/BlindBoxEventDetailPage.tsx`
  - `apps/user-client/src/pages/FAQPage.tsx`
- Mini-program files with support-related copy only, not an actual customer-service control:
  - `apps/mini-program/src/pages/blind-box-payment/index.tsx`
  - `apps/mini-program/src/pages/terms/index.tsx`

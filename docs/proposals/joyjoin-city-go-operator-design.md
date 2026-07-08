# City GO Operator-Reviewed Assignment Design

**Status:** Compliance-oriented design sketch  
**Goal:** Use backend matching as an internal decision-support tool while keeping the user-facing experience free of algorithmic recommendation signals.

---

## 1. Design Principle

> The algorithm suggests. The operator decides. The user only sees the final arrangement.

This keeps the matching logic internal and operator-controlled, reducing the risk that the mini-program is classified as an algorithmic recommendation service.

---

## 2. User-Facing Flow (Mini Program)

### 2.1 Discover / Entry
- Show a list of upcoming City GO events.
- Sort by **time** only. No personalized ranking.
- No "Recommended for you," "Because you are a 柯基," or match scores.

**Copy:**
- ❌ "为你推荐的活动"
- ✅ " upcoming City GO 活动"

### 2.2 Event Detail
- Event title, time, landmark, duration, what to expect, safety note.
- CTA: "预约参加" / "报名" (not "匹配" or "组队").
- Clear statement: "报名后，工作人员会在活动前安排同行伙伴。"

**Copy:**
- ❌ "AI 为你匹配 3 位朋友"
- ✅ "活动前你将收到最终确认，包括集合地点和同行伙伴。"

### 2.3 After Registration
- Show: "报名成功，等待确认。"
- Do not show the algorithm’s suggestion, other participants, or compatibility information.

### 2.4 Before Event
- 24 hours before: "你的 City GO 活动已确认。"
- Show: time, landmark, meeting point, and a generic group name (e.g., "海岸城 7/12 小队").
- Do not reveal other users’ identities until check-in (optional privacy choice).

### 2.5 Check-In
- User arrives at landmark and scans a QR code or taps a check-in button.
- No background location required.

### 2.6 Post-Event
- Event is added to **我的故事** as a memory.
- Mascot may display a visual souvenir from the event.
- No language implies the group was algorithmically matched.

---

## 3. Operator Dashboard Flow (Admin / Web)

### 3.1 Dashboard Entry
`/admin/city-go/assignments`

Sections:
- **待安排 (Pending)** — events that need assignment
- **已确认 (Confirmed)** — assignments finalized and sent to users
- **待开场 (Upcoming)** — events happening in next 24 hours
- **已完成 (Completed)** — events with attendance data

### 3.2 Assignment Detail View
For each event, show:
- List of registered users (basic info: nickname, age range, archetype, city, intent, paid-event history).
- Algorithm-generated suggested groups (e.g., Group A: User 1, 2, 3; Group B: User 4, 5, 6).
- Compatibility notes for operator reference only (e.g., "same archetype family" / "complementary interests"). These are internal labels, not user-facing.
- Override controls: move users between groups, remove a user, cancel a group.
- Operator notes field for every override.
- "Finalize and notify users" button.

### 3.3 Operator Actions
1. **Approve suggestion** — one-click if all groups look good.
2. **Edit group** — drag-and-drop users, swap members, or remove a user.
3. **Cancel group** — if fewer than 3 participants can be confirmed, cancel with a warm message to users.
4. **Request more info** — flag a user for manual review (e.g., incomplete profile).
5. **Finalize** — lock assignments and trigger notifications.

### 3.4 Audit Log (Visible in Admin)
Every assignment records:
- Event ID
- Timestamp of algorithm suggestion
- Operator ID
- Original suggestion
- Final assignment
- Override reason (if any)
- Notification timestamp
- User check-in status

---

## 4. What the Algorithm Does (Internal Only)

Inputs:
- User archetype / personality profile
- Intent tags
- Interest heat signals
- Past event history (if any)
- Location / city
- Availability / registered time slot

Output:
- Suggested groupings with internal notes for operator reference
- No scores or rankings shown to users
- No direct user-facing output

The algorithm is treated as an **internal optimization tool**, not a user-facing recommendation engine.

---

## 5. Data Flow

```
User registers for City GO event
        ↓
Backend stores registration
        ↓
Algorithm runs → generates suggested groupings
        ↓
Operator reviews suggestions in admin dashboard
        ↓
Operator approves / edits / overrides
        ↓
Final groups are locked
        ↓
Users receive notification: "你的活动已确认"
        ↓
Event day: users check in
        ↓
Attendance recorded → memory added to 我的故事
```

---

## 6. Copy & Language Guardrails

### Always use
- 安排 / 组队 / 确认 / 报名成功
- 活动组织者 / 平台工作人员
- 同行伙伴 / 小队成员
- 集合地点 / 签到

### Never use
- 匹配 / 推荐 / 算法 / AI 匹配
- 相似度 / 匹配度 / 契合度分数
- 因为你是 [原型]，所以推荐…
- 同城速配 / 附近的人 / 智能推荐

---

## 7. Compliance Acceptance Criteria

- [ ] Every finalized group has been reviewed or approved by a human operator.
- [ ] Operator can override any algorithmic suggestion with a documented reason.
- [ ] No algorithmic score, ranking, or match explanation is shown to users.
- [ ] Mini-program event list is sorted by time or distance, not by personalized recommendation.
- [ ] Audit logs are retained for at least 6 months.
- [ ] Users can request a review of their group assignment by a human.
- [ ] Privacy policy discloses that group assignments involve internal review and may use profile data.

---

## 8. Operational Reality

### 8.1 Operator Workload
- Each event requires one operator review.
- Review time per event: 5–10 minutes for 3–4 groups.
- For 10 events/week, this is manageable with one part-time operator.
- For scale, this becomes a bottleneck; plan to hire/train operators as the feature grows.

### 8.2 Timing
- Operator review should happen **6–12 hours before the event** so users have enough notice but operators have enough time to review.
- If review is too late, users may not see the confirmation in time and attendance drops.

### 8.3 Cancellation Handling
- If fewer than 3 confirmed users remain, the operator should cancel the event and notify users with a warm explanation + re-invite to the next event.
- This protects the user experience and the brand.

---

## 9. Open Questions

1. How many operators do you need at launch? (Pilot: 1 part-time operator for 2–3 events/week.)
2. Should operators be internal staff or trained community hosts?
3. Should the operator dashboard be built inside the existing admin portal, or as a separate internal tool?
4. What is the fallback if an operator is unavailable? (Suggestion: cancel/reschedule, not auto-approve.)
5. Should users be told explicitly that a person arranged their group, or simply that "the platform" arranged it?

---

## 10. Summary

- **User sees:** an appointment/activity tool with human-arranged groups.
- **Backend sees:** an algorithmic suggestion engine that feeds the operator dashboard.
- **Operator sees:** suggestions, override controls, and an audit trail.
- **Regulator sees:** a human-in-the-loop decision system rather than a user-facing recommendation algorithm.

This design is not a guaranteed workaround for 算法备案, but it is the most defensible product structure if you want to avoid filing.

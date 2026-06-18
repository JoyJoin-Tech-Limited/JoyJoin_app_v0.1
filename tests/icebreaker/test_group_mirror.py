#!/usr/bin/env python3
"""Manual test for the Group Mirror phase.

Flow:
  1. Login host + player2, create session
  2. Force phase to group_mirror
  3. Generate questions
  4. Both submit answers (asker → target)
  5. Host triggers reveal
  6. Advance out
"""

import sys, time
from icebreaker_common import IcebreakerClient, print_step, require_ok

SESSION_ID = input("Enter group/event ID: ").strip()
if not SESSION_ID:
    print("[FAILED] No session ID"); sys.exit(1)

# ── Step 1: Login + create ──
print_step(1, "Login Host + Player2, create session")
host = IcebreakerClient()
host.login("+8613800000001", "test123456", "测试小柯")
host.cleanup_session(SESSION_ID)
sd = host.start_icebreaker(SESSION_ID, "测试小柯", event_tier="glow", vibe="balanced")
sid = sd["socialSessionId"]
assert sd["currentPhase"] == "warmup"

player2 = IcebreakerClient()
player2.login("+8613800000004", "test123456", "测试小考")
player2.start_icebreaker(SESSION_ID, "测试小考")

# ── Step 2: Force to group_mirror ──
print_step(2, "Force phase to group_mirror")
host.force_phase(SESSION_ID, "group_mirror")

# ── Step 3: Generate questions ──
print_step(3, "Generate group mirror questions")
resp = host.social_api(f"{sid}/group-mirror/generate")
if resp.status_code == 202:
    time.sleep(3)
    resp = host.social_api(f"{sid}/group-mirror/generate")
data = require_ok(resp)
qs = data.get("questions", [])
print(f"  {len(qs)} questions:")
for q in qs:
    print(f"    [{q['id'][:8]}] {q.get('text','?')}")

# ── Step 4: Each player answers ──
print_step(4, "Both submit answers")
for cl, nm in [(host, "Host"), (player2, "P2")]:
    target = player2.user_id if cl == host else host.user_id
    answers = [{"questionId": q["id"], "targetUserId": target} for q in qs]
    resp = cl.social_api(f"{sid}/group-mirror/submit",
        body={"answers": answers, "operationId": f"gm-{nm}-{int(time.time())}"})
    print(f"  {nm}: {'OK' if resp.status_code==200 else f'HTTP {resp.status_code}'}")

# ── Step 5: Reveal ──
print_step(5, "Host triggers reveal")
resp = host.social_api(f"{sid}/group-mirror/reveal")
data = require_ok(resp)
matches = data.get("matches", [])
print(f"  {len(matches)} match(es):")
for m in matches:
    print(f"    Q: {m.get('questionId','?')[:8]} → matches: {m.get('matchCount',0)}")

# ── Step 6: Advance out ──
print_step(6, "Advance out")
adv = host.advance_phase(sid, "group_mirror")
print(f"  Next: {adv.get('nextPhase','?')}")

print(f"\n  >>> GROUP MIRROR TEST PASSED <<<")

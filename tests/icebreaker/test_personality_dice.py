#!/usr/bin/env python3
"""Manual test for the Personality Dice phase.

Flow:
   1. Login host + player2, create session
   2. Force phase to personality_dice
   3. Generate dice challenges (choose-mode)
   4. Each player chooses an option
   5. Each player completes/passes
   6. Advance out
"""

import sys, time
from icebreaker_common import IcebreakerClient, print_step, require_ok

SESSION_ID = input("Enter group/event ID: ").strip()
if not SESSION_ID:
    print("[FAILED] No session ID"); sys.exit(1)

# ── Step 1: Login and create session ──
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

# ── Step 2: Force to personality_dice ──
print_step(2, "Force phase to personality_dice")
host.force_phase(SESSION_ID, "personality_dice")

# ── Step 3: Generate dice challenges ──
print_step(3, "Personality dice: generate")
input("  Press Enter to generate dice challenges...")
roster = [
    {"userId": host.user_id, "displayName": "测试小柯"},
    {"userId": player2.user_id, "displayName": "测试小考"},
]
resp = host.social_api(f"{sid}/personality-dice/generate", body={"participants": roster})
if resp.status_code == 202:
    time.sleep(3)
    resp = host.social_api(f"{sid}/personality-dice/generate", body={"participants": roster})
data = require_ok(resp)
groups = data.get("groups", [])
print(f"  {len(groups)} groups generated")
for g in groups:
    nm = g.get("displayName", "?")
    opts = g.get("options", [])
    print(f"  {nm}: {len(opts)} options (0=easy 1=medium 2=hard)")

# ── Step 4: Each player chooses option 0 ──
print_step(4, "Each player chooses option 0")
for uid, cl in [(host.user_id, host), (player2.user_id, player2)]:
    resp = cl.social_api(f"{sid}/personality-dice/choose",
        body={"userId": uid, "optionIndex": 0})
    print(f"  {'OK' if resp.status_code==200 else 'FAIL'} {uid[:8]}")

# ── Step 5: Each player completes ──
print_step(5, "Each player completes")
input("  Press Enter to mark both complete...")
for uid, cl in [(host.user_id, host), (player2.user_id, player2)]:
    cl.social_api(f"{sid}/personality-dice/complete",
        body={"pass": False, "operationId": f"pd-{uid[:8]}-{int(time.time())}"})
    print(f"  Completed: {uid[:8]}")

# ── Step 6: Advance out ──
print_step(6, "Advance out")
adv = host.advance_phase(sid, "personality_dice")
print(f"  Next: {adv.get('nextPhase','?')}")

print(f"\n  >>> PERSONALITY DICE TEST PASSED <<<")

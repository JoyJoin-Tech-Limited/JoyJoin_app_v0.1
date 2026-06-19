#!/usr/bin/env python3
"""Manual test for the Speed Friending phase.

Flow:
  1. Login host + player2, create session
  2. Force phase to speed_friending
  3. Loop through speed friending rounds
  4. Host completes
  5. Advance out
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

# ── Step 2: Force to speed_friending ──
print_step(2, "Force phase to speed_friending")
host.force_phase(SESSION_ID, "speed_friending")

# ── Step 3: Loop through rounds ──
print_step(3, "Loop through speed friending rounds")
st = require_ok(host.social_api(f"{sid}", method="GET"))
total = st.get("speedFriendingTotalRounds", 3)
print(f"  Total rounds configured: {total}")

for r in range(1, total + 1):
    input(f"  Round {r}/{total}: Press Enter to advance to next round...")
    resp = host.social_api(f"{sid}/speed-friending/next-round")
    if resp.status_code == 200:
        data = resp.json()
        pairs = data.get("pairs", data.get("currentPairs", []))
        print(f"  Round {r}: {len(pairs)} pair(s)")
        for p in pairs:
            print(f"    {p.get('displayName','?')[:8]} ↔ {p.get('partnerDisplayName','?')[:8]}")
    else:
        print(f"  HTTP {resp.status_code}")

# ── Step 4: Complete ──
print_step(4, "Complete speed friending")
resp = host.social_api(f"{sid}/speed-friending/complete")
data = require_ok(resp)
print(f"  Completed: {resp.status_code}")

# ── Step 5: Advance out ──
print_step(5, "Advance out")
adv = host.advance_phase(sid, "speed_friending")
print(f"  Next: {adv.get('nextPhase','?')}")

print(f"\n  >>> SPEED FRIENDING TEST PASSED <<<")

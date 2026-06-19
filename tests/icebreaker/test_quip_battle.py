#!/usr/bin/env python3
"""Manual test for the Quip Battle phase.

Flow:
  1. Login host + player2, create session
  2. Force phase to quip_battle
  3. Generate prompts
  4. Both submit answers
  5. Both vote
  6. Check results
  7. Advance out
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

# ── Step 2: Force to quip_battle ──
print_step(2, "Force phase to quip_battle")
host.force_phase(SESSION_ID, "quip_battle")

# ── Step 3: Generate prompts ──
print_step(3, "Generate quip battle prompts")
resp = host.social_api(f"{sid}/quip-battle/generate")
if resp.status_code == 202:
    time.sleep(3)
    resp = host.social_api(f"{sid}/quip-battle/generate")
data = require_ok(resp)
prompts = data.get("prompts", [])
print(f"  {len(prompts)} prompts:")
for p in prompts:
    print(f"    [{p['id'][:8]}] {p['promptText']}")

# ── Step 4: Submit answers ──
print_step(4, "Both submit answers")
for cl, nm in [(host, "Host"), (player2, "P2")]:
    answers = [{"promptId": p["id"], "answerText": f"{nm}的回答_{p['id'][:4]}"} for p in prompts]
    resp = cl.social_api(f"{sid}/quip-battle/submit",
        body={"answers": answers, "operationId": f"qb-{nm}-{int(time.time())}"})
    print(f"  {nm}: {'OK' if resp.status_code==200 else f'HTTP {resp.status_code}'}")

# ── Step 5: Vote ──
print_step(5, "Both vote for each other's answers")
all_uids = [(host, "Host"), (player2, "P2")]
for cl, nm in all_uids:
    others = [cc for cc, _ in all_uids if cc != cl]
    votes = [{"answerId": f"{o.user_id}::{p['id']}", "promptId": p["id"]}
             for o in others for p in prompts]
    resp = cl.social_api(f"{sid}/quip-battle/vote",
        body={"votes": votes, "operationId": f"qv-{nm}-{int(time.time())}"})
    print(f"  {nm}: {'OK' if resp.status_code==200 else f'HTTP {resp.status_code}'}")

# ── Step 6: Results (host only) ──
print_step(6, "Host checks results")
resp = host.social_api(f"{sid}/quip-battle/results", method="GET")
data = require_ok(resp)
results = data.get("results", [])
print(f"  {len(results)} results:")
for r in results:
    w = r.get("winnerDisplayName", "?")
    c = r.get("voteCount", 0)
    print(f"    Winner: {w} ({c} votes)")

# ── Step 7: Advance out ──
print_step(7, "Advance out")
adv = host.advance_phase(sid, "quip_battle")
print(f"  Next: {adv.get('nextPhase','?')}")

print(f"\n  >>> QUIP BATTLE TEST PASSED <<<")

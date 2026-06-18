#!/usr/bin/env python3
"""Manual test for the Mini-Script phase (bonus phase, 4 players).

Tests bonus gate offer/accept + full mini_script flow:
  generate → assign-roles → reveal-act (× acts) → vote → reveal-solution

Requires 4 registered users in the same event pool group.
"""

import json, sys, time
from icebreaker_common import IcebreakerClient, print_step, require_ok

SESSION_ID = input("Enter group/event ID (4 registered users): ").strip()
if not SESSION_ID:
    print("[FAILED] No session ID"); sys.exit(1)

PLAYERS = [
    ("+8613800000001", "test123456", "测试小柯"),
    ("+8613800000005", "test123456", "测试凤"),
    ("+8613800000006", "test123456", "测试独角兽"),
    ("+8613800000007", "test123456", "测试狼"),
]

# ── Step 1: Login all 4 ──
print_step(1, f"Login {len(PLAYERS)} players, host creates session")
host = IcebreakerClient()
host.login(PLAYERS[0][0], PLAYERS[0][1], PLAYERS[0][2])
host.cleanup_session(SESSION_ID)
sd = host.start_icebreaker(SESSION_ID, PLAYERS[0][2], event_tier="blaze", vibe="balanced")
sid = sd["socialSessionId"]
assert sd["currentPhase"] == "warmup", f"Expected warmup, got {sd['currentPhase']}"

clients = [host]
for i in range(1, len(PLAYERS)):
    c = IcebreakerClient()
    c.login(PLAYERS[i][0], PLAYERS[i][1], PLAYERS[i][2])
    c.start_icebreaker(SESSION_ID, PLAYERS[i][2])
    clients.append(c)

# ── Step 2: Force to mini_script ──
print_step(2, "Force phase to mini_script")
host.force_phase(SESSION_ID, "mini_script")

# ── Step 3: Verify force_phase worked ──
print_step(3, "Verify phase set to mini_script")
sd2 = host.start_icebreaker(SESSION_ID, PLAYERS[0][2])
assert sd2.get("currentPhase") == "mini_script", f"Phase should be mini_script after force"

# ── Step 4: Generate framework ──
print_step(6, "Generate mini_script framework (host)")
resp = host.miniscript_api("/generate", body={
    "socialSessionId": sid,
    "playerCount": 4,
    "style": "modern_urban",
    "genres": ["light_reasoning"],
    "lite": True,
})
data = require_ok(resp)
print(f"  Style: {data.get('style','?')}")
print(f"  Genres: {data.get('genres','?')}")
print(f"  Premise: {(data.get('premise','') or '?')[:80]}...")
chars = data.get("characters", [])
print(f"  Characters: {len(chars)}")
for ch in chars:
    print(f"    Slot {ch.get('slotIndex','?')}: {ch.get('roleLabel','?')} — {ch.get('sinHook','?')}")
acts = data.get("act_flow", [])
print(f"  Acts: {len(acts)}")
for a in acts:
    print(f"    Act {a.get('actNumber','?')}: {a.get('title','?')}")
meta = data.get("meta", {})
print(f"  Meta: promptVersion={meta.get('promptVersion','?')}, model={meta.get('model','?')}")

# ── Step 5: Assign roles ──
print_step(5, "Assign roles (host)")
resp = host.miniscript_api("/assign-roles", body={"socialSessionId": sid})
data = require_ok(resp)
assignments = data.get("roleAssignments", {})
views = data.get("playerRuntimeViews", {})
user_id_to_name = {c.user_id: PLAYERS[i][2] for i, c in enumerate(clients)}
print(f"  {len(assignments)} assignments:")
for uid, slot in assignments.items():
    nm = user_id_to_name.get(uid, uid[:8])
    view = views.get(uid, {})
    print(f"    {nm}: slot {slot} → {view.get('roleLabel','?')} (agenda: {(view.get('secretAgenda','') or '?')[:40]}...)")

# ── Step 6: Reveal each act ──
print_step(6, "Reveal acts sequentially")
total_acts = len(acts)
for act_num in range(1, total_acts + 1):
    input(f"  Act {act_num}/{total_acts}: Press Enter to reveal...")
    resp = host.miniscript_api("/reveal-act", body={
        "socialSessionId": sid, "targetAct": act_num
    })
    data = require_ok(resp)
    clues = data.get("revealedClueIds", [])
    hints = data.get("deductionHints", [])
    print(f"    Current act: {data.get('currentAct','?')}")
    print(f"    Clues revealed: {len(clues)}")
    for h in hints:
        print(f"      Hint {h.get('stepNumber','?')}: {(h.get('conclusion','') or '?')[:60]}")

# ── Step 7: Vote (all players) ──
print_step(7, "All players submit accusation vote")
for i, c in enumerate(clients):
    who = f"角色{i}"
    what = f"罪名{i}"
    why = f"因为{i}"
    # Use provided names if available from character data
    if i < len(chars):
        who = chars[i].get("roleLabel", who)
    resp = c.miniscript_api("/vote", body={
        "socialSessionId": sid,
        "vote": {"who": who, "what": what, "why": why}
    })
    data = require_ok(resp)
    print(f"  {PLAYERS[i][2]}: voted for '{who}'")
    vote = data.get("vote", {})
    print(f"    Voted at: {vote.get('votedAt','?')}")

# ── Step 8: Reveal solution ──
print_step(8, "Host reveals solution")
resp = host.miniscript_api("/reveal-solution", body={"socialSessionId": sid})
data = require_ok(resp)
sol = data.get("solution", {})
print(f"  Who: {sol.get('who','?')}")
print(f"  What: {(sol.get('what','') or '?')[:80]}")
print(f"  Why: {(sol.get('why','') or '?')[:80]}")
print(f"  Revealed: {data.get('revealed', False)}")

# ── Step 9: Ready check ──
print_step(9, "Players ready for recap")
for i, c in enumerate(clients):
    resp = c.miniscript_api("/ready", body={"socialSessionId": sid, "ready": True})
    data = require_ok(resp)
    ready_map = data.get("readyMap", {})
    ready_count = sum(1 for v in ready_map.values() if v)
    print(f"  {PLAYERS[i][2]}: ready ({ready_count}/{len(clients)})")

# ── Step 10: Advance to recap ──
print_step(10, "Host advances to recap")
adv = host.advance_phase(sid, "mini_script")
next_phase = adv.get("nextPhase", "")
print(f"  Next: {next_phase}")

if next_phase == "recap":
    print_step(11, "Verify recap includes mini_script snapshot")
    resp = host.social_api(f"{sid}/recap", method="GET")
    data = require_ok(resp)
    snap = data.get("recapSnapshot", {})
    ms_line = snap.get("miniScriptRecapLine", snap.get("miniScriptRecap", "(not found)"))
    print(f"  Mini-script recap: {(ms_line or '?')[:80]}")

print(f"\n  >>> MINI SCRIPT TEST PASSED <<<")

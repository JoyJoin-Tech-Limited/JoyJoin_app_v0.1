# JoyJoin Social Icebreaker — Manual Test Suite

> 11 phase-level manual test scripts for all Social Icebreaker phases.
> Tests prompt for input at each step — they are interactive runbooks, not CI tests.

---

## Prerequisites

```bash
# Python
pip3 install requests

# Seed test data (from repo root: apps/server)
node --env-file=../../.env --import tsx/esm src/scripts/seed-test-data.ts

# Dev server running
npm run dev:server
```

The seed script creates:
- 8 test users `+8613800000001`–`+8613800000008` (password: `test123456`)
- 1 QA event pool titled `QA 测试饭局 — 周五夜聊`
- 1 admin account: `test_admin_seed` / `TestAdmin123!`

---

## Data Setup: Create a Group

The seed creates a pool but **no groups**. Icebreaker `/start` needs a valid `event_pool_groups.id` where your test user has a `registration.assignedGroupId`. Follow this workflow:

### 1. Find the QA pool ID

```bash
psql "$DATABASE_URL" -c "SELECT id, title FROM event_pools WHERE title LIKE '%QA%';"
```

Expected output:
```
                   id                   |           title
----------------------------------------+--------------------------
 aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee   | QA 测试饭局 — 周五夜聊
```

### 2. Register test users to the pool

**Option A — Demo API** (easiest, regular auth):
```bash
# Login as user 0001 (any seeded user works)
curl -c /tmp/joy_cookies.txt -X POST http://localhost:5001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+8613800000001"}'

# Use the pool_id from step 1 (POST with JSON body, not query params)
curl -b /tmp/joy_cookies.txt -X POST http://localhost:5001/api/demo/seed-pool-registrations \
  -H "Content-Type: application/json" \
  -d '{"poolId":"<POOL_ID>","count":4}'
```

**Option B — Test Admin API** (admin auth):
```bash
curl -c /tmp/admin_cookies.txt -X POST http://localhost:5001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test_admin_seed","password":"TestAdmin123!"}'

curl -b /tmp/admin_cookies.txt -X POST http://localhost:5001/api/test/admin/registrations \
  -H "Content-Type: application/json" \
  -d '{"phone":"+8613800000001","poolId":"<POOL_ID>"}'
```

### 3. Create a group + link registrations

```sql
-- Replace <POOL_ID> with the UUID from step 1
INSERT INTO event_pool_groups (pool_id, group_number, member_count, status)
VALUES ('<POOL_ID>', 1, 4, 'confirmed')
RETURNING id;

-- Grab the returned UUID — that's your SESSION_ID for all tests
-- Example: ffffffff-1111-2222-3333-444444444444
```

### 4. Update registrations to link to the group

```sql
-- Replace <SESSION_ID> with the group UUID from step 3
UPDATE event_pool_registrations
SET assigned_group_id = '<SESSION_ID>', match_status = 'matched'
WHERE pool_id = '<POOL_ID>'
AND user_id IN (
  SELECT id FROM users WHERE phone IN (
    '+8613800000001','+8613800000003','+8613800000004'
  )
);
```

### 5. Verify

```sql
SELECT u.phone, epr.match_status, epr.assigned_group_id
FROM event_pool_registrations epr
JOIN users u ON u.id = epr.user_id
WHERE epr.pool_id = '<POOL_ID>';
```

Expected:
```
     phone      | match_status |          assigned_group_id
----------------+--------------+--------------------------------------
 +8613800000001 | matched      | ffffffff-1111-2222-3333-444444444444
 +8613800000003 | matched      | ffffffff-1111-2222-3333-444444444444
 +8613800000004 | matched      | ffffffff-1111-2222-3333-444444444444
```

Now you have a valid `SESSION_ID = ffffffff-1111-2222-3333-444444444444`.

---

## Running a Test

```bash
python3 tests/icebreaker/test_<phase>.py
```

The script prompts at each step. Read the prompt, check the server's JSON response, and enter your choice.

---

## Module Reference

All tests run against `http://localhost:5001`.

### Common Pattern

Every test script:
1. Prompts for `SESSION_ID` (the `event_pool_groups.id` from setup above)
2. Logs in each test user via `POST /api/auth/dev-login` (dev only)
3. Calls `POST /api/social-icebreaker/start` for the 2-player host
4. Steps through phase actions with `input()` at each decision point

---

### 2-Player Phases

| Module | Host | Player | Default inputs |
|--------|------|--------|----------------|
| `test_warmup.py` | 0001 | 0004 | All Y |
| `test_micro_challenge.py` | 0001 | 0004 | All Y, timer=2 |
| `test_recap.py` | 0001 | 0004 | All Enter |
| `test_group_mirror.py` | 0001 | 0004 | All Enter |
| `test_speed_friending.py` | 0001 | 0004 | Enter for round |
| `test_quip_battle.py` | 0001 | 0004 | prompt1, own answer |

### 3-Player Phases

| Module | Players | Notes |
|--------|---------|-------|
| `test_lie_detective.py` | 0001, 0003, 0004 | V1: each enters truth+lie → vote |
| `test_auction.py` | 0001, 0003, 0004 | Each bids virtual coins on lots |
| `test_undercover_word.py` | 0001, 0003, 0004 | 1 undercover, describe words → vote |

### 4-Player Phase

| Module | Players | Notes |
|--------|---------|-------|
| `test_mini_script.py` | 0001, 0005, 0006, 0007 | Bonus gate → framework → roles → acts → vote → solution |

---

## Input Reference

### Every Test (Phase-Independent)

| Prompt | Example Input | Notes |
|--------|---------------|-------|
| `Enter group/event ID: ` | `ffffffff-1111-2222-3333-444444444444` | Your group UUID |
| `Enter any key to login <USER>...` | just Enter | Triggers dev-login |
| `Enter any key to advance phase...` | just Enter | Controls flow |
| `(Y/n): ` | `Y` or `y` (or blank) | Confirms |
| `(n/Y): ` | `Y` (or blank) | Opt-in |

### Phase-Specific Inputs

**warmup:**
| Prompt | Input |
|--------|-------|
| `How many questions to generate? [3]:` | blank or `3` |

**micro_challenge:**
| Prompt | Input |
|--------|-------|
| `Timer duration (seconds) [2]:` | blank or `2` |
| `Which team won? (team1/team2/draw):` | `team1` |

**personality_dice:**
| Prompt | Input |
|--------|-------|
| `Complete challenge for <USER>?` | `Y` |

**group_mirror:**
| Prompt | Input |
|--------|-------|
| `How many questions? [3]:` | blank or `3` |
| `Mirror answer for <USER>: ` | any text |

**speed_friending:**
| Prompt | Input |
|--------|-------|
| `(enter for next round, 'done' to finish)` | Enter or `done` |

**lie_detective:**
| Prompt | Input |
|--------|-------|
| `Enter truth 1 for <USER>: ` | any truth |
| `Enter lie for <USER>: ` | any lie |
| `Vote: which statement is the lie? (1/2/3): ` | `1`, `2`, or `3` |

**auction:**
| Prompt | Input |
|--------|-------|
| `bid amount [10]: ` | blank or integer |
| `(enter to close lot, 'done' to finish)` | Enter or `done` |

**quip_battle:**
| Prompt | Input |
|--------|-------|
| `Generate prompt number?` | `Y` |
| `Enter quip for <USER>: ` | any witty reply |
| `Vote for winner (enter username): ` | host's phone |

**undercover_word:**
| Prompt | Input |
|--------|-------|
| `Description from <USER>: ` | any description |
| `Vote for undercover (enter username): ` | `+8613800000003` |

**mini_script:**
| Prompt | Input |
|--------|-------|
| `Vote to enter mini_script? (y/n): ` | `y` |
| `Assign role for <USER>: ` | `侦探` |
| `Reveal act N for <USER>?` | `Y` |
| `Final vote: arrest the suspect? (y/n): ` | `y` |

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `403 Forbidden` on start | No valid registration | Check `assignedGroupId` in setup step 4 |
| `401 Unauthorized` | Session expired | Re-login |
| `Icebreaker session not found` | Wrong SESSION_ID | Verify group UUID exists |
| `Phase not found in registry` | Wrong phase for run plan | Check session phase list |
| Stale session data | Previous test persisted | `DELETE FROM social_icebreaker_sessions;` |
| `404` on `/start` | Pool status not `matched` | `UPDATE event_pools SET status='matched';` |
| Wrong users in session | 3P/4P need different users | Re-create group with correct registrations |

### Quick Reset

```bash
# Nuke all icebreaker sessions
psql "$DATABASE_URL" -c "DELETE FROM social_icebreaker_sessions;"

# Reset all test data (admin auth)
curl -b /tmp/admin_cookies.txt -X POST http://localhost:5001/api/test/admin/reset

# Re-seed
node --env-file=../../.env --import tsx/esm src/scripts/seed-test-data.ts
```

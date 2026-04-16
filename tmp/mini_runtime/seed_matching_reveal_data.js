const { neon } = require("@neondatabase/serverless")
const DATABASE_URL = process.env.DATABASE_URL
const MAIN_USER = { loginCode: "wechat_test_local_smoke", openId: "mock_openid_wechat_test_local_smoke", displayName: "测试主角", archetype: "开心柯基", interests: ["咖啡", "城市散步", "展览"] }
const COMPANION_USER = { openId: "mock_openid_wechat_test_reveal_companion", displayName: "桌友阿晴", archetype: "温柔水豚", interests: ["城市散步", "摄影", "甜品"] }
const QA_GROUP = { theme: "城市夜谈局", subtitle: "先从最近上头的事情聊起", vibe: "playful", themeEmoji: "✨", themeHighlights: ["城市散步", "咖啡续摊", "周末灵感"], matchExplanation: "你们都偏向轻松开场，很容易从城市生活和周末安排聊开。", venueName: "JoyJoin QA Table", venueAddress: "深圳 南山区 QA Smoke Venue", temperatureLevel: "warm", status: "confirmed", mainScore: 84, companionScore: 81 }
if (!DATABASE_URL) throw new Error("DATABASE_URL is required. Run with node --env-file=../../.env or export DATABASE_URL first.")
const sql = neon(DATABASE_URL)
async function ensureUser(user) {
  const existing = await sql`select id from users where wechat_open_id = ${user.openId} limit 1`
  let userId = existing[0] && existing[0].id
  if (!userId) {
    const inserted = await sql`
      insert into users (wechat_open_id, has_completed_registration, has_completed_interests_topics, has_completed_personality_test, has_completed_profile_setup, has_completed_voice_quiz, created_at, updated_at)
      values (${user.openId}, false, false, false, false, false, now(), now())
      returning id
    `
    userId = inserted[0].id
  }
  await sql`update users set display_name = ${user.displayName}, archetype = ${user.archetype}, interests_ranked_top3 = ${user.interests}::text[], updated_at = now() where id = ${userId}`
  return userId
}
async function pickPools() {
  const zeroPools = await sql`select id, title, min_group_size, max_group_size from event_pools where status = $$active$$ and coalesce(total_registrations, 0) = 0 order by date_time asc limit 2`
  if (zeroPools.length >= 2) return { selectionStrategy: "active-zero-registration", pendingPool: zeroPools[0], matchedPool: zeroPools[1] }
  const activePools = await sql`select id, title, min_group_size, max_group_size from event_pools where status = $$active$$ order by date_time asc limit 2`
  if (activePools.length < 2) throw new Error("Need at least two active event pools for matching/reveal smoke data.")
  return { selectionStrategy: "active-fallback", pendingPool: activePools[0], matchedPool: activePools[1] }
}
async function ensurePendingRegistration(poolId, userId) {
  const existing = await sql`select id from event_pool_registrations where pool_id = ${poolId} and user_id = ${userId} limit 1`
  if (existing.length > 0) {
    await sql`update event_pool_registrations set match_status = $$pending$$, assigned_group_id = null, match_score = null, updated_at = now() where id = ${existing[0].id}`
    return { id: existing[0].id, reused: true }
  }
  const inserted = await sql`insert into event_pool_registrations (pool_id, user_id, match_status, registered_at, updated_at) values (${poolId}, ${userId}, $$pending$$, now(), now()) returning id`
  return { id: inserted[0].id, reused: false }
}
async function ensureMatchedGroup(poolId) {
  const existing = await sql`select id, group_number from event_pool_groups where pool_id = ${poolId} and venue_name = ${QA_GROUP.venueName} and venue_address = ${QA_GROUP.venueAddress} limit 1`
  let groupId = existing[0] && existing[0].id
  let groupNumber = existing[0] && existing[0].group_number
  const reused = existing.length > 0
  if (!groupId) {
    const rows = await sql`select coalesce(max(group_number), 0)::int + 1 as next_group_number from event_pool_groups where pool_id = ${poolId}`
    groupNumber = rows[0] && rows[0].next_group_number ? rows[0].next_group_number : 1
    const inserted = await sql`
      insert into event_pool_groups (pool_id, group_number, member_count, avg_chemistry_score, diversity_score, energy_balance, overall_score, temperature_level, match_explanation, theme, subtitle, vibe, theme_emoji, theme_highlights, venue_name, venue_address, final_date_time, status, created_at, updated_at)
      values (${poolId}, ${groupNumber}, 2, 86, 78, 82, 84, ${QA_GROUP.temperatureLevel}, ${QA_GROUP.matchExplanation}, ${QA_GROUP.theme}, ${QA_GROUP.subtitle}, ${QA_GROUP.vibe}, ${QA_GROUP.themeEmoji}, ${JSON.stringify(QA_GROUP.themeHighlights)}::jsonb, ${QA_GROUP.venueName}, ${QA_GROUP.venueAddress}, now() + interval '3 day', ${QA_GROUP.status}, now(), now())
      returning id
    `
    groupId = inserted[0].id
  }
  await sql`update event_pool_groups set member_count = 2, avg_chemistry_score = 86, diversity_score = 78, energy_balance = 82, overall_score = 84, temperature_level = ${QA_GROUP.temperatureLevel}, match_explanation = ${QA_GROUP.matchExplanation}, theme = ${QA_GROUP.theme}, subtitle = ${QA_GROUP.subtitle}, vibe = ${QA_GROUP.vibe}, theme_emoji = ${QA_GROUP.themeEmoji}, theme_highlights = ${JSON.stringify(QA_GROUP.themeHighlights)}::jsonb, venue_name = ${QA_GROUP.venueName}, venue_address = ${QA_GROUP.venueAddress}, final_date_time = now() + interval '3 day', status = ${QA_GROUP.status}, updated_at = now() where id = ${groupId}`
  return { id: groupId, groupNumber, reused }
}
async function ensureMatchedRegistration(poolId, userId, groupId, score) {
  const existing = await sql`select id from event_pool_registrations where pool_id = ${poolId} and user_id = ${userId} limit 1`
  if (existing.length > 0) {
    await sql`update event_pool_registrations set match_status = $$matched$$, assigned_group_id = ${groupId}, match_score = ${score}, updated_at = now() where id = ${existing[0].id}`
    return { id: existing[0].id, reused: true }
  }
  const inserted = await sql`insert into event_pool_registrations (pool_id, user_id, match_status, assigned_group_id, match_score, registered_at, updated_at) values (${poolId}, ${userId}, $$matched$$, ${groupId}, ${score}, now(), now()) returning id`
  return { id: inserted[0].id, reused: false }
}
async function syncPoolTotalRegistrations(poolId) {
  await sql`update event_pools set total_registrations = (select count(*)::int from event_pool_registrations where pool_id = ${poolId}), updated_at = now() where id = ${poolId}`
}
async function main() {
  const startedAt = new Date().toISOString()
  const mainUserId = await ensureUser(MAIN_USER)
  const companionUserId = await ensureUser(COMPANION_USER)
  const pools = await pickPools()
  if (pools.pendingPool.id === pools.matchedPool.id) throw new Error("Pending pool and matched pool must be different.")
  const pendingRegistration = await ensurePendingRegistration(pools.pendingPool.id, mainUserId)
  const group = await ensureMatchedGroup(pools.matchedPool.id)
  const matchedRegistration = await ensureMatchedRegistration(pools.matchedPool.id, mainUserId, group.id, QA_GROUP.mainScore)
  const companionRegistration = await ensureMatchedRegistration(pools.matchedPool.id, companionUserId, group.id, QA_GROUP.companionScore)
  await syncPoolTotalRegistrations(pools.pendingPool.id)
  await syncPoolTotalRegistrations(pools.matchedPool.id)
  return {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    loginCode: MAIN_USER.loginCode,
    selectionStrategy: pools.selectionStrategy,
    users: { main: { id: mainUserId, openId: MAIN_USER.openId, displayName: MAIN_USER.displayName, archetype: MAIN_USER.archetype }, companion: { id: companionUserId, openId: COMPANION_USER.openId, displayName: COMPANION_USER.displayName, archetype: COMPANION_USER.archetype } },
    pools: { pending: { id: pools.pendingPool.id, title: pools.pendingPool.title, minGroupSize: pools.pendingPool.min_group_size, maxGroupSize: pools.pendingPool.max_group_size }, matched: { id: pools.matchedPool.id, title: pools.matchedPool.title, minGroupSize: pools.matchedPool.min_group_size, maxGroupSize: pools.matchedPool.max_group_size } },
    registrations: { pending: pendingRegistration, matched: matchedRegistration, companionMatched: companionRegistration },
    group,
  }
}
main().then((result) => { console.log(JSON.stringify(result, null, 2)) }).catch((error) => { console.log(JSON.stringify({ ok: false, startedAt: new Date().toISOString(), error: error && error.stack ? error.stack : String(error) }, null, 2)); process.exit(1) })

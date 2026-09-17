/**
 * Verifies the WeChat subscribe-message template contracts used by
 * apps/server/src/lib/wechatSubscribeMessage.ts.
 *
 * Why this exists: WeChat assigns field keys from the chosen library template
 * and does NOT renumber when you add a subset of fields, so the keys are
 * non-sequential and differ per template (e.g. result uses thing4/time15/thing7).
 * A wrong key makes the send fail with 47003 (模板参数不准确) and the message
 * silently never arrives — this script reads the authoritative keys from the
 * WeChat `wxaapi/newtmpl/gettemplate` API and fails on any mismatch.
 *
 * Run: npm run verify:subscribe-templates   (requires WECHAT_APPID/SECRET and
 * the three WECHAT_SUBSCRIBE_TMPL_* vars in .env)
 */
import process from 'node:process'

const EXPECTED = {
  result: {
    envVar: 'WECHAT_SUBSCRIBE_TMPL_MATCH_SUCCESS',
    keys: ['thing4', 'time15', 'thing7'],
  },
  reminder: {
    envVar: 'WECHAT_SUBSCRIBE_TMPL_EVENT_REMINDER',
    keys: ['thing1', 'time2', 'thing6', 'thing4'],
  },
  recap: {
    envVar: 'WECHAT_SUBSCRIBE_TMPL_RECAP',
    keys: ['thing1', 'time4', 'thing3'],
  },
}

const appid = process.env.WECHAT_APPID
const secret = process.env.WECHAT_SECRET
if (!appid || !secret) {
  console.log('SKIP: WECHAT_APPID/WECHAT_SECRET not set')
  process.exit(0)
}

const tokenRes = await fetch(
  `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`,
).catch((err) => {
  console.error(`FAIL: access_token request error: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
const token = await tokenRes.json()
if (!token.access_token) {
  console.error(`FAIL: access_token fetch failed (${token.errcode} ${token.errmsg})`)
  process.exit(1)
}

const listRes = await fetch(
  `https://api.weixin.qq.com/wxaapi/newtmpl/gettemplate?access_token=${token.access_token}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
).catch((err) => {
  console.error(`FAIL: gettemplate request error: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
const list = await listRes.json()
if (list.errcode !== 0) {
  console.error(`FAIL: gettemplate failed (${list.errcode} ${list.errmsg})`)
  process.exit(1)
}

const byId = new Map((list.data ?? []).map((t) => [t.priTmplId, t]))
let failures = 0

for (const [role, spec] of Object.entries(EXPECTED)) {
  const templateId = process.env[spec.envVar]
  if (!templateId) {
    console.log(`SKIP ${role}: ${spec.envVar} not set`)
    continue
  }
  const template = byId.get(templateId)
  if (!template) {
    console.error(`FAIL ${role}: template ${templateId.slice(-8)} not found on this app`)
    failures += 1
    continue
  }
  const actual = [...template.content.matchAll(/\{\{([a-z]+\d+)\.DATA\}\}/g)].map((m) => m[1])
  const missing = spec.keys.filter((k) => !actual.includes(k))
  if (missing.length > 0) {
    console.error(
      `FAIL ${role} (${template.title}): expected keys [${spec.keys.join(', ')}], template has [${actual.join(', ')}] — missing ${missing.join(', ')}`,
    )
    failures += 1
  } else {
    console.log(`PASS ${role}: ${template.title} keys [${actual.join(', ')}]`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} template contract(s) failed — update TEMPLATES in apps/server/src/lib/wechatSubscribeMessage.ts`)
  process.exit(1)
}
console.log('\nAll subscribe-message template contracts verified.')

#!/usr/bin/env node
/**
 * WeCom Bot Notification Utility
 * 企业微信群机器人消息推送
 *
 * Sends markdown or text messages to a WeCom (WeChat Work) group bot.
 *
 * Usage:
 *   export WECOM_BOT_KEY=xxxxx                              # bot webhook key
 *   node scripts/wecom-notify.mjs --text "Hello world"
 *   node scripts/wecom-notify.mjs --markdown "# Header\nBody text"
 *   node scripts/wecom-notify.mjs --markdown < message.md
 *   node scripts/wecom-notify.mjs --file ./report.json
 *
 * Environment:
 *   WECOM_BOT_KEY        – Required. Bot webhook key (the `key` query param).
 *   WECOM_BOT_WEBHOOK    – Optional. Full webhook URL override.
 *                          Default: https://qyapi.weixin.qq.com/cgi-bin/webhook/send
 *   WECOM_BOT_TIMEOUT_MS – Optional. Request timeout (default: 10000).
 *
 * Exit codes:
 *   0 = sent successfully
 *   1 = configuration error
 *   2 = API error
 */

// @ts-check

const BOT_KEY = process.env.WECOM_BOT_KEY || '';
const BOT_WEBHOOK_BASE = process.env.WECOM_BOT_WEBHOOK ||
  'https://qyapi.weixin.qq.com/cgi-bin/webhook/send';
const TIMEOUT_MS = parseInt(process.env.WECOM_BOT_TIMEOUT_MS || '10000', 10);

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

/** @type {{ type: 'text' | 'markdown'; content: string } | null} */
let payload = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--text' && i + 1 < args.length) {
    payload = { type: 'text', content: args[++i] };
  } else if (args[i] === '--markdown' && i + 1 < args.length) {
    payload = { type: 'markdown', content: args[++i] };
  }
}

// If no inline content, try stdin
if (!payload) {
  // check if stdin has data (not a TTY)
  try {
    const isTTY = process.stdin.isTTY;
    if (!isTTY) {
      const stdin = await new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => resolve(data));
      });
      if (stdin.trim()) {
        payload = { type: 'markdown', content: stdin.trim() };
      }
    }
  } catch {
    // Not readable
  }
}

if (!payload) {
  console.error('Usage: wecom-notify.mjs --text "message" | --markdown "content"');
  console.error('  Or pipe content:  echo "# Hello" | node scripts/wecom-notify.mjs');
  process.exit(1);
}

if (!BOT_KEY && !process.env.WECOM_BOT_WEBHOOK) {
  console.error('❌ WECOM_BOT_KEY environment variable is required.');
  console.error('   Set it in your .env or GitHub Actions secrets.');
  console.error('   echo "WECOM_BOT_KEY=your-key" >> .env');
  process.exit(1);
}

// ─── Build webhook URL ───────────────────────────────────────────────────────

const webhookUrl = process.env.WECOM_BOT_WEBHOOK
  ? BOT_WEBHOOK_BASE
  : `${BOT_WEBHOOK_BASE}?key=${BOT_KEY}`;

// ─── Build request body ──────────────────────────────────────────────────────

/** @type {Record<string, unknown>} */
let body;

if (payload.type === 'text') {
  body = {
    msgtype: 'text',
    text: { content: payload.content },
  };
} else {
  // WeCom markdown: supports basic markdown (headers, bold, links, quotes, etc.)
  // Max length: 4096 bytes
  const truncated = payload.content.length > 4000
    ? payload.content.slice(0, 3996) + '\n…'
    : payload.content;

  body = {
    msgtype: 'markdown',
    markdown: { content: truncated },
  };
}

// ─── Send ────────────────────────────────────────────────────────────────────

async function send() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const json = await res.json();

    if (json.errcode === 0) {
      console.log(JSON.stringify({
        level: 'info',
        message: `WeCom bot message sent (${payload.type})`,
        type: payload.type,
        length: payload.content.length,
      }));
      process.exit(0);
    } else {
      console.error(JSON.stringify({
        level: 'error',
        message: 'WeCom bot API error',
        errcode: json.errcode,
        errmsg: json.errmsg,
      }));
      process.exit(2);
    }
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = /** @type {any} */ (err)?.name === 'AbortError';
    console.error(JSON.stringify({
      level: 'error',
      message: isTimeout ? `WeCom bot timeout after ${TIMEOUT_MS}ms` : 'WeCom bot request failed',
      error: String(err),
    }));
    process.exit(2);
  }
}

send();

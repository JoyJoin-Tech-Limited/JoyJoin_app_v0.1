#!/usr/bin/env node
/**
 * Temporary corrected H5 mock server for results-page visual QA.
 * Mirrors scripts/devtools/mock-h5-server.mjs with the correct DIST_DIR.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.H5_MOCK_PORT || 5001
const DIST_DIR = path.resolve(import.meta.dirname, '../apps/mini-program/dist')

const MOCK_AUTH_USER = {
  id: 1,
  phoneNumber: '13800138000',
  displayName: 'Test User',
  nickname: 'Tester',
  archetype: 'corgi',
  profileEssentialComplete: true,
  profileExtendedComplete: true,
  nextStep: null,
  avatarUrl: null,
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.url === '/api/auth/user') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(MOCK_AUTH_USER))
    return
  }

  if (req.url === '/api/xiaoyue/analysis') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      headline: '你是开心柯基：人群中的小太阳',
      analysis: '你带着天然的热情和感染力，总能让场子暖起来。',
      socialRole: '气氛担当',
      bestScene: '周末户外局',
      microAction: '主动cue一下安静的朋友',
      shareLine: '活着就要开心，交朋友也是。',
      stateLabel: '活力满满',
      whyThisFits: '你的外向与正向度都极高，符合柯基原型。',
      blendLine: '',
      expressionTags: ['热情', '乐观', '亲和'],
      shareVariants: {
        selfIntro: '我是 JoyJoin 的开心柯基，爱热闹也爱你。',
        friendCallout: '快来找我组局，保证不冷场。',
        socialInvite: '周末一起出来玩？',
      },
      cached: true,
    }))
    return
  }

  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  const ext = path.extname(filePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  try {
    const content = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(content)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`H5 mock server running at http://localhost:${PORT}`)
  console.log(`Serving static files from: ${DIST_DIR}`)
})

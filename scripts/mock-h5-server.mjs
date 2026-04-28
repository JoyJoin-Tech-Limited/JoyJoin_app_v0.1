#!/usr/bin/env node
/**
 * H5 Mock Server for mini-program screenshots
 *
 * Serves the built H5 app from apps/mini-program/dist and mocks the API
 * endpoints needed to render authenticated pages.
 *
 * Usage:
 *   node scripts/mock-h5-server.mjs
 *
 * The server listens on port 5001 (matching TARO_APP_API_BASE_URL default).
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = 5001
const DIST_DIR = path.resolve(import.meta.dirname, '../apps/mini-program/dist')

// ─── Mock data ────────────────────────────────────────────────────

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

const MOCK_EVENT_POOLS = [
  {
    id: '1',
    title: '周末咖啡局',
    description: '轻松聊聊生活与工作',
    city: '深圳',
    district: '南山区',
    dateTime: '2026-04-26 14:00',
    status: 'open',
    maxParticipants: 24,
    currentParticipants: 12,
    spotsLeft: 12,
    registrationCount: 12,
    accentFamily: 'warm',
    sampleArchetypes: ['corgi', 'rooster'],
    topArchetypes: [
      { archetype: 'corgi', count: 3 },
      { archetype: 'rooster', count: 2 },
    ],
  },
  {
    id: '2',
    title: '桌游夜',
    description: '策略与合作',
    city: '深圳',
    district: '福田区',
    dateTime: '2026-04-27 19:00',
    status: 'open',
    maxParticipants: 18,
    currentParticipants: 8,
    spotsLeft: 10,
    registrationCount: 8,
    accentFamily: 'cool',
    sampleArchetypes: ['智望猪', 'dolphin_calm'],
    topArchetypes: [
      { archetype: '智望猪', count: 2 },
      { archetype: 'dolphin_calm', count: 2 },
    ],
  },
]

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

// ─── Server ───────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // ── API endpoints ──
  if (req.url === '/api/auth/user') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(MOCK_AUTH_USER))
    return
  }

  if (req.url === '/api/event-pools') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(MOCK_EVENT_POOLS))
    return
  }

  if (req.url === '/api/my-pool-registrations') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify([]))
    return
  }

  if (req.url === '/api/notifications/unread') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ unreadCounts: {}, totalUnread: 0 }))
    return
  }

  // ── Static files ──
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

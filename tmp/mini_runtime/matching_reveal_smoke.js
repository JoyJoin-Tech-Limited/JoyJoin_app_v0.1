const { spawnSync } = require("node:child_process")
const path = require("node:path")
const automator = require("miniprogram-automator")
const CONFIG = {
  cliPath: process.env.CLI_PATH || "/Applications/wechatwebdevtools.app/Contents/MacOS/cli",
  projectPath: process.env.PROJECT_PATH || path.resolve(__dirname, "../../apps/mini-program/dist"),
  apiBaseUrl: process.env.MINI_RUNTIME_API_BASE_URL || "http://127.0.0.1:5001",
  launchTimeoutMs: Number.parseInt(process.env.LAUNCH_TIMEOUT_MS || "45000", 10),
  readyTimeoutMs: Number.parseInt(process.env.READY_TIMEOUT_MS || "15000", 10),
  pollIntervalMs: Number.parseInt(process.env.POLL_INTERVAL_MS || "150", 10),
  loginCode: process.env.MINI_RUNTIME_LOGIN_CODE || "wechat_test_local_smoke",
}
const SELECTORS = {
  pending: [".matching-status__waiting-card", ".matching-status__waiting-scene", ".matching-status__waiting-refresh-btn"],
  matched: [".matching-status__squad-card", ".matching-status__theme-card", ".matching-status__cta-btn"],
  revealReady: [".squad-unboxing__blind-box-card", ".squad-unboxing__open-btn"],
  revealDone: [".squad-unboxing__viewer-spotlight", ".squad-unboxing__action-zone"],
}
function nowIso() { return new Date().toISOString() }
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)) }
function routePathOnly(route) { return String(route || "").replace(/^\//, "").split("?")[0] }
function formatError(error) { return error && error.stack ? error.stack : String(error) }
function safeJsonParse(raw, fallback) { try { return JSON.parse(raw) } catch (_error) { return fallback } }
function readDevToolsLoginState() {
  if (!CONFIG.cliPath) return { ok: false, blocked: true, reason: "missing-cli", message: "WeChat DevTools CLI path is missing." }
  const command = spawnSync(CONFIG.cliPath, ["islogin"], { encoding: "utf8" })
  const rawOutput = ((command.stdout || "") + (command.stderr || "")).trim()
  const parsed = safeJsonParse(rawOutput, null)
  if (!(parsed && parsed.login === true)) {
    return { ok: false, blocked: true, reason: "devtools-login-required", message: "WeChat DevTools CLI reports login:false. Open WeChat DevTools, sign in interactively, then rerun this smoke helper.", rawOutput, exitCode: typeof command.status === "number" ? command.status : null }
  }
  return { ok: true, blocked: false, rawOutput, exitCode: typeof command.status === "number" ? command.status : null }
}
async function waitFor(label, predicate, timeoutMs = CONFIG.readyTimeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    const value = await predicate()
    if (value) return value
    await sleep(CONFIG.pollIntervalMs)
  }
  throw new Error("Timed out waiting for " + label + " after " + timeoutMs + "ms")
}
async function waitForRoute(miniProgram, route) {
  const expectedPath = routePathOnly(route)
  return waitFor("route " + expectedPath, async () => {
    const page = await miniProgram.currentPage()
    return page && page.path === expectedPath ? page : null
  })
}
async function collectSelectorState(page, selectors) {
  const found = {}
  for (const selector of selectors) found[selector] = Boolean(await page.$(selector))
  return found
}
async function assertSelectors(page, selectors, label) {
  const found = await collectSelectorState(page, selectors)
  const missing = selectors.filter((selector) => !found[selector])
  if (missing.length > 0) throw new Error(label + " missing selectors: " + missing.join(", "))
  return found
}
async function installRuntimeApiRewrite(miniProgram) {
  return miniProgram.evaluate(function (targetOrigin) {
    if (typeof wx === "undefined" || typeof wx.request !== "function") return { ok: false, reason: "wx-request-unavailable" }
    if (globalThis.__JOYJOIN_MINI_RUNTIME_PATCHED__) return { ok: true, patched: false, targetOrigin, reason: "already-patched" }
    const originalRequest = wx.request.bind(wx)
    const target = new URL(targetOrigin)
    wx.request = function patchedRequest(options) {
      const nextOptions = Object.assign({}, options)
      if (nextOptions && typeof nextOptions.url === "string") {
        try {
          const parsedUrl = new URL(nextOptions.url)
          if (parsedUrl.pathname.startsWith("/api/")) {
            parsedUrl.protocol = target.protocol
            parsedUrl.host = target.host
            nextOptions.url = parsedUrl.toString()
          }
        } catch (_error) {
          if (nextOptions.url.startsWith("/api/")) nextOptions.url = targetOrigin.replace(/\/$/, "") + nextOptions.url
        }
      }
      if (nextOptions && nextOptions.enableCookie !== true) nextOptions.enableCookie = true
      return originalRequest(nextOptions)
    }
    globalThis.__JOYJOIN_MINI_RUNTIME_PATCHED__ = true
    globalThis.__JOYJOIN_MINI_RUNTIME_TARGET_ORIGIN__ = targetOrigin
    return { ok: true, patched: true, targetOrigin }
  }, CONFIG.apiBaseUrl)
}
async function loginAndSeedAuth(miniProgram) {
  return miniProgram.evaluate(function (apiBaseUrl, loginCode) {
    function request(options) {
      return new Promise((resolve, reject) => wx.request(Object.assign({}, options, { enableCookie: true, success: resolve, fail: reject })))
    }
    function toAbsoluteUrl(pathname) { return apiBaseUrl.replace(/\/$/, "") + pathname }
    return (async function () {
      const common = require("./common.js")
      if (common && typeof common.clearMiniProgramAuthSession === "function") common.clearMiniProgramAuthSession({ queryClient: common.queryClient, mode: "hard" })
      const login = await request({ url: toAbsoluteUrl("/api/auth/wechat/login-with-test"), method: "POST", header: { "content-type": "application/json" }, data: { code: loginCode, testAnswers: [] } })
      const authUser = await request({ url: toAbsoluteUrl("/api/auth/user"), method: "GET", header: { "content-type": "application/json" } })
      if (authUser.statusCode >= 200 && authUser.statusCode < 300 && common && typeof common.seedMiniProgramAuthSession === "function") common.seedMiniProgramAuthSession(authUser.data, common.queryClient)
      const registrations = await request({ url: toAbsoluteUrl("/api/my-pool-registrations"), method: "GET", header: { "content-type": "application/json" } })
      const items = Array.isArray(registrations.data) ? registrations.data : []
      const pending = items.find((item) => item && item.matchStatus === "pending") || null
      const matched = items.find((item) => item && item.matchStatus === "matched" && item.assignedGroupId) || null
      return {
        login: { statusCode: login.statusCode, body: login.data },
        authUser: { statusCode: authUser.statusCode, body: authUser.data },
        registrations: { statusCode: registrations.statusCode, count: items.length, pendingRegistrationId: pending && pending.id, matchedRegistrationId: matched && matched.id, matchedGroupId: matched && matched.assignedGroupId },
      }
    })()
  }, CONFIG.apiBaseUrl, CONFIG.loginCode)
}
async function launchMiniProgram() {
  return automator.launch({ cliPath: CONFIG.cliPath, projectPath: CONFIG.projectPath, timeout: CONFIG.launchTimeoutMs })
}

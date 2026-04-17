const fs = require("node:fs")
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
function parseDevToolsLoginState(rawOutput) {
  const candidates = []
  function pushCandidate(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) candidates.push(value)
  }

  pushCandidate(safeJsonParse(rawOutput, null))
  for (const line of String(rawOutput || "").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    pushCandidate(safeJsonParse(trimmed, null))

    const firstBrace = trimmed.indexOf("{")
    const lastBrace = trimmed.lastIndexOf("}")
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      pushCandidate(safeJsonParse(trimmed.slice(firstBrace, lastBrace + 1), null))
    }
  }

  return candidates.find((candidate) => candidate.login === true)
    || candidates.find((candidate) => Object.prototype.hasOwnProperty.call(candidate, "login"))
    || null
}
function readDevToolsLoginState() {
  if (!CONFIG.cliPath) return { ok: false, blocked: true, reason: "missing-cli", message: "WeChat DevTools CLI path is missing." }
  const command = spawnSync(CONFIG.cliPath, ["islogin"], { encoding: "utf8" })
  const rawOutput = ((command.stdout || "") + (command.stderr || "")).trim()
  const parsed = parseDevToolsLoginState(rawOutput)
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
    function isRecord(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    }
    function readHeaderValue(headers, headerName) {
      if (!isRecord(headers)) return ""
      const expectedHeaderName = String(headerName || "").toLowerCase()
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() !== expectedHeaderName) continue
        const value = headers[key]
        if (Array.isArray(value)) return value.map((entry) => String(entry || "").trim()).filter(Boolean).join("; ")
        return value == null ? "" : String(value).trim()
      }
      return ""
    }
    function splitCookieHeader(cookieHeader) {
      return String(cookieHeader || "").split(/;\s*/).map((entry) => entry.trim()).filter((entry) => entry && entry.includes("="))
    }
    function mergeCookieHeaders(existingCookieHeader, runtimeCookieHeader) {
      const cookiePairs = new Map()
      for (const source of [existingCookieHeader, runtimeCookieHeader]) {
        for (const entry of splitCookieHeader(source)) {
          const separatorIndex = entry.indexOf("=")
          const cookieName = entry.slice(0, separatorIndex).trim()
          if (!cookieName) continue
          cookiePairs.set(cookieName, entry.slice(separatorIndex + 1).trim())
        }
      }
      return Array.from(cookiePairs.entries()).map(([cookieName, cookieValue]) => cookieName + "=" + cookieValue).join("; ")
    }
    function mergeHeaders(primaryHeaders, secondaryHeaders, runtimeCookieHeader) {
      const mergedHeaders = {}
      if (isRecord(secondaryHeaders)) Object.assign(mergedHeaders, secondaryHeaders)
      if (isRecord(primaryHeaders)) Object.assign(mergedHeaders, primaryHeaders)
      if (runtimeCookieHeader) {
        const cookieKey = Object.keys(mergedHeaders).find((key) => key.toLowerCase() === "cookie") || "Cookie"
        mergedHeaders[cookieKey] = mergeCookieHeaders(readHeaderValue(mergedHeaders, "cookie"), runtimeCookieHeader)
      }
      return mergedHeaders
    }
    if (globalThis.__JOYJOIN_MINI_RUNTIME_PATCHED__) return { ok: true, patched: false, targetOrigin, reason: "already-patched" }
    const originalRequest = wx.request.bind(wx)
    const target = new URL(targetOrigin)
    wx.request = function patchedRequest(options) {
      const nextOptions = Object.assign({}, options)
      let isApiRequest = false
      if (nextOptions && typeof nextOptions.url === "string") {
        try {
          const parsedUrl = new URL(nextOptions.url, targetOrigin)
          if (parsedUrl.pathname.startsWith("/api/")) {
            isApiRequest = true
            parsedUrl.protocol = target.protocol
            parsedUrl.host = target.host
            nextOptions.url = parsedUrl.toString()
          }
        } catch (_error) {
          if (nextOptions.url.startsWith("/api/")) {
            isApiRequest = true
            nextOptions.url = targetOrigin.replace(/\/$/, "") + nextOptions.url
          }
        }
      }
      const runtimeCookieHeader = isApiRequest && typeof globalThis.__JOYJOIN_MINI_RUNTIME_COOKIE_HEADER__ === "string"
        ? globalThis.__JOYJOIN_MINI_RUNTIME_COOKIE_HEADER__.trim()
        : ""
      const mergedHeaders = mergeHeaders(nextOptions && nextOptions.header, nextOptions && nextOptions.headers, runtimeCookieHeader)
      if (Object.keys(mergedHeaders).length > 0) {
        nextOptions.header = mergedHeaders
        if (Object.prototype.hasOwnProperty.call(nextOptions, "headers")) nextOptions.headers = mergedHeaders
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
    function isRecord(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    }
    function collectHeaderValues(headers, headerName) {
      if (!isRecord(headers)) return []
      const expectedHeaderName = String(headerName || "").toLowerCase()
      const values = []
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() !== expectedHeaderName) continue
        const value = headers[key]
        if (Array.isArray(value)) {
          for (const entry of value) {
            const normalizedEntry = String(entry || "").trim()
            if (normalizedEntry) values.push(normalizedEntry)
          }
          continue
        }
        const normalizedValue = String(value || "").trim()
        if (normalizedValue) values.push(normalizedValue)
      }
      return values
    }
    function normalizeCookiePair(entry) {
      if (!entry) return ""
      if (typeof entry === "string") {
        const normalizedEntry = entry.split(";")[0].trim()
        return normalizedEntry && normalizedEntry.includes("=") ? normalizedEntry : ""
      }
      if (!isRecord(entry)) return ""
      const cookieName = typeof entry.name === "string"
        ? entry.name.trim()
        : typeof entry.key === "string"
          ? entry.key.trim()
          : ""
      if (!cookieName) return ""
      const cookieValue = entry.value == null ? "" : String(entry.value).trim()
      return cookieName + "=" + cookieValue
    }
    function splitCookieHeader(cookieHeader) {
      return String(cookieHeader || "").split(/;\s*/).map((entry) => entry.trim()).filter((entry) => entry && entry.includes("="))
    }
    function mergeCookieHeaders() {
      const cookiePairs = new Map()
      for (const cookieSource of arguments) {
        for (const entry of splitCookieHeader(cookieSource)) {
          const separatorIndex = entry.indexOf("=")
          const cookieName = entry.slice(0, separatorIndex).trim()
          if (!cookieName) continue
          cookiePairs.set(cookieName, entry.slice(separatorIndex + 1).trim())
        }
      }
      return Array.from(cookiePairs.entries()).map(([cookieName, cookieValue]) => cookieName + "=" + cookieValue).join("; ")
    }
    function getCapturedCookieHeader(response) {
      const responseHeaders = {}
      if (isRecord(response && response.header)) Object.assign(responseHeaders, response.header)
      if (isRecord(response && response.headers)) Object.assign(responseHeaders, response.headers)
      const cookiePairs = []
      const responseCookies = response && response.cookies
      if (Array.isArray(responseCookies)) {
        for (const entry of responseCookies) {
          const normalizedCookie = normalizeCookiePair(entry)
          if (normalizedCookie) cookiePairs.push(normalizedCookie)
        }
      } else {
        const normalizedCookie = normalizeCookiePair(responseCookies)
        if (normalizedCookie) cookiePairs.push(normalizedCookie)
      }
      for (const setCookieValue of collectHeaderValues(responseHeaders, "set-cookie")) {
        const normalizedCookie = normalizeCookiePair(setCookieValue)
        if (normalizedCookie) cookiePairs.push(normalizedCookie)
      }
      return mergeCookieHeaders(globalThis.__JOYJOIN_MINI_RUNTIME_COOKIE_HEADER__, cookiePairs.join("; "))
    }
    function loadRuntimeCommonModule() {
      if (typeof require !== "function") return { ok: false, reason: "require-unavailable", attempts: [] }
      const attempts = []
      for (const modulePath of ["../../common.js", "../common.js", "./common.js", "common.js"]) {
        try {
          const moduleExports = require(modulePath)
          if (moduleExports && typeof moduleExports.seedMiniProgramAuthSession === "function" && moduleExports.queryClient) {
            return { ok: true, modulePath, moduleExports }
          }
          attempts.push({ modulePath, reason: "missing-exports" })
        } catch (error) {
          attempts.push({ modulePath, reason: error && error.message ? error.message : String(error) })
        }
      }
      return { ok: false, reason: "common-module-unavailable", attempts }
    }
    function request(options) {
      return new Promise((resolve, reject) => wx.request(Object.assign({}, options, { enableCookie: true, success: resolve, fail: reject })))
    }
    function toAbsoluteUrl(pathname) { return apiBaseUrl.replace(/\/$/, "") + pathname }
    return (async function () {
      const login = await request({ url: toAbsoluteUrl("/api/auth/wechat/login-with-test"), method: "POST", header: { "content-type": "application/json" }, data: { code: loginCode, testAnswers: [] } })
      const runtimeCookieHeader = getCapturedCookieHeader(login)
      if (runtimeCookieHeader) globalThis.__JOYJOIN_MINI_RUNTIME_COOKIE_HEADER__ = runtimeCookieHeader
      const authUser = await request({ url: toAbsoluteUrl("/api/auth/user"), method: "GET", header: { "content-type": "application/json" } })
      let authSeed = { ok: false, modulePath: null, reason: "auth-user-not-seeded" }
      if (authUser && authUser.statusCode >= 200 && authUser.statusCode < 300) {
        const runtimeCommon = loadRuntimeCommonModule()
        if (runtimeCommon.ok) {
          try {
            runtimeCommon.moduleExports.seedMiniProgramAuthSession(authUser.data, runtimeCommon.moduleExports.queryClient)
            authSeed = { ok: true, modulePath: runtimeCommon.modulePath }
          } catch (error) {
            authSeed = { ok: false, modulePath: runtimeCommon.modulePath, reason: error && error.message ? error.message : String(error) }
          }
        } else {
          authSeed = { ok: false, modulePath: null, reason: runtimeCommon.reason, attempts: runtimeCommon.attempts }
        }
      }
      const registrations = await request({ url: toAbsoluteUrl("/api/my-pool-registrations"), method: "GET", header: { "content-type": "application/json" } })
      const items = Array.isArray(registrations.data) ? registrations.data : []
      const pending = items.find((item) => item && item.matchStatus === "pending") || null
      const matched = items.find((item) => item && item.matchStatus === "matched" && item.assignedGroupId) || null
      return {
        login: { statusCode: login.statusCode, body: login.data, cookieHeader: runtimeCookieHeader || null },
        authUser: { statusCode: authUser.statusCode, body: authUser.data },
        authSeed,
        registrations: { statusCode: registrations.statusCode, count: items.length, pendingRegistrationId: pending && pending.id, matchedRegistrationId: matched && matched.id, matchedGroupId: matched && matched.assignedGroupId },
      }
    })()
  }, CONFIG.apiBaseUrl, CONFIG.loginCode)
}
async function launchMiniProgram() {
  return automator.launch({ cliPath: CONFIG.cliPath, projectPath: CONFIG.projectPath, timeout: CONFIG.launchTimeoutMs })
}
function normalizeOptionalString(value) {
  if (typeof value === "string") return value.trim()
  if (value == null) return ""
  return String(value).trim()
}
function parseCliArgs(argv) {
  const positional = []
  const named = {}
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith("--")) {
      positional.push(current)
      continue
    }
    const trimmed = current.slice(2)
    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex >= 0) {
      named[trimmed.slice(0, equalsIndex)] = trimmed.slice(equalsIndex + 1)
      continue
    }
    const next = argv[index + 1]
    if (next && !next.startsWith("--")) {
      named[trimmed] = next
      index += 1
      continue
    }
    named[trimmed] = ""
  }
  return {
    outputPath: normalizeOptionalString(named.outputPath || positional[0]),
    pendingRegistrationId: normalizeOptionalString(named.pendingRegistrationId || positional[1]),
    matchedRegistrationId: normalizeOptionalString(named.matchedRegistrationId || positional[2]),
    groupId: normalizeOptionalString(named.groupId || positional[3]),
  }
}
function persistResult(outputPath, payload) {
  const normalizedOutputPath = normalizeOptionalString(outputPath)
  if (normalizedOutputPath) {
    const resolvedOutputPath = path.resolve(normalizedOutputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(resolvedOutputPath, JSON.stringify(payload, null, 2))
  }
  console.log(JSON.stringify(payload, null, 2))
}
function buildMatchingStatusRoute(registrationId) {
  return "/pages/matching-status/index?registrationId=" + encodeURIComponent(registrationId)
}
function buildSquadUnboxingRoute(groupId) {
  return "/pages/squad-unboxing/index?groupId=" + encodeURIComponent(groupId)
}
function requireValue(label, value) {
  const normalized = normalizeOptionalString(value)
  if (!normalized) throw new Error(label + " is required via CLI args or discovered registrations.")
  return normalized
}
async function waitForLaunchReady(miniProgram) {
  return waitFor("mini-program launch", async () => {
    const page = await miniProgram.currentPage()
    return page || null
  }, CONFIG.launchTimeoutMs)
}
async function waitForRouteSelectors(miniProgram, route, selectors, label, timeoutMs = CONFIG.readyTimeoutMs) {
  const expectedPath = routePathOnly(route)
  let lastRoute = null
  let lastFound = {}
  try {
    return await waitFor(label, async () => {
      const page = await miniProgram.currentPage()
      if (!page) return null
      lastRoute = page.path
      if (page.path === "pages/login/index") throw new Error(label + " redirected to pages/login/index")
      if (page.path !== expectedPath) return null
      const found = await collectSelectorState(page, selectors)
      lastFound = found
      const missing = selectors.filter((selector) => !found[selector])
      return missing.length === 0 ? { page, found } : null
    }, timeoutMs)
  } catch (error) {
    throw new Error(label + " failed on route " + (lastRoute || "<none>") + " with selector state " + JSON.stringify(lastFound) + ": " + formatError(error))
  }
}
const CLI_ARGS = parseCliArgs(process.argv.slice(2))
async function run() {
  const result = {
    ok: true,
    startedAt: nowIso(),
    finishedAt: null,
    config: {
      cliPath: CONFIG.cliPath,
      projectPath: CONFIG.projectPath,
      apiBaseUrl: CONFIG.apiBaseUrl,
      loginCode: CONFIG.loginCode,
    },
    args: CLI_ARGS,
    resolvedIds: null,
    checks: [],
    errors: [],
  }
  let miniProgram = null
  try {
    const devToolsLogin = readDevToolsLoginState()
    result.checks.push({
      name: "devtools-cli-login",
      ok: devToolsLogin.ok,
      blocked: devToolsLogin.blocked,
      exitCode: devToolsLogin.exitCode,
      rawOutput: devToolsLogin.rawOutput || null,
    })
    if (!devToolsLogin.ok) throw new Error(devToolsLogin.message || "WeChat DevTools CLI login verification failed.")
    miniProgram = await launchMiniProgram()
    const launchedPage = await waitForLaunchReady(miniProgram)
    result.checks.push({ name: "launch-mini-program", route: launchedPage.path })
    await miniProgram.callWxMethod("clearStorageSync")
    const rewrite = await installRuntimeApiRewrite(miniProgram)
    result.checks.push({ name: "install-api-rewrite", rewrite })
    if (!(rewrite && rewrite.ok)) throw new Error("Runtime API rewrite failed: " + JSON.stringify(rewrite))
    const authSummary = await loginAndSeedAuth(miniProgram)
    result.checks.push({
      name: "login-with-test-code",
      loginStatusCode: authSummary.login && authSummary.login.statusCode,
      authUserStatusCode: authSummary.authUser && authSummary.authUser.statusCode,
      registrationStatusCode: authSummary.registrations && authSummary.registrations.statusCode,
      registrationCount: authSummary.registrations && authSummary.registrations.count,
      discovered: {
        pendingRegistrationId: authSummary.registrations && authSummary.registrations.pendingRegistrationId || null,
        matchedRegistrationId: authSummary.registrations && authSummary.registrations.matchedRegistrationId || null,
        groupId: authSummary.registrations && authSummary.registrations.matchedGroupId || null,
      },
    })
    if (!authSummary.login || authSummary.login.statusCode < 200 || authSummary.login.statusCode >= 300) throw new Error("Test login failed with status " + (authSummary.login && authSummary.login.statusCode))
    if (!authSummary.authUser || authSummary.authUser.statusCode < 200 || authSummary.authUser.statusCode >= 300) throw new Error("Auth user fetch failed with status " + (authSummary.authUser && authSummary.authUser.statusCode))
    if (!authSummary.registrations || authSummary.registrations.statusCode < 200 || authSummary.registrations.statusCode >= 300) throw new Error("Pool registrations fetch failed with status " + (authSummary.registrations && authSummary.registrations.statusCode))
    const resolvedIds = {
      pendingRegistrationId: normalizeOptionalString(CLI_ARGS.pendingRegistrationId) || normalizeOptionalString(authSummary.registrations.pendingRegistrationId),
      matchedRegistrationId: normalizeOptionalString(CLI_ARGS.matchedRegistrationId) || normalizeOptionalString(authSummary.registrations.matchedRegistrationId),
      groupId: normalizeOptionalString(CLI_ARGS.groupId) || normalizeOptionalString(authSummary.registrations.matchedGroupId),
    }
    requireValue("outputPath", CLI_ARGS.outputPath)
    requireValue("pendingRegistrationId", resolvedIds.pendingRegistrationId)
    requireValue("matchedRegistrationId", resolvedIds.matchedRegistrationId)
    requireValue("groupId", resolvedIds.groupId)
    result.resolvedIds = resolvedIds
    const pendingRoute = buildMatchingStatusRoute(resolvedIds.pendingRegistrationId)
    await miniProgram.callWxMethod("reLaunch", { url: pendingRoute })
    const pendingState = await waitForRouteSelectors(miniProgram, pendingRoute, SELECTORS.pending, "pending matching-status selectors")
    result.checks.push({ name: "matching-status-pending", route: pendingState.page.path, url: pendingRoute, selectors: pendingState.found })
    const matchedRoute = buildMatchingStatusRoute(resolvedIds.matchedRegistrationId)
    await miniProgram.callWxMethod("reLaunch", { url: matchedRoute })
    const matchedState = await waitForRouteSelectors(miniProgram, matchedRoute, SELECTORS.matched, "matched matching-status selectors")
    result.checks.push({ name: "matching-status-matched", route: matchedState.page.path, url: matchedRoute, selectors: matchedState.found })
    const squadUnboxingRoute = buildSquadUnboxingRoute(resolvedIds.groupId)
    await miniProgram.callWxMethod("reLaunch", { url: squadUnboxingRoute })
    const revealReadyState = await waitForRouteSelectors(miniProgram, squadUnboxingRoute, SELECTORS.revealReady, "squad-unboxing ready selectors")
    result.checks.push({ name: "squad-unboxing-ready", route: revealReadyState.page.path, url: squadUnboxingRoute, selectors: revealReadyState.found })
    const openButton = await revealReadyState.page.$(".squad-unboxing__open-btn")
    if (!openButton) throw new Error("Squad unboxing open button not found.")
    await openButton.tap()
    result.checks.push({ name: "squad-unboxing-open-button-tapped", route: revealReadyState.page.path })
    const revealDoneState = await waitForRouteSelectors(miniProgram, squadUnboxingRoute, SELECTORS.revealDone, "squad-unboxing reveal selectors", Math.max(CONFIG.readyTimeoutMs, 12000))
    result.checks.push({ name: "squad-unboxing-revealed", route: revealDoneState.page.path, url: squadUnboxingRoute, selectors: revealDoneState.found })
  } catch (error) {
    result.ok = false
    result.errors.push(formatError(error))
  } finally {
    result.finishedAt = nowIso()
    if (miniProgram) {
      try {
        await miniProgram.close()
      } catch (closeError) {
        result.errors.push("close-error: " + formatError(closeError))
      }
    }
    persistResult(CLI_ARGS.outputPath, result)
  }
  if (!result.ok) process.exitCode = 1
}
run().catch((error) => {
  const payload = {
    ok: false,
    startedAt: nowIso(),
    finishedAt: nowIso(),
    fatalError: formatError(error),
  }
  persistResult(CLI_ARGS.outputPath, payload)
  process.exit(1)
})

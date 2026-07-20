#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CLI_PATH="${CLI_PATH:-/Applications/wechatwebdevtools.app/Contents/MacOS/cli}"
PROJECT_PATH="${PROJECT_PATH:-$REPO_ROOT/apps/mini-program/dist}"
SAMPLES="${SAMPLES:-5}"
PRELOAD_SETTLE_MS="${PRELOAD_SETTLE_MS:-1500}"
LAUNCH_TIMEOUT_MS="${LAUNCH_TIMEOUT_MS:-45000}"
LAUNCH_RETRY_COUNT="${LAUNCH_RETRY_COUNT:-2}"
LAUNCH_RETRY_DELAY_MS="${LAUNCH_RETRY_DELAY_MS:-1500}"
READY_TIMEOUT_MS="${READY_TIMEOUT_MS:-15000}"
POLL_INTERVAL_MS="${POLL_INTERVAL_MS:-100}"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

require_non_negative_integer() {
  local value="$1"
  local name="$2"

  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    fail "$name must be a non-negative integer."
  fi
}

require_positive_integer() {
  local value="$1"
  local name="$2"

  require_non_negative_integer "$value" "$name"

  if [[ "$value" -le 0 ]]; then
    fail "$name must be greater than 0."
  fi
}

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is required to run this probe."
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is required to install miniprogram-automator in a temporary workspace."
fi

require_positive_integer "$SAMPLES" "SAMPLES"
require_non_negative_integer "$PRELOAD_SETTLE_MS" "PRELOAD_SETTLE_MS"
require_positive_integer "$LAUNCH_TIMEOUT_MS" "LAUNCH_TIMEOUT_MS"
require_non_negative_integer "$LAUNCH_RETRY_COUNT" "LAUNCH_RETRY_COUNT"
require_non_negative_integer "$LAUNCH_RETRY_DELAY_MS" "LAUNCH_RETRY_DELAY_MS"
require_positive_integer "$READY_TIMEOUT_MS" "READY_TIMEOUT_MS"
require_positive_integer "$POLL_INTERVAL_MS" "POLL_INTERVAL_MS"

if [[ ! -x "$CLI_PATH" ]]; then
  fail "WeChat DevTools CLI was not found at $CLI_PATH. Set CLI_PATH to override the default."
fi

if [[ ! -f "$PROJECT_PATH/app.json" ]]; then
  fail "Mini-program dist is missing $PROJECT_PATH/app.json. Build apps/mini-program first."
fi

if [[ ! -f "$PROJECT_PATH/project.config.json" ]]; then
  fail "Mini-program dist is missing $PROJECT_PATH/project.config.json. Build apps/mini-program first."
fi

login_output="$("$CLI_PATH" islogin 2>&1 || true)"

if [[ "$login_output" == *'"login":false'* ]]; then
  printf '%s\n' "WeChat DevTools CLI is not logged in. Open WeChat DevTools, sign in interactively, then rerun this probe. Real timing samples remain blocked until login=true." >&2
  exit 2
fi

if [[ "$login_output" != *'"login":true'* ]]; then
  fail "Unable to determine WeChat DevTools login state from CLI output: $login_output"
fi

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/joyjoin-mini-program-probe.XXXXXX")"

cleanup() {
  rm -rf "$temp_dir"
}

trap cleanup EXIT INT TERM

cat > "$temp_dir/package.json" <<'EOF'
{
  "name": "joyjoin-mini-program-cold-entry-probe",
  "private": true
}
EOF

printf '%s\n' "Installing miniprogram-automator in temporary workspace $temp_dir ..." >&2

(
  cd "$temp_dir"
  npm install --silent --no-audit --no-fund --no-progress miniprogram-automator >/dev/null
)

cat > "$temp_dir/benchmark.js" <<'EOF'
const { performance } = require('node:perf_hooks')
const automator = require('miniprogram-automator')

function parseInteger(name, { minimum = 0, allowZero = true } = {}) {
  const rawValue = process.env[name]
  const parsedValue = Number.parseInt(rawValue || '', 10)

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`${name} must be an integer.`)
  }

  if (parsedValue < minimum) {
    throw new Error(`${name} must be >= ${minimum}.`)
  }

  if (!allowZero && parsedValue === 0) {
    throw new Error(`${name} must be greater than 0.`)
  }

  return parsedValue
}

const config = {
  cliPath: process.env.CLI_PATH,
  projectPath: process.env.PROJECT_PATH,
  samples: parseInteger('SAMPLES', { minimum: 1, allowZero: false }),
  preloadSettleMs: parseInteger('PRELOAD_SETTLE_MS'),
  launchTimeoutMs: parseInteger('LAUNCH_TIMEOUT_MS', { minimum: 1, allowZero: false }),
  launchRetryCount: parseInteger('LAUNCH_RETRY_COUNT'),
  launchRetryDelayMs: parseInteger('LAUNCH_RETRY_DELAY_MS'),
  readyTimeoutMs: parseInteger('READY_TIMEOUT_MS', { minimum: 1, allowZero: false }),
  pollIntervalMs: parseInteger('POLL_INTERVAL_MS', { minimum: 1, allowZero: false }),
}

const routes = {
  landing: '/pages/index/index',
  login: '/pages/login/index',
  personality: '/subpackages/onboarding/personality-test/index',
}

const selectors = {
  landingReady: '.landing-page__legal-checkbox',
  landingPrimaryCta: '.landing-page__cta--primary',
  landingCheckedClass: 'landing-page__legal-checkbox--checked',
  loginReady: '.login-page__wechat-btn',
  personalityReady: '.personality-test__start-btn',
}

function normalizeRoute(route) {
  return route.replace(/^\//, '')
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function roundMilliseconds(value) {
  return Number(value.toFixed(1))
}

function elapsedMilliseconds(startedAt) {
  return roundMilliseconds(performance.now() - startedAt)
}

function formatError(error) {
  return error && error.stack ? error.stack : String(error)
}

async function waitFor(label, timeoutMs, predicate) {
  const startedAt = performance.now()

  while (performance.now() - startedAt <= timeoutMs) {
    const result = await predicate()
    if (result) {
      return result
    }

    await sleep(config.pollIntervalMs)
  }

  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms.`)
}

async function waitForElementOnRoute(miniProgram, route, selector, label) {
  const normalizedRoute = normalizeRoute(route)

  return waitFor(label, config.readyTimeoutMs, async () => {
    const page = await miniProgram.currentPage()

    if (!page || page.path !== normalizedRoute) {
      return null
    }

    const element = await page.$(selector)
    if (!element) {
      return null
    }

    return { page, element }
  })
}

async function waitForCheckedLandingState(miniProgram, label) {
  const normalizedRoute = normalizeRoute(routes.landing)

  return waitFor(label, config.readyTimeoutMs, async () => {
    const page = await miniProgram.currentPage()

    if (!page || page.path !== normalizedRoute) {
      return null
    }

    const checkbox = await page.$(selectors.landingReady)
    if (!checkbox) {
      return null
    }

    const className = await checkbox.attribute('class')
    if (typeof className !== 'string' || !className.includes(selectors.landingCheckedClass)) {
      return null
    }

    return { page, checkbox }
  })
}

async function clearStorage(miniProgram) {
  await miniProgram.callWxMethod('clearStorageSync')
}

async function reLaunch(miniProgram, url) {
  await miniProgram.callWxMethod('reLaunch', { url })
}

async function navigateTo(miniProgram, url) {
  await miniProgram.callWxMethod('navigateTo', { url })
}

async function safeClose(miniProgram) {
  if (!miniProgram) {
    return
  }

  try {
    await miniProgram.close()
  } catch (_error) {
    // Ignore close errors so the original benchmark failure is preserved.
  }
}

async function launchMiniProgramWithRetry(sampleIndex, flowLabel) {
  const totalAttempts = config.launchRetryCount + 1
  let lastError

  for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber += 1) {
    const launchStartedAt = performance.now()

    try {
      const miniProgram = await automator.launch({
        cliPath: config.cliPath,
        projectPath: config.projectPath,
        timeout: config.launchTimeoutMs,
      })

      return { miniProgram, launchStartedAt }
    } catch (error) {
      lastError = error

      if (attemptNumber >= totalAttempts) {
        break
      }

      const retryDelayMs = config.launchRetryDelayMs * attemptNumber
      const failureMessage = error && error.message ? error.message : String(error)

      process.stderr.write(
        `[measure-mini-program-cold-entry] ${flowLabel} sample ${sampleIndex}: automator.launch attempt ${attemptNumber}/${totalAttempts} failed: ${failureMessage}. Retrying in ${retryDelayMs}ms.\n`,
      )

      if (retryDelayMs > 0) {
        await sleep(retryDelayMs)
      }
    }
  }

  throw new Error(
    `${flowLabel} sample ${sampleIndex} failed to launch after ${totalAttempts} attempt(s).\n${formatError(lastError)}`,
  )
}

async function runLandingFlow(sampleIndex) {
  let miniProgram
  let launchStartedAt

  try {
    const launched = await launchMiniProgramWithRetry(sampleIndex, 'landing')
    miniProgram = launched.miniProgram
    launchStartedAt = launched.launchStartedAt

    await clearStorage(miniProgram)
    await reLaunch(miniProgram, routes.landing)
    await waitForElementOnRoute(
      miniProgram,
      routes.landing,
      selectors.landingReady,
      `sample ${sampleIndex} landing page ready`,
    )

    const coldLaunchToLandingReadyMs = elapsedMilliseconds(launchStartedAt)

    await sleep(config.preloadSettleMs)

    const { element: checkbox } = await waitForElementOnRoute(
      miniProgram,
      routes.landing,
      selectors.landingReady,
      `sample ${sampleIndex} landing legal checkbox`,
    )

    await checkbox.tap()

    await waitForCheckedLandingState(
      miniProgram,
      `sample ${sampleIndex} landing legal checkbox checked`,
    )

    const { element: primaryCta } = await waitForElementOnRoute(
      miniProgram,
      routes.landing,
      selectors.landingPrimaryCta,
      `sample ${sampleIndex} landing primary CTA`,
    )

    const navigationStartedAt = performance.now()
    await primaryCta.tap()

    await waitForElementOnRoute(
      miniProgram,
      routes.personality,
      selectors.personalityReady,
      `sample ${sampleIndex} personality test ready from landing`,
    )

    return {
      coldLaunchToLandingReadyMs,
      landingToPersonalityTestReadyMs: elapsedMilliseconds(navigationStartedAt),
    }
  } finally {
    await safeClose(miniProgram)
  }
}

async function runLoginFlow(sampleIndex) {
  let miniProgram
  let launchStartedAt

  try {
    const launched = await launchMiniProgramWithRetry(sampleIndex, 'login')
    miniProgram = launched.miniProgram
    launchStartedAt = launched.launchStartedAt

    await clearStorage(miniProgram)
    await reLaunch(miniProgram, routes.login)
    await waitForElementOnRoute(
      miniProgram,
      routes.login,
      selectors.loginReady,
      `sample ${sampleIndex} login page ready`,
    )

    const coldLaunchToLoginReadyMs = elapsedMilliseconds(launchStartedAt)

    await sleep(config.preloadSettleMs)

    const navigationStartedAt = performance.now()
    await navigateTo(miniProgram, routes.personality)

    await waitForElementOnRoute(
      miniProgram,
      routes.personality,
      selectors.personalityReady,
      `sample ${sampleIndex} personality test ready from login preload proxy`,
    )

    return {
      coldLaunchToLoginReadyMs,
      loginEntryToPersonalityTestReadyMsPreloadProxy: elapsedMilliseconds(navigationStartedAt),
    }
  } finally {
    await safeClose(miniProgram)
  }
}

function summarize(values) {
  const sortedValues = [...values].sort((left, right) => left - right)
  const middleIndex = Math.floor(sortedValues.length / 2)
  const medianValue =
    sortedValues.length % 2 === 0
      ? (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
      : sortedValues[middleIndex]

  const averageValue =
    values.reduce((total, currentValue) => total + currentValue, 0) / values.length

  return {
    min: roundMilliseconds(sortedValues[0]),
    median: roundMilliseconds(medianValue),
    avg: roundMilliseconds(averageValue),
    max: roundMilliseconds(sortedValues[sortedValues.length - 1]),
  }
}

async function main() {
  const samples = []

  for (let sampleIndex = 1; sampleIndex <= config.samples; sampleIndex += 1) {
    const landingMetrics = await runLandingFlow(sampleIndex)
    const loginMetrics = await runLoginFlow(sampleIndex)

    samples.push({
      sample: sampleIndex,
      ...landingMetrics,
      ...loginMetrics,
    })
  }

  const metricKeys = [
    'coldLaunchToLandingReadyMs',
    'landingToPersonalityTestReadyMs',
    'coldLaunchToLoginReadyMs',
    'loginEntryToPersonalityTestReadyMsPreloadProxy',
  ]

  const summary = Object.fromEntries(
    metricKeys.map((metricKey) => [
      metricKey,
      summarize(samples.map((sample) => sample[metricKey])),
    ]),
  )

  const report = {
    generatedAt: new Date().toISOString(),
    tool: 'measure-mini-program-cold-entry',
    environment: {
      cliPath: config.cliPath,
      projectPath: config.projectPath,
      samples: config.samples,
      preloadSettleMs: config.preloadSettleMs,
      launchTimeoutMs: config.launchTimeoutMs,
      readyTimeoutMs: config.readyTimeoutMs,
      pollIntervalMs: config.pollIntervalMs,
    },
    measurementNotes: [
      'coldLaunchTo* metrics run from automator.launch through a storage reset plus normalized entry route becoming ready.',
      `landingToPersonalityTestReadyMs waits ${config.preloadSettleMs}ms on the landing page before tapping the legal checkbox and primary CTA.`,
      `loginEntryToPersonalityTestReadyMsPreloadProxy waits ${config.preloadSettleMs}ms on the login page, then navigates directly to the personality test without executing WeChat login. This is a preload proxy, not a full auth benchmark.`,
    ],
    samples,
    summary,
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main().catch((error) => {
  const message = error && error.stack ? error.stack : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
EOF

printf '%s\n' "Running cold-entry probe with $SAMPLES sample(s) ..." >&2

CLI_PATH="$CLI_PATH" \
PROJECT_PATH="$PROJECT_PATH" \
SAMPLES="$SAMPLES" \
PRELOAD_SETTLE_MS="$PRELOAD_SETTLE_MS" \
LAUNCH_TIMEOUT_MS="$LAUNCH_TIMEOUT_MS" \
LAUNCH_RETRY_COUNT="$LAUNCH_RETRY_COUNT" \
LAUNCH_RETRY_DELAY_MS="$LAUNCH_RETRY_DELAY_MS" \
READY_TIMEOUT_MS="$READY_TIMEOUT_MS" \
POLL_INTERVAL_MS="$POLL_INTERVAL_MS" \
node "$temp_dir/benchmark.js"
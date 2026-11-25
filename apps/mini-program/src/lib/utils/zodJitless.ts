import { z } from 'zod'

/**
 * Disable zod's JIT parser before any schema is constructed.
 *
 * WeChat's appservice stubs dynamic code generation: `new Function('')` returns
 * a NON-CALLABLE object instead of throwing. zod v4's `allowsEval` probe only
 * checks whether the probe throws, so it concludes JIT is available and builds
 * `$ZodObjectJIT` schemas through `Doc.compile()`, whose factory call becomes
 * `factory(...Object.values(this.closed))`. On device that surfaces as
 * `TypeError: t is not a function` / `Function.prototype.apply was called on
 * [object Object]` the first time any `z.object(...).safeParse()` runs — which
 * killed analytics, aborted the events page's effect chain, and left taps dead
 * on the profile page (2026-11-25 report).
 *
 * `fastEnabled` is captured per schema at construction time, so this MUST run
 * before the first `z.object(...)` anywhere in the app. `app.ts` imports this
 * module first for exactly that reason; analytics modules import it too so they
 * stay safe when loaded in isolation (tests, tooling).
 */
z.config({ jitless: true })

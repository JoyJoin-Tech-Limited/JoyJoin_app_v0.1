import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FLASH_STORY_SEASON_UNITS, type FlashStoryUnitDefinition } from '../../packages/shared/src/alang/flashStorySeason.js'
import {
  createStoryUnitState,
  reconcileStoryUnitState,
  restoreStoryUnitState,
  storyUnitReducer,
  type StoryUnitChoice,
  type StoryUnitQuestionSnapshot,
  type StoryUnitState,
} from '../../packages/shared/src/alang/flashStoryUnitRuntime.js'

export const DEFAULT_FLASH_SIM_SEED = 'flash-sim-v3:2026-08-10'
export const FLASH_SIM_SCENARIOS = [
  'reducer_invalid_transition_noop',
  'reducer_first_mistake',
  'restore_interaction_checkpoint',
  'restore_solved_checkpoint',
  'restore_invalid_version_reset',
  'reconcile_reviewed_label',
] as const

type Scenario = (typeof FLASH_SIM_SCENARIOS)[number]
type Operation = 'reducer' | 'restore' | 'reconcile'

export interface FlashSimulationBranchEvidence {
  operation: Operation
  beforeStage: string
  afterStage: string
  beforeCompanionEvent: string
  afterCompanionEvent: string
  optionIdPreserved: boolean
  labelUpdated: boolean
}

export interface FlashSimulationTrace {
  virtualUser: string
  unitId: string
  scenario: Scenario
  optionId: string
  terminalStage: string
  payloadStable: boolean
  branchEvidence: FlashSimulationBranchEvidence
}

export interface FlashSimulationSummary {
  seed: string
  users: number
  attemptedUnits: number
  completedClientJourneys: number
  clientDeadEnds: number
  payloadIntegrityChecks: number
  runtimeLlmCallSites: number
  scenarioCoverage: Record<Scenario, number>
  choiceCoverage: Record<string, Record<string, number>>
  npcCompletion: Record<string, number>
  phaseCompletion: Record<string, number>
  unitCompletion: Record<string, number>
  seasonReachabilityProxy: number
  digest: string
}

export interface FlashSimulationResult {
  summary: FlashSimulationSummary
  traces: FlashSimulationTrace[]
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message)
}
const hashNumber = (seed: string): number => createHash('sha256').update(seed).digest().readUInt32BE(0) / 0xffffffff
const shuffled = <T>(values: readonly T[], seed: string): T[] => [...values]
  .map((value, index) => ({ value, key: hashNumber(`${seed}:${index}`) }))
  .sort((left, right) => left.key - right.key)
  .map(({ value }) => value)
const increment = (record: Record<string, number>, key: string) => { record[key] = (record[key] ?? 0) + 1 }

const questionFor = (unit: FlashStoryUnitDefinition): StoryUnitQuestionSnapshot => ({
  id: `${unit.unitId}-response-v2`,
  options: [
    { id: `${unit.unitId}-cooperate-a`, label: `${unit.goal}（回应 A）` },
    { id: `${unit.unitId}-cooperate-b`, label: `${unit.goal}（回应 B）` },
  ],
})

const serializeRestore = (unit: FlashStoryUnitDefinition, state: StoryUnitState): StoryUnitState =>
  restoreStoryUnitState(unit.unitId, JSON.parse(JSON.stringify(state)) as unknown)

const enterInteraction = (unit: FlashStoryUnitDefinition, choice: StoryUnitChoice): StoryUnitState => {
  let state = storyUnitReducer(createStoryUnitState(unit.unitId), { type: 'ENTER' })
  state = storyUnitReducer(state, { type: 'START_INTERACTION', choice })
  assert(state.stage === 'OBJECT_INTERACTION', `${unit.unitId} did not enter interaction`)
  return state
}

const finish = (state: StoryUnitState): StoryUnitState => {
  let next = state
  if (next.stage === 'INIT') next = storyUnitReducer(next, { type: 'ENTER' })
  if (next.stage === 'NPC_INTRO') throw new Error('choice must be replayed before finish')
  if (next.stage === 'OBJECT_INTERACTION') next = storyUnitReducer(next, { type: 'OBJECT_ALIGNED' })
  if (next.stage === 'OBJECT_SUCCESS') next = storyUnitReducer(next, { type: 'RESPONSE_RECEIVED' })
  if (next.stage === 'NPC_RESPONSE') next = storyUnitReducer(next, { type: 'COMPLETE' })
  return next
}

function exerciseScenario(input: {
  unit: FlashStoryUnitDefinition
  scenario: Scenario
  choice: StoryUnitChoice
  question: StoryUnitQuestionSnapshot
}): { terminal: StoryUnitState; evidence: FlashSimulationBranchEvidence } {
  const { unit, scenario, choice, question } = input
  let state: StoryUnitState
  let before: StoryUnitState
  let after: StoryUnitState
  let operation: Operation
  let labelUpdated = false

  if (scenario === 'reducer_invalid_transition_noop') {
    before = createStoryUnitState(unit.unitId)
    after = storyUnitReducer(before, { type: 'OBJECT_ALIGNED' })
    operation = 'reducer'
    state = enterInteraction(unit, choice)
  } else {
    state = enterInteraction(unit, choice)
    if (scenario === 'reducer_first_mistake') {
      before = state
      after = storyUnitReducer(before, { type: 'FIRST_MISTAKE' })
      operation = 'reducer'
      state = after
    } else if (scenario === 'restore_interaction_checkpoint') {
      before = state
      after = serializeRestore(unit, before)
      operation = 'restore'
      state = reconcileStoryUnitState(unit.unitId, after, question)
    } else {
      state = storyUnitReducer(state, { type: 'OBJECT_ALIGNED' })
      before = state
      if (scenario === 'restore_solved_checkpoint') {
        after = serializeRestore(unit, before)
        operation = 'restore'
        state = reconcileStoryUnitState(unit.unitId, after, question)
      } else if (scenario === 'restore_invalid_version_reset') {
        after = restoreStoryUnitState(unit.unitId, { ...before, version: -1 })
        operation = 'restore'
        state = enterInteraction(unit, choice)
      } else {
        const changedQuestion = {
          ...question,
          options: question.options.map((option) => option.id === choice.optionId
            ? { ...option, label: `${option.label}（已复核）` }
            : option),
        }
        after = reconcileStoryUnitState(unit.unitId, before, changedQuestion)
        operation = 'reconcile'
        labelUpdated = after.choice?.label !== before.choice?.label
        state = after
      }
    }
  }

  const evidence: FlashSimulationBranchEvidence = {
    operation,
    beforeStage: before.stage,
    afterStage: after.stage,
    beforeCompanionEvent: before.companionEvent,
    afterCompanionEvent: after.companionEvent,
    optionIdPreserved: before.choice?.optionId === after.choice?.optionId,
    labelUpdated,
  }
  return { terminal: finish(state), evidence }
}

const countFormalRuntimeLlmCallSites = (): number => {
  const source = readFileSync(resolve(repoRoot, 'apps/server/src/services/flashService.ts'), 'utf8')
  return [...source.matchAll(/generateFlashPersonalizedResponse\s*\(/g)].length
}

export const runFlashStorySimulation = (seed = DEFAULT_FLASH_SIM_SEED, userCount = 100): FlashSimulationResult => {
  const scenarioCoverage = Object.fromEntries(FLASH_SIM_SCENARIOS.map((scenario) => [scenario, 0])) as Record<Scenario, number>
  const choiceCoverage: Record<string, Record<string, number>> = {}
  const npcCompletion: Record<string, number> = {}
  const phaseCompletion: Record<string, number> = {}
  const unitCompletion: Record<string, number> = {}
  const traces: FlashSimulationTrace[] = []
  let attemptedUnits = 0
  let completedClientJourneys = 0
  let clientDeadEnds = 0
  let payloadIntegrityChecks = 0
  let usersReachingSeasonEnd = 0

  for (let userIndex = 0; userIndex < userCount; userIndex += 1) {
    let completedForUser = 0
    for (const phase of [1, 2, 3] as const) {
      const units = shuffled(FLASH_STORY_SEASON_UNITS.filter((unit) => unit.phase === phase), `${seed}:${userIndex}:${phase}`)
      for (const unit of units) {
        const scenario = FLASH_SIM_SCENARIOS[attemptedUnits % FLASH_SIM_SCENARIOS.length]
        const question = questionFor(unit)
        const option = question.options[(userIndex + unit.phase + unit.npcSlug.length) % question.options.length]
        const choice = { questionId: question.id, optionId: option.id, label: option.label }
        attemptedUnits += 1
        scenarioCoverage[scenario] += 1
        choiceCoverage[unit.unitId] ??= {}
        increment(choiceCoverage[unit.unitId], option.id)

        const { terminal, evidence } = exerciseScenario({ unit, scenario, choice, question })
        const payloadStable = terminal.choice?.questionId === choice.questionId && terminal.choice?.optionId === choice.optionId
        const trace: FlashSimulationTrace = {
          virtualUser: `virtual-${String(userIndex + 1).padStart(3, '0')}`,
          unitId: unit.unitId,
          scenario,
          optionId: choice.optionId,
          terminalStage: terminal.stage,
          payloadStable,
          branchEvidence: evidence,
        }
        traces.push(trace)
        if (!payloadStable || terminal.stage !== 'COMPLETED') {
          clientDeadEnds += 1
          continue
        }
        payloadIntegrityChecks += 1
        completedClientJourneys += 1
        completedForUser += 1
        increment(npcCompletion, unit.npcSlug)
        increment(phaseCompletion, String(unit.phase))
        increment(unitCompletion, unit.unitId)
      }
    }
    if (completedForUser === FLASH_STORY_SEASON_UNITS.length) usersReachingSeasonEnd += 1
  }

  const stable = {
    seed,
    users: userCount,
    attemptedUnits,
    completedClientJourneys,
    clientDeadEnds,
    payloadIntegrityChecks,
    runtimeLlmCallSites: countFormalRuntimeLlmCallSites(),
    scenarioCoverage,
    choiceCoverage,
    npcCompletion,
    phaseCompletion,
    unitCompletion,
    seasonReachabilityProxy: userCount === 0 ? 0 : usersReachingSeasonEnd / userCount,
  }
  return { summary: { ...stable, digest: createHash('sha256').update(JSON.stringify(stable)).digest('hex') }, traces }
}

const writeArtifacts = (result: FlashSimulationResult) => {
  const outputDir = resolve(repoRoot, 'artifacts/flash-sim')
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(resolve(outputDir, 'summary.json'), `${JSON.stringify(result.summary, null, 2)}\n`)
  writeFileSync(resolve(outputDir, 'traces.ndjson'), `${result.traces.map((trace) => JSON.stringify(trace)).join('\n')}\n`)
  writeFileSync(resolve(outputDir, 'report.md'), `# 街头盲盒第一季确定性客户端仿真\n\n- seed: \`${result.summary.seed}\`\n- 虚拟用户: ${result.summary.users}\n- 生产 reducer/restore 完成: ${result.summary.completedClientJourneys}/${result.summary.attemptedUnits}\n- 客户端死路: ${result.summary.clientDeadEnds}\n- 原载荷实测: ${result.summary.payloadIntegrityChecks}\n- 正式 Flash 服务运行时 LLM 调用点（静态扫描）: ${result.summary.runtimeLlmCallSites}\n\n> 这项结果验证客户端可恢复性，不代表真人趣味评分。服务端 exactly-once、并发和用户隔离由独立临时 PostgreSQL 门验证。\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runFlashStorySimulation()
  writeArtifacts(result)
  console.log(JSON.stringify(result.summary, null, 2))
}

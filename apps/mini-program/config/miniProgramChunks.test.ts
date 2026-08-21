import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { miniProgramManualChunks } from './miniProgramChunks'

type ModuleRecord = {
  importers?: string[]
  dynamicImporters?: string[]
  isEntry?: boolean
}

function graph(records: Record<string, ModuleRecord>) {
  return {
    getModuleInfo(id: string) {
      const record = records[id]
      return record
        ? {
            importers: record.importers ?? [],
            dynamicImporters: record.dynamicImporters ?? [],
            isEntry: record.isEntry ?? false,
          }
        : null
    },
  }
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(fullPath)
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)
      ? [fullPath]
      : []
  })
}

describe('miniProgramManualChunks', () => {
  it('keeps framework and third-party chunks stable', () => {
    const api = graph({})

    expect(miniProgramManualChunks('C:/repo/node_modules/react/index.js', api)).toBe('taro')
    expect(miniProgramManualChunks('C:/repo/node_modules/zod/index.js', api)).toBe('vendors')
    expect(miniProgramManualChunks('C:/repo/node_modules/@babel/runtime/helpers/extends.js', api)).toBe('babelHelpers')
  })

  it('keeps the avatar 3D cone inside profile-linked', () => {
    const api = graph({})

    expect(miniProgramManualChunks('C:/repo/node_modules/three/build/three.module.js', api)).toBe(
      'pages/profile-linked/three-avatar',
    )
  })

  it('routes a module used only by one subpackage into that subpackage', () => {
    const shared = 'C:/repo/src/pages/icebreaker-session/phases/RecapPhaseView.tsx'
    const barrel = 'C:/repo/src/pages/icebreaker-session/phaseViews.tsx'
    const session = 'C:/repo/src/pages/icebreaker-session/SessionPhaseViews.tsx'
    const entry = 'C:/repo/src/pages/icebreaker-session/index.tsx'
    const api = graph({
      [shared]: { importers: [barrel, session] },
      [barrel]: { importers: [session] },
      [session]: { importers: [entry] },
      [entry]: { isEntry: true },
    })

    expect(miniProgramManualChunks(shared, api)).toBe('pages/icebreaker-session/sub-common')
  })

  it('routes shared-package logic when every dependent entry belongs to onboarding', () => {
    const questions = 'C:/repo/packages/shared/src/personality/questionsV4.ts'
    const testPage = 'C:/repo/src/pages/onboarding/personality-test/index.tsx'
    const resultPage = 'C:/repo/src/pages/onboarding/personality-test/results/index.tsx'
    const api = graph({
      [questions]: { importers: [testPage, resultPage] },
      [testPage]: { isEntry: true },
      [resultPage]: { isEntry: true },
    })

    expect(miniProgramManualChunks(questions, api)).toBe('pages/onboarding/sub-common')
  })

  it('leaves single-importer dependencies with their owning page chunk', () => {
    const questionBank = 'C:/repo/packages/shared/src/copy/onboardingVoice.ts'
    const questions = 'C:/repo/src/lib/onboarding/voice.ts'
    const testPage = 'C:/repo/src/pages/onboarding/personality-test/index.tsx'
    const api = graph({
      [questionBank]: { importers: [questions] },
      [questions]: { importers: [testPage] },
      [testPage]: { isEntry: true },
    })

    expect(miniProgramManualChunks(questionBank, api)).toBeUndefined()
  })

  it('keeps modules shared by multiple subpackages in the root common chunk', () => {
    const overlay = 'C:/repo/src/components/ProfessionChatOverlay.tsx'
    const onboarding = 'C:/repo/src/pages/onboarding/essential-data/index.tsx'
    const profile = 'C:/repo/src/pages/profile-linked/edit-profile/index.tsx'
    const api = graph({
      [overlay]: { importers: [onboarding, profile] },
      [onboarding]: { isEntry: true },
      [profile]: { isEntry: true },
    })

    expect(miniProgramManualChunks(overlay, api)).toBe('common')
  })

  it('keeps modules used by a main-package page in the root common chunk', () => {
    const shared = 'C:/repo/src/lib/api/api.ts'
    const discover = 'C:/repo/src/pages/discover/index.tsx'
    const onboarding = 'C:/repo/src/pages/onboarding/essential-data/index.tsx'
    const api = graph({
      [shared]: { importers: [discover, onboarding] },
      [discover]: { isEntry: true },
      [onboarding]: { isEntry: true },
    })

    expect(miniProgramManualChunks(shared, api)).toBe('common')
  })

  it('avoids the broad personality barrel that links question-engine back into main', () => {
    const sourceRoot = resolve(process.cwd(), 'src')
    const offenders = sourceFiles(sourceRoot)
      .filter((file) => /from\s+['"]@shared\/personality['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(sourceRoot, file).replace(/\\/g, '/'))

    expect(offenders).toEqual([])
  }, 15000)

  it('avoids the shared root barrel that hoists subpackage-only modules into main', () => {
    const sourceRoot = resolve(process.cwd(), 'src')
    const offenders = sourceFiles(sourceRoot)
      .filter((file) => /from\s+['"]@joyjoin\/shared['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(sourceRoot, file).replace(/\\/g, '/'))

    expect(offenders).toEqual([])
  }, 15000)
})

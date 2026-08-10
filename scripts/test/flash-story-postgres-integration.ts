import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const { Pool } = pg
const require = createRequire(import.meta.url)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const artifactPath = resolve(repoRoot, 'artifacts/flash-sim/postgres-integration.json')
const allowedName = /^joyjoin_flash_story_test_\d{13}_[a-f0-9]{6}$/

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message)
}

const quoteIdentifier = (value: string) => {
  assert(allowedName.test(value), `refusing unsafe temporary database name: ${value}`)
  return `"${value}"`
}

const migration = (name: string) => readFileSync(resolve(repoRoot, 'apps/server/migrations', name), 'utf8')

async function main() {
  const adminUrlText = process.env.DATABASE_URL?.trim()
  assert(adminUrlText, 'DATABASE_URL is required and must point to the local administrative database')
  const adminUrl = new URL(adminUrlText)
  assert(['localhost', '127.0.0.1', '::1'].includes(adminUrl.hostname), 'only local PostgreSQL is allowed')
  assert(adminUrl.pathname === '/joyjoin', 'administrative connection must target the local joyjoin database')

  const tempName = `joyjoin_flash_story_test_${Date.now()}_${Math.random().toString(16).slice(2, 8).padEnd(6, '0')}`
  assert(allowedName.test(tempName), 'generated database name failed the safety regex')
  const tempUrl = new URL(adminUrl)
  tempUrl.pathname = `/${tempName}`
  const adminPool = new Pool({ connectionString: adminUrlText, max: 1 })
  let tempPool: InstanceType<typeof Pool> | null = null
  let appPool: { end(): Promise<void> } | null = null
  let created = false
  const evidence: Record<string, unknown> = { databaseName: tempName, cleaned: false }

  try {
    const server = await adminPool.query<{ version: string; current_database: string; current_user: string; rolcreatedb: boolean }>(
      `select version(), current_database(), current_user, rolcreatedb
       from pg_roles where rolname = current_user`,
    )
    const serverRow = server.rows[0]
    assert(serverRow?.current_database === 'joyjoin', 'administrative database changed unexpectedly')
    assert(serverRow.rolcreatedb, 'current PostgreSQL role cannot create isolated databases')
    evidence.postgresVersion = serverRow.version.match(/PostgreSQL\s+([\d.]+)/)?.[1] ?? 'unknown'
    evidence.roleCanCreateDatabase = true

    await adminPool.query(`create database ${quoteIdentifier(tempName)}`)
    created = true
    tempPool = new Pool({ connectionString: tempUrl.toString(), max: 8 })

    const drizzleBin = resolve(dirname(require.resolve('drizzle-kit')), 'bin.cjs')
    const pushed = spawnSync(process.execPath, [drizzleBin, 'push', '--config', resolve(repoRoot, 'apps/server/drizzle.config.cjs'), '--force'], {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: tempUrl.toString(), TEST_DATABASE_URL: tempUrl.toString(), APP_MODE: 'test' },
      encoding: 'utf8',
      timeout: 120_000,
    })
    assert(pushed.status === 0, `isolated schema push failed: ${(pushed.stderr || pushed.stdout).slice(-800)}`)

    const npcSlugs = ['alang', 'lizi', 'momo', 'shiqi', 'atuan']
    for (const [index, slug] of npcSlugs.entries()) {
      await tempPool.query(
        `insert into flash_npcs
          (id, slug, name, species, personality_summary, invite_line, voice_guide, dialogue_questions, eligible_weekdays, theme_color, sort_order)
         values ($1,$2,$3,'digital-animal','test','test','[]'::jsonb,'[]'::jsonb,array[1],'#6F45E8',$4)
         on conflict (slug) do nothing`,
        [`npc-${slug}`, slug, slug, index],
      )
    }

    await tempPool.query(migration('20260807010000_flash_story_season.sql'))
    await tempPool.query(migration('20260809010000_naturalize_flash_story_dialogue.sql'))
    const baseline = await tempPool.query(`select count(*)::int as count from flash_story_episodes where content_version=1 and review_status='reviewed'`)
    assert(baseline.rows[0].count === 15, 'canonical seed did not create 15 reviewed v1 baselines')

    await tempPool.query(migration('20260810010000_distinct_flash_story_units.sql'))
    const firstPass = await tempPool.query(
      `select count(*)::int as count,
              count(*) filter (where content_version=2 and review_status='draft')::int as pending,
              count(*) filter (where jsonb_array_length(content #> '{question,options}')=2)::int as two_options,
              min(updated_at)::text as min_updated, max(updated_at)::text as max_updated
       from flash_story_episodes`,
    )
    assert(firstPass.rows[0].count === 15 && firstPass.rows[0].pending === 15 && firstPass.rows[0].two_options === 15, 'first pass did not update 15/15 to draft two-option content')
    const beforeRerun = await tempPool.query(`select code, content_version, review_status, updated_at::text from flash_story_episodes order by code`)
    await tempPool.query(migration('20260810010000_distinct_flash_story_units.sql'))
    const afterRerun = await tempPool.query(`select code, content_version, review_status, updated_at::text from flash_story_episodes order by code`)
    assert(JSON.stringify(beforeRerun.rows) === JSON.stringify(afterRerun.rows), 'second migration execution changed rows')

    await tempPool.query(migration('20260807010000_flash_story_season.sql'))
    await tempPool.query(migration('20260809010000_naturalize_flash_story_dialogue.sql'))
    await tempPool.query(`update flash_story_episodes set content_version=1, review_status='reviewed'`)
    await tempPool.query(
      `update flash_story_episodes
       set content=jsonb_set(content,'{question,prompt}',to_jsonb('运营保留文案'::text),false), content_version=2, review_status='draft'
       where code='s1-p2-lizi'`,
    )
    const beforeDriftAttempt = await tempPool.query(
      `select code, content, content_version, review_status, updated_at::text
       from flash_story_episodes order by code`,
    )
    const driftClient = await tempPool.connect()
    let driftRejected = false
    try {
      await driftClient.query(migration('20260810010000_distinct_flash_story_units.sql'))
    } catch (error) {
      driftRejected = error instanceof Error && error.message.includes('expected 0 or 15 canonical rows, found 14')
      await driftClient.query('rollback')
    } finally {
      driftClient.release()
    }
    assert(driftRejected, 'partial canonical baseline did not fail closed')
    const afterDriftAttempt = await tempPool.query(
      `select code, content, content_version, review_status, updated_at::text
       from flash_story_episodes order by code`,
    )
    assert(JSON.stringify(afterDriftAttempt.rows) === JSON.stringify(beforeDriftAttempt.rows), 'failed partial migration changed season rows')
    const drift = await tempPool.query(
      `select
        count(*) filter (where content_version=2 and review_status='draft')::int as total_draft,
        count(*) filter (where content_version=1 and review_status='reviewed')::int as canonical_reviewed,
        max(content #>> '{question,prompt}') filter (where code='s1-p2-lizi') as drift_prompt
       from flash_story_episodes`,
    )
    assert(
      drift.rows[0].total_draft === 1
      && drift.rows[0].canonical_reviewed === 14
      && drift.rows[0].drift_prompt === '运营保留文案',
      'partial baseline rollback did not preserve every row',
    )

    await tempPool.query(migration('20260807010000_flash_story_season.sql'))
    await tempPool.query(migration('20260809010000_naturalize_flash_story_dialogue.sql'))
    await tempPool.query(`update flash_story_episodes set content_version=1, review_status='reviewed'`)
    await tempPool.query(migration('20260810010000_distinct_flash_story_units.sql'))
    await tempPool.query(`update flash_story_episodes set review_status='reviewed'`)

    const userId = 'flash-db-user-a'
    const isolatedUserId = 'flash-db-user-b'
    const repeatUserId = 'flash-db-user-repeat'
    const conflictUserId = 'flash-db-user-conflict'
    await tempPool.query(`insert into users(id) values ($1),($2),($3),($4)`, [userId, isolatedUserId, repeatUserId, conflictUserId])
    await tempPool.query(
      `insert into flash_encounter_locations
       (id,name,city,district,address,latitude,longitude,coordinate_system,availability_windows,approval_status,is_active)
       values ('flash-db-location','test','深圳','南山区','test',22.54,113.94,'gcj02','[{"weekday":1,"startTime":"09:00","endTime":"21:00"}]'::jsonb,'approved',true)`,
    )
    await tempPool.query(
      `insert into flash_schedule_plans(id,service_date,city,status,source,generation_seed,auto_publish_after)
       values ('flash-db-plan',current_date,'深圳','published','generated','flash-db',now())`,
    )
    const season = await tempPool.query(`select id from flash_story_seasons where code='unnamed-objects-s1'`)
    const seasonId = season.rows[0].id as string
    await tempPool.query(
      `insert into flash_user_story_progress(user_id,season_id,current_phase,status)
       values ($1,$5,1,'active'),($2,$5,1,'active'),($3,$5,1,'active'),($4,$5,1,'active')`,
      [userId, isolatedUserId, repeatUserId, conflictUserId, seasonId],
    )

    const episodes = await tempPool.query<{ id: string; code: string; phase: number; npc_id: string }>(
      `select id,code,phase,npc_id from flash_story_episodes order by phase,sort_order`,
    )
    for (const [index, episode] of episodes.rows.entries()) {
      const shiftId = `flash-db-shift-${index}`
      const encounterId = `flash-db-encounter-${index}`
      await tempPool.query(
        `insert into flash_shifts(id,plan_id,npc_id,location_id,starts_at,ends_at,status,source,availability_mode)
         values ($1,'flash-db-plan',$2,'flash-db-location',now()-interval '1 hour',now()+interval '1 hour','published','generated','scheduled')`,
        [shiftId, episode.npc_id],
      )
      await tempPool.query(
        `insert into flash_encounters(id,user_id,shift_id,npc_id,story_episode_id,status,expires_at)
         values ($1,$2,$3,$4,$5,'dialogue',now()+interval '24 hours')`,
        [encounterId, userId, shiftId, episode.npc_id, episode.id],
      )
    }

    process.env.APP_MODE = 'test'
    process.env.TEST_DATABASE_URL = tempUrl.toString()
    process.env.DATABASE_URL = tempUrl.toString()
    const repository = await import('../../apps/server/src/repositories/flashStoryRepo.js')
    const flashRepository = await import('../../apps/server/src/repositories/flashRepo.js')
    const dbModule = await import('../../apps/server/src/db.js')
    appPool = dbModule.pool

    const published = await repository.publishFlashStorySeason(seasonId, 'flash-db-test', new Date())
    assert(published, 'reviewed test season did not publish')

    const repeatedEpisode = episodes.rows[0]
    await tempPool.query(
      `insert into flash_shifts(id,plan_id,npc_id,location_id,starts_at,ends_at,status,source,availability_mode)
       values ('flash-db-repeat-shift','flash-db-plan',$1,'flash-db-location',now()-interval '1 hour',now()+interval '1 hour','published','generated','scheduled')`,
      [repeatedEpisode.npc_id],
    )
    await tempPool.query(
      `insert into flash_encounters(id,user_id,shift_id,npc_id,story_episode_id,status,expires_at)
       values ('flash-db-repeat-original',$1,'flash-db-shift-0',$2,$3,'dialogue',now()+interval '24 hours'),
              ('flash-db-repeat-duplicate',$1,'flash-db-repeat-shift',$2,null,'dialogue',now()+interval '24 hours')`,
      [repeatUserId, repeatedEpisode.npc_id, repeatedEpisode.id],
    )
    const repeatedCompletion = await repository.completeFlashStoryEpisode({
      encounterId: 'flash-db-repeat-original',
      userId: repeatUserId,
      episodeId: repeatedEpisode.id,
      optionId: `${repeatedEpisode.code}-cooperate-a`,
      responseSnapshot: 'static reviewed response',
      renderKind: 'template',
      promptVersion: null,
      now: new Date(),
    })
    assert(repeatedCompletion?.created, 'repeat-NPC setup did not complete the original unit')
    const repeatedAssignment = await repository.ensureFlashStoryEpisodeForEncounter({
      encounterId: 'flash-db-repeat-duplicate',
      userId: repeatUserId,
      npcId: repeatedEpisode.npc_id,
      now: new Date(),
      mode: 'standard',
      consentVersion: null,
    })
    assert(repeatedAssignment?.alreadyCompleted, 'repeat NPC was not recognized as already completed')
    const repeatedEncounter = await tempPool.query(
      `select status from flash_encounters where id='flash-db-repeat-duplicate'`,
    )
    assert(repeatedEncounter.rows[0]?.status === 'completed', 'repeat NPC encounter remained resumable')
    const repeatedResume = await flashRepository.getLatestResumableFlashEncounter(repeatUserId, new Date())
    assert(repeatedResume === null, 'repeat NPC encounter still won the home resume query')

    await tempPool.query(
      `insert into flash_encounters(id,user_id,shift_id,npc_id,story_episode_id,status,expires_at)
       values ('flash-db-conflict',$1,'flash-db-shift-0',$2,$3,'dialogue',now()+interval '24 hours')`,
      [conflictUserId, repeatedEpisode.npc_id, repeatedEpisode.id],
    )
    const conflictBase = {
      encounterId: 'flash-db-conflict',
      userId: conflictUserId,
      episodeId: repeatedEpisode.id,
      responseSnapshot: 'static reviewed response',
      renderKind: 'template' as const,
      promptVersion: null,
      now: new Date(),
    }
    const differentOptionRace = await Promise.all([
      repository.completeFlashStoryEpisode({ ...conflictBase, optionId: `${repeatedEpisode.code}-cooperate-a` }),
      repository.completeFlashStoryEpisode({ ...conflictBase, optionId: `${repeatedEpisode.code}-cooperate-b` }),
    ])
    assert(differentOptionRace.filter((item) => item?.created).length === 1, 'different-option race did not settle exactly once')
    const conflictRows = await tempPool.query(
      `select
        (select count(*)::int from flash_user_story_episodes where user_id=$1) as episodes,
        (select count(*)::int from flash_user_story_fragments where user_id=$1) as fragments,
        (select selected_option_id from flash_user_story_episodes where user_id=$1 limit 1) as selected_option`,
      [conflictUserId],
    )
    assert(
      conflictRows.rows[0].episodes === 1
      && conflictRows.rows[0].fragments === 1
      && [`${repeatedEpisode.code}-cooperate-a`, `${repeatedEpisode.code}-cooperate-b`].includes(conflictRows.rows[0].selected_option),
      'different-option race persisted a non-canonical result',
    )

    const phaseEvidence: Array<{ phase: number; completions: number; currentPhase: number; status: string }> = []
    for (const phase of [1, 2, 3]) {
      const phaseEpisodes = episodes.rows.filter((episode) => episode.phase === phase)
      for (const [phaseIndex, episode] of phaseEpisodes.entries()) {
        const index = episodes.rows.findIndex((item) => item.id === episode.id)
        const input = {
          encounterId: `flash-db-encounter-${index}`,
          userId,
          episodeId: episode.id,
          optionId: `${episode.code}-cooperate-${index % 2 === 0 ? 'a' : 'b'}`,
          responseSnapshot: 'static reviewed response',
          renderKind: 'template' as const,
          promptVersion: null,
          now: new Date(),
        }
        if (phaseIndex === 4) {
          const concurrent = await Promise.all([
            repository.completeFlashStoryEpisode(input),
            repository.completeFlashStoryEpisode(input),
          ])
          assert(concurrent.filter((item) => item?.created).length === 1, `phase ${phase} fifth completion was not exactly once`)
        } else {
          const result = await repository.completeFlashStoryEpisode(input)
          assert(result?.created, `phase ${phase} unit ${phaseIndex + 1} did not complete`)
        }
        const replay = await repository.completeFlashStoryEpisode(input)
        assert(replay?.created === false, 'lost-response replay was not idempotent')
      }
      const progress = await tempPool.query(`select current_phase,status from flash_user_story_progress where user_id=$1 and season_id=$2`, [userId, seasonId])
      const completionCount = await tempPool.query(
        `select count(*)::int as count from flash_user_story_episodes usep join flash_story_episodes e on e.id=usep.episode_id where usep.user_id=$1 and e.phase=$2`,
        [userId, phase],
      )
      phaseEvidence.push({ phase, completions: completionCount.rows[0].count, currentPhase: progress.rows[0].current_phase, status: progress.rows[0].status })
    }

    const totals = await tempPool.query(
      `select
        (select count(*)::int from flash_user_story_episodes where user_id=$1) as episodes,
        (select count(*)::int from flash_user_story_fragments where user_id=$1) as fragments,
        (select count(*)::int from flash_user_story_episodes where user_id=$2) as isolated_user_episodes`,
      [userId, isolatedUserId],
    )
    assert(totals.rows[0].episodes === 15 && totals.rows[0].fragments === 15, '15/15 episode and fragment invariant failed')
    assert(totals.rows[0].isolated_user_episodes === 0, 'cross-user isolation failed')
    assert(phaseEvidence.every((item) => item.completions === 5), 'a phase did not settle exactly five units')
    assert(phaseEvidence[0].currentPhase === 2 && phaseEvidence[1].currentPhase === 3 && phaseEvidence[2].status === 'completed', 'phase/finale progression failed')

    // Production-repository journey gate: 100 isolated users, 15 episodes each.
    // The deterministic client simulator covers reducer/restore failures; this
    // section measures persisted exactly-once, ownership and phase boundaries.
    const virtualUserIds = Array.from({ length: 100 }, (_, index) => `flash-virtual-${String(index + 1).padStart(3, '0')}`)
    await tempPool.query(`insert into users(id) select unnest($1::varchar[])`, [virtualUserIds])
    const release = await tempPool.query(`select id from flash_story_release_snapshots where status='published' limit 1`)
    const releaseId = release.rows[0]?.id as string
    assert(releaseId, 'published release snapshot was not created')
    await tempPool.query(
      `insert into flash_story_universe_runs(user_id,release_snapshot_id,mode,universe_vector,flags,echo_queue,status)
       select input.user_id,$2,'standard','{"trust":0,"attachment":0,"intervention":0,"truth":0}'::jsonb,array[]::text[],'[]'::jsonb,'active'
       from unnest($1::varchar[]) as input(user_id)`,
      [virtualUserIds, releaseId],
    )
    await tempPool.query(
      `insert into flash_user_story_progress(user_id,season_id,universe_run_id,current_phase,status)
       select run.user_id,$2,run.id,1,'active'
       from flash_story_universe_runs run
       where run.user_id = any($1::varchar[]) and run.release_snapshot_id=$3`,
      [virtualUserIds, seasonId, releaseId],
    )
    const virtualEncounterIds: string[] = []
    const virtualEncounterUsers: string[] = []
    const virtualEncounterShifts: string[] = []
    const virtualEncounterNpcs: string[] = []
    const virtualEncounterEpisodes: string[] = []
    for (const virtualUserId of virtualUserIds) {
      for (const [episodeIndex, episode] of episodes.rows.entries()) {
        virtualEncounterIds.push(`flash-virtual-encounter-${virtualUserId.slice(-3)}-${episodeIndex}`)
        virtualEncounterUsers.push(virtualUserId)
        virtualEncounterShifts.push(`flash-db-shift-${episodeIndex}`)
        virtualEncounterNpcs.push(episode.npc_id)
        virtualEncounterEpisodes.push(episode.id)
      }
    }
    await tempPool.query(
      `insert into flash_encounters(id,user_id,shift_id,npc_id,story_episode_id,status,expires_at)
       select * from unnest($1::varchar[],$2::varchar[],$3::varchar[],$4::varchar[],$5::varchar[],$6::varchar[],$7::timestamptz[])`,
      [
        virtualEncounterIds,
        virtualEncounterUsers,
        virtualEncounterShifts,
        virtualEncounterNpcs,
        virtualEncounterEpisodes,
        virtualEncounterIds.map(() => 'dialogue'),
        virtualEncounterIds.map(() => new Date(Date.now() + 86_400_000)),
      ],
    )

    const firstEpisode = episodes.rows[0]
    const crossUserAttempt = await repository.completeFlashStoryEpisode({
      encounterId: 'flash-virtual-encounter-002-0',
      userId: virtualUserIds[0],
      episodeId: firstEpisode.id,
      optionId: `${firstEpisode.code}-cooperate-a`,
      responseSnapshot: 'static reviewed response',
      renderKind: 'template',
      promptVersion: null,
      now: new Date(),
    })
    assert(crossUserAttempt === null, 'a user completed another user\'s encounter')
    const crossUserCounts = await tempPool.query(
      `select count(*)::int as count from flash_user_story_episodes where user_id = any($1::varchar[])`,
      [virtualUserIds.slice(0, 2)],
    )
    assert(crossUserCounts.rows[0].count === 0, 'cross-user rejection still wrote a completion')

    let lostResponseReplays = 0
    let sameUnitDoubleTaps = 0
    let distinctNpcBoundaryRaces = 0
    const virtualPhaseEvidence: Array<{ phase: number; usersAtBoundary: number; completions: number }> = []
    for (const phase of [1, 2, 3]) {
      const phaseEpisodes = episodes.rows.filter((episode) => episode.phase === phase)
      await Promise.all(virtualUserIds.map(async (virtualUserId, userIndex) => {
        const makeInput = (episode: (typeof phaseEpisodes)[number]) => {
          const episodeIndex = episodes.rows.findIndex((candidate) => candidate.id === episode.id)
          return {
            encounterId: `flash-virtual-encounter-${virtualUserId.slice(-3)}-${episodeIndex}`,
            userId: virtualUserId,
            episodeId: episode.id,
            optionId: `${episode.code}-cooperate-${(userIndex + episodeIndex) % 2 === 0 ? 'a' : 'b'}`,
            responseSnapshot: 'static reviewed response',
            renderKind: 'template' as const,
            promptVersion: null,
            now: new Date(),
          }
        }

        for (const [episodeIndex, episode] of phaseEpisodes.slice(0, 3).entries()) {
          const input = makeInput(episode)
          if ((userIndex + phase + episodeIndex) % 3 === 0) {
            const doubleTap = await Promise.all([
              repository.completeFlashStoryEpisode(input),
              repository.completeFlashStoryEpisode(input),
            ])
            assert(doubleTap.filter((item) => item?.created).length === 1, 'same-unit double tap did not settle exactly once')
            sameUnitDoubleTaps += 1
          } else {
            const created = await repository.completeFlashStoryEpisode(input)
            assert(created?.created, 'virtual user unit did not complete')
            if ((userIndex + phase + episodeIndex) % 3 === 1) {
              const replay = await repository.completeFlashStoryEpisode(input)
              assert(replay?.created === false, 'lost-response replay created a duplicate')
              lostResponseReplays += 1
            }
          }
        }

        const boundaryInputs = phaseEpisodes.slice(3).map(makeInput)
        const boundary = await Promise.all(boundaryInputs.map((input) => repository.completeFlashStoryEpisode(input)))
        assert(boundary.length === 2 && boundary.every((item) => item?.created), 'two distinct NPCs did not both settle at a phase boundary')
        const boundaryReplays = await Promise.all(boundaryInputs.map((input) => repository.completeFlashStoryEpisode(input)))
        assert(boundaryReplays.every((item) => item?.created === false), 'distinct-NPC boundary replay was not idempotent')
        distinctNpcBoundaryRaces += 1
      }))

      const boundary = await tempPool.query(
        `select count(*)::int as users_at_boundary from flash_user_story_progress
         where user_id = any($1::varchar[])
           and (($2 < 3 and current_phase=$2+1 and status='active') or ($2=3 and current_phase=3 and status='completed'))`,
        [virtualUserIds, phase],
      )
      const completions = await tempPool.query(
        `select count(*)::int as count
         from flash_user_story_episodes usep
         join flash_story_episodes e on e.id=usep.episode_id
         where usep.user_id = any($1::varchar[]) and e.phase=$2`,
        [virtualUserIds, phase],
      )
      assert(boundary.rows[0].users_at_boundary === 100, `phase ${phase} did not advance all 100 users exactly once`)
      assert(completions.rows[0].count === 500, `phase ${phase} did not persist 500 completions`)
      virtualPhaseEvidence.push({ phase, usersAtBoundary: 100, completions: 500 })
    }

    const virtualTotals = await tempPool.query(
      `select
        (select count(*)::int from flash_user_story_episodes where user_id = any($1::varchar[])) as episodes,
        (select count(*)::int from flash_user_story_fragments where user_id = any($1::varchar[])) as fragments,
        (select count(*)::int from flash_user_story_progress where user_id = any($1::varchar[]) and status='completed') as completed_users,
        (select count(*)::int from flash_story_universe_runs where user_id = any($1::varchar[]) and status='completed') as completed_runs,
        (select count(*)::int from flash_story_universe_runs where user_id = any($1::varchar[]) and ending_code is not null) as endings,
        (select count(*)::int from flash_encounters where user_id = any($1::varchar[]) and status='completed') as completed_encounters`,
      [virtualUserIds],
    )
    assert(
      virtualTotals.rows[0].episodes === 1500
      && virtualTotals.rows[0].fragments === 1500
      && virtualTotals.rows[0].completed_users === 100
      && virtualTotals.rows[0].completed_runs === 100
      && virtualTotals.rows[0].endings === 100
      && virtualTotals.rows[0].completed_encounters === 1500,
      '100-user persisted journey totals failed',
    )

    Object.assign(evidence, {
      migration: {
        baselineRows: 15,
        updatedRows: 15,
        secondRunChanges: 0,
        partialBaselineRejected: true,
        partialBaselineRowsChanged: 0,
        operatorDriftPreserved: true,
        candidatesRemainDraft: true,
      },
      runtime: {
        episodes: 15,
        fragments: 15,
        phaseEvidence,
        lostResponseReplay: true,
        concurrentFifthExactlyOnce: true,
        differentOptionRaceExactlyOnce: true,
        repeatedNpcReturnsHome: true,
        crossUserWrites: 0,
      },
      virtualUsers: {
        users: 100,
        episodes: 1500,
        fragments: 1500,
        completedUsers: 100,
        completedRuns: 100,
        phaseAdvances: 300,
        seasonFinales: 100,
        nonNullEndingCodes: 100,
        phaseEvidence: virtualPhaseEvidence,
        lostResponseReplays,
        sameUnitDoubleTaps,
        distinctNpcBoundaryRaces,
        crossUserAttackRejected: true,
        crossUserWrites: 0,
      },
    })
  } finally {
    if (appPool) await appPool.end().catch(() => undefined)
    if (tempPool) await tempPool.end().catch(() => undefined)
    if (created) {
      assert(allowedName.test(tempName), 'cleanup refused: temporary database name no longer matches safety regex')
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const active = await adminPool.query<{ count: number }>(
          `select count(*)::int as count from pg_stat_activity where datname=$1 and pid <> pg_backend_pid()`,
          [tempName],
        )
        if (active.rows[0].count === 0) break
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
      }
      const active = await adminPool.query<{ pid: number; usename: string }>(
        `select pid,usename from pg_stat_activity where datname=$1 and pid <> pg_backend_pid()`,
        [tempName],
      )
      const owner = await adminPool.query<{ current_user: string }>('select current_user')
      assert(active.rows.every((row) => row.usename === owner.rows[0].current_user), 'cleanup refused to terminate another role')
      for (const row of active.rows) await adminPool.query('select pg_terminate_backend($1)', [row.pid])
      await adminPool.query(`drop database if exists ${quoteIdentifier(tempName)}`)
      evidence.cleaned = true
    }
    await adminPool.end()
    mkdirSync(dirname(artifactPath), { recursive: true })
    writeFileSync(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`)
  }

  console.log(JSON.stringify(evidence, null, 2))
}

await main()

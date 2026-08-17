-- Repair every historical Flash completion that is missing its story fragment.
-- Safe to re-run: the user/fragment natural key and ON CONFLICT make the
-- backfill idempotent. Rollback: drop uq_flash_story_fragment_episode only;
-- do not delete repaired ownership rows because they represent earned data.
BEGIN;

DO $$
DECLARE
  reviewed_episode_count integer;
  invalid_episode record;
  missing_count integer;
BEGIN
  IF to_regclass('public.flash_story_episodes') IS NULL
    OR to_regclass('public.flash_story_fragments') IS NULL
    OR to_regclass('public.flash_user_story_episodes') IS NULL
    OR to_regclass('public.flash_user_story_fragments') IS NULL THEN
    RAISE NOTICE 'Flash story tables are absent; fragment repair skipped.';
    RETURN;
  END IF;

  SELECT count(*)::integer
  INTO reviewed_episode_count
  FROM flash_story_episodes
  WHERE review_status = 'reviewed' AND is_active = true;

  IF reviewed_episode_count = 0 THEN
    RAISE NOTICE 'No reviewed Flash story catalog is installed; fragment repair skipped.';
    RETURN;
  END IF;

  IF reviewed_episode_count <> 15 THEN
    RAISE EXCEPTION 'Expected 15 reviewed Flash story episodes, found %', reviewed_episode_count;
  END IF;

  SELECT episode_id, fragment_count
  INTO invalid_episode
  FROM (
    SELECT episode.id AS episode_id, count(fragment.id)::integer AS fragment_count
    FROM flash_story_episodes episode
    LEFT JOIN flash_story_fragments fragment ON fragment.episode_id = episode.id
    WHERE episode.review_status = 'reviewed' AND episode.is_active = true
    GROUP BY episode.id
  ) catalog
  WHERE fragment_count <> 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Flash story episode % must have exactly one fragment; found %',
      invalid_episode.episode_id, invalid_episode.fragment_count;
  END IF;

  DROP INDEX IF EXISTS idx_flash_story_fragment_episode;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_flash_story_fragment_episode
    ON flash_story_fragments (episode_id);

  WITH completed_episode_count AS (
    SELECT count(*)::integer AS value FROM flash_user_story_episodes
  ), repair_candidates AS (
    SELECT
      completion.user_id,
      fragment.id AS fragment_id,
      completion.episode_id,
      snapshot_fragment.fragment AS fragment_snapshot,
      completion.completed_at AS unlocked_at
    FROM flash_user_story_episodes completion
    JOIN flash_story_episodes episode ON episode.id = completion.episode_id
    JOIN flash_story_fragments fragment ON fragment.episode_id = completion.episode_id
    LEFT JOIN flash_story_universe_runs universe_run ON universe_run.id = completion.universe_run_id
    LEFT JOIN flash_story_release_snapshots release_snapshot ON release_snapshot.id = universe_run.release_snapshot_id
    LEFT JOIN LATERAL (
      SELECT manifest_episode -> 'fragment' AS fragment
      FROM jsonb_array_elements(COALESCE(release_snapshot.manifest -> 'episodes', '[]'::jsonb)) manifest_episode
      WHERE manifest_episode ->> 'code' = episode.code
      LIMIT 1
    ) snapshot_fragment ON true
  )
  INSERT INTO flash_user_story_fragments (
    user_id,
    fragment_id,
    episode_id,
    fragment_snapshot,
    unlocked_at
  )
  SELECT
    candidate.user_id,
    candidate.fragment_id,
    candidate.episode_id,
    candidate.fragment_snapshot,
    candidate.unlocked_at
  FROM repair_candidates candidate
  CROSS JOIN completed_episode_count
  ON CONFLICT DO NOTHING;

  SELECT count(*)::integer
  INTO missing_count
  FROM flash_user_story_episodes completion
  LEFT JOIN flash_user_story_fragments owned
    ON owned.user_id = completion.user_id
   AND owned.episode_id = completion.episode_id
  WHERE owned.id IS NULL;

  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'Flash story fragment repair incomplete: % completions still missing fragments', missing_count;
  END IF;
END $$;

COMMIT;

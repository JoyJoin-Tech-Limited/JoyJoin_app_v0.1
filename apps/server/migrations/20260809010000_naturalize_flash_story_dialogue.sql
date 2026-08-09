BEGIN;

-- Content-only compatibility patch for already-seeded first-season rows.
-- Every write is guarded by the season, stable option/episode ID, and exact old value so
-- operator-reviewed edits win. Re-running this migration converges without further changes.
DO $migration$
BEGIN
  IF to_regclass('public.flash_story_episodes') IS NULL
     OR to_regclass('public.flash_story_seasons') IS NULL THEN
    RAISE NOTICE 'Flash story tables are absent; dialogue content patch skipped.';
    RETURN;
  END IF;

  UPDATE flash_story_episodes e
  SET content = jsonb_set(
    e.content,
    '{question,prompt}',
    to_jsonb('你最想接着问哪一句？'::text),
    false
  )
  FROM flash_story_seasons s
  WHERE e.season_id = s.id
    AND s.code = 'unnamed-objects-s1'
    AND e.content #>> '{question,prompt}' = '你想先注意哪一件事？';

  UPDATE flash_story_episodes e
  SET content = jsonb_set(
    e.content,
    '{question,options}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN option_value->>'id' = 'notice-action'
               AND option_value->>'label' = '它刚才做的动作'
            THEN jsonb_set(option_value, '{label}', to_jsonb('我想问：你为什么这样做？'::text), false)
          WHEN option_value->>'id' = 'notice-object'
               AND option_value->>'label' = '这件旧物留下的痕迹'
            THEN jsonb_set(option_value, '{label}', to_jsonb('我想看看：旧物还留下了什么？'::text), false)
          WHEN option_value->>'id' = 'notice-relationship'
               AND option_value->>'label' = '它没有直接说出的关系'
            THEN jsonb_set(option_value, '{label}', to_jsonb('等等，这件旧物和谁有关？'::text), false)
          ELSE option_value
        END
        ORDER BY option_ordinality
      )
      FROM jsonb_array_elements(e.content #> '{question,options}')
        WITH ORDINALITY AS option_rows(option_value, option_ordinality)
    ),
    false
  )
  FROM flash_story_seasons s
  WHERE e.season_id = s.id
    AND s.code = 'unnamed-objects-s1'
    AND jsonb_typeof(e.content #> '{question,options}') = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(e.content #> '{question,options}') AS guarded(option_value)
      WHERE (option_value->>'id' = 'notice-action' AND option_value->>'label' = '它刚才做的动作')
         OR (option_value->>'id' = 'notice-object' AND option_value->>'label' = '这件旧物留下的痕迹')
         OR (option_value->>'id' = 'notice-relationship' AND option_value->>'label' = '它没有直接说出的关系')
    );

  UPDATE flash_story_episodes e
  SET content = jsonb_set(
    e.content,
    '{responseByOption,notice-action}',
    to_jsonb('你先留意了那个动作。有时候，动作比解释更诚实。'::text),
    false
  )
  FROM flash_story_seasons s
  WHERE e.season_id = s.id
    AND s.code = 'unnamed-objects-s1'
    AND e.content #>> '{responseByOption,notice-action}' = '你注意到了它怎样处理，而不是只听它解释。';

  UPDATE flash_story_episodes e
  SET content = jsonb_set(
    e.content,
    '{responseByOption,notice-object}',
    to_jsonb('你把目光留在旧物上。那些不起眼的痕迹，替过去补上了一小段。'::text),
    false
  )
  FROM flash_story_seasons s
  WHERE e.season_id = s.id
    AND s.code = 'unnamed-objects-s1'
    AND e.content #>> '{responseByOption,notice-object}' = '物件上的使用痕迹把过去说得更具体了。';

  UPDATE flash_story_episodes e
  SET content = jsonb_set(
    e.content,
    '{responseByOption,notice-relationship}',
    to_jsonb('你追问了那段没说完的关系。旧物和另一个角色，终于连上了一点。'::text),
    false
  )
  FROM flash_story_seasons s
  WHERE e.season_id = s.id
    AND s.code = 'unnamed-objects-s1'
    AND e.content #>> '{responseByOption,notice-relationship}' = '这件旧物与另一个角色的关系变得清楚了一点。';

  UPDATE flash_story_episodes e
  SET motion = jsonb_set(e.motion, '{ambient}', to_jsonb('breathe'::text), false)
  FROM flash_story_seasons s
  WHERE e.season_id = s.id
    AND s.code = 'unnamed-objects-s1'
    AND e.code IN ('s1-p1-shiqi', 's1-p2-shiqi', 's1-p3-shiqi')
    AND e.motion #>> '{ambient}' = 'none';
END
$migration$;

COMMIT;

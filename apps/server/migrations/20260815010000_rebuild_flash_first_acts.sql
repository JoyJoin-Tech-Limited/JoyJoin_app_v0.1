-- Replace the four first-act server snapshots with the accepted scene-driven
-- contracts. Runtime code carries the same contract so deploy order is safe:
-- code may ship before this migration, while the migration removes stale v2
-- pilot documents and old flat copy once an operator applies it.
--
-- Idempotency: exact four-row pre/post checks; an already migrated set is a no-op.
-- Abort: any partial set or unexpected row count raises and rolls back atomically.
-- Rollback after commit: restore the pre-migration DB snapshot, then redeploy the
-- previous service version. Do not hand-edit individual episodes.
BEGIN;

DO $migration$
DECLARE
  existing_count integer := 0;
  current_count integer := 0;
  updated_count integer := 0;
BEGIN
  IF to_regclass('public.flash_story_episodes') IS NULL OR to_regclass('public.flash_story_seasons') IS NULL THEN
    RAISE NOTICE 'Flash story tables are absent; first-act rebuild skipped.';
    RETURN;
  END IF;

  WITH copy(code, opening, action, discovery, prompt, a_label, a_response, b_label, b_response, closing) AS (VALUES
    ('s1-p1-alang','风从河面过来。你替我看看，这里有没有一种不催人的距离。','阿浪把两把椅子的草图压在河岸地图旁，绳结、转角和窗边座位互相呼应。','四处线索都在说同一件事：靠近不是挤占，而是留出能回应的角度。','看完四处线索，你想把两把椅子怎样摆？','先并肩看河。话慢一点再说。','我偏向这个。先共享一个方向，再谈分歧。','留一点角度。既同向，也看得见彼此。','也好。不是躲开，只是不给目光太多压力。','两把椅子并肩留出半步，既能一起看河，也给彼此留下转身回应的余地。'),
    ('s1-p1-lizi','来得正好。我正和一卷干掉的彩笔较劲。名字都磨没了，偏偏每支还留着自己的脾气。','栗子把色板、悬挂色片和工具车上的三顶笔帽一一摊开。','名字会模糊，软边、细线和断点留下的手感却不会抢答。','四处都看过了，你想先相信什么？','先相信纸上留下的痕迹。','好。先信纸上留下的东西，名字晚一点回来也没关系。','先把三种手感排成顺序。','成交。把三种手感排开，让颜色这次别抢答。','“暖、静、醒”重新找到各自的笔帽，颜色没有走丢，只是暂时没有名字。'),
    ('s1-p1-momo','最后一条实线在空白页前停住。……我不是走丢，只是不确定停下算不算选择。','默默把檐水的节奏、路线牌的折点和册子里的实线按顺序排好。','声音、折点和实线能彼此印证；空白没有要求任何人替它补完。','三处线索接上了，你想怎样记下停步？','停下也算路线的一部分','……那我把停下，也记成一笔。','先核对最后三处，再决定停下','好。声音、折点、实线，先接一遍。','雨路在空白页前稳稳停住。没有多画的箭头，也没有被替写的下一站。'),
    ('s1-p1-shiqi','三份记录看似一致。准确地说，只是方向一致；叙述还没有说完。','拾柒把外出记录册、交换箱压痕和三层路线纸放到检视灯箱前。','共同浅痕可以先被称为事实；更晚出现的箭头和备注仍需单独标明。','四处都看过了，你想怎样区分事实与解释？','先保留事实浅痕，再注明解释层','稳妥。事实和解释都留下，但不混成一句话。','先标出解释偏移，再回看原始浅痕','可以。先暴露偏移，再确认它没有改写底层。','三层浅痕已经对齐。共同事实留在底层，后来补上的解释各自有了位置。')
  ), episodes AS (
    SELECT
      e.id,
      e.content,
      copy.code,
      copy.prompt,
      copy.a_label,
      copy.a_response,
      copy.b_label,
      copy.b_response
    FROM flash_story_episodes e
    JOIN flash_story_seasons s ON s.id = e.season_id
    JOIN copy ON copy.code = e.code
    WHERE s.code = 'unnamed-objects-s1'
  ), current_rows AS (
    SELECT id
    FROM episodes
    WHERE content #> '{question}' = jsonb_build_object(
      'id', code || '-first-act-response-v1',
      'prompt', prompt,
      'options', jsonb_build_array(
        jsonb_build_object('id', code || '-cooperate-a', 'label', a_label, 'tags', jsonb_build_array()),
        jsonb_build_object('id', code || '-cooperate-b', 'label', b_label, 'tags', jsonb_build_array())
      )
    )
    AND content #> '{responseByOption}' = jsonb_build_object(
      code || '-cooperate-a', a_response,
      code || '-cooperate-b', b_response
    )
  )
  SELECT (SELECT count(*) FROM episodes), (SELECT count(*) FROM current_rows)
  INTO existing_count, current_count;

  IF existing_count = 0 THEN
    RAISE NOTICE 'Flash first-act episodes are absent; rebuild skipped.';
    RETURN;
  END IF;
  IF existing_count <> 4 THEN
    RAISE EXCEPTION 'Flash first-act rebuild expected 4 episodes, found %', existing_count;
  END IF;
  IF current_count = 4 THEN
    RAISE NOTICE 'Flash first-act episodes already match the accepted contracts.';
    RETURN;
  END IF;
  IF current_count <> 0 THEN
    RAISE EXCEPTION 'Flash first-act rebuild found a partial contract set (% of 4); refusing a mixed update', current_count;
  END IF;

  WITH copy(code, opening, action, discovery, prompt, a_label, a_response, b_label, b_response, closing) AS (VALUES
    ('s1-p1-alang','风从河面过来。你替我看看，这里有没有一种不催人的距离。','阿浪把两把椅子的草图压在河岸地图旁，绳结、转角和窗边座位互相呼应。','四处线索都在说同一件事：靠近不是挤占，而是留出能回应的角度。','看完四处线索，你想把两把椅子怎样摆？','先并肩看河。话慢一点再说。','我偏向这个。先共享一个方向，再谈分歧。','留一点角度。既同向，也看得见彼此。','也好。不是躲开，只是不给目光太多压力。','两把椅子并肩留出半步，既能一起看河，也给彼此留下转身回应的余地。'),
    ('s1-p1-lizi','来得正好。我正和一卷干掉的彩笔较劲。名字都磨没了，偏偏每支还留着自己的脾气。','栗子把色板、悬挂色片和工具车上的三顶笔帽一一摊开。','名字会模糊，软边、细线和断点留下的手感却不会抢答。','四处都看过了，你想先相信什么？','先相信纸上留下的痕迹。','好。先信纸上留下的东西，名字晚一点回来也没关系。','先把三种手感排成顺序。','成交。把三种手感排开，让颜色这次别抢答。','“暖、静、醒”重新找到各自的笔帽，颜色没有走丢，只是暂时没有名字。'),
    ('s1-p1-momo','最后一条实线在空白页前停住。……我不是走丢，只是不确定停下算不算选择。','默默把檐水的节奏、路线牌的折点和册子里的实线按顺序排好。','声音、折点和实线能彼此印证；空白没有要求任何人替它补完。','三处线索接上了，你想怎样记下停步？','停下也算路线的一部分','……那我把停下，也记成一笔。','先核对最后三处，再决定停下','好。声音、折点、实线，先接一遍。','雨路在空白页前稳稳停住。没有多画的箭头，也没有被替写的下一站。'),
    ('s1-p1-shiqi','三份记录看似一致。准确地说，只是方向一致；叙述还没有说完。','拾柒把外出记录册、交换箱压痕和三层路线纸放到检视灯箱前。','共同浅痕可以先被称为事实；更晚出现的箭头和备注仍需单独标明。','四处都看过了，你想怎样区分事实与解释？','先保留事实浅痕，再注明解释层','稳妥。事实和解释都留下，但不混成一句话。','先标出解释偏移，再回看原始浅痕','可以。先暴露偏移，再确认它没有改写底层。','三层浅痕已经对齐。共同事实留在底层，后来补上的解释各自有了位置。')
  )
  UPDATE flash_story_episodes e
  SET content = (CASE WHEN e.content ->> 'v' = '2' THEN '{}'::jsonb ELSE e.content - 'v' - 'start' - 'nodes' END)
    || jsonb_build_object(
      'opening', copy.opening,
      'action', copy.action,
      'discovery', copy.discovery,
      'question', jsonb_build_object(
        'id', copy.code || '-first-act-response-v1',
        'prompt', copy.prompt,
        'options', jsonb_build_array(
          jsonb_build_object('id', copy.code || '-cooperate-a', 'label', copy.a_label, 'tags', jsonb_build_array()),
          jsonb_build_object('id', copy.code || '-cooperate-b', 'label', copy.b_label, 'tags', jsonb_build_array())
        )
      ),
      'responseByOption', jsonb_build_object(
        copy.code || '-cooperate-a', copy.a_response,
        copy.code || '-cooperate-b', copy.b_response
      ),
      'closing', copy.closing
    ),
    content_version = e.content_version + 1,
    review_status = 'draft',
    updated_at = now()
  FROM flash_story_seasons s, copy
  WHERE e.season_id = s.id
    AND s.code = 'unnamed-objects-s1'
    AND e.code = copy.code;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 4 THEN
    RAISE EXCEPTION 'Flash first-act rebuild expected 4 updates, applied %', updated_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM flash_story_episodes e
    JOIN flash_story_seasons s ON s.id = e.season_id
    WHERE s.code = 'unnamed-objects-s1'
      AND e.code IN ('s1-p1-alang', 's1-p1-lizi', 's1-p1-momo', 's1-p1-shiqi')
      AND (e.content ->> 'v' = '2' OR e.content #>> '{question,id}' <> e.code || '-first-act-response-v1')
  ) THEN
    RAISE EXCEPTION 'Flash first-act rebuild postcondition failed';
  END IF;

  RAISE NOTICE 'Flash first-act contracts rebuilt for 4 episodes; operator review required.';
END
$migration$;

COMMIT;

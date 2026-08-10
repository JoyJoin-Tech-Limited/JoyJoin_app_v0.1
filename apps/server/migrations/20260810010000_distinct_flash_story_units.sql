BEGIN;

-- Candidate copy for the 15 formal first-season units. This is a content backfill,
-- not a review action: changed rows return to draft and require operator review.
-- SAFETY / ABORT: only the exact canonical v1 question + response map in a draft
-- season is eligible. A published season, an operator version bump, or any edited
-- question/response is left untouched. The transaction aborts on row-count drift.
-- ROLLBACK: do not auto-reverse after review. Before applying, retain a DB backup or
-- release snapshot; if validation fails, ROLLBACK this transaction. After commit,
-- restore only from that snapshot and have an operator review again before publish.
DO $migration$
DECLARE
  eligible_count integer := 0;
  updated_count integer := 0;
BEGIN
  IF to_regclass('public.flash_story_episodes') IS NULL OR to_regclass('public.flash_story_seasons') IS NULL THEN
    RAISE NOTICE 'Flash story tables are absent; distinct-unit copy skipped.';
    RETURN;
  END IF;

  WITH copy(code, opening, prompt, a_label, a_response, b_label, b_response) AS (VALUES
    ('s1-p1-alang','我们应该没见过。我叫阿浪。这张座位图总像少了个人，陪我把距离摆回来？','你愿意怎么和我开始？','我先陪你把两把椅子的距离摆清楚。','阿浪按住图角：对，先看距离最直接。它不是通用座位建议，一直在等一个人。','我先问：这张图为什么总少一个人？','阿浪看了看空位：因为我一直替别人留着答案。先把图摆好，我再把这件事说清。'),
    ('s1-p1-lizi','第一次见，我叫栗子。这几支彩笔的笔帽全乱了，陪我试一笔？','你愿意怎么和我开始？','我想先按试写痕迹配回笔帽。','栗子把三支笔并排放好：好主意，颜色没消失，只是我们一直叫错了它们。','我想先知道：哪支笔最久没被用过？','栗子转了转笔身：你看见干掉的那支了。先配回来，也许就知道它为什么一直被留下。'),
    ('s1-p1-momo','我们还不认识。我叫默默。先别翻到结尾，帮我找到这本路线册真正断开的地方。','你愿意怎么和我开始？','我会沿着最后一条实线走，不抢着翻页。','默默点头：这样就够了。断点比结尾更接近我没说出口的那句话。','我想先停在第一张空白页前。','默默把手移开：你也觉得该停在这里。不是没有下一站，是我没把邀请说出口。'),
    ('s1-p1-shiqi','我们应该没见过。我叫拾柒。这本出门册一次也没用过，却留下三道重叠的短线。陪我对齐？','你愿意怎么和我开始？','我和你一起对齐纸页，不替主人删选项。','拾柒把册子转向你：谢谢。三条线方向完全一致，看来它们不是随手留下的。','我先看三条短线，不猜它们代表谁。','拾柒把灯挪近：这样更稳妥。先确认痕迹，再决定能不能继续往下推。'),
    ('s1-p1-atuan','第一次碰面，我叫阿团。这几张观察卡里有不该留下的细节，帮我分开？','你愿意怎么和我开始？','我会留下城市细节，把名字和时间盖住。','阿团收好被盖住的部分：能分享的已经够了，剩下的应该还给它的主人。','我先不翻背面，只看正面能公开的部分。','阿团把卡背压住：谢谢。守住不该看的，比猜对它写给谁更重要。'),
    ('s1-p2-alang','你还记得那本只写一半的路线册吗？最后一条路，我认识。','这次你想怎样陪我确认？','我只接回已经留下的那段路。','阿浪点点头：是我走过的方向。接回来不是为了追谁，只是把事实说清。','我想听你自己说，这条路停在哪里。','阿浪没有绕开：停在搬家以前。那时我以为，只要留着空白，就不算放弃同行。'),
    ('s1-p2-lizi','你还记得那本出门册？那些重复圈起来的地方……都是我画的。','这次你想怎样陪我确认？','我先看清你反复留下的那一格。','栗子笑了一下：对，我每次都舍不得删，又每次都找理由不去。','我不替你删，只想知道你为什么总留下它。','栗子抿了抿嘴：因为只要它还在清单里，我就能说自己以后会去。'),
    ('s1-p2-momo','那些笔帽，你也觉得配错了吧？我来换回去——这几支笔，是我准备的。','这次你想怎样陪我确认？','我按试写痕迹陪你把它们配回来。','默默握住还能写的那支：它们原本不是礼物，是我没能说完的一道选择题。','我想知道，你原本准备让谁来选颜色。','默默停了一会：栗子。可我把问题藏进笔里，结果谁也没有真的收到。'),
    ('s1-p2-shiqi','卡背你没翻，对吧？谢谢。至于那条时间记录……是我写的。','这次你想怎样陪我确认？','我陪你分清观察和越界。','拾柒没有辩解：我记得很准，但准确从来不等于有权保存。','我想问：如果记录很准确，为什么还要删？','拾柒看着那一格：因为它准确到能追踪一个人。好意不能替代同意。'),
    ('s1-p2-atuan','这张座位图，转到这个方向才对。我改过不止一版，你看出来了吗？','这次你想怎样陪我确认？','我帮你把真正量过的距离摆回来。','阿团把图压平：每一版都在躲开默默不舒服的声音。它一直有明确的对象。','我想知道，你为什么改了这么多次还没交出去。','阿团摸了摸图角：照顾一个人容易，承认自己想靠近他，难一点。'),
    ('s1-p3-alang','那本路线册，我不想再替两个人留着了。陪我把该保留和该归还的分开？','最后这次，你愿意怎样搭把手？','我陪你走完保留的路，再把空白页交还。','阿浪把空白页递出去：自己的路我会留下，别人的位置不再由我占着。','我想确认：归还空白，不等于否定走过的路。','阿浪合上前半本：当然不等于。留下事实，放下替别人预留的未来，是两件事。'),
    ('s1-p3-lizi','我真的去了。没多特别——但这次，我想先把第一格画上。','最后这次，你愿意怎样搭把手？','我只帮你记下“发生过”，不替它打分。','栗子认真画下标记：普通也不是白去。至少这一次，我没有把出门留在计划里。','我想先听你说，普通的一天值不值得记。','栗子笑了：以前我会说不值。现在我觉得，真的去过就已经和计划不一样。'),
    ('s1-p3-momo','那支还能写的笔，我留到了现在。今天不绕了，我会亲口问栗子。','最后这次，你愿意怎样搭把手？','我帮你找到笔，邀请由你自己说完。','默默写下时间和两个方向：这次不用谁替我传话，答案也留给栗子自己。','我只提醒你把时间和方向说完整。','默默写完最后一行：够了。清楚不是逼她答应，只是不再让她猜我的意思。'),
    ('s1-p3-shiqi','那张卡还在。我犯的错也在。城市细节留下，阿浪的时间删掉。','最后这次，你愿意怎样搭把手？','我陪你留下城市，也陪你删掉越界的记录。','拾柒确认删除：记录的边界应该由被记录的人决定，不由我的好意决定。','我想看你亲自决定哪一部分不再恢复。','拾柒选中时间记录：就是这一部分。城市还在，阿浪的规律不会再被我保存。'),
    ('s1-p3-atuan','图上两个位置，我都写上名字了。默默的答案，让他自己来选。','最后这次，你愿意怎样搭把手？','我帮你把邀请摆清楚，不替任何人回答。','阿团把图推过去：我的意思已经写明白了。靠近多少，接下来由默默决定。','我想确认：即使他只愿意并肩坐一次，也算回答。','阿团点头：当然。邀请属于我，边界和答案属于他。')
  ), baseline AS (
    SELECT e.id
    FROM flash_story_episodes e
    JOIN flash_story_seasons s ON s.id = e.season_id
    JOIN copy ON copy.code = e.code
    WHERE s.code = 'unnamed-objects-s1'
      AND s.status = 'draft'
      AND e.content_version = 1
      AND e.review_status = 'reviewed'
      AND e.content #> '{question}' = jsonb_build_object(
        'id', copy.code || '-choice',
        'prompt', '你最想接着问哪一句？',
        'options', jsonb_build_array(
          jsonb_build_object('id', 'notice-action', 'label', '我想问：你为什么这样做？', 'tags', jsonb_build_array()),
          jsonb_build_object('id', 'notice-object', 'label', '我想看看：旧物还留下了什么？', 'tags', jsonb_build_array()),
          jsonb_build_object('id', 'notice-relationship', 'label', '等等，这件旧物和谁有关？', 'tags', jsonb_build_array())
        )
      )
      AND e.content #> '{responseByOption}' = jsonb_build_object(
        'notice-action', '你先留意了那个动作。有时候，动作比解释更诚实。',
        'notice-object', '你把目光留在旧物上。那些不起眼的痕迹，替过去补上了一小段。',
        'notice-relationship', '你追问了那段没说完的关系。旧物和另一个角色，终于连上了一点。'
      )
  )
  SELECT count(*) INTO eligible_count FROM baseline;

  -- Never leave a season half-migrated. Zero rows is the idempotent/already-
  -- handled path; the only writable baseline is the complete canonical set.
  IF eligible_count <> 0 AND eligible_count <> 15 THEN
    RAISE EXCEPTION 'Flash story CAS drift: expected 0 or 15 canonical rows, found %', eligible_count;
  END IF;

  WITH copy(code, opening, prompt, a_label, a_response, b_label, b_response) AS (VALUES
    ('s1-p1-alang','我们应该没见过。我叫阿浪。这张座位图总像少了个人，陪我把距离摆回来？','你愿意怎么和我开始？','我先陪你把两把椅子的距离摆清楚。','阿浪按住图角：对，先看距离最直接。它不是通用座位建议，一直在等一个人。','我先问：这张图为什么总少一个人？','阿浪看了看空位：因为我一直替别人留着答案。先把图摆好，我再把这件事说清。'),
    ('s1-p1-lizi','第一次见，我叫栗子。这几支彩笔的笔帽全乱了，陪我试一笔？','你愿意怎么和我开始？','我想先按试写痕迹配回笔帽。','栗子把三支笔并排放好：好主意，颜色没消失，只是我们一直叫错了它们。','我想先知道：哪支笔最久没被用过？','栗子转了转笔身：你看见干掉的那支了。先配回来，也许就知道它为什么一直被留下。'),
    ('s1-p1-momo','我们还不认识。我叫默默。先别翻到结尾，帮我找到这本路线册真正断开的地方。','你愿意怎么和我开始？','我会沿着最后一条实线走，不抢着翻页。','默默点头：这样就够了。断点比结尾更接近我没说出口的那句话。','我想先停在第一张空白页前。','默默把手移开：你也觉得该停在这里。不是没有下一站，是我没把邀请说出口。'),
    ('s1-p1-shiqi','我们应该没见过。我叫拾柒。这本出门册一次也没用过，却留下三道重叠的短线。陪我对齐？','你愿意怎么和我开始？','我和你一起对齐纸页，不替主人删选项。','拾柒把册子转向你：谢谢。三条线方向完全一致，看来它们不是随手留下的。','我先看三条短线，不猜它们代表谁。','拾柒把灯挪近：这样更稳妥。先确认痕迹，再决定能不能继续往下推。'),
    ('s1-p1-atuan','第一次碰面，我叫阿团。这几张观察卡里有不该留下的细节，帮我分开？','你愿意怎么和我开始？','我会留下城市细节，把名字和时间盖住。','阿团收好被盖住的部分：能分享的已经够了，剩下的应该还给它的主人。','我先不翻背面，只看正面能公开的部分。','阿团把卡背压住：谢谢。守住不该看的，比猜对它写给谁更重要。'),
    ('s1-p2-alang','你还记得那本只写一半的路线册吗？最后一条路，我认识。','这次你想怎样陪我确认？','我只接回已经留下的那段路。','阿浪点点头：是我走过的方向。接回来不是为了追谁，只是把事实说清。','我想听你自己说，这条路停在哪里。','阿浪没有绕开：停在搬家以前。那时我以为，只要留着空白，就不算放弃同行。'),
    ('s1-p2-lizi','你还记得那本出门册？那些重复圈起来的地方……都是我画的。','这次你想怎样陪我确认？','我先看清你反复留下的那一格。','栗子笑了一下：对，我每次都舍不得删，又每次都找理由不去。','我不替你删，只想知道你为什么总留下它。','栗子抿了抿嘴：因为只要它还在清单里，我就能说自己以后会去。'),
    ('s1-p2-momo','那些笔帽，你也觉得配错了吧？我来换回去——这几支笔，是我准备的。','这次你想怎样陪我确认？','我按试写痕迹陪你把它们配回来。','默默握住还能写的那支：它们原本不是礼物，是我没能说完的一道选择题。','我想知道，你原本准备让谁来选颜色。','默默停了一会：栗子。可我把问题藏进笔里，结果谁也没有真的收到。'),
    ('s1-p2-shiqi','卡背你没翻，对吧？谢谢。至于那条时间记录……是我写的。','这次你想怎样陪我确认？','我陪你分清观察和越界。','拾柒没有辩解：我记得很准，但准确从来不等于有权保存。','我想问：如果记录很准确，为什么还要删？','拾柒看着那一格：因为它准确到能追踪一个人。好意不能替代同意。'),
    ('s1-p2-atuan','这张座位图，转到这个方向才对。我改过不止一版，你看出来了吗？','这次你想怎样陪我确认？','我帮你把真正量过的距离摆回来。','阿团把图压平：每一版都在躲开默默不舒服的声音。它一直有明确的对象。','我想知道，你为什么改了这么多次还没交出去。','阿团摸了摸图角：照顾一个人容易，承认自己想靠近他，难一点。'),
    ('s1-p3-alang','那本路线册，我不想再替两个人留着了。陪我把该保留和该归还的分开？','最后这次，你愿意怎样搭把手？','我陪你走完保留的路，再把空白页交还。','阿浪把空白页递出去：自己的路我会留下，别人的位置不再由我占着。','我想确认：归还空白，不等于否定走过的路。','阿浪合上前半本：当然不等于。留下事实，放下替别人预留的未来，是两件事。'),
    ('s1-p3-lizi','我真的去了。没多特别——但这次，我想先把第一格画上。','最后这次，你愿意怎样搭把手？','我只帮你记下“发生过”，不替它打分。','栗子认真画下标记：普通也不是白去。至少这一次，我没有把出门留在计划里。','我想先听你说，普通的一天值不值得记。','栗子笑了：以前我会说不值。现在我觉得，真的去过就已经和计划不一样。'),
    ('s1-p3-momo','那支还能写的笔，我留到了现在。今天不绕了，我会亲口问栗子。','最后这次，你愿意怎样搭把手？','我帮你找到笔，邀请由你自己说完。','默默写下时间和两个方向：这次不用谁替我传话，答案也留给栗子自己。','我只提醒你把时间和方向说完整。','默默写完最后一行：够了。清楚不是逼她答应，只是不再让她猜我的意思。'),
    ('s1-p3-shiqi','那张卡还在。我犯的错也在。城市细节留下，阿浪的时间删掉。','最后这次，你愿意怎样搭把手？','我陪你留下城市，也陪你删掉越界的记录。','拾柒确认删除：记录的边界应该由被记录的人决定，不由我的好意决定。','我想看你亲自决定哪一部分不再恢复。','拾柒选中时间记录：就是这一部分。城市还在，阿浪的规律不会再被我保存。'),
    ('s1-p3-atuan','图上两个位置，我都写上名字了。默默的答案，让他自己来选。','最后这次，你愿意怎样搭把手？','我帮你把邀请摆清楚，不替任何人回答。','阿团把图推过去：我的意思已经写明白了。靠近多少，接下来由默默决定。','我想确认：即使他只愿意并肩坐一次，也算回答。','阿团点头：当然。邀请属于我，边界和答案属于他。')
  ), baseline AS (
    SELECT e.id
    FROM flash_story_episodes e
    JOIN flash_story_seasons s ON s.id = e.season_id
    JOIN copy ON copy.code = e.code
    WHERE s.code = 'unnamed-objects-s1'
      AND s.status = 'draft'
      AND e.content_version = 1
      AND e.review_status = 'reviewed'
      AND e.content #> '{question}' = jsonb_build_object(
        'id', copy.code || '-choice',
        'prompt', '你最想接着问哪一句？',
        'options', jsonb_build_array(
          jsonb_build_object('id', 'notice-action', 'label', '我想问：你为什么这样做？', 'tags', jsonb_build_array()),
          jsonb_build_object('id', 'notice-object', 'label', '我想看看：旧物还留下了什么？', 'tags', jsonb_build_array()),
          jsonb_build_object('id', 'notice-relationship', 'label', '等等，这件旧物和谁有关？', 'tags', jsonb_build_array())
        )
      )
      AND e.content #> '{responseByOption}' = jsonb_build_object(
        'notice-action', '你先留意了那个动作。有时候，动作比解释更诚实。',
        'notice-object', '你把目光留在旧物上。那些不起眼的痕迹，替过去补上了一小段。',
        'notice-relationship', '你追问了那段没说完的关系。旧物和另一个角色，终于连上了一点。'
      )
  )
  UPDATE flash_story_episodes e
  SET content = e.content || jsonb_build_object(
      'opening', copy.opening,
      'question', jsonb_build_object(
        'id', copy.code || '-response-v2',
        'prompt', copy.prompt,
        'options', jsonb_build_array(
          jsonb_build_object('id', copy.code || '-cooperate-a', 'label', copy.a_label, 'tags', jsonb_build_array()),
          jsonb_build_object('id', copy.code || '-cooperate-b', 'label', copy.b_label, 'tags', jsonb_build_array())
        )
      ),
      'responseByOption', jsonb_build_object(
        copy.code || '-cooperate-a', copy.a_response,
        copy.code || '-cooperate-b', copy.b_response
      )
    ),
    content_version = e.content_version + 1,
    review_status = 'draft',
    updated_at = now()
  FROM copy, baseline
  WHERE e.id = baseline.id
    AND e.code = copy.code;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> eligible_count THEN
    RAISE EXCEPTION 'Flash story CAS drift: expected % updates, applied %', eligible_count, updated_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM flash_story_episodes e
    JOIN flash_story_seasons s ON s.id = e.season_id
    WHERE s.code = 'unnamed-objects-s1'
      AND s.status = 'draft'
      AND e.content_version = 1
      AND e.review_status = 'reviewed'
      AND e.content #>> '{question,id}' = e.code || '-choice'
      AND e.content #>> '{question,prompt}' = '你最想接着问哪一句？'
      AND e.content #>> '{responseByOption,notice-action}' = '你先留意了那个动作。有时候，动作比解释更诚实。'
  ) THEN
    RAISE EXCEPTION 'Flash story postcondition failed: canonical v1 rows remain eligible';
  END IF;

  RAISE NOTICE 'Flash story candidate copy updated % canonical draft rows; operator review required', updated_count;
END
$migration$;

COMMIT;

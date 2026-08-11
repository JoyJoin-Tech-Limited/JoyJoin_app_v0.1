-- Flash story episode v2 SEASON 1 FULL: 15 units (all NPCs, phases 1-3).
-- Content authority: apps/server/src/data/flashStoryPilot/v2-season1.json
-- Deploy gate: apply ONLY after pilot 5-unit staging QA passes + supervisor sign-off (flashStoryV2Enabled).
-- Idempotent: guarded by exact code + content_version so re-run converges.
BEGIN;
UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第一轮回。交换箱放在你脚边，盖子敞着。"},{"text":"阿浪蹲在箱子旁边，手里捏着一张纸。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"他把那张折得很薄的图摊在膝盖上。两道椅子的距离被反复涂改过，叠着两三道不同力度的铅笔线。"},{"text":"他先量了图上两把椅子的距离，又把纸转了一个方向。"},{"text":"你想先注意哪一件事？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-changes","text":"这张图改了不止一次。","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-alang-noticed-edits"]}},{"id":"flip-paper","text":"把纸翻过来","kind":"path","next":"n4_echo_b","effect":{"echo":5}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“七次。”阿浪说。他报出数字，没有解释。"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"纸的背面，铅笔写着“声音”和“阴影”。另一半被擦掉了，只剩下淡灰的痕迹。"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"阿浪把图按原来的折痕收好，准备放回交换箱。"},{"text":"他忽然停了一下。“这箱子里……有金属碰过木板的声音。”"},{"text":"他没有再说下去。"}],"unlockFragment":"s1-p1-alang-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p1-alang';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第二轮。认领开始的时候，阿浪从箱里把路线本拿了出来。"},{"text":"他没有翻，先把册子平放在膝盖上。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"册子前半写满了折痕和转弯的标记，后半是空的。"},{"text":"他用手指停在最后一条已经写下的路线旁。"},{"text":"你想问哪一句？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"note-empty","text":"后半本一直空着。","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-alang-routebook-empty"]}},{"id":"ask-tear","text":"你想过把它撕掉吗？","kind":"destiny","next":"n4_echo_b","effect":{"echo":20,"flagsSet":["s1-alang-asked-tear"]}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“写过的人没来。”阿浪说。"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"阿浪停了很久。"},{"text":"“想过。每天。”"},{"text":"他把册子合上了。"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"“她以为是份工作。”阿浪把册子放回箱里，往箱底推了推。"}],"unlockFragment":"s1-p2-alang-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p2-alang';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第三轮。最后处理旧物的时候，阿浪带着拆开的册子回来了。"},{"text":"前半本和后半本被分开，空白页朝上放着。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"他把空白的后半本推到你面前。"},{"text":"“你想好了吗？”"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-owner","text":"这是留给谁的？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-alang-owner-asked"]}},{"id":"write-date","text":"在空白页上写下今天的日期","kind":"path","next":"n4_echo_b","effect":{"echo":15,"flagsSet":["s1-alang-wrote-date"]}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“留给一个误会。”阿浪说。“拾柒以为我要的是记录员。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"阿浪看着你写下的日期，没有动。"},{"text":"很久。“那天，我也记错了日子。”"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"空白页被拾柒接了过去。"},{"text":"“那天我……”拾柒停住，把后半本翻到了第一页。"}],"unlockFragment":"s1-p3-alang-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p3-alang';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第一轮回。拾柒把出门册从箱里取出来，没有立刻翻开。"},{"text":"他先对着光，把空白盖章区逐页看过去。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"册子很轻。盖章区全是空的，几个地点被重复圈选过。"},{"text":"第一页的角落里，有一行铅笔写的淡痕日期。"},{"text":"你想先确认哪一处？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"note-circles","text":"圈选最多的那一项，是最近加的。","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-shiqi-noted-circles"]}},{"id":"point-pencil","text":"指着第一页的铅笔痕","kind":"path","next":"n4_echo_b","effect":{"echo":15,"flagsSet":["s1-shiqi-saw-pencil"]}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"拾柒核对页码。“不是。是第九项。加了三次。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"“铅笔痕比册子早三个月。”拾柒翻过那一页。“不归属本次交换。”"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"拾柒在册子扉页记下编号，没有替主人补上任何答案。"},{"text":"在记录页的角落，他画了一个很小的钥匙轮廓。"}],"unlockFragment":"s1-p1-shiqi-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p1-shiqi';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第三轮。拾柒把五张卡背面的名字朝下放好。"},{"text":"他只读正面的城市细节，没有翻看写给谁。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"五张统一的卡片。其中一张的背面，写着阿浪的名字——记录了他的固定活动时间。"},{"text":"拾柒把那张卡单独抽了出来。"},{"text":"你想说什么？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"note-boundary","text":"这张不该在箱子里。","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-shiqi-boundary-noted"]}},{"id":"hand-back","text":"当着他的面把那张卡递回去","kind":"destiny","next":"n4_echo_b","effect":{"echo":20,"flagsSet":["s1-shiqi-handed-back"]}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"拾柒核对背面的名字。“是整理失误。”"},{"text":"他停了一秒。“但记录它，不是失误。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"拾柒接过卡，看了你一眼。“你替我拿了回来。”"},{"text":"他把城市细节保留，删掉了时间行。"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"剩下四张卡被重新装回信封。拾柒把删除的那页折起，没有撕。"},{"text":"折起的卡片背面，铅笔画着一个钥匙轮廓——日期比这只箱子更早。"}],"unlockFragment":"s1-p3-shiqi-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p3-shiqi';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第一轮回。栗子把五支彩笔按颜色排开。"},{"text":"她逐支试写，又检查了笔帽与笔身不一致的地方。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"五支笔。其中两支的笔帽和笔身颜色对不上。"},{"text":"你想先注意哪一件事？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-caps","text":"笔帽怎么不配对？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-lizi-noted-caps"]}},{"id":"pick-one","text":"拿起那支配得上的笔","kind":"path","next":"n4_echo_b","effect":{"echo":5}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“也不是……就是说，有人换过。”栗子把笔帽一个个转回去。“换的人，大概想挑一个颜色。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"栗子接过那支笔，笔帽内侧是湿的。“这支……最近还用过。”"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"“五支笔，五个方向。”栗子把它们排好。“选颜色的人，后来大概没来。”"}],"unlockFragment":"s1-p1-lizi-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p1-lizi';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第二轮。栗子一眼认出自己重复圈过的项目。"},{"text":"她把册子翻到圈选最密的那页，停了下来。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"三个地点被反复圈选，笔迹一次比一次重。册脊上系着一截褪色的挂绳。"},{"text":"你想说什么？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-why","text":"为什么圈这么多遍？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-lizi-asked-why"]}},{"id":"suggest-delete","text":"删掉它们吧。","kind":"path","next":"n4_echo_b","effect":{"echo":5,"flagsSet":["s1-lizi-considered-delete"]}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“我就是想确认一下……哪一项最值得去。”栗子把册子翻过来。“结果列得越长，越出不了门。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"栗子拿着笔，悬在册子上。“删掉以后，就只剩一件要做的事了。”"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"“我怕的不是出门。”栗子说。“是去了以后，发现它很普通。”"},{"text":"她把册子合上，指尖停在挂绳上。“这个颜色……我好像在哪件旧物上见过。”"}],"unlockFragment":"s1-p2-lizi-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p2-lizi';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第三轮。栗子在最小的一项旁画下完成标记。"},{"text":"她没有评价是否值得，只记录自己确实做完了。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"册子翻到第一格。盖章区盖了章，旁边写着一行小字：便利店，买了一瓶水。"},{"text":"你想问什么？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-feel","text":"完成的感觉怎么样？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-lizi-completed"]}},{"id":"ask-next","text":"下一项是什么？","kind":"path","next":"n4_echo_b","effect":{"echo":5}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“普通得很。”栗子笑了一下。“就是去了，买了一杯喝的，又回来了。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"“下一项……还没想好跟谁一起去。”栗子把册子合上又翻开。"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"“普通并不等于白去。”栗子把册子收好，没有评价是否值得。"},{"text":"挂绳在她指间绕了一圈。“这截绳子，我记起来了。它系过一把钥匙。”"}],"unlockFragment":"s1-p3-lizi-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p3-lizi';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第一轮回。默默翻开一本前半写满、后半空着的册子。"},{"text":"他没有继续往后翻，只用手指停在最后一条已写路线旁。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"前半段的路线记录得很细，转弯、坡度、休息点都标着。"},{"text":"你想听他说什么？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-hear","text":"你听到了什么？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-momo-listening"]}},{"id":"follow-finger","text":"顺着他的手指看那条路线","kind":"path","next":"n4_echo_b","effect":{"echo":5}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“前半是一个人写的。后半……是留给另一个人的。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"路线最后停在城东，没有画下去。页码那里，压着一道浅痕。"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"“那个人一直没有动笔。”默默合上册子，想起什么。"},{"text":"“这箱子……有金属滑进过更深的地方。撞了两下。”"}],"unlockFragment":"s1-p1-momo-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p1-momo';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第二轮。默默把错配的笔帽一个个换回去。"},{"text":"他换得很慢，每一支都先对着光看一会儿。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"五支笔整齐了。笔身颜色各不同，笔帽终于各归其位。"},{"text":"你想说什么？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"say-still-time","text":"现在开口，还来得及。","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-momo-encouraged"]}},{"id":"ask-waiting","text":"你在等什么时机？","kind":"path","next":"n4_echo_b","effect":{"echo":5}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“我总把开口延后到东西都失效。”默默换好最后一个笔帽。"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"“等……等到颜色不会干的那天。结果等不到。”"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"他保留其中一支笔，放进口袋。“这支，当提醒。”"}],"unlockFragment":"s1-p2-momo-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p2-momo';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第三轮。默默把保留下来的那支笔放在最上面。"},{"text":"他站了一会儿，然后开口。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"“栗子。下周。”默默说。“南边的公园，或者旧书市，你挑一个。”"},{"text":"时间、方向，都是他亲口说出来的。你想接哪一句？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-answer","text":"栗子会答应吗？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-momo-invited"]}},{"id":"ask-places","text":"这两个方向，是你挑的吗？","kind":"path","next":"n4_echo_b","effect":{"echo":5}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“会不会答应，是栗子的事。”默默说。“说不说，是我的事。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"“都是她圈过的地方。”默默说。“我记下来了。”"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"“我说完了。”默默把笔收起来，没有替栗子回答。"}],"unlockFragment":"s1-p3-momo-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p3-momo';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第一轮回。阿团把五张卡背面的名字朝下放好。"},{"text":"他只读正面的城市细节，没有擅自翻看写给谁。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"五张卡片。正面的记录写得细：梧桐山南坡，下午三点，树影最长。"},{"text":"你想问什么？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-city","text":"记的是哪座城市？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-atuan-read-cards"]}},{"id":"suggest-turn","text":"不看看背面吗？","kind":"path","next":"n4_echo_b","effect":{"echo":5}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“都是深圳的角落。”阿团念出其中一处。“梧桐山南坡，下午三点，树影最长。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"“背面是名字……不是写给我的。”阿团没有翻。"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"放回卡片时，阿团发现交换箱底板一边高一边低。"},{"text":"“这底板……松的。”他按了一下，夹层里露出一把钥匙的轮廓。"}],"unlockFragment":"s1-p1-atuan-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p1-atuan';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第二轮。阿团把图转回只有自己习惯的朝向。"},{"text":"图上的两把椅子，距离被反复涂改过。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"图上的两把椅子之间，涂改痕迹叠了好几层——每一版都在避开同一个问题：椅子之间，坐得下什么声音。"},{"text":"你想问什么？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-owner","text":"这张图，画给谁的？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-atuan-owner-asked"]}},{"id":"ask-distance","text":"椅子中间的距离，是你定的？","kind":"path","next":"n4_echo_b","effect":{"echo":5}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“也不是……就是说……画给一个怕吵的人。”阿团没有说出名字。"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"“距离不是定的。是试的。”阿团说。“坐得近，他会不安；坐得远，他会听不清。”"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"“这不是通用座位建议，是一份迟迟没有交出去的邀请。”阿团把图折好。"}],"unlockFragment":"s1-p2-atuan-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p2-atuan';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第三轮。阿团在两把椅子旁分别写下自己和默默的名字。"},{"text":"他把图交给默默，没有替对方回答。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"“这是一份想更靠近一点的邀请。”阿团说。“可以算表白，也可以只算并肩坐下。”"},{"text":"你想接哪一句？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-confession","text":"这算表白吗？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-atuan-gave-seat-plan"]}},{"id":"ask-accepted","text":"默默收下了吗？","kind":"path","next":"n4_echo_b","effect":{"echo":5}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“可以算。也可以只算并肩坐下。”阿团说。“答案不由我定。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"“他收下了。”阿团的声音低下来。“没说别的。”"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"收回的五件旧物都有了去向。"},{"text":"夹层里的钥匙仍躺在箱底。钥匙柄与夹板内侧，刻着同样的三道短线。"},{"text":"它属于一位已经离开的数字居民。钥匙等待下一季。"}],"unlockFragment":"s1-p3-atuan-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p3-atuan';

UPDATE flash_story_episodes e
SET content = '{"v":2,"start":"n1_setup","nodes":{"n1_setup":{"id":"n1_setup","type":"prose","segments":[{"text":"第二轮。拾柒先检查了卡片是否被翻过。"},{"text":"她把五张卡按顺序码好，确认没有人动过。"}],"next":"n2_object"},"n2_object":{"id":"n2_object","type":"prose","segments":[{"text":"其中一张卡背面，是写给阿浪的记录——固定活动时间，写得精确。"},{"text":"你想说什么？"}],"next":"n3_choice"},"n3_choice":{"id":"n3_choice","type":"choice","choices":[{"id":"ask-privacy","text":"记录被翻过，你很在意？","kind":"attitude","next":"n4_echo_a","effect":{"echo":10,"flagsSet":["s1-shiqi-boundary-checked"]}},{"id":"ask-delete","text":"那条记录，会删掉吗？","kind":"path","next":"n4_echo_b","effect":{"echo":5,"flagsSet":["s1-shiqi-delete-asked"]}}]},"n4_echo_a":{"id":"n4_echo_a","type":"callback","segments":[{"text":"“在意。记录是我的，翻动是别人的事。”拾柒把卡片顺序复原。“但内容……是我的错。”"}],"next":"n5_close"},"n4_echo_b":{"id":"n4_echo_b","type":"callback","segments":[{"text":"“会删。”拾柒说。“记录得准确，不代表有权保存。”"}],"next":"n5_close"},"n5_close":{"id":"n5_close","type":"closure","segments":[{"text":"她把那张卡单独留下，准备亲自处理。"},{"text":"翻过那叠卡时，最底下露出一张更旧的卡——背面画着一把钥匙的轮廓，柄上有三道短线。“我画过它。时间比这次交换早。”"}],"unlockFragment":"s1-p2-shiqi-fragment"}}}'::jsonb, content_version = content_version + 1, updated_at = now()
FROM flash_story_seasons s
WHERE e.season_id = s.id
  AND s.code = 'unnamed-objects-s1'
  AND e.code = 's1-p2-shiqi';

COMMIT;

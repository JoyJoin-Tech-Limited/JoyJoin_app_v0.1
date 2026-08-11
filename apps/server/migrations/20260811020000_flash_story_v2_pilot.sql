-- Flash story episode v2 pilot content: 5 units (Alang p1/p2/p3 + Shiqi p1/p3).
-- Content authority: apps/server/src/data/flashStoryPilot/v2-pilot.json
-- Deploy gate: apply ONLY after the taro v2 UI sprint lands + supervisor sign-off (flashStoryV2Enabled).
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

COMMIT;

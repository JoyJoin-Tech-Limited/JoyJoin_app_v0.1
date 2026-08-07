CREATE TABLE IF NOT EXISTS flash_story_seasons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(60) NOT NULL UNIQUE,
  title varchar(120) NOT NULL,
  premise text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  published_at timestamptz,
  published_by varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flash_story_seasons_status ON flash_story_seasons(status, published_at);

CREATE TABLE IF NOT EXISTS flash_story_episodes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id varchar NOT NULL REFERENCES flash_story_seasons(id) ON DELETE CASCADE,
  npc_id varchar NOT NULL REFERENCES flash_npcs(id),
  code varchar(80) NOT NULL,
  phase integer NOT NULL CHECK (phase BETWEEN 1 AND 3),
  sort_order integer NOT NULL,
  title varchar(120) NOT NULL,
  object_code varchar(60) NOT NULL,
  content jsonb NOT NULL,
  motion jsonb NOT NULL DEFAULT '{"ambient":"breathe"}'::jsonb,
  review_status varchar(24) NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'reviewed')),
  content_version integer NOT NULL DEFAULT 1 CHECK (content_version > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, code),
  UNIQUE(season_id, phase, npc_id)
);
CREATE INDEX IF NOT EXISTS idx_flash_story_episode_runtime ON flash_story_episodes(season_id, phase, is_active, review_status);

CREATE TABLE IF NOT EXISTS flash_story_fragments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id varchar NOT NULL REFERENCES flash_story_episodes(id) ON DELETE CASCADE,
  code varchar(80) NOT NULL UNIQUE,
  category varchar(24) NOT NULL CHECK (category IN ('object', 'past', 'relationship', 'key')),
  title varchar(120) NOT NULL,
  fact text NOT NULL,
  asset_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flash_story_fragment_episode ON flash_story_fragments(episode_id, sort_order);

ALTER TABLE flash_encounters ADD COLUMN IF NOT EXISTS story_episode_id varchar REFERENCES flash_story_episodes(id);

CREATE TABLE IF NOT EXISTS flash_user_story_progress (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id varchar NOT NULL REFERENCES flash_story_seasons(id) ON DELETE CASCADE,
  current_phase integer NOT NULL DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 3),
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, season_id)
);
CREATE INDEX IF NOT EXISTS idx_flash_user_story_progress_status ON flash_user_story_progress(user_id, status);

CREATE TABLE IF NOT EXISTS flash_user_story_episodes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id varchar NOT NULL REFERENCES flash_story_episodes(id) ON DELETE CASCADE,
  encounter_id varchar NOT NULL REFERENCES flash_encounters(id),
  selected_option_id varchar(80) NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, episode_id),
  UNIQUE(encounter_id)
);
CREATE INDEX IF NOT EXISTS idx_flash_user_story_episode_user ON flash_user_story_episodes(user_id, completed_at);

CREATE TABLE IF NOT EXISTS flash_user_story_fragments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fragment_id varchar NOT NULL REFERENCES flash_story_fragments(id) ON DELETE CASCADE,
  episode_id varchar NOT NULL REFERENCES flash_story_episodes(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, fragment_id)
);
CREATE INDEX IF NOT EXISTS idx_flash_user_story_fragments_user ON flash_user_story_fragments(user_id, unlocked_at);

INSERT INTO flash_story_seasons(code, title, premise, status, version)
VALUES ('unnamed-objects-s1', '没有名字的旧物', '五位数字动物参加一次匿名旧物交换，却在旧箱子的夹层里发现一把不属于任何人的钥匙。', 'draft', 1)
ON CONFLICT (code) DO NOTHING;

WITH season AS (SELECT id FROM flash_story_seasons WHERE code = 'unnamed-objects-s1'),
episode_data(slug, code, phase, sort_order, title, object_code, opening, action, discovery, closing, category, fragment_title, fragment_fact, ambient) AS (
  VALUES
  ('alang','s1-p1-alang',1,1,'一张画了两把椅子的图','seat-plan','阿浪把一张折得很薄的图摊在膝盖上。','他先量了图上两把椅子的距离，又把纸转了一个方向。','这不像路线图。画图的人在反复计算两个人怎样坐着才都舒服。','阿浪把图按原来的折痕收好，准备放回交换箱。','object','双人座位图','图上记录的不是地点，而是两个人之间合适的距离。','drift'),
  ('lizi','s1-p1-lizi',1,2,'五支已经写不出的彩笔','dry-markers','栗子把五支彩笔按颜色排开。','她逐支试写，又检查了笔帽与笔身不一致的地方。','这些笔不是用来画画的。有人原本想让另一个人挑一种颜色，再决定一起去哪。','栗子没有替主人补上答案，只把笔整齐放回去。','past','干掉的彩色笔','五种颜色原本对应五个可以一起去的方向。','breathe'),
  ('momo','s1-p1-momo',1,3,'只写了一半的路线本','route-book','默默翻开一本前半写满、后半空着的册子。','他没有继续往后翻，只用手指停在最后一条已写路线旁。','前半段由一个人记录，后半段明显留给另一个人；那个人一直没有动笔。','默默合上册子时，想起旧箱子里曾有金属物滑进更深处。','key','两声轻响','默默记得有金属物落进旧箱，撞到木板后又滑了一段。','breathe'),
  ('shiqi','s1-p1-shiqi',1,4,'一本一次也没用过的出门册','outing-book','拾柒把空白盖章区逐页对着光看。','她统计重复圈选的项目，但没有替主人删掉任何一项。','主人不是没有计划，而是每次快出发时又增加一个新选择。','她在纸角看见了交换箱内侧也有的三条短线。','key','三条短线','册页压出的浅痕与旧箱夹层内侧的三条短线方向一致。','none'),
  ('atuan','s1-p1-atuan',1,5,'五张没有送出去的观察卡','observation-cards','阿团把五张卡背面的名字朝下放好。','他只读正面的城市细节，没有擅自翻看写给谁。','这些记录原本是礼物，其中却夹着一条过于具体的个人活动时间。','放回卡片时，阿团发现交换箱底板一边高一边低。','key','不平的箱底','交换箱底板下还有一层空间，不是普通的磨损。','breathe'),
  ('alang','s1-p2-alang',2,6,'阿浪认领路线本','route-book','阿浪看到册子最后一条路线，没有再猜。','他承认后半本一直留给拾柒，也承认同行计划从未真正开始。','搬家不是突然离开；他早就知道自己维护不了全部旧路线。','他决定在处理册子前，先把没说完的计划讲清楚。','relationship','没走完的同行计划','路线本的后半段原本留给拾柒记录。','drift'),
  ('lizi','s1-p2-lizi',2,7,'栗子认领出门册','outing-book','栗子一眼认出自己重复圈过的项目。','她没有把拖延说成忙，而是删掉了三个只是为了拖延而新增的选项。','她害怕的不是出门，是期待很久以后发现事情其实很普通。','她留下最小的一项，准备真的完成一次。','past','越列越长的清单','栗子不断添加项目，是为了推迟真正出发的那一刻。','breathe'),
  ('momo','s1-p2-momo',2,8,'默默认领彩笔','dry-markers','默默把错配的笔帽一个个换回去。','他说明这些颜色原本要交给栗子选择，但邀请一直没有发出。','默默并非没有想去的地方；他只总把开口延后到东西都失效。','他保留其中一支笔，作为这次必须开口的提醒。','relationship','没有发出的邀请','彩笔原本是默默准备给栗子的选择题。','breathe'),
  ('shiqi','s1-p2-shiqi',2,9,'拾柒认领观察卡','observation-cards','拾柒先检查了卡片是否被翻过。','她承认自己想分享细节，也承认记录阿浪活动时间越过了朋友的边界。','观察得准确不代表有权保存；好意也不能代替同意。','她把那张卡单独留下，准备亲自处理。','relationship','准确也会越界','拾柒记录了阿浪的固定活动时间，却从未征得同意。','none'),
  ('atuan','s1-p2-atuan',2,10,'阿团认领座位图','seat-plan','阿团把图转回只有自己习惯的朝向。','他承认每一版都在避开默默不舒服的声音和距离。','这不是通用座位建议，而是一份迟迟没有交给特定对象的邀请。','阿团还没有说出名字，但没有再否认这张图有对象。','relationship','为一个人画的位置','双人座位图是阿团按默默的习惯反复修改的。','breathe'),
  ('alang','s1-p3-alang',3,11,'最后一次整理旧路线','route-book','阿浪把搬家后不会再维护的路线逐条划掉。','他保留前半本，把空白后半本拆下交给拾柒自行决定。','他停止替一段未开始的同行计划保留位置。','路线本不再是一笔旧账，搬家也不再是假装什么都能带走。','relationship','路线本的新去向','阿浪保留自己的记录，把属于拾柒的空白页交还给拾柒。','drift'),
  ('lizi','s1-p3-lizi',3,12,'出门册的第一格','outing-book','栗子在最小的一项旁画下完成标记。','她没有评价是否值得，只记录自己确实做完了。','普通并不等于白去；完成以后，她终于能删掉其余用来拖延的备选。','出门册第一次不是计划，而是发生过的事。','past','第一个完成标记','栗子完成了最小的一项，没有再为结果是否特别找借口。','breathe'),
  ('momo','s1-p3-momo',3,13,'默默把邀请说完整','dry-markers','默默把保留下来的那支笔放在最上面。','他直接向栗子发出邀请，给出时间和两个可选方向。','这不是让用户传话，也不是含糊暗示；邀请由默默自己说出。','栗子是否答应留到她自己的故事里，但默默已经完成了自己的动作。','relationship','迟到但完整的邀请','默默亲自给出了时间与方向，没有再把决定藏进物件。','breathe'),
  ('shiqi','s1-p3-shiqi',3,14,'删除那条不该保留的记录','observation-cards','拾柒把涉及阿浪活动时间的卡片调出来。','她先保留城市细节，再删除可以追踪个人习惯的部分。','记录的边界由被记录者决定，不由记录者的好意决定。','剩下四张卡可以被送出；这一张不会再恢复。','relationship','被删除的时间记录','拾柒永久删除了关于阿浪固定活动时间的部分。','none'),
  ('atuan','s1-p3-atuan',3,15,'座位图写上了名字','seat-plan','阿团在两把椅子旁分别写下自己和默默的名字。','他把图交给默默，并明确说明这是一份想更靠近一点的邀请。','这可以被理解为表白，也允许对方只接受一次并肩坐下；答案不由用户代替。','收回的五件旧物都有了去向，箱底钥匙仍等待下一季。','key','没有锁孔的旧钥匙','钥匙柄与交换箱夹层内侧都有同样的三条短线；它属于一位已经离开的数字居民。','breathe')
), inserted AS (
  INSERT INTO flash_story_episodes(season_id,npc_id,code,phase,sort_order,title,object_code,content,motion,review_status,is_active)
  SELECT season.id, npc.id, d.code, d.phase, d.sort_order, d.title, d.object_code,
    jsonb_build_object(
      'opening', d.opening,
      'action', d.action,
      'discovery', d.discovery,
      'question', jsonb_build_object('id', d.code || '-choice', 'prompt', '你想先注意哪一件事？', 'options', jsonb_build_array(
        jsonb_build_object('id','notice-action','label','它刚才做的动作','tags',jsonb_build_array()),
        jsonb_build_object('id','notice-object','label','这件旧物留下的痕迹','tags',jsonb_build_array()),
        jsonb_build_object('id','notice-relationship','label','它没有直接说出的关系','tags',jsonb_build_array())
      )),
      'responseByOption', jsonb_build_object(
        'notice-action','你注意到了它怎样处理，而不是只听它解释。',
        'notice-object','物件上的使用痕迹把过去说得更具体了。',
        'notice-relationship','这件旧物与另一个角色的关系变得清楚了一点。'
      ),
      'closing', d.closing
    ),
    jsonb_build_object('ambient', d.ambient), 'reviewed', true
  FROM episode_data d CROSS JOIN season JOIN flash_npcs npc ON npc.slug = d.slug
  ON CONFLICT (season_id, code) DO UPDATE SET title=EXCLUDED.title, object_code=EXCLUDED.object_code, content=EXCLUDED.content, motion=EXCLUDED.motion, updated_at=now()
  RETURNING id, code
)
INSERT INTO flash_story_fragments(episode_id,code,category,title,fact,sort_order)
SELECT inserted.id, inserted.code || '-fragment', d.category, d.fragment_title, d.fragment_fact, d.sort_order
FROM inserted JOIN episode_data d ON d.code = inserted.code
ON CONFLICT (code) DO UPDATE SET category=EXCLUDED.category,title=EXCLUDED.title,fact=EXCLUDED.fact,sort_order=EXCLUDED.sort_order,updated_at=now();

-- Publishing remains an explicit audited admin action. The migration only prepares reviewed content.

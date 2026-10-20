/**
 * Quip 灵感 chips — 机智对决作答相位的静态策展句式起手池
 * (spec: docs/deliberations/2026-10-20-recap-share-and-quip-chips-spec.md 规格二).
 *
 * surface: 'social-icebreaker' quip_battle answer phase
 * toneMode: 'system-ui' — 中性系统文案（「灵感起手」），非悦仔口吻。
 *
 * 分层法则（设计约束，review checklist 必查）：
 * - chips = 静态策展：纯客户端常量池 + 纯函数取样，零 LLM 调用、零网络请求。
 * - 零 AIGC 角标：角标 fail-closed（仅当内容确为 AI 生成才渲染）⟹ 策展 chips
 *   天然不挂角标；任何「给 chips 挂 AI 标」的改法都是违规。
 * - 去 mascot 化：chips 区不出现悦仔形象/口吻/「悦仔」字样。
 * - 永不与生成式通道并排：chips 与「悦仔帮我写」类 AI 生成入口（现存于
 *   lie_detective compose，LieDetectiveHeroView.tsx）不同屏共存。quip_battle
 *   当前无 AI 帮写；未来若给 quip 加生成式帮写，必须先下 chips 或做二选一
 *   互斥开关。
 * - 安全链路：chips 本身为预审策展内容，不入敏感词管线；用户基于 chip 改写
 *   后的提交文本仍走既有 UGC 过滤路径。
 *
 * 取样机制（规格 §3）：三元种子 sessionId ∥ promptId ∥ userId → fnv1a32 →
 * mulberry32 播种 PRNG → Fisher–Yates 洗牌 27 条池 → 取前 N。同 person 同题
 * 跨 remount/断线重进稳定；同桌不同人高概率各见不同子集（公开投票不撞车）。
 * 备选（默认不采用）：若产品坚持「全桌共享 3 枚」，从种子中去掉 userId 即可。
 *
 * 🔴 Hard constraints（源码测试常跑锁定）：
 * - 27 条 = 9 族 × 3；每条 ≤16 字、零 emoji、零禁用词、零审核敏感词
 *   （匹配/社交/灵魂/撮合/AI）、零负能量钩子。
 * - 句式起手，不给完整答案。
 */

// ─── 池结构 ──────────────────────────────────────────────────────────────

/** 九族（规格 §2 表）。 */
export type QuipChipFamily =
  | 'dish' // 爆料式
  | 'self_deprecating' // 自嘲式
  | 'suspense' // 悬念式
  | 'hyperbole' // 夸张式
  | 'confession' // 坦白式
  | 'daily' // 生活式
  | 'interactive' // 互动式
  | 'hypothetical' // 假设式
  | 'metaphor'; // 比喻式

export interface QuipInspirationChip {
  /** 稳定 id（quip_chip_01–27）— 埋点 metadata.chipId 用。 */
  id: string;
  family: QuipChipFamily;
  /** 句式起手正文（≤16 字，零 emoji）。 */
  text: string;
  /** 覆盖的 quip fallback 题库 category（QUIP_BATTLE_FALLBACK_PROMPTS）。 */
  categories: ReadonlyArray<string>;
}

/**
 * 27 条池（9 族 × 3，id 后缀 01–27）。入池前每条已过 brand-copy 🔴：
 * 无机器词、无审核敏感词、无负能量钩子。新增/修改条目必须同步更新
 * __tests__/quipInspirationChips.test.ts 的族×条数断言。
 */
export const QUIP_INSPIRATION_CHIPS: ReadonlyArray<QuipInspirationChip> = [
  // ── 爆料式（生活、社死、秘密）──
  { id: 'quip_chip_01', family: 'dish', text: '说出来你们可能不信', categories: ['生活', '社死', '秘密'] },
  { id: 'quip_chip_02', family: 'dish', text: '我最后悔的一次', categories: ['生活', '社死', '秘密'] },
  { id: 'quip_chip_03', family: 'dish', text: '有次我脑子一热', categories: ['生活', '社死', '秘密'] },
  // ── 自嘲式（自嘲、身份）──
  { id: 'quip_chip_04', family: 'self_deprecating', text: '不瞒大家说，我', categories: ['自嘲', '身份'] },
  { id: 'quip_chip_05', family: 'self_deprecating', text: '我这人最大的毛病', categories: ['自嘲', '身份'] },
  { id: 'quip_chip_06', family: 'self_deprecating', text: '别笑，这事我真干过', categories: ['自嘲', '身份'] },
  // ── 悬念式（生活、情感）──
  { id: 'quip_chip_07', family: 'suspense', text: '结果第二天', categories: ['生活', '情感'] },
  { id: 'quip_chip_08', family: 'suspense', text: '万万没想到', categories: ['生活', '情感'] },
  { id: 'quip_chip_09', family: 'suspense', text: '从此我再也没', categories: ['生活', '情感'] },
  // ── 夸张式（脑洞、状态）──
  { id: 'quip_chip_10', family: 'hyperbole', text: '我当场就想', categories: ['脑洞', '状态'] },
  { id: 'quip_chip_11', family: 'hyperbole', text: '我敢打赌，在场没人', categories: ['脑洞', '状态'] },
  { id: 'quip_chip_12', family: 'hyperbole', text: '那一刻我觉得自己', categories: ['脑洞', '状态'] },
  // ── 坦白式（秘密、情感）──
  { id: 'quip_chip_13', family: 'confession', text: '这事我谁都没告诉过', categories: ['秘密', '情感'] },
  { id: 'quip_chip_14', family: 'confession', text: '其实我一直偷偷', categories: ['秘密', '情感'] },
  { id: 'quip_chip_15', family: 'confession', text: '讲真，我有点', categories: ['秘密', '情感'] },
  // ── 生活式（生活、社死）──
  { id: 'quip_chip_16', family: 'daily', text: '上周我刚', categories: ['生活', '社死'] },
  { id: 'quip_chip_17', family: 'daily', text: '每次点外卖我都', categories: ['生活', '社死'] },
  { id: 'quip_chip_18', family: 'daily', text: '有天半夜我突然', categories: ['生活', '社死'] },
  // ── 互动式（互动、吐槽）──
  { id: 'quip_chip_19', family: 'interactive', text: '在座的有没有', categories: ['互动', '吐槽'] },
  { id: 'quip_chip_20', family: 'interactive', text: '谁来评评理', categories: ['互动', '吐槽'] },
  { id: 'quip_chip_21', family: 'interactive', text: '你们肯定也干过', categories: ['互动', '吐槽'] },
  // ── 假设式（幻想、假设、时光）──
  { id: 'quip_chip_22', family: 'hypothetical', text: '如果能重来一次', categories: ['幻想', '假设', '时光'] },
  { id: 'quip_chip_23', family: 'hypothetical', text: '要是明天不用上班', categories: ['幻想', '假设', '时光'] },
  { id: 'quip_chip_24', family: 'hypothetical', text: '十年后回头再看', categories: ['幻想', '假设', '时光'] },
  // ── 比喻式（比喻、状态、拟人）──
  { id: 'quip_chip_25', family: 'metaphor', text: '我现在的状态就像', categories: ['比喻', '状态', '拟人'] },
  { id: 'quip_chip_26', family: 'metaphor', text: '用三个字形容就是', categories: ['比喻', '状态', '拟人'] },
  { id: 'quip_chip_27', family: 'metaphor', text: '我和它之间只差', categories: ['比喻', '状态', '拟人'] },
] as const;

// ─── 渲染层文案（中性系统文案，非悦仔口吻）────────────────────────────────

/** chips 行引导语。 */
export const QUIP_CHIP_ROW_LABEL = '灵感起手';

/** 手打内容被替换前的轻确认正文（confirm/cancel 按钮文案）。 */
export const QUIP_CHIP_REPLACE_CONFIRM_TEXT = '替换掉现在写的内容？';
export const QUIP_CHIP_REPLACE_CONFIRM_OK = '替换';
export const QUIP_CHIP_REPLACE_CONFIRM_CANCEL = '取消';

// ─── 确定性取样（fnv1a32 → mulberry32 → Fisher–Yates，零新依赖）────────────

/** FNV-1a 32-bit string hash — 快、确定性、分布均匀。 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 播种 PRNG — 返回 [0, 1) 的确定性序列。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 从 27 条池中确定性取 count 条（默认 3）。
 *
 * 三元种子 `sessionId ∥ promptId ∥ userId`：
 * - 同 person 同题跨 remount / 断线重进 → 子集完全一致（与草稿持久化语义一致）；
 * - 同桌不同人同题 → 高概率各见不同子集（公开投票环节不撞车）；
 * - 不同桌自然不同。
 */
export function pickQuipInspirationChips(
  sessionId: string,
  promptId: string,
  userId: string,
  count = 3,
): QuipInspirationChip[] {
  const seed = fnv1a32(`${sessionId}::${promptId}::${userId}`);
  const rand = mulberry32(seed);
  const pool = [...QUIP_INSPIRATION_CHIPS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const safeCount = Math.max(0, Math.min(count, pool.length));
  return pool.slice(0, safeCount);
}

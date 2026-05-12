# JoyJoin Embedding + AI 大模型架构设计

> 为 `userSemanticProfileService.ts` 和 `industryClassifier.ts` 设计 embeddings + LLM 协同架构。
> 状态：设计提案 | 最后更新：2026-05-09 (Embedding 模型已切换至 granite-embedding-97m-multilingual-r2)

---

## 一、现状分析

### 1.1 两条独立的流水线

```
┌─────────────────────────────────────────┐
│   用户语义画像 (userSemanticProfile)       │
│   embeddingClient → Granite Embedding    │
│   → user_semantic_profiles              │
│   → 第7匹配维度 (cosine similarity)      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│   行业分类 (industryClassifier)           │
│   Tier 0/1/2: 模糊+种子+关键词 (<50ms)   │
│   Tier 3: DeepSeek LLM 推理 (200-800ms) │
│   → users.industryNiche 字段            │
│   → backgroundDiversity (刻意多元化)      │
└─────────────────────────────────────────┘
```

**两者当前完全独立，没有任何数据或模型共享。**

### 1.2 关键设计决策

| 维度 | 画像 Embedding | 行业分类 |
|------|---------------|---------|
| 目标 | 语义相似度匹配 | 结构化分类 (3层级) |
| 模型 | `granite-embedding-97m-multilingual-r2` | DeepSeek Chat (推理) |
| 输入 | 用户全量画像文本 | 单个行业/职业描述字符串 |
| 输出 | 384-dim 向量 | category/segment/niche 标签 |
| 匹配用途 | 第7语义维度的 cosine 相似度 | 背景多样性分数 (刻意差异化) |
| 缓存 | user_semantic_profiles 表 | 无 (纯函数，种子库命中率 ~80%) |
| 刷新 | 异步队列 (profile/interests 更新时) | N/A (实时分类) |

---

## 二、推荐架构：双路径分层设计

### 2.1 架构总览

```
                         ┌───────────────────┐
                         │   用户输入 / 事件    │
                         └─────────┬─────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               ▼                                       ▼
   ┌───────────────────────┐             ┌───────────────────────┐
   │  Path A: 画像语义匹配   │             │  Path B: 行业知识图谱   │
   │  (Profile Semantic)    │             │  (Industry Knowledge)  │
   └───────────┬───────────┘             └───────────┬───────────┘
               │                                       │
   ┌───────────▼───────────┐             ┌───────────▼───────────┐
   │  EmbeddingGateway     │             │  IndustryClassifier   │
   │  (多Provider路由)      │             │  (现有4层引擎保留)      │
   │                       │             │                       │
    │  • Granite (主)       │             │  Tier 0: 模糊匹配      │
    │  • 本地模型 (备/降级)  │             │  Tier 1: 种子库        │
   │  • 粗粒度缓存 (>24h)   │             │  Tier 2: 关键词        │
   └───────────┬───────────┘             │  Tier 3: LLM 推理      │
               │                          └───────────┬───────────┘
   ┌───────────▼───────────┐                          │
   │  ProfileDocumentBuilder│             ┌───────────▼───────────┐
   │  (分层结构化文本)        │             │  IndustryKnowledgeBase │
   │                       │             │  (NEW — LLM预计算)     │
   │  • 基础层: bio, 城市   │             │                       │
   │  • 身份层: 行业, 学历   │             │  • 行业节点embedding   │
   │  • 兴趣层: topics      │             │  • 职业关联图谱        │
   │  • 社交层: vibe, intent │             │  • 跨行业语义距离     │
   │  • 动态层: recent events│             │  • 定期刷新 (weekly)  │
   └───────────┬───────────┘             └───────────┬───────────┘
               │                                       │
   ┌───────────▼───────────┐             ┌───────────▼───────────┐
   │  Matching (第7维度)    │             │  Professional Similarity│
   │                       │             │  (NEW — 职业语义匹配)   │
   │  cosine(emb_a, emb_b) │             │                       │
   │  × 0.06 weight        │             │  cosine(niche_a,      │
   │                       │             │         niche_b)      │
   └───────────────────────┘             │  × 0.03 weight (可配) │
                                         └───────────────────────┘
```

### 2.2 设计原则

1. **不替换，只增强**：行业分类系统（4层引擎）保持不变，新增职业语义匹配作为独立信号
2. **模型分离**：画像 embedding 和行业 embedding 使用不同模型/策略，避免跨域噪声
3. **降级优先**：所有 embedding 路径都有确定性降级方案（feature-hash 向量 / 种子库匹配）
4. **可观测性内置**：每条流水线都有独立的 metrics、trace、缓存命中率监控

---

## 三、Path A：画像语义匹配（优化现有系统）

### 3.1 当前问题

```typescript
// 当前：所有信息混在一起生成一个 embedding
const profileDocument = buildSemanticProfileDocument(user, interests);
// "bio\nArchetype: explorer\nCity: Beijing\nIndustry: tech...\nInterests: gaming, music..."
const embedding = await embeddingClient.embed(profileDocument);
```

**痛点**：
- 所有维度混合在一个 embedding 中，无法调整个别维度的权重
- 用户更新个别字段（如兴趣）就需要重新生成整个 embedding
- 无法利用不同模型对不同领域的优势

### 3.2 优化方案：分层文档 + 智能刷新

```typescript
// 新：分层结构化文档，每层可独立刷新
export interface LayeredProfileDocument {
  /** 基础信息层 — 变化最少，缓存最久 */
  base: string;       // "Archetype: explorer | City: Beijing | Education: Bachelor"
  
  /** 身份层 — 行业/职业信息 */
  identity: string;   // "Industry: tech/software | Role: backend_dev | WorkMode: remote"
  
  /** 兴趣层 — 变化中等，取 Top-8 兴趣 */
  interests: string;  // "Top interests: gaming(heat:25), music(heat:20), hiking(heat:15)..."

  /** 社交层 — 变化较多，vibe/intent 偏好 */
  social: string;     // "Vibe: casual | Intent: make_friends, explore_career | Languages: zh, en"
}

// 版本向量改为细粒度
export interface SemanticProfileVersionVector {
  baseHash: string;       // base 层内容 hash
  identityHash: string;   // identity 层内容 hash
  interestsHash: string;  // interests 层内容 hash
  socialHash: string;     // social 层内容 hash
  generatorVersion: string;
}

// 增量刷新：只重建变化层的 embedding
async function smartRecompute(userId: string, changedLayer: 'base' | 'identity' | 'interests' | 'social') {
  // 仅重新生成变化层的 embedding，其他层复用缓存
}
```

**不推荐**：完全分层 embedding + 加权融合（复杂性过高，收益有限）

**推荐**：分层文档结构用于智能刷新判断，但 still 生成单一 composite embedding。理由：
- granite-embedding-97m-multilingual-r2 对多语言结构化文本理解良好
- 单 embedding 的匹配计算简单 (cosine similarity)
- 分层 structure 仅用于优化 refresh 策略，不改变 embedding 语义

### 3.3 EmbeddingGateway：多 Provider 路由

```typescript
interface EmbeddingProvider {
  name: 'granite' | 'local-bge' | 'fallback-feature-hash';
  embed(text: string): Promise<EmbeddingResult>;
  isAvailable(): boolean;
  dimensions(): number;
  costPer1KTokens(): number;
}

class EmbeddingGateway {
  private providers: EmbeddingProvider[] = [];
  private circuitBreaker: Map<string, { failures: number; lastFail: number }>;

  // 路由策略：Granite > 本地模型 > feature-hash 降级
  async embed(text: string, preferredProvider?: string): Promise<EmbeddingResult> {
    // 1. 检查缓存 (基于 content hash)
    const cached = await this.cache.get(text);
    if (cached) return cached;

    // 2. 按优先级尝试 providers
    for (const provider of this.orderedProviders(preferredProvider)) {
      if (this.circuitBreaker.isOpen(provider.name)) continue;
      try {
        const result = await provider.embed(text);
        await this.cache.set(text, result);
        return result;
      } catch (e) {
        this.circuitBreaker.record(provider.name);
        logger.warn('Embedding provider degraded', { provider: provider.name });
      }
    }

    // 3. 全部降级 → feature-hash 向量
    return this.featureHashEmbed(text);
  }
}
```

### 3.4 缓存策略

| 缓存层 | 位置 | TTL | 键 |
|--------|------|-----|-----|
| L1: 进程内 | Node.js Map | 会话级别 | content hash (SHA256) |
| L2: DB | `user_semantic_profiles` | 直到版本向量过期 | userId |
| L3: Redis (可选) | Redis | 24h | `embedding:sha256:{hash}` |

**触发重算的信号**：
- `PATCH /api/profile` → queueRecompute(userId, 'profile_updated')
- `PATCH /api/user/interests` → queueRecompute(userId, 'interests_updated')
- POST `/api/assessment/complete` → queueRecompute(userId, 'archetype_assigned')

---

## 四、Path B：行业分类 + 职业语义匹配（新增）

### 4.1 行业分类：保持现有系统

**不改变** `industryClassifier.ts` 的 4 层引擎。理由：

| 对比维度 | 当前4层引擎 | Embedding-only 方案 |
|----------|-----------|-------------------|
| 准确率 | 高 (~95% seed/taxonomy, ~85% AI) | 中 (需要预计算所有节点向量) |
| 速度 | <50ms (80% case), 200-800ms (AI fallback) | 50-200ms (annoy/faiss 检索) |
| 可解释性 | 高 (每层都有 reasoning) | 低 (向量最近邻，无推理过程) |
| 边缘案例 | LLM 推理解决 | 需要大量标注数据优化 |
| 维护成本 | 种子库和关键词人工维护 | 需要定期重算分类节点向量 |

### 4.2 新增：Professional Similarity（职业语义匹配）

**目标**：在匹配中增加一个轻量级职业语义信号，让"前端工程师"在语义上比"后端工程师"更接近"UI设计师"。

```
当前 backgroundDiversity: 刻意多元化 (不同 industryNiche → 高分)
新增 professionalSimilarity: 语义相近度  (相似 profession → 高分)
```

#### 4.2.1 数据流

```
用户输入 Industry/Occupation
  │
  ▼
industryClassifier (现有4层)
  │
  ├─→ users.industryNiche (存储到DB)          ← 用于 backgroundDiversity
  │
  └─→ ProfessionalEmbeddingService (NEW)      ← 用于 professionalSimilarity
        │
        ▼
     IndustryKnowledgeBase (预计算向量库)
        │
        ├─→ niche_embeddings (每周离线生成)
        │     • 每个 industryNiche 节点 → 384-dim vector
        │     • 使用 granite-embedding-97m-multilingual-r2
        │     • 存储: industry_niche_embeddings 表
        │
        └─→ occupation_embeddings (每周离线生成)
              • 每个 OCCUPATION → 384-dim vector
              • 存储: occupation_embeddings 表
              │
              ▼
         Matching Signal (professionalSimilarity)
              cosine(niche_emb_a, niche_emb_b) × 0.03
```

#### 4.2.2 离线生成：IndustryKnowledgeBase

```typescript
// scripts/generate-industry-knowledge-base.ts — 每周离线运行
async function generateIndustryKnowledgeBase() {
  // 1. 遍历 INDUSTRY_TAXONOMY 的所有 niche 节点
  for (const niche of getAllNiches()) {
    // 为每个 niche 构建描述文本
    const description = buildNicheDescription(niche);
    // "Backend Development: 服务器端开发，涉及数据库、API、系统架构..."
    
    // 2. 生成 embedding
    const embedding = await embeddingGateway.embed(description);
    
    // 3. 存储
    await db.insert(industryNicheEmbeddings).values({
      nicheId: niche.id,
      categoryId: niche.categoryId,
      segmentId: niche.segmentId,
      vector: embedding.vector,
      modelVersion: embedding.model,
      generatedAt: new Date(),
    });
  }

  // 4. 同样为 OCCUPATIONS 生成
  for (const occupation of OCCUPATIONS) {
    const description = buildOccupationDescription(occupation);
    const embedding = await embeddingGateway.embed(description);
    // 存储...
  }
}
```

#### 4.2.3 在线匹配：ProfessionalSimilarity

```typescript
// matchingSemantic.ts 新增函数
export function calculateProfessionalSimilarity(
  user1IndustryNicheId: string | null,
  user2IndustryNicheId: string | null,
  knowledgeBase: IndustryKnowledgeBase,
): number {
  // 兜底：无行业信息 → 中性分
  if (!user1IndustryNicheId || !user2IndustryNicheId) {
    return 50;
  }

  const vec1 = knowledgeBase.getNicheVector(user1IndustryNicheId);
  const vec2 = knowledgeBase.getNicheVector(user2IndustryNicheId);

  // 降级：向量库不可用 → 字符串相等判断
  if (!vec1 || !vec2) {
    return user1IndustryNicheId === user2IndustryNicheId ? 65 : 50;
  }

  const similarity = cosineSimilarity(vec1, vec2);
  return Math.round(35 + similarity * 65); // scale to 35-100
}

// 权重建议 (添加到 PairScoreWeights)
export const PROFESSIONAL_AWARE_PAIR_SCORE_WEIGHTS: PairScoreWeights = {
  chemistry: 0.26,
  interest: 0.26,
  socialAffinity: 0.16,
  backgroundDiversity: 0.12,    // ← 略微降低
  professionalSimilarity: 0.03, // ← NEW
  preference: 0.05,
  language: 0.04,
  semanticSimilarity: 0.08,     // ← 略微提高 (画像embedding权)
};
```

### 4.3 行业分类的 LLM 增强（最小改动）

当前 `industryClassifier.ts` Tier 3 使用 DeepSeek Chat 做推理分类。这个小改动可以提升质量：

```typescript
// 当前：每次调用都做完整推理
const result = await deepseekClient.chat.completions.create({
  model: getDeepseekModel(),
  messages: [{ role: 'user', content: classifyPrompt(input) }],
});

// 优化：增加短时缓存 (相同输入 1h 内复用)
const cacheKey = `industry:classify:${sha256(input)}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const result = await deepseekClient.chat.completions.create({...});
await cache.set(cacheKey, result, { ttl: 3600 });
```

---

## 五、模型选型建议

### 5.1 Embedding 模型

| 使用场景 | 推荐模型 | 维度 | 成本 | 理由 |
|---------|---------|------|------|------|
| 用户画像 (主) | `granite-embedding-97m-multilingual-r2` | 384 | 自部署免费 (Apache 2.0) | 97M参数低开销，多语言覆盖200+语言，384dim效率高 |
| 职业/行业节点 (离线) | `granite-embedding-97m-multilingual-r2` | 384 | 自部署免费 | 与画像模型统一，减少维护成本 |
| 本地降级 (可选) | `bge-small-zh-v1.5` (ONNX) | 512 | 免费 | CPU推理，<10ms，质量中等 |

**决策**：采用 `granite-embedding-97m-multilingual-r2` 作为统一生产 embedding 模型。97M参数可自部署，Apache 2.0 免许可费，多语言覆盖强于 `deepseek-embedding`，384维向量显著降低存储和计算成本。

### 5.2 LLM 模型

| 使用场景 | 模型 | 成本 | 延迟 |
|---------|------|------|------|
| 行业分类 Tier 3 | DeepSeek Chat (当前) | ~$0.001/req | 200-800ms |
| 行业节点描述生成 (离线) | DeepSeek Chat 或可选用便宜模型 | 批量 | N/A |

**决策**：不改动 Tier 3 LLM 选型。离线描述生成可使用 `deepseek-chat` (便宜，质量够用)。

---

## 六、数据流与存储

### 6.1 新增表结构

```sql
-- 行业niche语义向量库 (离线生成，只读查询)
CREATE TABLE industry_niche_embeddings (
  niche_id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  segment_id TEXT NOT NULL,
  vector FLOAT8[] NOT NULL,           -- 384 dim
  model_version TEXT NOT NULL,        -- 'granite-embedding-97m-multilingual-r2'
  generated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(niche_id, model_version)
);

-- 职业语义向量库 (离线生成，只读查询)
CREATE TABLE occupation_embeddings (
  occupation_id TEXT PRIMARY KEY,
  occupation_name TEXT NOT NULL,
  vector FLOAT8[] NOT NULL,           -- 384 dim
  model_version TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(occupation_id, model_version)
);

-- 用户语义画像 (增强 — 已有表，新增字段)
ALTER TABLE user_semantic_profiles
  ADD COLUMN embedding_model TEXT,           -- 'granite-embedding-97m-multilingual-r2'
  ADD COLUMN embedding_dimension INT,         -- 384
  ADD COLUMN profile_document_hash TEXT,      -- SHA256 of profileDocument
  ADD COLUMN layered_version JSONB;          -- { base, identity, interests, social }
```

### 6.2 在匹配流程中的位置

```
calculateWeightedPairScore(userA, userB, weights)
  ├── calculateChemistryScore         # 化学分数
  ├── calculateInterestScore          # 兴趣匹配
  ├── calculateSocialAffinityScore    # 社交亲和
  ├── calculateBackgroundDiversity    # 行业多样性 (刻意差异化)
  ├── calculatePreferenceScore        # 偏好匹配
  ├── calculateLanguageScore          # 语言匹配
  ├── calculateSemanticSimilarityScore # 画像语义 (第7维, embedding)
  └── calculateProfessionalSimilarity  # 职业语义 (NEW, embedding)
       └── 仅在 ENABLE_PROFESSIONAL_SIMILARITY=true 时启用
```

---

## 七、Feature Flags 设计

```bash
# .env
ENABLE_SEMANTIC_SIMILARITY=true           # 现有：启用画像语义匹配 (Path A)
EMBEDDING_MODEL=granite-embedding-97m-multilingual-r2  # embedding 模型选择
ENABLE_PROFESSIONAL_SIMILARITY=false      # NEW：启用职业语义匹配 (Path B)
PROFESSIONAL_SIMILARITY_WEIGHT=0.03      # NEW：职业语义在总权重中的占比
ENABLE_EMBEDDING_GATEWAY=true            # NEW：启用多Provider路由
EMBEDDING_LOCAL_FALLBACK_ENABLED=false   # NEW：启用本地模型降级
```

---

## 八、实施路线

### Phase 1：现状加固（1-2 天）
- [ ] `EmbeddingGateway` 多 Provider 路由（不改功能，只加断路器）
- [ ] 添加 embedding 操作的 metrics (成功率、延迟 P50/P99、降级次数)
- [ ] 为 `industryClassifier` Tier 3 添加短时缓存

### Phase 2：画像优化（2-3 天）
- [ ] 分层文档结构 (`LayeredProfileDocument`) + 智能刷新判断
- [ ] embedding 内容 hash 缓存 (L1 进程内)
- [ ] `user_semantic_profiles` 表增强字段 (model, dimension, hash)

### Phase 3：职业语义匹配（4-5 天）
- [ ] `generate-industry-knowledge-base.ts` 离线脚本
- [ ] `industry_niche_embeddings` + `occupation_embeddings` 表
- [ ] `calculateProfessionalSimilarity` 函数
- [ ] 在 `PairScoreWeights` 中添加 `professionalSimilarity` 维度
- [ ] feature flag 控制启用

### Phase 4：本地降级（可选，3-4 天）
- [ ] ONNX 运行时 + `bge-small-zh-v1.5` 模型
- [ ] 本地 embedding 作为远程 API 的降级方案
- [ ] 仅在 `EMBEDDING_LOCAL_FALLBACK_ENABLED=true` 时加载

---

## 九、关键决策记录

| 决策 | 结论 | 理由 |
|------|------|------|
| 是否用 embedding 替代行业分类？ | ❌ 不替代 | 准确率、可解释性、多样性目标均不支持 |
| 是否加职业语义匹配？ | ✅ 新增独立信号 | 轻量级，独立 feature flag，不干扰现有逻辑 |
| 是否分层生成多个 embedding？ | ❌ 不推荐 | 复杂度高，收益微；分层仅用于刷新判断 |
| embedding 模型是否切换？ | ✅ 切换至 `granite-embedding-97m-multilingual-r2` | 97M可自部署，Apache 2.0免费，多语言200+，384dim更低存储成本 |
| 行业节点是否需要实时 embedding？ | ❌ 离线批量 | 数据稳定，周级刷新足够，成本极低 |
| 是否需要 Redis 缓存层？ | ⏳ 暂不需要 | 当前 QPS 下 DB 查询足够，未来按需添加 |

---

## 十、参考文件

- `apps/server/src/userSemanticProfileService.ts` — 用户语义画像服务
- `apps/server/src/embeddingClient.ts` — embedding 客户端 (Granite)
- `apps/server/src/matchingSemantic.ts` — 语义匹配评分
- `apps/server/src/inference/industryClassifier.ts` — 行业分类引擎
- `packages/shared/src/schema.ts` — `userSemanticProfiles` 表定义
- `docs/systems/systems/MATCHING_ALGORITHM_REFERENCE.md` — 匹配算法参考

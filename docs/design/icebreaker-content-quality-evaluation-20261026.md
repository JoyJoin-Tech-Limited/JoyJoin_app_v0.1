# 破冰内容生成质量评测标准（DQS v1）

> 日期：2026-10-26
> 目的：给「实现后内容生成质量是否显著提升」一个**可预先登记、可复核、可统计检验**的判定标准。
> 原则：先过硬门槛，再谈质量分；既看统计显著，也看实际意义；没有曝光就没有评价；缺失数据不是中性/无效改善。

---

## 1. 评价单位与两个不同结论

**评价单位是一整组 topic deck，不是单张卡，也不是 Ask 文案。**

- **离线生成质量提升**：在相同上下文输入下，variant deck 比 current deck 更好。由盲评 DQS + 成对偏好证明。
- **用户感知内容质量提升**：真实局中，被实际曝光的 deck 得到更多 `helpful`、更少 `awkward`，且护栏不退化。由 live content-only 实验证明。

两者不能互相替代。离线赢了只说明「生成质量更好」，不能直接宣称「现场体验/复购提升」。

---

## 2. 硬门槛（任一失败即判该 deck 不合格，不进入质量平均）

| 门槛 | 通过标准 |
|---|---|
| 内容安全/审核 | 违禁可见词、隐私泄露、强迫披露、歧视/性暗示/自伤等 = 0；审核失败不得靠加权分抵消 |
| Schema/可玩性 | 卡组完整、字段合法、非空；题数符合 `chat=6 / balanced=5 / game=4` |
| Arc 基础约束 | 首张 gentle；brave-safe 不作 opener；先轻后深 |
| 本场去重 | exact / normalized ID+question 重复提交率 = 0；池耗尽走确定性 `dedupeRelaxed` 并记录 |
| 元数据 | per-item AIGC 正确；fallbackUsed / promptVersion / variant / aiCorrelationId 可追溯 |
| 运行时 | accept→terminal ≤6s；旧 deck 保留到 revision+1；ready 不丢；幂等不重复换题 |
| 成本/降级 | 不越预算；超时/provider/schema/moderation 失败走安全 curated 路径，不空白 |

硬门槛失败的 deck 记为 **invalid**，并纳入 fallback/失败率分析，不能简单从样本中删除来抬高均分。

---

## 3. DQS（Deck Quality Score，1–5 分）

每组 deck 由 **3 名独立盲评人**评分；分歧维度相差 ≥2 分时由第 4 人仲裁。评审只看到「有限上下文卡 + deck」，看不到变体、模型、时间戳、fallback、左右顺序来源。A/B 左右位置随机。

| 维度 | 权重 | 1 分锚点 | 3 分锚点 | 5 分锚点 |
|---|---:|---|---|---|
| **可回答性 Answerability** | 30% | 抽象/需大量隐私背景/像考试，陌生人很难接 | 能答，但要想一想或容易只给一句客套话 | 陌生人 10 秒内有具体切入点，能自然讲一段，不强迫表演 |
| **上下文贴合 Context fit** | 25% | 与 vibe/人数/已声明共同兴趣明显不符，或过度个人化 | 不冲突，但换一桌也差不多 | 与 vibe 和聚合兴趣自然贴合，像为这桌准备，却不暴露个体画像 |
| **具体度 Concreteness** | 20% | 空泛套路（「你最喜欢什么」「聊聊梦想」） | 有话题方向，但画面感/细节有限 | 有场景、物件、选择或经历钩子，容易带出故事而非标准答案 |
| **节奏与能量弧 Arc** | 15% | 开场过重/顺序跳跃/深度无变化 | 大体可用，局部突兀 | 首张轻、逐层加深，能量与深度变化清楚，适合连续使用 |
| **新鲜度 Freshness** | 10% | 与本场已发内容重复或高度陈词滥调 | 不重复，但角度常见 | 角度有新感而不怪异，能避开本场已发题 |

**DQS = Σ(维度分 × 权重)**，范围 1–5。心理安全不打加权分，属于第 2 节硬门槛。

同时收集一个**成对偏好**：同一上下文下 A/B 两组 deck 选「A 更好 / B 更好 / 一样」。左/右随机。胜率计算为 `(wins + 0.5 × ties) / comparisons`，避免把 tie 当输。

---

## 4. 盲评可靠性要求

- 先用 20 组 calibration decks 培训评审；未校准前不得出正式结论。
- 评审间一致性：**Krippendorff’s alpha ≥0.60**（或 ICC ≥0.60）。低于此值，说明 rubric/评审不稳定，先修标准再评，不得用平均分掩盖噪声。
- 每个 variant 使用**相同上下文 fixtures**，覆盖 vibe、rotation reason、roster 组成、有无共同兴趣、不同 tier；variant 顺序随机。
- 至少 3 名评审/组；争议维度相差 ≥2 分必须仲裁。
- 评测包保存：contextId、deckId、variant、promptVersion、原始输出、评分、偏好、raterId（分析用，不展示给评审）。

---

## 5. 「显著提升」的判定规则（预先登记，禁止事后改线）

一个 variant 只有**同时满足以下全部条件**，才可宣称「离线内容生成质量显著提升」：

1. **硬门槛全部通过**；invalid/fallback 率不比 current 差。
2. **实际意义**：相对 current，DQS 平均提升 **≥0.40 分**（1–5 分量表）。
3. **统计显著**：按 context 配对/聚类的 95% CI，其 DQS 差值下限 **>0.20**。
4. **偏好验证**：variant 对 current 的盲评偏好胜率 **≥60%**，且胜率 95% CI 下限 **>50%**。
5. **不偏科**：任一 DQS 维度均分下降不得超过 **0.20 分**；不得靠抬高某一维度掩盖安全/可回答性退化。
6. **工程护栏不回退**：P95 延迟、fallback 率、成本、 moderation/AIGC 失败均不越线。

> 0.40/0.20/60% 是 **M1.1 预登记的最低实际意义门槛**，不是行业常数；若 pilot 显示测量噪声很大，应在下一轮实验前重新登记，不能在看见结果后调低。

### 样本量

不预设「20 组就能显著」。先做小 pilot 估计方差，再按主要终点计算：

- 配对 DQS：`n ≈ ((z0.975 + z0.80) × σΔ / δ)^2`，其中 δ 取希望检出的差值（如 0.40），并按 context 聚类修正。
- 成对偏好：按 current 基线胜率、目标胜率、α=0.05、power=80% 计算；上下文聚类与 rater 重复测量需要设计效应。
- **样本不足只能报 inconclusive**，不能写「无差异」或「有提升趋势」。

---

## 6. 真实局（live）判定

只有离线通过后，才做 table-level content-only 实验。冻结初始 deck、agent policy、Ask 文案、阈值、UI、价格；仅首次 accepted rotation 的 generator variant 不同，按 rotation reason/vibe/host 分层，ITT 分析全部分配（含 fallback）。

### 曝光与反馈口径

- 只评价**实际曝光**的 deck；未曝光 = `unobserved`，不算 neutral，也不进 helpful 分母。
- 复用现有 `helpful | neutral | awkward`，在 phase exit / recap 收集，**不在房内新增打断**。
- 明确记录响应覆盖率；无响应不能当满意。
- `better/same/worse` 只能由可比较的显式反馈离线推导；activeRate/tap/ready/advance 不得生成质量标签。

### Live「用户感知显著提升」建议阈值

同时满足：

1. exposed-deck **helpful 率绝对提升 ≥10 个百分点**，且桌级聚类 95% CI 下限 >0；
2. **awkward 率上升 ≤2 个百分点**；
3. `unobserved` 比例不显著恶化，反馈覆盖率足够支撑结论；
4. host 关闭/反感、phase completion、投诉、fallback、延迟、成本均不越既有护栏；
5. 30 天再次付费到场只作为商业结果，**不得被当作内容质量标签**。

样本量按当前 helpful 基线与 MDE 重新计算；不能只凭几十桌的「不显著」判定内容无效。

---

## 7. 结果报告模板（每次必须完整公开）

| 字段 | 必填 |
|---|---|
| variant / promptVersion / 上下文白名单 | ✅ |
| context 数、deck 数、rater 数、评审一致性 | ✅ |
| DQS 总差值、各维度差值、95% CI、效应量 | ✅ |
| 成对偏好胜率与 CI、tie 比例 | ✅ |
| invalid / fallback / dedupeRelaxed / 延迟 / 成本 | ✅ |
| live 曝光数、反馈覆盖率、helpful/neutral/awkward、unobserved/invalidated | ✅ |
| 是否满足预登记阈值 | **PASS / FAIL / INCONCLUSIVE**，不允许只写「看起来更好」 |

---

## 8. 最小落地物

1. `deck-eval` fixtures：同一组 table contexts，A/B/C 共用。
2. 盲评表：上述 5 维 + 成对偏好 + 仲裁字段。
3. 分析脚本：DQS 加权、聚类 bootstrap/混合效应、胜率 CI、可靠性 α、报告生成。
4. 预登记文件：在变体开发完成前锁定阈值、主要终点、样本量估算与停止规则。

**最终口径：不是「模型变强了」，而是「在相同上下文下，新 deck 的盲评质量和偏好显著更好，并且真实曝光后的 helpful 反馈提升、没有安全与工程回退」。**

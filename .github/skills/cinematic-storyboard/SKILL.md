---
name: cinematic-storyboard
description: >
  JoyJoin 自研电影分镜技术（Cinematic Storyboard Technique）——把任何想法转成专业
  分镜表与 AI 视频提示词：Lovart 先生成分镜场景参考图，再生成 Seedance 2.0 / 即梦
  视频提示词。Use when creating brand videos,
  marketing shorts, mascot stories, 街头盲盒 promos, event teasers, or any video
  storyboard for JoyJoin. Trigger phrases: "分镜", "storyboard", "电影分镜",
  "写一个视频脚本", "Seedance 提示词", "即梦", "营销短片分镜", "mascot video",
  "分镜场景图", "video storyboard prompt".
---

# Cinematic Storyboard — 电影分镜技术

**Core rule:** Every storyboard starts from one-sentence intent, passes through the
**五维分镜法** (Narrative / Visual / Camera / Rhythm / Sound), and lands as a
storyboard table + a copy-paste AI video prompt. Output must stay inside JoyJoin's
brand system — see [`references/brand-injection.md`](./references/brand-injection.md).

## Ownership & Agent pairing

**Primary executor: [Film Master agent](../../agents/film-master.agent.md)** — this skill IS the
agent's working methodology (五维分镜法, Lovart→Seedance pipeline, brand injection). The agent
ALWAYS loads this skill before producing any 分镜表 or prompt; methodology changes must be
reflected in both files — treat them as one artifact in two files.

| Request | Go to |
|---------|-------|
| Full direction (导演阐述 + 分镜表 + Lovart briefs + Seedance 提示词) | `Film Master` agent |
| Storyboard/prompt without director-level treatment | this skill |

## When to use this skill

- Turning an idea into a professional storyboard for AI video generation (Seedance 2.0 / 即梦)
- Marketing shorts: 街头盲盒 (Flash NPC) promos, event teasers, feature announcements
- Mascot-led brand stories (社牛柯基 Xiaoyue as protagonist)
- Social media video content for 小红书 / 抖音 / 视频号
- Internal motion specs handoff to `flow-animation` / `wow-elements`

## When NOT to use

- Static illustration briefs **without** video intent → `lovart-design-workflow`
- Mini-program micro-interactions → `wow-elements`
- Writing the story/script itself → `draft-prd` / `xiaoyue-writing-craft`
- Runtime LLM calls in server code → `llm-runtime-safety-and-integration`

## Pipeline (Lovart → Seedance)

1. **理解意图** — one-sentence story, duration (default 15s), target platform, available assets.
2. **五维补全** — interrogate the five dimensions (see [`references/five-dimension-method.md`](./references/five-dimension-method.md)).
3. **构建分镜表** — break the timeline into shots: 镜号 / 时间 / 景别 / 运镜 / 画面内容 / 声音 / 转场.
4. **Lovart 出分镜场景图（推荐）** — generate key-frame stills for character/scene consistency
   (角色参考图、首帧、场景参考), each following `lovart-design-workflow` brand briefs.
5. **生成 Seedance 提示词** — compose the video prompt, referencing the Lovart stills with
   `@素材名` syntax (see [`references/prompt-generation.md`](./references/prompt-generation.md)).
6. **校验优化** — check platform limits, brand compliance, and 0-2s hook strength.

> 没有 Lovart 素材也可以纯文本出片，但角色/场景一致性会明显变弱 — mascot 视频强烈建议先出参考图。

## Quick example

**想法**："社牛柯基组织一场惊喜聚会"

```
电影级2D动画风格，15秒，16:9，温暖治愈氛围
0-3s：远景缓推，黄昏咖啡馆外，社牛柯基背着小书包小跑入画
3-7s：中景环绕，柯基推开店门，暖光涌出，朋友们回头招手
7-11s：近景跟随，柯基与朋友们击掌拥抱，气球升起
11-13s：特写，柯基亮晶晶眼睛的特写，嘴角上扬
13-15s：远景拉远，落地窗内众人欢笑剪影，画面渐暖
背景音：轻快的尤克里里 + 人群欢笑声
```

## Troubleshooting

**"AI 生成的人物/形象不稳定"** → 必须提供角色参考图（`@图片1 作为角色形象参考`）；写实真人脸部素材会被平台拦截。
**"分镜衔接生硬"** → 检查相邻镜号的运镜是否匹配剪辑逻辑（同向运动 vs 反向切入），或加"匹配剪辑/遮罩转场"。
**"前 2 秒没有吸引力"** → 把最强视觉钩子（动作/冲突/反差）移到 0-2s，不要用渐入开场。
**"品牌感丢失"** → 重跑品牌注入清单：紫色锚点、暖色调、mascot 插画风、禁止写实/霓虹/暗黑。

## Review checklist

- [ ] 五维（叙事/视觉/镜头/节奏/声音）全部覆盖
- [ ] 分镜表时间轴连续，无缝隙无重叠
- [ ] 镜头语言明确（景别+运镜+转场），无模糊词汇
- [ ] 0-2s 有钩子，结尾有落点
- [ ] 提示词符合目标平台语法与限制
- [ ] 品牌注入通过（颜色/插画风/禁项）
- [ ] 素材引用使用 @素材名 格式且标注用途

## Related files

- [`references/five-dimension-method.md`](./references/five-dimension-method.md) — 五维分镜法完整方法论 + 镜头语言词典 + 时间轴模板
- [`references/prompt-generation.md`](./references/prompt-generation.md) — Lovart→Seedance 双阶段管线、提示词语法、平台限制
- [`references/brand-injection.md`](./references/brand-injection.md) — JoyJoin 品牌注入清单（色彩/插画风/禁项）
- [`references/examples.md`](./references/examples.md) — 3 个完整实战案例
- [`joyjoin-brand-guidelines`](../joyjoin-brand-guidelines/SKILL.md) — 品牌系统源头
- [`lovart-design-workflow`](../lovart-design-workflow/SKILL.md) — 静态视觉资产生成
- [Film Master agent](../../agents/film-master.agent.md) — 本 skill 的执行者（诺兰级电影大师）

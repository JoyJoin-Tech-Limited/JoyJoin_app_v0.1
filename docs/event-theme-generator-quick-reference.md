# Event Theme Generator - Quick Reference
# 活动主题生成器 - 快速参考

## 🎯 What is it?

A **mystery box (盲盒主题) experience design system** that creates intriguing themes for matched groups using JoyJoin's 12-archetype system.

**NOT** team names - creates anticipation, not identity.

## 🚀 Quick Start

### Basic Usage

```typescript
import { generateAndSaveEventTheme } from './eventThemeGeneratorService';

// Generate theme for a group
const theme = await generateAndSaveEventTheme(
  'group123',              // groupId
  ['user1', 'user2', ...], // memberIds
  'pool456'                // poolId
);

console.log(theme.theme);    // "高能充电站：柯基×狐狸的周末探险"
console.log(theme.subtitle); // "广州老乡的咖啡×人脉派对"
console.log(theme.vibe);     // "🔥 温暖 (81分)"
```

### Integration with Pool Matching

Already integrated! Themes auto-generate when groups are created in `poolMatchingService.ts`.

## 📊 Output Format

```typescript
interface EventTheme {
  theme: string;        // 12-18 chars, archetype-led, mysterious
  subtitle: string;     // 15-25 chars, grounding, concrete
  vibe: string;         // Energy emoji + level
  emoji: string;        // Single emoji
  reasoning: string;    // Full data provenance
  dataSources: object;  // File paths + line numbers
}
```

## ✅ Validation Checks (7 Stages)

| Check | Rule | Severity |
|-------|------|----------|
| 1. Structure | Has theme, subtitle, vibe, emoji | ❌ ERROR |
| 2. Character Limits | Theme: 12-18, Subtitle: 15-25 | ⚠️ WARNING |
| 3. Archetype Presence | Must include archetype if data exists | ❌ ERROR |
| 4. Energy Alignment | Theme energy matches group energy | ❌ ERROR |
| 5. Grounding | Subtitle has hometown/interest/intent | ⚠️ WARNING |
| 6. Generic Detection | No boring terms allowed | ❌ ERROR |
| 7. Vibe Format | Must include emoji | ⚠️ WARNING |

## 🎨 Theme Structure

### Good Patterns ✅

```
"高能充电站：柯基×情绪稳定鸡的周末探险"
  └─ Archetype + energy + activity

"沉思者花园：猫头鹰的深夜书房"
  └─ Archetype + vibe + setting

"能量平衡实验室：狐狸点火×熊守护"
  └─ Archetype dynamics
```

### Bad Patterns ❌

```
"广州老乡咖啡局" - Too plain, no archetype
"周末美食探店团" - Generic, could be any app
"精英人脉拓展会" - Boring, corporate
```

## 📦 Data Sources

### ✅ Use These

**From `users` table:**
- `archetype`, `secondaryArchetype`
- `gender`, `birthYear`
- `industryNicheLabel`
- `hometownRegionCity`, `currentCity`
- `intent`

**From `user_interests` table:**
- `selections` (filter heat >= 10)

**From `archetypeRegistry`:**
- `energyLevel`

### ❌ Never Use

- `languagesComfort` (not collected)
- `relationshipStatus` (too sensitive)
- `cuisinePreferences` (filter only)
- `seniority`, `companyName` (deprecated)

## 🔢 Scoring System

### Weights (Sum = 1.0)

```typescript
archetype: 0.30  // #1 priority - JoyJoin's unique IP
interests: 0.25  // #2 - Activity hook
intent: 0.20     // #3 - Experience framing
hometown: 0.15   // #4 - Grounding element
industry: 0.10   // #5 - Context flavor
age: 0.00        // Rarely useful
```

### Dual Scoring

Every dimension gets:
1. **Mystery Value** (0-100): How intriguing?
2. **Grounding Value** (0-100): How concrete?

**Final Score:**
```
finalScore = weight × (mysteryValue × 0.6 + groundingValue × 0.4)
```

## 🎭 12 Archetypes & Energy Levels

| Archetype | Energy | Category |
|-----------|--------|----------|
| 气氛组柯基 | 95 | 🔥 Very High |
| 情绪稳定鸡 | 90 | 🔥 Very High |
| 捧场王仓鼠 | 85 | 🔥 High |
| 探宝雷达狐 | 82 | 🔥 High |
| 读空气海豚 | 75 | 🌡️ Medium |
| 社交裁缝蛛 | 72 | 🌡️ Medium |
| 情绪树洞考拉 | 70 | 🌡️ Medium |
| 脑洞喷泉章鱼 | 68 | 🌡️ Medium |
| 追问猫头鹰 | 55 | 🌙 Low |
| 定海神针大象 | 52 | 🌙 Low |
| 慢半拍龟 | 38 | ❄️ Very Low |
| 静音模式猫 | 30 | ❄️ Very Low |

## 🔧 Configuration

### Environment Variables

```bash
# Required
DEEPSEEK_API_KEY=sk-xxx...

# Without API key, uses deterministic fallback templates
```

### Tuning

**Adjust weights** in `themeScoringService.ts`:
```typescript
export const EVENT_THEME_WEIGHTS = {
  archetype: 0.30,  // Increase for more archetype focus
  interests: 0.25,
  // ...
};
```

**Adjust retry attempts** in `themeLLMService.ts`:
```typescript
const maxAttempts = 3;  // Default: 3 attempts before fallback
```

## 🐛 Troubleshooting

### High Fallback Rate (>5%)

**Symptoms:** Most themes use deterministic templates

**Solutions:**
1. Check `DEEPSEEK_API_KEY` is set correctly
2. Review DeepSeek API status
3. Check system prompt in `themeLLMService.ts`

### Generic Themes

**Symptoms:** Themes like "XX的聚会"

**Solutions:**
1. Ensure users have completed personality test
2. Ensure users have selected interests (heat >= 2)
3. Increase archetype weight in config

### Energy Misalignment

**Symptoms:** High energy groups get "沉静" themes

**Solutions:**
1. Check avgEnergy calculation
2. Review energy alignment validation
3. Add more energy examples to LLM prompt

## 📈 Monitoring

### Key Metrics

```typescript
// Track these in analytics
{
  attempt: 1-3,              // Which attempt succeeded?
  usedFallback: boolean,     // Did LLM fail?
  passedValidation: boolean, // Did theme pass all checks?
  hasArchetype: boolean,     // CRITICAL: 100% required
  energyAlignment: boolean,  // CRITICAL: 100% required
  latency: number,           // Target: <2s p50
  cost: number,              // Target: <$0.02
}
```

### Alert Thresholds

- Fallback rate > 10% → Alert
- Archetype presence < 95% → Alert
- Average latency > 4s → Alert
- Cost per theme > $0.05 → Alert

## 📝 Examples

### Example 1: High-Energy Complementary

**Input:**
```typescript
Members: 4 people
- 2x 气氛组柯基 (energy: 95)
- 1x 探宝雷达狐 (energy: 82)
- 1x 情绪树洞考拉 (energy: 70)
avgEnergy: 86
Hometown: 3 from 广州
Interest: 4 love 咖啡 (heat=25)
Intent: 4 want 拓展人脉
```

**Output:**
```json
{
  "theme": "高能充电站：柯基×狐狸的周末探险",
  "subtitle": "广州老乡的咖啡×人脉派对",
  "vibe": "🔥 温暖 (86分)",
  "emoji": "⚡"
}
```

### Example 2: Low-Energy Homogeneous

**Input:**
```typescript
Members: 4 people
- 4x 追问猫头鹰 (energy: 55)
avgEnergy: 55
Interest: 4 love 阅读 (heat=25)
Intent: 4 want 结识朋友
```

**Output:**
```json
{
  "theme": "沉思者的秘密花园：猫头鹰的深夜书房",
  "subtitle": "纯交友·深度阅读分享",
  "vibe": "🌙 沉静 (55分)",
  "emoji": "📚"
}
```

## 🗄️ Database

### Query Themes

```sql
-- Get all groups with themes
SELECT theme, subtitle, vibe
FROM event_pool_groups
WHERE theme IS NOT NULL;

-- Get recent themes
SELECT *
FROM event_pool_groups
WHERE theme_generated_at > NOW() - INTERVAL '1 day'
ORDER BY theme_generated_at DESC;
```

### Schema

```sql
-- 6 new columns in event_pool_groups
theme VARCHAR(50)
subtitle VARCHAR(80)
vibe VARCHAR(30)
theme_emoji VARCHAR(10)
theme_reasoning TEXT
theme_generated_at TIMESTAMP
```

## 🧪 Testing

### Run Tests

```bash
# Run all theme tests
npm test apps/server/src/__tests__/theme

# Run specific test file
npm test apps/server/src/__tests__/themeScoring.test.ts
npm test apps/server/src/__tests__/themeLLM.test.ts
```

### Test Coverage

- 40+ tests for scoring algorithms
- 30+ tests for validation pipeline
- 70+ total test cases

## 📚 Full Documentation

See: `docs/event-theme-generator.md`

---

**Version:** 1.0.0 | **Last Updated:** 2026-02-07

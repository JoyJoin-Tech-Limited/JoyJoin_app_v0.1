# Event Theme Generator Documentation
# 活动主题生成器文档

## Overview

The Event Theme Generator is a **mystery box (盲盒主题) experience design system** that creates intriguing, archetype-led themes for matched groups using JoyJoin's proprietary 12-archetype system.

**Key Difference from Team Names:**
- ❌ Team names = **recognition + identity** ("This is who we are")
- ✅ Event themes = **anticipation + mystery** ("What will happen tonight?")

## Architecture

### System Flow

```
1. Pool Matching Service
   └─> Creates matched groups
       └─> generateAndSaveEventTheme()
           │
           ├─> PHASE 1: Data Collection
           │   └─> Fetch users + interests from DB
           │
           ├─> PHASE 2: Dimension Extraction
           │   └─> Extract 6 dimensions (archetype, interests, intent, hometown, industry, age)
           │
           ├─> PHASE 3: Scoring
           │   └─> Dual scoring (mystery + grounding)
           │
           ├─> PHASE 4: Component Selection
           │   └─> Theme leads vs subtitle grounds
           │
           ├─> PHASE 5: LLM Generation
           │   ├─> Build prompts (system + user)
           │   ├─> Call DeepSeek API
           │   └─> Validate (7 checks)
           │
           ├─> PHASE 6: Post-processing
           │   └─> Enrich with metadata
           │
           └─> PHASE 7: Database Save
               └─> event_pool_groups table
```

### Service Architecture

```
apps/server/src/
├── themeScoringService.ts       (10KB)
│   ├── extractDimensions()      - Extract 6 dimensions
│   ├── scoreDimensionsForTheme() - Dual scoring system
│   ├── selectThemeComponents()  - Select theme vs subtitle components
│   └── getEnergyLabel/Emoji()   - Energy utilities
│
├── themeLLMService.ts           (12.5KB)
│   ├── buildUserPrompt()        - Dynamic prompt construction
│   ├── validateTheme()          - 7-stage validation
│   ├── generateThemeWithLLM()   - DeepSeek integration + retry
│   └── generateFallbackTheme()  - Deterministic fallback
│
└── eventThemeGeneratorService.ts (9.3KB)
    ├── fetchEnrichedMemberProfiles() - Data fetching
    ├── buildLLMInput()              - LLM input preparation
    ├── enrichThemeWithMetadata()    - Add reasoning
    ├── generateEventTheme()         - Main entry point
    ├── saveEventTheme()             - DB persistence
    └── batchGenerateEventThemes()   - Batch processing
```

## Core Concepts

### 1. Dual Scoring System

Every dimension is scored on **two axes**:

| Dimension | Mystery Value | Grounding Value | Usage Type |
|-----------|--------------|-----------------|------------|
| Archetype | 95 (highest) | 40 (abstract) | **theme-lead** |
| Interests | 70 (moderate) | 90 (tangible) | bonus |
| Intent | 50 (some) | 80 (clear) | bonus |
| Hometown | 30 (factual) | 100 (concrete) | **subtitle-ground** |
| Industry | 40 (professional) | 70 (context) | bonus |
| Age | 20 (boring) | 60 (demographic) | bonus |

**Final Score Formula:**
```
finalScore = weight × (mysteryValue × 0.6 + groundingValue × 0.4)
```

**Usage Type Rules:**
```typescript
if (mysteryValue > 70 && groundingValue < 60) {
  return 'theme-lead';  // Goes into main theme
}

if (mysteryValue < 50 && groundingValue > 80) {
  return 'subtitle-ground';  // Goes into subtitle
}

return 'bonus';  // Optional enhancement
```

### 2. Event Theme Weights

```typescript
const EVENT_THEME_WEIGHTS = {
  archetype: 0.30,   // #1: JoyJoin's unique IP, mystery factor
  interests: 0.25,   // #2: Activity hook (MUST be heat >= 2)
  intent: 0.20,      // #3: Experience framing
  hometown: 0.15,    // #4: Grounding element (for subtitle)
  industry: 0.10,    // #5: Context flavor
  age: 0.00,         // #6: Rarely useful (only for special cases)
};
// Sum = 1.0
```

### 3. Data Sources (ONLY Use What We Collect)

#### ✅ Allowed Fields:

**From `users` table:**
```typescript
{
  archetype: string,              // e.g., "气氛组柯基"
  secondaryArchetype: string,
  gender: string,
  birthYear: string,              // For age calculation
  industryNicheLabel: string,     // e.g., "医疗AI"
  hometownRegionCity: string,     // e.g., "广州"
  currentCity: string,
  intent: string[],               // e.g., ["拓展人脉", "结识朋友"]
}
```

**From `user_interests` table:**
```typescript
// Query: Filter heat >= 2 (stored as 10 or 25)
SELECT * FROM user_interests WHERE heat >= 10

// Structure:
{
  selections: [
    { topicId, label, heat, level }
  ]
}
```

**From `archetypeRegistry`:**
```typescript
archetypeRegistry[archetype].profile.energyLevel
// 气氛组柯基: 95
// 情绪稳定鸡: 90
// 静音模式猫: 30
```

#### ❌ Never Use (Deprecated/Not Collected):

```typescript
// ❌ NEVER USE:
languagesComfort      // Not collected
seniority            // Not collected
companyName          // Not collected
roleTitleShort       // Deprecated
relationshipStatus   // Too sensitive
educationLevel       // Too broad
cuisinePreferences   // Filter only, not real interest
barThemes            // Filter only
```

### 4. Validation Pipeline (7 Stages)

```typescript
// CHECK 1: Structure
✅ Has theme, subtitle, vibe, emoji

// CHECK 2: Character limits
✅ Theme: 12-18 characters (warning if outside)
✅ Subtitle: 15-25 characters (warning if outside)

// CHECK 3: Archetype Presence (CRITICAL)
❌ ERROR if archetype data exists but theme missing archetype name

// CHECK 4: Energy Alignment
❌ ERROR if avgEnergy > 80 but theme has "沉静/安静/深度"
❌ ERROR if avgEnergy < 60 but theme has "高能/活力/爆发"

// CHECK 5: Grounding in Subtitle
⚠️ WARNING if subtitle missing hometown/interest/intent

// CHECK 6: Generic Detection
❌ ERROR if theme contains:
   "周末聚会", "朋友聚餐", "美食探店", "咖啡交流会",
   "社交活动", "精英人脉", "高端社交", "专业交流"

// CHECK 7: Vibe Format
⚠️ WARNING if vibe missing emoji: 🔥, 🌡️, 🌤️, ❄️, 🌙
```

## Usage Examples

### Example 1: High-Energy Complementary Group

**Input Data:**
```typescript
const members = [
  { archetype: "气氛组柯基", energy: 95, hometown: "广州", interests: ["咖啡": heat=25] },
  { archetype: "探宝雷达狐", energy: 82, hometown: "广州", interests: ["咖啡": heat=25] },
  { archetype: "情绪树洞考拉", energy: 70, hometown: "深圳", interests: ["咖啡": heat=10] },
  { archetype: "读空气海豚", energy: 75, hometown: "广州", interests: ["咖啡": heat=25] }
];
// avgEnergy: 81
// intent: "拓展人脉" (4 people)
```

**Generated Output:**
```json
{
  "theme": "高能充电站：柯基×狐狸的周末探险",
  "subtitle": "广州老乡的咖啡×人脉派对",
  "vibe": "🔥 温暖 (81分)",
  "emoji": "⚡",
  "reasoning": "主题整合:\n1. 原型化学反应: 柯基95+狐狸82 (高能探索者) 遇见 熊70+海豚75 (温和守护者), 能量互补平衡 - archetypeRegistry.ts\n2. 同乡: 3人广州老乡 - users.hometown_region_city\n3. 强兴趣: 4人都对咖啡很上头 (heat=3/3/2/3) - user_interests table (heat >= 2)\n4. 目的: 4人都来拓展人脉 - users.intent\n\n体验设计理念: 用'高能充电站'营造energetic vibe, 用archetype强化性格认同, 用咖啡提供具体话题, 用老乡建立trust"
}
```

**Validation Result:**
```
✅ All checks passed
✅ Archetype present (柯基×狐狸)
✅ Energy aligned (81 matches "温暖")
✅ Grounding elements present (广州, 咖啡, 人脉)
✅ No generic terms
```

### Example 2: Low-Energy Homogeneous Group

**Input Data:**
```typescript
const members = [
  { archetype: "追问猫头鹰", energy: 55, interests: ["阅读": heat=25, "哲学": heat=10] },
  { archetype: "定海神针大象", energy: 52, interests: ["阅读": heat=25, "商业": heat=10] },
  { archetype: "慢半拍龟", energy: 38, interests: ["阅读": heat=10, "心理学": heat=25] },
  { archetype: "静音模式猫", energy: 30, interests: ["阅读": heat=25, "艺术": heat=10] }
];
// avgEnergy: 44
// intent: "结识朋友" (4 people)
// No common hometown
```

**Generated Output:**
```json
{
  "theme": "沉思者的秘密花园：猫头鹰×大象的深夜书房",
  "subtitle": "纯交友·深度阅读分享",
  "vibe": "🌙 沉静 (44分)",
  "emoji": "📚",
  "reasoning": "主题整合:\n1. 原型化学反应: 猫头鹰55+大象52+龟38+猫30 = 沉静思考型组合 - archetypeRegistry.ts\n2. 强兴趣: 4人都对阅读很上头 (heat>=2) - user_interests table\n3. 目的: 4人都来结识朋友, not networking - users.intent\n\n体验设计理念: 用'沉思者花园'给予introvert permission to be quiet, 用'深夜书房'营造intimate vibe, explicitly说'纯交友'降低社交压力"
}
```

## API Reference

### `generateEventTheme(memberIds: string[], poolId: string): Promise<EventTheme>`

Main entry point for theme generation.

**Parameters:**
- `memberIds` - Array of user IDs in the group
- `poolId` - Event pool ID (for context like city, event type)

**Returns:** EventTheme object

**Example:**
```typescript
const theme = await generateEventTheme(
  ['user1', 'user2', 'user3', 'user4'],
  'pool123'
);

console.log(theme.theme);     // "高能充电站：柯基×狐狸的周末探险"
console.log(theme.subtitle);  // "广州老乡的咖啡×人脉派对"
console.log(theme.vibe);      // "🔥 温暖 (81分)"
```

### `saveEventTheme(groupId: string, theme: EventTheme): Promise<void>`

Save generated theme to database.

**Parameters:**
- `groupId` - Event pool group ID
- `theme` - Generated EventTheme object

**Side Effects:**
- Updates `event_pool_groups` table with theme fields

### `generateAndSaveEventTheme(groupId: string, memberIds: string[], poolId: string): Promise<EventTheme>`

Generate and save in one operation.

**Example:**
```typescript
const theme = await generateAndSaveEventTheme(
  'group123',
  ['user1', 'user2', 'user3'],
  'pool456'
);
```

### `batchGenerateEventThemes(groups: Array<{...}>): Promise<EventTheme[]>`

Generate themes for multiple groups.

**Parameters:**
```typescript
const groups = [
  { groupId: 'group1', memberIds: ['u1', 'u2'], poolId: 'pool1' },
  { groupId: 'group2', memberIds: ['u3', 'u4'], poolId: 'pool1' }
];
```

**Returns:** Array of EventTheme objects

**Note:** Continues on error (best-effort)

## Database Schema

### New Columns in `event_pool_groups`

```sql
ALTER TABLE event_pool_groups 
ADD COLUMN theme VARCHAR(50),                -- Main theme
ADD COLUMN subtitle VARCHAR(80),             -- Grounding subtitle
ADD COLUMN vibe VARCHAR(30),                 -- Energy indicator
ADD COLUMN theme_emoji VARCHAR(10),          -- Single emoji
ADD COLUMN theme_reasoning TEXT,             -- Full reasoning
ADD COLUMN theme_generated_at TIMESTAMP;     -- Generation timestamp

CREATE INDEX idx_event_pool_groups_theme_generated 
ON event_pool_groups(theme_generated_at) 
WHERE theme IS NOT NULL;
```

### Querying Themes

```sql
-- Get all groups with themes
SELECT id, theme, subtitle, vibe, theme_emoji
FROM event_pool_groups
WHERE theme IS NOT NULL;

-- Get recently generated themes
SELECT *
FROM event_pool_groups
WHERE theme_generated_at > NOW() - INTERVAL '1 day'
ORDER BY theme_generated_at DESC;

-- Get themes for a specific pool
SELECT g.*, p.title as pool_title
FROM event_pool_groups g
JOIN event_pools p ON g.pool_id = p.id
WHERE g.pool_id = 'pool123'
  AND g.theme IS NOT NULL;
```

## Configuration

### Environment Variables

```bash
# Required for LLM generation
DEEPSEEK_API_KEY=sk-xxx...

# If not set, falls back to deterministic templates
```

### Tuning Parameters

**In `themeScoringService.ts`:**
```typescript
// Adjust weights (must sum to 1.0)
export const EVENT_THEME_WEIGHTS = {
  archetype: 0.30,   // Increase for more archetype focus
  interests: 0.25,   // Increase for more interest focus
  intent: 0.20,
  hometown: 0.15,
  industry: 0.10,
  age: 0.00,
};

// Adjust mystery/grounding balance
const finalScore = weight × (mysteryValue × 0.6 + groundingValue × 0.4);
// Change 0.6 to 0.7 for more mystery, 0.5 for more grounding
```

**In `themeLLMService.ts`:**
```typescript
// Adjust retry attempts
const maxAttempts = 3;  // Change to 5 for more retries

// Adjust LLM temperature
temperature: 0.8,  // Higher = more creative, lower = more conservative
```

## Monitoring & Analytics

### Metrics to Track

```typescript
interface ThemeGenerationMetrics {
  attempt: number;              // Which attempt succeeded (1-3)
  latency: number;              // ms
  inputTokens: number;          // OpenAI tokens
  outputTokens: number;         // OpenAI tokens
  cost: number;                 // Calculated cost
  passedValidation: boolean;    // Did it pass all checks?
  validationErrors: string[];   // What failed?
  usedFallback: boolean;        // Did we use fallback template?
  themeLength: number;          // Character count
  subtitleLength: number;       // Character count
  hasArchetype: boolean;        // Critical check
  energyAlignment: boolean;     // Critical check
  top1Dimension: string;        // Highest scored dimension
  avgEnergy: number;            // Group energy level
  memberCount: number;          // Group size
}
```

### Recommended Dashboards

1. **Success Rate**
   - % themes passing validation on first attempt
   - % using fallback
   - Average retry count

2. **Quality Metrics**
   - Archetype presence rate (should be ~100%)
   - Energy alignment rate (should be ~100%)
   - Generic term detection rate (should be 0%)

3. **Cost & Performance**
   - Average latency (target: <2s p50, <4s p99)
   - Average cost per theme (target: <$0.02)
   - Token usage trends

4. **Content Analysis**
   - Most common archetypes in themes
   - Most common interests in subtitles
   - Energy distribution (fire/warm/mild/cold)

## Troubleshooting

### Issue: LLM keeps failing validation

**Symptoms:** High fallback rate (>5%)

**Causes:**
1. System prompt too vague
2. Energy alignment rules too strict
3. Generic term list too restrictive

**Solutions:**
1. Review failed themes in logs
2. Adjust validation thresholds
3. Add more good/bad examples to system prompt

### Issue: Themes too generic

**Symptoms:** Lots of "XX的聚会" patterns

**Causes:**
1. LLM fallback triggered too often
2. Not enough archetype emphasis in prompts
3. Low-quality input data (missing interests/archetypes)

**Solutions:**
1. Check DeepSeek API key is valid
2. Increase archetype weight in EVENT_THEME_WEIGHTS
3. Ensure users complete interests carousel

### Issue: Energy misalignment

**Symptoms:** High energy groups get low energy themes

**Causes:**
1. Energy calculation bug
2. LLM not following energy guidelines
3. Validation not catching mismatches

**Solutions:**
1. Check `avgEnergy` calculation in extractDimensions()
2. Add more energy examples to system prompt
3. Tighten energy alignment validation thresholds

## Best Practices

### 1. Always Validate Input Data

```typescript
// Before generating theme
if (memberIds.length < 2) {
  throw new Error('Need at least 2 members for theme generation');
}

// Check if members have archetypes
const hasArchetypes = members.some(m => m.archetype !== null);
if (!hasArchetypes) {
  console.warn('No archetypes found - theme will be generic');
}
```

### 2. Handle Errors Gracefully

```typescript
try {
  await generateAndSaveEventTheme(groupId, memberIds, poolId);
} catch (error) {
  console.error('Theme generation failed:', error);
  // Don't fail the entire matching process
  // Theme is nice-to-have, not critical
}
```

### 3. Monitor Fallback Rate

```typescript
// Alert if fallback rate > 10%
if (usedFallback) {
  analytics.track('theme_generation_fallback', {
    reason: validationErrors.join(', '),
    groupId,
    memberCount
  });
}
```

### 4. Test with Real Data

```typescript
// Use actual user data for testing
const realMembers = await fetchRealMemberProfiles(['user1', 'user2']);
const theme = await generateEventTheme(realMembers.map(m => m.id), 'pool123');

// Verify output makes sense
expect(theme.theme).toContain(realMembers[0].archetype);
```

## Future Enhancements

### Potential Improvements

1. **A/B Testing Framework**
   - Generate 2-3 theme variants
   - Let users vote on favorites
   - Learn which patterns work best

2. **Personalization**
   - Adjust based on user feedback
   - Track which themes lead to higher attendance
   - Optimize for event completion rate

3. **Multi-language Support**
   - Add English theme generation
   - Support Cantonese themes
   - Detect user language preference

4. **Theme Templates**
   - Pre-generate templates for common patterns
   - Cache popular archetype combinations
   - Faster generation (<500ms)

5. **Advanced Validation**
   - Sentiment analysis
   - Readability scoring
   - Cultural sensitivity checks

## Support

For questions or issues:
- Check logs: `console.log('[EventThemeGenerator] ...')`
- Review validation errors in `validationErrors` array
- Check DeepSeek API status
- Contact: [engineering team]

---

**Last Updated:** 2026-02-07
**Version:** 1.0.0

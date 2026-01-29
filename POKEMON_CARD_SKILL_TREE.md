# Pokemon Card Skill Tree System Documentation

## 📋 Overview

The Pokemon Card Skill Tree System transforms JoyJoin's personality test result cards from basic keyword badges into **authentic Pokemon Trading Card Game-style skill trees** with proper active/passive abilities, energy costs, and visual flair.

## 🎯 Key Features

### 1. **Two-Column Skill Layout**
- **Left Column**: Active skills with energy costs
- **Right Column**: Passive skills (always active)

### 2. **Complete Skill Definitions for 12 Archetypes**
Each archetype now has:
- **Attribute Badge**: Energy type with emoji (e.g., "🔥 热情")
- **Card Title**: Pokemon-style title (e.g., "破冰点火官")
- **Active Skill**: Triggered ability with energy cost
- **Passive Skill**: Always-on effect

### 3. **Pokemon TCG Design Elements**
- Energy cost indicators (0-3 energy)
- Type-specific energy emojis
- Badge indicators ("主动" / "被动")
- Circular icon containers with gradients
- Short, punchy effect descriptions (≤15 characters)
- Border effects matching card variant colors

## 📁 File Structure

```
packages/shared/src/personality/
├── archetypeSkills.ts          # NEW: Complete skill tree definitions
└── index.ts                     # Updated to export archetypeSkills

apps/user-client/src/components/
└── PokemonShareCard.tsx         # Updated with new skill display
```

## 🔧 Technical Implementation

### Data Structure

```typescript
export interface ArchetypeSkill {
  name: string;              // 技能名称
  type: 'active' | 'passive';
  energyCost: number;        // 0-3 for active, 0 for passive
  energyType: string;        // Energy emoji
  shortEffect: string;       // Concise (≤15 chars)
  fullEffect: string;        // Full description
  icon: string;              // Skill icon emoji
}

export interface ArchetypeSkillSet {
  attribute: string;         // Card attribute
  cardTitle: string;         // Pokemon card title
  activeSkill: ArchetypeSkill;
  passiveSkill: ArchetypeSkill;
}
```

### Usage Example

```typescript
import { archetypeSkills } from "@shared/personality/archetypeSkills";

// Get skills for an archetype
const corgiSkills = archetypeSkills["开心柯基"];

// Access skill properties
console.log(corgiSkills.activeSkill.name);        // "摇尾热场波"
console.log(corgiSkills.activeSkill.energyCost);  // 2
console.log(corgiSkills.activeSkill.energyType);  // "🔥"
console.log(corgiSkills.activeSkill.shortEffect); // "破冰启动，参与度+50%"
```

## 🎴 Complete Skill Reference

### 1. 开心柯基 (🔥 热情) - "破冰点火官"
- **Active**: 摇尾热场波 (2🔥) - 破冰启动，参与度+50%
- **Passive**: 永动引擎 - 能量恢复速度+1/分钟

### 2. 太阳鸡 (☀️ 暖意) - "小太阳发光体"
- **Active**: 小太阳辐射 (2☀️) - 持续幸福光环
- **Passive**: 恒定发光体 - 免疫负面氛围

### 3. 夸夸豚 (✨ 鼓舞) - "闪光捕手"
- **Active**: 闪光捕捉术 (1✨) - 优点放大，自信++
- **Passive**: 掌声回响 - 自动鼓励机制

### 4. 机智狐 (🗺️ 探索) - "秘境引路人"
- **Active**: 秘巷探照灯 (1🗺️) - 发现隐藏地点或玩法
- **Passive**: 新奇雷达 - 30%几率触发惊喜活动

### 5. 淡定海豚 (🌊 调和) - "情绪冲浪手"
- **Active**: 情绪冲浪 (1🌊) - 抵消尴尬与冲突
- **Passive**: 平滑波纹 - 情绪波动减少40%

### 6. 织网蛛 (🕸️ 连接) - "人脉架构师"
- **Active**: 人脉联结网 (1🕸️) - 发现隐藏共同点
- **Passive**: 社交网络 - 弱连接自动增强

### 7. 暖心熊 (🧸 共情) - "故事编织师"
- **Active**: 故事编织术 (2🧸) - 编织集体故事，连接++
- **Passive**: 安心拥抱领域 - 持续降低社交压力

### 8. 灵感章鱼 (🎨 灵感) - "脑洞喷泉"
- **Active**: 脑洞喷墨术 (1🎨) - 喷吐3个创意点子
- **Passive**: 多线程联想 - 脑暴灵感+50%

### 9. 沉思猫头鹰 (💡 洞察) - "本质透视者"
- **Active**: 本质透视 (2💡) - 揭示本质议题
- **Passive**: 思辨力场 - 发言质量提升

### 10. 定心大象 (🐘 安定) - "定心锚点"
- **Active**: 象鼻定心锚 (1🐘) - 提供绝对安心状态
- **Passive**: 厚重守护 - 安全感阈值提升

### 11. 稳如龟 (💎 真知) - "真知炮台"
- **Active**: 真知慢放炮 (3💎) - 蓄力后触发顿悟
- **Passive**: 深度观察 - 发现隐藏细节

### 12. 隐身猫 (🌙 陪伴) - "静默守护者"
- **Active**: 静默结界 (1🌙) - 创造低压社交区
- **Passive**: 存在即安慰 - 降低表现压力

## 🎨 Visual Design

### Active Skill Card (Left)
- **Badge**: Purple-pink gradient ("主动")
- **Background**: White with border glow matching variant color
- **Icon**: Purple-pink gradient circle
- **Energy Cost**: Number + emoji in purple pill
- **Effect Text**: 8px gray text, center-aligned

### Passive Skill Card (Right)
- **Badge**: Amber-yellow gradient ("被动")
- **Background**: Amber-yellow gradient
- **Icon**: Amber-yellow gradient circle
- **Status**: Green dot + "常驻效果" label
- **Effect Text**: 8px gray text, center-aligned

### Section Header
- **Title**: "技能树" with purple-pink gradient text
- **Attribute**: Card attribute in rounded pill with variant color

## 🔄 Migration from Old System

### What Was Removed
1. **SKILL_KEYWORD_MAP**: Old keyword-to-emoji mapping
2. **Core Skills Badge Grid**: Simple 2-4 badge layout
3. **Dynamic keyword matching logic**

### What Was Added
1. **archetypeSkills.ts**: Complete skill definitions
2. **Two-column Pokemon TCG layout**
3. **Energy cost system**
4. **Active/passive skill distinction**

## 📊 Energy Cost Balance

Energy costs are balanced by archetype activity level:
- **1 Energy**: Low-cost skills (discovery, mediation)
- **2 Energy**: Medium-cost skills (icebreaking, storytelling)
- **3 Energy**: High-cost skills (deep insight, rare)

Distribution:
- 1 Energy: 7 archetypes
- 2 Energy: 4 archetypes
- 3 Energy: 1 archetype (稳如龟 - slow but powerful)

## 🧪 Testing

Run the verification script to check all skills are properly defined:

```bash
node --import tsx/esm scripts/verify-skills.mjs
```

Expected output:
```
✅ All 12 archetypes have complete skill definitions!
```

## 🚀 Future Enhancements

### Potential Features
1. **Holographic shimmer** on skill cards (preview mode)
2. **Energy type-specific color theming**
3. **Micro-animations** on badges
4. **Skill synergy notes** between archetypes
5. **Interactive skill tooltips** showing full effect descriptions
6. **Skill combination suggestions** for team composition

### API Extensions
```typescript
// Potential future exports
export function getSkillSynergies(archetype1: string, archetype2: string): string[];
export function getSkillsByEnergyType(energyType: string): ArchetypeSkillSet[];
export function getSkillRecommendations(teamArchetypes: string[]): string;
```

## 📝 Maintenance Notes

### When Adding New Archetypes
1. Add skill definition to `archetypeSkills` object in `archetypeSkills.ts`
2. Follow naming conventions (Chinese characters, 3-5 chars per skill name)
3. Keep `shortEffect` under 15 characters for card readability
4. Run verification script to ensure all data is valid

### Design Guidelines
- **Energy emojis**: Must be visually distinct and thematically relevant
- **Skill names**: Should be creative, memorable, and evocative
- **Short effects**: Concise game mechanics (e.g., "+50%", "x3", "降低40%")
- **Full effects**: 1-2 sentences explaining the skill's social impact

## 🎯 Success Metrics

✅ All 12 archetypes have unique, meaningful skills  
✅ Skills accurately reflect Chinese archetype documentation  
✅ Visual design matches Pokemon TCG aesthetic  
✅ Text is readable at 420px card width (mobile share)  
✅ No TypeScript compilation errors  
✅ Build passes successfully  
✅ Cards are visually stunning and shareable  

---

**Created**: 2026-01-28  
**Version**: 1.0.0  
**Author**: GitHub Copilot  
**Status**: ✅ Complete & Production Ready

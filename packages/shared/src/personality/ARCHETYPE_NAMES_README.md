# Archetype Canonical Ordering - Single Source of Truth

## Overview

This module provides the canonical ordering of the 12 archetypes used throughout the JoyJoin application. It ensures consistency between server and client implementations and prevents ordering drift.

## Usage

### Import from Shared Package

```typescript
// Server (apps/server/src/)
import { 
  ARCHETYPE_CANONICAL_ORDER, 
  ARCHETYPE_COUNT,
  getArchetypeIndex,
  formatTypeNo,
  getArchetypeTypeNo 
} from '@shared/personality/archetypeNames';

// User Client (apps/user-client/src/)
import { 
  ARCHETYPE_CANONICAL_ORDER, 
  ARCHETYPE_COUNT,
  getArchetypeIndex,
  formatTypeNo,
  getArchetypeTypeNo 
} from '@shared/personality/archetypeNames';
```

### Canonical Archetype Order

```typescript
export const ARCHETYPE_CANONICAL_ORDER = [
  "气氛组柯基",      // #01
  "情绪稳定鸡",        // #02
  "捧场王仓鼠",        // #03
  "探宝雷达狐",        // #04
  "读空气海豚",      // #05
  "社交裁缝蛛",        // #06
  "情绪树洞考拉",        // #07
  "脑洞喷泉章鱼",      // #08
  "追问猫头鹰",    // #09
  "定海神针大象",      // #10
  "慢半拍龟",        // #11
  "静音模式猫",        // #12
] as const;
```

## API Reference

### `ARCHETYPE_CANONICAL_ORDER`

The canonical ordering of all 12 archetypes. This is a readonly array that should never be modified.

**Type:** `readonly string[]`

### `ARCHETYPE_COUNT`

The total number of archetypes (always 12).

**Type:** `number`

### `getArchetypeIndex(archetype: string): number | null`

Get the 1-based index of an archetype in the canonical order.

**Parameters:**
- `archetype` - The archetype name (Chinese)

**Returns:**
- 1-based index (1-12), or `null` if not found

**Examples:**
```typescript
getArchetypeIndex("气氛组柯基") // returns 1
getArchetypeIndex("探宝雷达狐")   // returns 4
getArchetypeIndex("静音模式猫")   // returns 12
getArchetypeIndex("不存在")   // returns null
```

### `formatTypeNo(index: number): string`

Format archetype TYPE number for display.

**Parameters:**
- `index` - 1-based index (1-12)

**Returns:**
- Formatted string like "01/12", "04/12", etc.

**Examples:**
```typescript
formatTypeNo(1)  // returns "01/12"
formatTypeNo(4)  // returns "04/12"
formatTypeNo(12) // returns "12/12"
```

### `getArchetypeTypeNo(archetype: string): string`

Get formatted TYPE number directly from archetype name.

**Parameters:**
- `archetype` - The archetype name (Chinese)

**Returns:**
- Formatted TYPE string like "01/12", or "00/12" if not found

**Examples:**
```typescript
getArchetypeTypeNo("气氛组柯基") // returns "01/12"
getArchetypeTypeNo("探宝雷达狐")   // returns "04/12"
getArchetypeTypeNo("不存在")   // returns "00/12"
```

## Where It's Used

1. **Server (`apps/server/src/archetypeConfig.ts`)**
   - Provides `ARCHETYPE_NAMES` export for backward compatibility
   - Used throughout server routing and matching logic

2. **User Client (`apps/user-client/src/components/slot-machine/archetypeData.ts`)**
   - Defines slot machine cycling order
   - Ensures UI matches backend ordering

3. **Share Card Components**
   - TYPE numbering for Pokemon-style cards (e.g., "No.04/12")

## Migration Notes

### Before (Multiple Sources)

```typescript
// Server had its own list
export const ARCHETYPE_NAMES = ["气氛组柯基", "情绪稳定鸡", ...];

// User client had its own list
export const ARCHETYPE_NAMES = Object.keys(CANONICAL_ARCHETYPES);
```

### After (Single Source)

```typescript
// Both import from shared
import { ARCHETYPE_CANONICAL_ORDER } from '@shared/personality/archetypeNames';
export const ARCHETYPE_NAMES = ARCHETYPE_CANONICAL_ORDER;
```

## Important Notes

⚠️ **DO NOT modify the canonical order without careful consideration!**

Changing the order will affect:
- Slot machine animation sequence
- TYPE numbering in share cards
- Any feature that depends on archetype enumeration
- Historical data or analytics that reference archetype positions

If you need to change the order, ensure:
1. All dependent systems are updated simultaneously
2. Migration plan is in place for existing data
3. Thorough testing across all affected features

## Testing

Run the smoke tests to verify the module:

```bash
npm test -- packages/shared/src/personality/__tests__/archetypeNames.test.ts
```

The tests verify:
- Canonical order contains exactly 12 archetypes
- All expected archetypes are present in correct order
- Helper functions work correctly
- Consistency across all archetypes

# PersonalityRadarChart Improvements for Mobile Share Cards

## Summary
Enhanced the PersonalityRadarChart component to support a compact variant optimized for mobile share cards (9:16 aspect ratio) with improved label formatting and reduced overlap.

## Changes Made

### 1. PersonalityRadarChart Component (`apps/user-client/src/components/PersonalityRadarChart.tsx`)

#### New Features
- **New `variant` prop**: Added optional `variant?: 'default' | 'compact'` prop (defaults to 'default')
- **Compact label mapping**: Created `compactLabels` constant with short, intuitive Chinese terms:
  - affinity: 亲和 (instead of 亲和力)
  - openness: 开放 (instead of 开放性)
  - conscientiousness: 尽责 (instead of 责任心)
  - emotionalStability: 稳定 (instead of 情绪稳定性)
  - extraversion: 外向 (instead of 外向性)
  - positivity: 积极 (instead of 正能量性)

#### Compact Variant Improvements

1. **Larger Labels**
   - Increased font size from 6px to 10px (in compactMode)
   - Font size formula: `variant === 'compact' ? (compactMode ? 10 : 13) : (compactMode ? 6 : 11)`

2. **Closer Label Positioning**
   - Reduced label radius from 35 to 20 (in compactMode)
   - Formula: `variant === 'compact' ? maxRadius + (20 * compactScale) : maxRadius + (35 * compactScale)`

3. **Quadrant-Aware Alignment**
   - Implemented precise 8-directional alignment based on angle
   - Reduces label overlap by aligning text based on position:
     - Right side (315°-45°): `textAnchor="start"`, `dy="0.35em"`
     - Bottom right (45°-90°): `textAnchor="start"`, `dy="-0.2em"`
     - Bottom (90°-135°): `textAnchor="middle"`, `dy="-0.5em"`
     - Bottom left (135°-180°): `textAnchor="end"`, `dy="-0.2em"`
     - Left side (180°-225°): `textAnchor="end"`, `dy="0.35em"`
     - Top left (225°-270°): `textAnchor="end"`, `dy="0.8em"`
     - Top (270°-315°): `textAnchor="middle"`, `dy="1em"`

### 2. PokemonShareCard Component (`apps/user-client/src/components/PokemonShareCard.tsx`)

- Updated PersonalityRadarChart usage to include `variant="compact"`
- Maintained existing `compactMode={true}` prop
- Share card now renders with optimized compact layout

## Backward Compatibility

All existing usages of PersonalityRadarChart remain unchanged:
- PersonalityTestResultPage
- ProfilePage
- PersonalityProfile
- ProfilePortraitCard

These components do not pass the `variant` prop, so they default to 'default' and maintain their current appearance.

## Technical Details

### Label Rendering Logic
```typescript
// Get label text based on variant
const labelText = variant === 'compact' 
  ? compactLabels[label.trait.key] || label.trait.name
  : label.trait.name;
```

### Angle-Based Alignment (Compact Variant)
```typescript
const angleDeg = (angle * 180 / Math.PI + 360) % 360;
// Apply different alignment based on 8 compass directions
```

## Benefits

1. **Improved Readability**: Larger font size (10px vs 6px) makes labels easier to read
2. **Better Layout**: Closer labels (20 vs 35 radius offset) provide more compact appearance
3. **Reduced Overlap**: Quadrant-aware alignment prevents label collision
4. **Concise Labels**: Short Chinese terms are more intuitive and save space
5. **Html2canvas Friendly**: No complex CSS effects that could break screenshot capture
6. **Type Safe**: Full TypeScript support with proper typing

## Build Verification

✅ TypeScript type checking passes  
✅ User client build succeeds  
✅ No breaking changes to existing components  
✅ All existing PersonalityRadarChart usages remain functional

## Visual Impact

- Share card radar chart labels are now:
  - **Bigger** (67% larger font size)
  - **Closer** (43% closer to chart)
  - **Shorter** (2-character labels vs 3-5 characters)
  - **Better aligned** (quadrant-aware positioning)
  
This creates a more readable, professional appearance for mobile share cards while maintaining the original design for other use cases.

# Refactoring Before/After Comparison
## Team Name → Event Theme Title

---

## File Renames

```
BEFORE                              AFTER
──────────────────────────────────────────────────────────────
TeamNameReveal.tsx          →       EventThemeTitleReveal.tsx
FloatingTeamTags.tsx        →       FloatingThemeTags.tsx
InteractiveTeamBubbles.tsx  →       InteractiveThemeBubbles.tsx
```

---

## Component Interface Changes

### EventThemeTitleReveal Component

```typescript
// BEFORE
interface TeamNameRevealProps {
  teamName: string;
  teamTagline: string;
  teamEmoji: string;
  teamSuperpowers: string[];
  teamVibe: 'playful' | 'professional' | 'creative' | 'adventurous';
}

export default function TeamNameReveal({
  teamName,
  teamTagline,
  teamEmoji,
  teamSuperpowers,
  teamVibe,
  ...
}: TeamNameRevealProps)

// AFTER
interface EventThemeTitleRevealProps {
  eventThemeTitle: string;
  themeTagline: string;
  themeEmoji: string;
  themeHighlights: string[];
  themeVibe: 'playful' | 'professional' | 'creative' | 'adventurous';
}

export default function EventThemeTitleReveal({
  eventThemeTitle,
  themeTagline,
  themeEmoji,
  themeHighlights,
  themeVibe,
  ...
}: EventThemeTitleRevealProps)
```

---

### FloatingThemeTags Component

```typescript
// BEFORE
interface TeamTag {
  teamName: string;
  teamEmoji: string;
}

interface FloatingTeamTagsProps {
  teamTags: TeamTag[];
  maxTags?: number;
  autoRotate?: boolean;
}

export default function FloatingTeamTags({
  teamTags,
  ...
}: FloatingTeamTagsProps)

// AFTER
interface ThemeTag {
  themeTitle: string;
  themeEmoji: string;
}

interface FloatingThemeTagsProps {
  themeTags: ThemeTag[];
  maxTags?: number;
  autoRotate?: boolean;
}

export default function FloatingThemeTags({
  themeTags,
  ...
}: FloatingThemeTagsProps)
```

---

### InteractiveThemeBubbles Component

```typescript
// BEFORE
interface TeamBubble {
  groupId: string;
  teamName: string;
  teamEmoji: string;
  memberCount: number;
  temperatureLevel: "fire" | "warm" | "mild" | "cold";
}

interface InteractiveTeamBubblesProps {
  teams: TeamBubble[];
  onTeamClick?: (groupId: string) => void;
}

export default function InteractiveTeamBubbles({
  teams,
  onTeamClick,
}: InteractiveTeamBubblesProps)

// AFTER
interface ThemeBubble {
  groupId: string;
  themeTitle: string;
  themeEmoji: string;
  memberCount: number;
  temperatureLevel: "fire" | "warm" | "mild" | "cold";
}

interface InteractiveThemeBubblesProps {
  themes: ThemeBubble[];
  onThemeClick?: (groupId: string) => void;
}

export default function InteractiveThemeBubbles({
  themes,
  onThemeClick,
}: InteractiveThemeBubblesProps)
```

---

## PoolRegistrationCard Changes

### Critical: Database Schema Alignment

```typescript
// BEFORE - Mixed naming
interface PoolRegistration {
  teamName?: string;          // ❌ Not in DB
  teamTagline?: string;       // ❌ Not in DB
  teamEmoji?: string;         // ✅ OK
  teamSuperpowers?: string[]; // ❌ Not in DB
  teamVibe?: string;          // ❌ Not in DB
}

// Component usage
{registration.teamName && (
  <div>
    <h3>{registration.teamName}</h3>
    <p>{registration.teamTagline}</p>
    <Badge>我的队伍</Badge>
  </div>
)}

// AFTER - Aligned with DB schema
interface PoolRegistration {
  theme?: string;         // ✅ Matches DB column
  subtitle?: string;      // ✅ Matches DB column
  themeEmoji?: string;    // ✅ Matches DB column
  highlights?: string[];  // ✅ Matches DB column (JSONB)
  vibe?: string;          // ✅ Matches DB column
}

// Component usage
{registration.theme && (
  <div>
    <h3>{registration.theme}</h3>
    <p>{registration.subtitle}</p>
    <Badge>我的盲盒主题</Badge>
  </div>
)}
```

---

## EventsPage WebSocket Changes

```typescript
// BEFORE
import TeamNameReveal from "@/components/TeamNameReveal";
import type { TeamNameRevealedData } from "@shared/wsEvents";

const [showTeamReveal, setShowTeamReveal] = useState(false);
const [teamData, setTeamData] = useState<TeamNameRevealedData | null>(null);

const unsubscribeTeamName = subscribe('TEAM_NAME_REVEALED', async (message) => {
  console.log('[User] Team name revealed:', message);
  const teamNameData = message.data as TeamNameRevealedData;
  setTeamData(teamNameData);
  setShowTeamReveal(true);
});

<TeamNameReveal
  isVisible={showTeamReveal}
  teamName={teamData.teamName}
  teamTagline={teamData.teamTagline}
  teamEmoji={teamData.teamEmoji}
  teamSuperpowers={teamData.teamSuperpowers || []}
  teamVibe={teamData.teamVibe || 'playful'}
  onClose={handleCloseTeamReveal}
/>

// AFTER
import EventThemeTitleReveal from "@/components/EventThemeTitleReveal";
import type { EventThemeTitleRevealedData } from "@shared/wsEvents";

const [showThemeReveal, setShowThemeReveal] = useState(false);
const [themeData, setThemeData] = useState<EventThemeTitleRevealedData | null>(null);

const unsubscribeThemeTitle = subscribe('EVENT_THEME_TITLE_REVEALED', async (message) => {
  console.log('[User] Event theme title revealed:', message);
  const themeTitleData = message.data as EventThemeTitleRevealedData;
  setThemeData(themeTitleData);
  setShowThemeReveal(true);
});

<EventThemeTitleReveal
  isVisible={showThemeReveal}
  eventThemeTitle={themeData.eventThemeTitle}
  themeTagline={themeData.themeTagline}
  themeEmoji={themeData.themeEmoji}
  themeHighlights={themeData.themeHighlights || []}
  themeVibe={themeData.themeVibe || 'playful'}
  onClose={handleCloseThemeReveal}
/>
```

---

## PoolStatusSection Import & Usage Changes

```typescript
// BEFORE
import FloatingTeamTags from "../FloatingTeamTags";
import InteractiveTeamBubbles from "../InteractiveTeamBubbles";

interface PoolStats {
  recentTeamNames: Array<{
    teamName: string;
    teamEmoji: string;
  }>;
}

interface PoolStatusSectionProps {
  successfulTeams?: TeamBubble[];
  onTeamClick?: (groupId: string) => void;
}

const [showAllTeams, setShowAllTeams] = useState(false);

<InteractiveTeamBubbles
  teams={successfulTeams}
  onTeamClick={onTeamClick}
/>

<FloatingTeamTags
  teamTags={stats.recentTeamNames}
  maxTags={5}
/>

// AFTER
import FloatingThemeTags from "../FloatingThemeTags";
import InteractiveThemeBubbles from "../InteractiveThemeBubbles";

interface PoolStats {
  recentThemeTitles: Array<{
    themeTitle: string;
    themeEmoji: string;
  }>;
}

interface PoolStatusSectionProps {
  successfulThemes?: ThemeBubble[];
  onThemeClick?: (groupId: string) => void;
}

const [showAllThemes, setShowAllThemes] = useState(false);

<InteractiveThemeBubbles
  themes={successfulThemes}
  onThemeClick={onThemeClick}
/>

<FloatingThemeTags
  themeTags={stats.recentThemeTitles}
  maxTags={5}
/>
```

---

## UI Text Changes (Chinese)

```
BEFORE                                  AFTER
─────────────────────────────────────────────────────────────────
我的队伍                        →       我的盲盒主题
暂无成功组队                    →       暂无盲盒主题
暂无成功组队案例                →       暂无盲盒主题案例
小悦正在为你们的队伍创造专属身份... →  小悦正在为你们的盲盒创造专属主题...
```

---

## Naming Convention Map

### Three Different Naming Contexts

| Context | Name Field | Tagline Field | Emoji | Highlights | Vibe |
|---------|-----------|---------------|-------|------------|------|
| **Database** | `theme` | `subtitle` | `themeEmoji` | `highlights` | `vibe` |
| **WebSocket** | `eventThemeTitle` | `themeTagline` | `themeEmoji` | `themeHighlights` | `themeVibe` |
| **Display** | `themeTitle` | - | `themeEmoji` | - | - |

---

## Key Takeaways

### ✅ Consistency Improvements
- All "team" references removed from client code
- Aligned with "盲盒主题" (blind box theme) product terminology
- Database schema properly reflected in TypeScript interfaces

### ⚠️ Important Notes
- `PoolRegistrationCard` uses **database field names** (`theme`, `subtitle`)
- `EventsPage` uses **WebSocket field names** (`eventThemeTitle`, `themeTagline`)
- Display components use simplified names (`themeTitle`, `themeEmoji`)

### 🔄 Migration Impact
- All imports must be updated
- WebSocket event listener changed from `TEAM_NAME_REVEALED` to `EVENT_THEME_TITLE_REVEALED`
- Component prop names changed across 7 components

---

**Completed:** February 9, 2025  
**Status:** ✅ Production Ready  
**Testing:** TypeScript compilation verified

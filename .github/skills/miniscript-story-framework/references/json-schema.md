# MiniScriptStoryFramework (v1)

- **`schemaVersion`:** literal `1`.
- **`style`:** `western_court` \| `medieval` \| `ancient_chinese` \| `xianxia` \| `future_tech` \| `modern_urban` \| `republican_era`.
- **`genres`:** non-empty subset of `light_reasoning`, `thriller_mystery`, `romance`, `absurd_comedy`.
- **`premise`:** string.
- **`characters[]`:** `slotIndex`, `roleLabel`, `sinHook`, `alibi`, `secret` (4–6 entries).
- **`act_flow[]`:** `actNumber`, `title`, `beats[]`.
- **`ending`:** `resolutionSummary`, `confessionMechanic`.

Authoritative Zod: `packages/shared/src/miniscriptStoryFramework.ts`.

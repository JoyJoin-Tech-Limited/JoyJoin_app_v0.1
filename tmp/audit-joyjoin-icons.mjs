import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const mapPath = path.resolve(__dirname, '../packages/shared/src/iconSystem/emojiToIconMap.ts')
const mapSrc = fs.readFileSync(mapPath, 'utf8')

function extractObjectEntries(src, varName) {
  const regex = new RegExp(`export const ${varName}: Record<string, IconMapping> = \\{([\\s\\S]*?)\\n}[^,]?`, 'm')
  const match = src.match(regex)
  if (!match) return new Map()
  const body = match[1]
  const entries = new Map()
  const lineRe = /'([^']+)':\s*\{[\s\S]*?assetKey:\s*'([^']+)',[\s\S]*?tier:\s*'([^']+)'/g
  let m
  while ((m = lineRe.exec(body)) !== null) {
    entries.set(m[1], { assetKey: m[2], tier: m[3] })
  }
  return entries
}

const maps = {
  RATING_FACE_MAP: extractObjectEntries(mapSrc, 'RATING_FACE_MAP'),
  INFO_LABEL_MAP: extractObjectEntries(mapSrc, 'INFO_LABEL_MAP'),
  MOOD_ICON_MAP: extractObjectEntries(mapSrc, 'MOOD_ICON_MAP'),
  CHEMISTRY_BADGE_MAP: extractObjectEntries(mapSrc, 'CHEMISTRY_BADGE_MAP'),
  PHASE_EMBLEM_MAP: extractObjectEntries(mapSrc, 'PHASE_EMBLEM_MAP'),
  CATEGORY_MAP: extractObjectEntries(mapSrc, 'CATEGORY_MAP'),
  INTENT_MAP: extractObjectEntries(mapSrc, 'INTENT_MAP'),
  REACTION_MAP: extractObjectEntries(mapSrc, 'REACTION_MAP'),
  REVEAL_MAP: extractObjectEntries(mapSrc, 'REVEAL_MAP'),
  ACHIEVEMENT_MAP: extractObjectEntries(mapSrc, 'ACHIEVEMENT_MAP'),
  STATUS_ICON_MAP: extractObjectEntries(mapSrc, 'STATUS_ICON_MAP'),
  UI_ICON_MAP: extractObjectEntries(mapSrc, 'UI_ICON_MAP'),
}

const flatMap = new Map()
for (const [name, entries] of Object.entries(maps)) {
  for (const [emoji, meta] of entries) {
    if (!flatMap.has(emoji)) {
      flatMap.set(emoji, { ...meta, source: name })
    }
  }
}

const tierMaps = new Map()
for (const [name, entries] of Object.entries(maps)) {
  for (const [emoji, meta] of entries) {
    if (!tierMaps.has(emoji)) tierMaps.set(emoji, [])
    tierMaps.get(emoji).push({ map: name, ...meta })
  }
}

const root = path.resolve(__dirname, '../apps/mini-program/src')
const files = globSync('**/*.{tsx,ts}', { cwd: root, absolute: true })

// Match JoyJoinIcon tags, possibly multiline
const componentRe = /<JoyJoinIcon\b([\s\S]*?)\/>/g
// Match individual props (simple literal or expression); does not handle nested braces perfectly
const propRe = /\b(emoji|tier|size|className|lazyLoad)\s*=\s*(\{([^{}]*)\}|'([^']+)'|"([^"]+)")/g

const literalNoTier = []
const literalInTierMap = []
const dynamicNoTier = []
const noMapping = []

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  let m
  while ((m = componentRe.exec(src)) !== null) {
    const tag = m[1]
    const props = {}
    let pm
    while ((pm = propRe.exec(tag)) !== null) {
      const key = pm[1]
      // value is either expression body (pm[3]) or single-quoted (pm[4]) or double-quoted (pm[5])
      const expr = pm[3]
      const literal = pm[4] ?? pm[5]
      props[key] = expr !== undefined ? { kind: 'expr', value: expr } : { kind: 'literal', value: literal }
    }
    propRe.lastIndex = 0

    if (!props.emoji) continue
    const relFile = path.relative(root, file)

    const emojiProp = props.emoji
    const hasTier = Boolean(props.tier)

    if (emojiProp.kind === 'expr') {
      dynamicNoTier.push({ file: relFile, emojiExpr: emojiProp.value, hasTier, snippet: m[0].split('\n')[0].trim() })
      continue
    }

    const emoji = emojiProp.value
    const inFlat = flatMap.has(emoji)
    const tierOptions = tierMaps.get(emoji) ?? []

    if (hasTier) {
      // already tiered; nothing to do
      continue
    }

    if (inFlat) {
      // resolves via flat map; no fallback
      continue
    }

    if (tierOptions.length > 0) {
      literalInTierMap.push({
        file: relFile,
        emoji,
        snippet: m[0].split('\n')[0].trim(),
        options: tierOptions.map((o) => `${o.tier}:${o.assetKey} (${o.map})`),
      })
    } else {
      noMapping.push({
        file: relFile,
        emoji,
        snippet: m[0].split('\n')[0].trim(),
      })
    }
  }
}

function print(title, list) {
  console.log(`\n=== ${title} (${list.length}) ===\n`)
  for (const item of list) {
    console.log(`File: ${item.file}`)
    if (item.emoji !== undefined) console.log(`Emoji: ${item.emoji}`)
    if (item.emojiExpr !== undefined) console.log(`Expr: ${item.emojiExpr}`)
    if (item.options) console.log(`Options: ${item.options.join(' | ')}`)
    if (item.hasTier !== undefined) console.log(`Has tier: ${item.hasTier}`)
    console.log(`Snippet: ${item.snippet}`)
    console.log('')
  }
}

print('Literal emojis NOT in flat map but available in tier-specific maps (fix by adding tier)', literalInTierMap)
print('Literal emojis with NO proprietary asset at all (need new asset/mapping or accept native fallback)', noMapping)
print('Dynamic emoji expressions (review; may need runtime tier helper or explicit tier)', dynamicNoTier)

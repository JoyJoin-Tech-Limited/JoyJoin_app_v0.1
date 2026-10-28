import type { SocialTopic } from '@shared/socialIcebreaker';
import { selectPermissionLineForTopic } from '@shared/socialIcebreakerYuezaiCopy';

/** Hard per-session bound. This is session state only — never a global window. */
export const WARMUP_SERVED_TOPIC_KEYS_LIMIT = 240;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Exact keys retain the served text; normalized aliases catch case, width,
 * whitespace and punctuation variants without claiming semantic similarity.
 */
export function normalizeWarmupTopicKeyPart(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, '');
}

export function getWarmupTopicServedKeys(topic: SocialTopic): string[] {
  const keys: string[] = [];
  for (const [prefix, raw] of [['id', topic.id], ['q', topic.question]] as const) {
    if (typeof raw !== 'string' || raw.length === 0) continue;
    keys.push(`${prefix}:${raw}`);
    const normalized = normalizeWarmupTopicKeyPart(raw);
    if (normalized) keys.push(`${prefix}:${normalized}`);
  }
  return unique(keys);
}

export function resolveWarmupServedTopicKeys(
  existing: readonly string[] | undefined,
  currentTopics: readonly SocialTopic[],
): string[] {
  if (Array.isArray(existing)) {
    return unique(existing).slice(-WARMUP_SERVED_TOPIC_KEYS_LIMIT);
  }
  // Legacy sessions have no served field. Their current deck was already served
  // and must be excluded before the first replacement, but no older deck is invented.
  return appendWarmupServedTopicKeys([], currentTopics);
}

/** Append only the final committed deck, then evict oldest history first. */
export function appendWarmupServedTopicKeys(
  previous: readonly string[],
  committedTopics: readonly SocialTopic[],
): string[] {
  const currentKeys = unique(committedTopics.flatMap(getWarmupTopicServedKeys));
  const currentSet = new Set(currentKeys);
  const history = unique(previous).filter((key) => !currentSet.has(key));
  // Current keys are last, so the cap cannot evict the deck just committed
  // (normal decks are at most seven cards). The slice is still a hard bound for
  // malformed oversized input.
  return [...history, ...currentKeys].slice(-WARMUP_SERVED_TOPIC_KEYS_LIMIT);
}

interface DeckEntry {
  topic: SocialTopic;
  source: 'primary' | 'fallback' | 'current';
  index: number;
}

export interface SelectWarmupTopicDeckInput {
  topics: readonly SocialTopic[];
  curatedFallbackCandidates?: readonly SocialTopic[];
  servedTopicKeys?: readonly string[];
  currentTopics?: readonly SocialTopic[];
  targetCount?: number;
}

export interface SelectWarmupTopicDeckResult {
  topics: SocialTopic[];
  dedupeRelaxed: boolean;
}

function topicDepth(topic: SocialTopic): number {
  return topic.depthLevel ?? 1;
}

function topicSafety(topic: SocialTopic): NonNullable<SocialTopic['safety']> {
  return topic.safety ?? 'gentle';
}

function buildPool(
  input: SelectWarmupTopicDeckInput,
  servedKeys: ReadonlySet<string>,
  includeServed: boolean,
  includeCurrent: boolean,
): DeckEntry[] {
  const pool: DeckEntry[] = [];
  const seen = new Set<string>();
  const add = (topics: readonly SocialTopic[], source: DeckEntry['source']) => {
    for (const topic of topics) {
      const keys = getWarmupTopicServedKeys(topic);
      if (keys.some((key) => seen.has(key))) continue;
      if (!includeServed && keys.some((key) => servedKeys.has(key))) continue;
      pool.push({ topic, source, index: pool.length });
      for (const key of keys) seen.add(key);
    }
  };

  add(input.topics, 'primary');
  add(input.curatedFallbackCandidates ?? [], 'fallback');
  if (includeCurrent) add(input.currentTopics ?? [], 'current');
  return pool;
}

function trimPreservingBrave(entries: DeckEntry[], targetCount: number): DeckEntry[] {
  const selected = [...entries];
  while (selected.length > targetCount) {
    // Keep the earliest flow and preserve reflective cards where possible.
    let removeAt = -1;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (topicSafety(selected[index].topic) !== 'reflective') {
        removeAt = index;
        break;
      }
    }
    selected.splice(removeAt >= 0 ? removeAt : selected.length - 1, 1);
  }
  return selected;
}

function selectSimple(pool: DeckEntry[], targetCount: number): DeckEntry[] {
  return pool.slice(0, targetCount);
}

function selectArcRemainder(
  primary: DeckEntry[],
  fill: DeckEntry[],
  targetCount: number,
): DeckEntry[] {
  if (targetCount === 0) return [];
  const primaryHasBrave = primary.some((entry) => topicSafety(entry.topic) === 'reflective');
  const fillBrave = fill.find((entry) => topicSafety(entry.topic) === 'reflective');

  if (primary.length >= targetCount) {
    if (primaryHasBrave || !fillBrave) return trimPreservingBrave(primary, targetCount);
    return [...trimPreservingBrave(primary, targetCount - 1), fillBrave];
  }

  const needed = targetCount - primary.length;
  if (!primaryHasBrave && fillBrave) {
    const remainingFill = fill.filter((entry) => entry.index !== fillBrave.index);
    return [...primary, fillBrave, ...remainingFill.slice(0, needed - 1)];
  }
  return [...primary, ...fill.slice(0, needed)];
}

/** Stable light-before-deep ordering with a gentle, never-brave opener. */
function selectArc(pool: DeckEntry[], targetCount: number): DeckEntry[] {
  const referenceMood = pool.find((entry) => entry.source === 'primary')?.topic.mood ?? pool[0]?.topic.mood;
  const gentle = pool
    .filter((entry) => topicSafety(entry.topic) === 'gentle')
    .sort((left, right) => {
      const depthDifference = topicDepth(left.topic) - topicDepth(right.topic);
      if (depthDifference !== 0) return depthDifference;
      const moodDifference = Number(left.topic.mood !== referenceMood) - Number(right.topic.mood !== referenceMood);
      if (moodDifference !== 0) return moodDifference;
      const sourceDifference = Number(left.source !== 'primary') - Number(right.source !== 'primary');
      return sourceDifference || left.index - right.index;
    });
  const opener = gentle[0];
  if (!opener) return selectSimple(pool, targetCount);

  const remaining = pool.filter(
    (entry) => entry.index !== opener.index && topicDepth(entry.topic) >= topicDepth(opener.topic),
  );
  const primary = remaining.filter((entry) => entry.source === 'primary');
  const fill = remaining.filter((entry) => entry.source !== 'primary');
  const remainderCount = Math.max(0, targetCount - 1);
  const remainder = selectArcRemainder(primary, fill, remainderCount);

  return [opener, ...remainder].sort((left, right) => {
    if (left.index === opener.index) return -1;
    if (right.index === opener.index) return 1;
    return topicDepth(left.topic) - topicDepth(right.topic) || left.index - right.index;
  });
}

function hasCompleteArc(entries: DeckEntry[], targetCount: number): boolean {
  if (entries.length !== targetCount || entries.length === 0) return false;
  if (topicSafety(entries[0].topic) !== 'gentle') return false;
  for (let index = 1; index < entries.length; index += 1) {
    if (topicDepth(entries[index].topic) < topicDepth(entries[index - 1].topic)) return false;
  }
  return true;
}

function attachPermissionLine(topic: SocialTopic): SocialTopic {
  if (
    topic.permissionLine !== undefined
    || (topic.depthLevel === undefined && topic.safety === undefined)
  ) {
    return topic;
  }
  return {
    ...topic,
    permissionLine: selectPermissionLineForTopic({
      question: topic.question,
      depthLevel: topic.depthLevel ?? 1,
    }),
  };
}

/**
 * Select a replacement deck before the state write. Unserved candidates are
 * always preferred; only exhaustion/arc infeasibility triggers a deterministic
 * second pass that may reuse served cards. No candidate is recorded here.
 */
export function selectWarmupTopicDeck(
  input: SelectWarmupTopicDeckInput,
): SelectWarmupTopicDeckResult {
  const hasCandidates = input.topics.length > 0
    || (input.curatedFallbackCandidates?.length ?? 0) > 0
    || (input.currentTopics?.length ?? 0) > 0;
  const requestedCount = input.targetCount ?? input.topics.length;
  const targetCount = requestedCount > 0 ? requestedCount : hasCandidates ? 1 : 0;
  const servedKeys = new Set(input.servedTopicKeys ?? []);
  const arcEnabled = input.topics.some(
    (topic) => topic.depthLevel !== undefined || topic.safety !== undefined,
  );

  const unservedPool = buildPool(input, servedKeys, false, false);
  const unserved = arcEnabled
    ? selectArc(unservedPool, targetCount)
    : selectSimple(unservedPool, targetCount);
  const unservedComplete = arcEnabled
    ? hasCompleteArc(unserved, targetCount)
    : unserved.length === targetCount;
  if (unservedComplete) {
    return {
      topics: unserved.map((entry) => attachPermissionLine(entry.topic)),
      dedupeRelaxed: false,
    };
  }

  const relaxedPool = buildPool(input, servedKeys, true, true);
  const relaxed = arcEnabled
    ? selectArc(relaxedPool, targetCount)
    : selectSimple(relaxedPool, targetCount);
  return {
    topics: relaxed.map((entry) => attachPermissionLine(entry.topic)),
    dedupeRelaxed: servedKeys.size > 0,
  };
}

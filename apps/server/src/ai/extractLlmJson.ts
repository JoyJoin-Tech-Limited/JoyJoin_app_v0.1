/**
 * Best-effort JSON extraction from LLM text (markdown fences, balanced JSON respecting strings).
 * Used when MiniMax OpenAI-compatible API does not enforce response_format json_object.
 */

/**
 * Returns a substring that JSON.parse accepts, or the trimmed input for a final attempt.
 */
export function extractJsonPayloadForParse(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = [trimmed, fenced].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  const balanced = extractBalancedJsonRespectingStrings(trimmed);
  if (balanced) return balanced;

  return trimmed;
}

/**
 * Finds first `{` or `[` and returns the shortest balanced slice that `JSON.parse` accepts,
 * respecting `"` strings and `\\` escapes so braces inside strings do not break depth.
 */
function extractBalancedJsonRespectingStrings(s: string): string | null {
  const iObj = s.indexOf('{');
  const iArr = s.indexOf('[');
  let start = -1;
  if (iObj === -1) start = iArr;
  else if (iArr === -1) start = iObj;
  else start = Math.min(iObj, iArr);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{' || c === '[') {
      depth++;
    } else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1).trim();
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

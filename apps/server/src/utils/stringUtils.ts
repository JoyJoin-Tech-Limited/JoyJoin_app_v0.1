/**
 * String utility functions for fuzzy matching
 */

/**
 * Calculate Levenshtein distance between two strings
 * (minimum number of single-character edits required to change one string into the other)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize base cases
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  // Fill the dp table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        // Characters match, no operation needed
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // Take minimum of insert, delete, or replace
        dp[i][j] = Math.min(
          dp[i - 1][j],     // delete
          dp[i][j - 1],     // insert
          dp[i - 1][j - 1]  // replace
        ) + 1;
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 * Based on Levenshtein distance
 */
export function similarityRatio(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  
  if (maxLen === 0) return 1.0;
  
  return 1.0 - (distance / maxLen);
}

/**
 * Check if two strings are similar within a threshold
 */
export function isSimilar(str1: string, str2: string, threshold: number = 0.8): boolean {
  return similarityRatio(str1, str2) >= threshold;
}

/**
 * Normalize Chinese text for comparison
 * (e.g., remove spaces, convert to lowercase for mixed content)
 */
export function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

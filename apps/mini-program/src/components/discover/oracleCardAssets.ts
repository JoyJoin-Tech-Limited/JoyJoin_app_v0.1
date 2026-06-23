import { cdnAsset } from '../../lib/utils/cdnAssets'

const ORACLE_CARD_CORNER_ASSETS: Record<string, string> = {
  '饭局': '/assets/lovart/oraclecard-corner-dining-20260623-v1.webp',
  '酒局': '/assets/lovart/oraclecard-corner-drinks-20260623-v1.webp',
  'dinner': '/assets/lovart/oraclecard-corner-dining-20260623-v1.webp',
  'dining': '/assets/lovart/oraclecard-corner-dining-20260623-v1.webp',
  'drinks': '/assets/lovart/oraclecard-corner-drinks-20260623-v1.webp',
  'bar': '/assets/lovart/oraclecard-corner-drinks-20260623-v1.webp',
}

export function getOracleCardCornerAsset(eventType?: string): string | undefined {
  if (!eventType) return undefined
  const path = ORACLE_CARD_CORNER_ASSETS[eventType]
  return path ? cdnAsset(path) : undefined
}

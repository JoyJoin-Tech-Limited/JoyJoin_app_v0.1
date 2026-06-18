import { validateCraft, type CraftContext } from '../../apps/server/src/lib/writingCraftValidator'

interface LabelAuditItem {
  key: string
  text: string
  context: CraftContext
  threshold: number
}

const LABELS: LabelAuditItem[] = [
  { key: 'bio_label', text: '一句话介绍', context: 'lite', threshold: 55 },
  { key: 'bio_placeholder', text: '输入你的社交签名', context: 'lite', threshold: 55 },
  { key: 'bio_empty_cta', text: '写一句你的社交签名，让别人一眼记住你', context: 'full', threshold: 70 },
  { key: 'bio_error_empty', text: '请填写一句话介绍', context: 'lite', threshold: 55 },
  { key: 'bio_error_too_long', text: '一句话介绍不能超过 100 个字符', context: 'lite', threshold: 55 },
  { key: 'mutual_context_same_city', text: '同在深圳', context: 'lite', threshold: 55 },
  { key: 'mutual_context_same_archetype', text: '同为开心柯基', context: 'lite', threshold: 55 },
  { key: 'mutual_context_same_family', text: '原型同频', context: 'lite', threshold: 55 },
  { key: 'mutual_context_complement', text: '原型互补', context: 'lite', threshold: 55 },
  { key: 'mutual_context_chemistry', text: '默契值 87', context: 'lite', threshold: 55 },
  { key: 'mutual_context_combined', text: '同在深圳 · 原型互补 · 默契值 87', context: 'full', threshold: 70 },
  { key: 'profile_completion_reaction', text: '资料完整度 100%，你的社交名片已就绪', context: 'full', threshold: 70 },
]

let failed = 0

console.log('Running craft validation for richer-profile-preview-card labels...\n')

for (const item of LABELS) {
  const result = validateCraft(item.text, item.context)
  const status = result.passes ? 'PASS' : 'FAIL'
  console.log(`${status}  ${item.key}  score=${result.craftScore}  threshold=${item.threshold}`)
  if (!result.passes) {
    failed++
    for (const issue of result.fixableIssues) {
      console.log(`      • ${issue}`)
    }
  }
}

console.log(`\n${failed === 0 ? 'All labels pass craft validation.' : `${failed} label(s) failed.`}`)
process.exit(failed === 0 ? 0 : 1)

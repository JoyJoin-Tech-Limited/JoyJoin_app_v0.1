export interface LocalProfessionClassification {
  occupationId: string
  standardizedOccupationId: string
  industryCategoryLabel: string | null
  industrySegmentLabel: string | null
  industryNicheLabel: string | null
  industryCategory: string | null
  industrySegmentNew: string | null
  industryNiche: string | null
  industrySource: string
  industryConfidence: number
  displayTags: string[]
  reaction: string
}

const CHINESE_STUDENT_IDENTITY_PATTERN = /(学生|在读|大学生|本科生|研究生|硕士生|博士生|留学生)/
const LATIN_STUDENT_IDENTITY_PATTERN = /^(student|undergraduate|graduate student|grad student|phd student|phd candidate|master student)$/

export function getLocalProfessionClassification(input: string): LocalProfessionClassification | null {
  const normalized = input.trim().replace(/\s+/g, ' ')
  if (!normalized) return null

  const compactChinese = normalized.replace(/\s+/g, '')
  const compactLatin = normalized.toLowerCase()

  if (
    !CHINESE_STUDENT_IDENTITY_PATTERN.test(compactChinese) &&
    !LATIN_STUDENT_IDENTITY_PATTERN.test(compactLatin)
  ) {
    return null
  }

  return {
    occupationId: normalized,
    standardizedOccupationId: 'student_grad',
    industryCategoryLabel: '学生',
    industrySegmentLabel: '在读身份',
    industryNicheLabel: '校园生活',
    industryCategory: 'other',
    industrySegmentNew: 'student',
    industryNiche: 'student_grad',
    industrySource: 'local_student_identity',
    industryConfidence: 0.92,
    displayTags: ['学生党', '开放探索', '好奇心强'],
    reaction: '学生党的好奇心是最宝贵的社交货币，保持开放就好',
  }
}

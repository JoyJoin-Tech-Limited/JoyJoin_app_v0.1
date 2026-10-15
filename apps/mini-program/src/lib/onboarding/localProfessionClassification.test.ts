import { describe, expect, it } from 'vitest'
import { isUsableStoredProfessionClassification } from './professionSubmissionGuard'
import { getLocalProfessionClassification } from './localProfessionClassification'

describe('localProfessionClassification', () => {
  it('classifies student identities with structured data', () => {
    const classification = getLocalProfessionClassification('学生')

    expect(classification).toMatchObject({
      occupationId: '学生',
      standardizedOccupationId: 'student_grad',
      industryCategory: 'other',
      industrySegmentNew: 'student',
      industryNiche: 'student_grad',
      industrySource: 'local_student_identity',
    })
    expect(classification?.displayTags).toContain('学生党')
    expect(isUsableStoredProfessionClassification(classification)).toBe(true)
  })

  it('keeps the student reaction free of banned WeChat-review vocabulary', () => {
    const reaction = getLocalProfessionClassification('学生')?.reaction ?? ''
    expect(reaction.length).toBeGreaterThan(0)
    expect(/匹配|社交|灵魂|撮合|AI/.test(reaction)).toBe(false)
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(reaction)).toBe(false)
  })

  it('recognizes common student variants without widening to random input', () => {
    expect(getLocalProfessionClassification('在读研究生')?.standardizedOccupationId).toBe('student_grad')
    expect(getLocalProfessionClassification('student')?.standardizedOccupationId).toBe('student_grad')
    expect(getLocalProfessionClassification('产品经理')).toBeNull()
    expect(getLocalProfessionClassification('ki')).toBeNull()
  })
})

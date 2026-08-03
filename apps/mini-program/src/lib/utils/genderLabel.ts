/**
 * getGenderLabel — canonical user-facing gender chip label.
 *
 * The users table stores gender in mixed forms ('male'/'female', '男'/'女',
 * '男生'/'女生'). Never render the raw value on a poster surface — a
 * lowercase English enum chip breaks the premium all-Chinese entry card
 * (Class A content defect, 2026-08-01 design audit).
 *
 * Returns null for unknown/undisclosed values so callers can filter them
 * out of tag rows.
 */
export function getGenderLabel(value?: string | null): string | null {
  switch (value?.trim().toLowerCase()) {
    case 'male':
    case 'man':
    case '男':
    case '男生':
    case '男性':
      return '男生'
    case 'female':
    case 'woman':
    case '女':
    case '女生':
    case '女性':
      return '女生'
    default:
      return null
  }
}

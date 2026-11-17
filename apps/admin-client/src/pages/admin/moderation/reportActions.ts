/**
 * The moderation queue is shared: `/api/admin/moderation/reports` returns every
 * row, including AI-content reports whose `reported_user_id` is NULL (there is
 * no user to act on). 封禁 / 警告 must be unavailable for those rows, while
 * 驳回 (dismiss) and a plain status change stay possible.
 *
 * Kept as a pure helper so the rule is testable instead of living only inside
 * inline JSX `disabled` expressions.
 */
export function canApplyUserAction(report: { reported_user_id: string | null }): boolean {
  return Boolean(report.reported_user_id);
}

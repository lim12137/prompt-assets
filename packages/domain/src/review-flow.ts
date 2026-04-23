export type ReviewStatus = "pending" | "approved" | "rejected";

const ALLOWED_TRANSITIONS: Record<ReviewStatus, ReadonlySet<ReviewStatus>> = {
  pending: new Set(["approved", "rejected"]),
  approved: new Set(),
  rejected: new Set(),
};

export function canTransitionReviewStatus(
  from: ReviewStatus,
  to: ReviewStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].has(to);
}

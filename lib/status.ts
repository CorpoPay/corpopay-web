/**
 * Statuses — single source of truth for the UI mapping (badge variant + label).
 *
 * The status *types* are generated from the API's Prisma schema (the real source
 * of truth) and consumed from the vendored `contract/enums.ts` (kept in sync by
 * corpopay-api's `contract:generate`). `ProviderHealthStatus` is re-exported here
 * for the providers admin page. Do NOT hand-write a status union — if an enum
 * value changes in the API, refresh `contract/` and the generated types follow.
 */
export type { ProviderHealthStatus } from "../contract/enums";

/**
 * The `Badge` component variants (see `components/ui/badge.tsx`). Keeping this
 * union here lets `statusVariant` be strongly typed without importing React
 * component code into `lib/`.
 */
export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "purple";

/**
 * Canonical status → badge variant mapping. This is the only place a status is
 * mapped to a visual variant; `StatusBadge` and any page-level badge should use
 * `statusVariant()` instead of a local `Record<string, …>`.
 *
 * Note: `CANCELED` (payment intent / payment link) and `CANCELLED`
 * (subscription / installment agreement / payout) are both real API values and
 * are kept as distinct keys on purpose.
 */
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // Positive / healthy / terminal success
  SUCCEEDED: "success",
  COMPLETED: "success",
  ACTIVE: "success",
  CONNECTED: "success",
  VERIFIED: "success",
  PAID: "success",
  NORMAL: "success",
  HEALTHY: "success",
  SETTLED: "success",
  MATCHED: "success",
  RESOLVED: "success",
  APPROVED: "success",
  COLLECTED: "success",
  WON: "success",
  FINALIZED: "success",
  EXACT: "success",
  LOW: "success",

  // Errors / failures
  FAILED: "destructive",
  INVALID: "destructive",
  DOWN: "destructive",
  ERROR: "destructive",
  OVERDUE: "destructive",
  DEFAULTED: "destructive",
  UNHEALTHY: "destructive",
  REVOKED: "destructive",
  SUSPENDED: "destructive",
  REJECTED: "destructive",
  LOST: "destructive",
  HIGH: "destructive",

  // In-flight / needs attention
  PROCESSING: "info",
  TRIAL: "info",
  SCHEDULED: "info",
  SUBMITTED: "info",
  REQUIRES_ACTION: "warning",
  PENDING: "warning",
  PENDING_PAYMENT: "warning",
  PENDING_CHECKOUT: "warning",
  PAST_DUE: "warning",
  DEGRADED: "warning",
  UNMATCHED: "warning",
  OPEN: "warning",
  NEEDS_INFO: "warning",
  MEDIUM: "warning",
  AMOUNT_DIFF: "warning",

  // Neutral / inactive / ended
  CREATED: "outline",
  DRAFT: "outline",
  INACTIVE: "outline",
  MISSING: "outline",
  DISABLED: "secondary",
  CANCELED: "secondary",
  CANCELLED: "secondary",
  EXPIRED: "secondary",
  ARCHIVED: "secondary",
  PAUSED: "secondary",
  VOID: "secondary",
  WAIVED: "secondary",

  // Money returned to the customer (or a split reversal)
  REFUNDED: "purple",
  PARTIALLY_REFUNDED: "purple",
  REVERSED: "purple",
};

/** Human-readable short labels for statuses that need them. */
const STATUS_LABELS: Record<string, string> = {
  REQUIRES_ACTION: "Action Req.",
  PARTIALLY_REFUNDED: "Part. Refunded",
  NEEDS_INFO: "Needs Info",
  AMOUNT_DIFF: "Amount Diff",
};

/** Map a status to its canonical badge variant (defaults to `outline`). */
export function statusVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status] ?? "outline";
}

/** Map a status to its display label (defaults to the status itself). */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

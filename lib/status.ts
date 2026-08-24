/**
 * Statuses — single source of truth for the UI mapping (badge variant + label).
 *
 * The status *types* are generated from the API's Prisma schema (the real source
 * of truth) and consumed directly from the published `@corpopay/contract` package.
 * `ProviderHealthStatus` is re-exported here for the providers admin page. Do NOT
 * hand-write a status union — if an enum value changes in the API, bump
 * `@corpopay/contract`.
 */
export type { ProviderHealthStatus } from "@corpopay/contract";

/**
 * The `Badge` component variants (see `components/ui/badge.tsx`). Keeping this
 * union here lets `statusVariant` be strongly typed without importing React
 * component code into `lib/`.
 */
export type BadgeVariant =
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "purple";

/**
 * Canonical status → badge variant mapping. This is the only place a status is
 * mapped to a visual variant; `StatusBadge` and any page-level badge should use
 * `statusVariant()` instead of a local `Record<string, …>`.
 *
 * Note: `CANCELED` (payment intent / payment link) and `CANCELLED`
 * (subscription / installment agreement) are both real API values and are kept
 * as distinct keys on purpose.
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

  // In-flight / needs attention
  PROCESSING: "info",
  TRIAL: "info",
  REQUIRES_ACTION: "warning",
  PENDING: "warning",
  PENDING_PAYMENT: "warning",
  PENDING_CHECKOUT: "warning",
  PAST_DUE: "warning",
  DEGRADED: "warning",

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

  // Money returned to the customer
  REFUNDED: "purple",
  PARTIALLY_REFUNDED: "purple",
};

/** Human-readable short labels for statuses that need them. */
const STATUS_LABELS: Record<string, string> = {
  REQUIRES_ACTION: "Action Req.",
  PARTIALLY_REFUNDED: "Part. Refunded",
};

/** Map a status to its canonical badge variant (defaults to `outline`). */
export function statusVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status] ?? "outline";
}

/** Map a status to its display label (defaults to the status itself). */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

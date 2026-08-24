type PaymentLinkProvider = "NAPS" | "VPS" | "STRIPE";

type BillingInterval = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "CUSTOM";

/** Form values collected by the payment-link creation UI (MAD, user-facing). */
export interface PaymentLinkDraft {
  title: string;
  amount: number;
  currency: string;
  provider: PaymentLinkProvider;
  reference?: string;
  customerEmail?: string;
  customerName?: string;
  maxUses?: number | "";
  expiresAt?: string;
  isRecurring?: boolean;
  billingInterval?: BillingInterval;
  intervalValue?: number;
  maxRetries?: number;
}

/**
 * Build the API request payload from the form values.
 *
 * - `amount` is converted from MAD to **centimes** (the DB stores MAD decimal).
 * - `title` (customer-facing) maps to the API's `description`.
 * - `maxUses` maps to the API's `maxAttempts`.
 */
export function buildPaymentLinkPayload(data: PaymentLinkDraft) {
  return {
    amount: Math.round(data.amount * 100),
    currency: data.currency || "MAD",
    description: data.title,
    reference: data.reference || data.title,
    provider: data.provider ?? "VPS",
    ...(data.customerName ? { customerName: data.customerName } : {}),
    ...(data.customerEmail ? { customerEmail: data.customerEmail } : {}),
    ...(data.maxUses ? { maxAttempts: Number(data.maxUses) } : {}),
    ...(data.expiresAt ? { expiresAt: new Date(data.expiresAt).toISOString() } : {}),
    ...(data.isRecurring
      ? {
          isRecurring: true,
          billingInterval: data.billingInterval ?? "MONTHLY",
          intervalValue: data.intervalValue ?? 1,
          maxRetries: data.maxRetries ?? 3,
        }
      : {}),
  };
}

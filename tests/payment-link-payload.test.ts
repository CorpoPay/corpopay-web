import { describe, expect, it } from "vitest";
import { buildPaymentLinkPayload } from "@/lib/payment-links";

const baseDraft = {
  title: "Acme invoice",
  amount: 1250,
  currency: "MAD",
  provider: "VPS" as const,
};

describe("buildPaymentLinkPayload", () => {
  it("converts MAD to centimes", () => {
    expect(buildPaymentLinkPayload(baseDraft).amount).toBe(125000);
  });

  it("maps title → description and maxUses → maxAttempts", () => {
    const payload = buildPaymentLinkPayload({ ...baseDraft, maxUses: 3 });

    expect(payload.description).toBe("Acme invoice");
    expect(payload.maxAttempts).toBe(3);
    expect(payload).not.toHaveProperty("title");
    expect(payload).not.toHaveProperty("maxUses");
  });

  it("defaults the reference to the title and provider to VPS", () => {
    const payload = buildPaymentLinkPayload(baseDraft);
    expect(payload.reference).toBe("Acme invoice");
    expect(payload.provider).toBe("VPS");
  });

  it("omits maxAttempts when maxUses is empty", () => {
    const payload = buildPaymentLinkPayload({ ...baseDraft, maxUses: "" });
    expect(payload).not.toHaveProperty("maxAttempts");
  });

  it("adds recurring billing fields when isRecurring is set", () => {
    const payload = buildPaymentLinkPayload({
      ...baseDraft,
      isRecurring: true,
      billingInterval: "MONTHLY",
      intervalValue: 2,
      maxRetries: 4,
    });
    expect(payload.isRecurring).toBe(true);
    expect(payload.billingInterval).toBe("MONTHLY");
    expect(payload.intervalValue).toBe(2);
    expect(payload.maxRetries).toBe(4);
  });
});

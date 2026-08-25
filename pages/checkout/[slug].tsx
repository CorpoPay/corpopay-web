import { CheckCircle, CreditCard, Layers, RefreshCw, Shield } from "lucide-react";
import { motion } from "motion/react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { components } from "@/lib/api-types";
import { serverClient } from "@/lib/client";
import { trackAction } from "@/lib/datadog";
import { formatAmount } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type CheckoutData = components["schemas"]["PublicCheckoutResponse"];

interface InstallmentPlan {
  planId: string;
  name: string;
  durationMonths: number;
  annualInterestRate: number;
  installmentAmount: number;
  totalAmount: number;
  totalInterest: number;
}

interface Props {
  checkout: CheckoutData | null;
  error?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function intervalLabel(interval: string, value = 1): string {
  const v = value > 1 ? `every ${value} ` : "";
  switch (interval) {
    case "DAILY":
      return `${v}day${value > 1 ? "s" : ""}`;
    case "WEEKLY":
      return `${v}week${value > 1 ? "s" : ""}`;
    case "MONTHLY":
      return `${v}month${value > 1 ? "s" : ""}`;
    case "QUARTERLY":
      return `every ${value > 1 ? value * 3 : 3} months`;
    case "ANNUAL":
      return `${v}year${value > 1 ? "s" : ""}`;
    case "CUSTOM":
      return `every ${value} day${value > 1 ? "s" : ""}`;
    default:
      return "recurring";
  }
}

// ─── SSR ───────────────────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const slug = params?.slug as string;
  try {
    const { data, error, response } = await serverClient.GET("/public/checkout/{slug}", {
      params: { path: { slug } },
    });
    if (error || !data) {
      if (response.status === 404) return { notFound: true };
      return { props: { checkout: null, error: "Failed to load payment details." } };
    }
    return { props: { checkout: data } };
  } catch {
    return { props: { checkout: null, error: "Failed to load payment details." } };
  }
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CheckoutPage({ checkout, error }: Props) {
  const router = useRouter();

  // Step: 'select-mode' | 'select-installment' | 'customer-details' | 'paywall' | 'success'
  const [step, setStep] = useState<
    "select-mode" | "select-installment" | "customer-details" | "paywall" | "success"
  >(
    checkout?.isInstallment
      ? "select-installment"
      : checkout?.isRecurring
        ? "select-mode"
        : "customer-details",
  );
  const [payMode, setPayMode] = useState<"once" | "recurring">("once");
  const [email, setEmail] = useState(checkout?.customerEmail ?? "");
  const [name, setName] = useState(checkout?.customerName ?? "");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [downPayment, setDownPayment] = useState("");

  // Fetch installment plans when on select-installment step
  useEffect(() => {
    if (step === "select-installment" && checkout?.isInstallment) {
      fetch(`/api/installment-plans-proxy?slug=${checkout.slug}`)
        .then((r) => r.json())
        .then((data: { plans: InstallmentPlan[] }) => {
          setInstallmentPlans(data.plans);
          if (data.plans.length > 0) setSelectedPlanId(data.plans[0].planId);
        })
        .catch(() => {
          /* plans remain empty */
        });
    }
  }, [step, checkout?.isInstallment, checkout?.slug]);

  // Paywall iframe POST data
  const [paywallData, setPaywallData] = useState<{
    paywallUrl: string;
    payload: string;
    signature: string;
    mode: string;
  } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-submit the hidden form into the iframe once we have paywall data
  useEffect(() => {
    if (paywallData && formRef.current) {
      formRef.current.submit();
    }
  }, [paywallData]);

  useEffect(() => {
    if (checkout) {
      trackAction("checkout_link_opened", { slug: checkout.slug, currency: checkout.currency });
    }
  }, [checkout]);

  if (error || !checkout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-10 pb-8 space-y-3">
            <p className="text-lg font-semibold">Payment link unavailable</p>
            <p className="text-sm text-muted-foreground">
              {error ?? "This payment link is no longer active."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleModeSelect(mode: "once" | "recurring") {
    setPayMode(mode);
    setStep("customer-details");
  }

  async function handlePay() {
    setApiError("");
    setLoading(true);
    trackAction("checkout_pay_attempted", { slug: checkout!.slug });
    try {
      const isBnpl = checkout!.isInstallment && !!selectedPlanId;
      const res = await fetch("/api/checkout-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: checkout!.slug,
          customerEmail: email || undefined,
          customerName: name || undefined,
          installmentPlanId: isBnpl ? selectedPlanId : undefined,
          downPaymentAmount: isBnpl && downPayment ? parseFloat(downPayment) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? "Payment initiation failed. Please try again.");
      }

      const data: {
        redirectUrl?: string;
        intentId?: string;
        agreementId?: string;
        providerData?: { paywallUrl: string; payload: string; signature: string; mode?: string };
      } = await res.json();

      const { redirectUrl, intentId, providerData } = data;

      if (providerData?.paywallUrl) {
        trackAction("checkout_paywall_redirected", { slug: checkout!.slug });
        setPaywallData({
          paywallUrl: providerData.paywallUrl,
          payload: providerData.payload,
          signature: providerData.signature,
          mode: providerData.mode ?? "DEEP_LINK",
        });
        setStep("paywall");
      } else if (redirectUrl) {
        trackAction("checkout_pay_succeeded", { slug: checkout!.slug, intentId });
        window.location.href = redirectUrl;
      } else {
        trackAction("checkout_pay_succeeded", { slug: checkout!.slug, intentId });
        router.push(`/checkout/success?ref=${intentId}`);
      }
    } catch (e) {
      trackAction("checkout_pay_failed", { slug: checkout!.slug });
      setApiError((e as Error).message ?? "Payment initiation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>Pay {checkout.merchantName} — CorpoPay</title>
        <meta name="description" content={checkout.description ?? `Pay ${checkout.merchantName}`} />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-10">
        <motion.div
          className="w-full max-w-md space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Merchant header */}
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">You are paying</p>
            <h1 className="text-xl font-bold">{checkout.merchantName}</h1>
          </div>

          {/* ── Step: Select installment plan ─────────────────────────── */}
          {step === "select-installment" && (
            <Card>
              <CardHeader className="pb-3 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Layers className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg font-bold">Buy Now, Pay Later</CardTitle>
                </div>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {formatAmount(checkout.amount, checkout.currency)}
                </CardTitle>
                <CardDescription>{checkout.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium">Choose a payment plan:</p>

                {installmentPlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Loading plans…</p>
                ) : (
                  installmentPlans.map((plan) => {
                    const isSelected = selectedPlanId === plan.planId;
                    return (
                      <button
                        key={plan.planId}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.planId)}
                        className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{plan.durationMonths} months</p>
                            <p className="text-sm text-muted-foreground">
                              {plan.annualInterestRate > 0
                                ? `${plan.annualInterestRate}% APR`
                                : "0% interest"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">
                              {formatAmount(plan.installmentAmount, checkout.currency)}/mo
                            </p>
                            {plan.totalInterest > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                Total {formatAmount(plan.totalAmount, checkout.currency)}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}

                {/* Optional larger down payment */}
                {selectedPlanId && (
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="down-payment" className="text-xs text-muted-foreground">
                      Down payment (optional — must be ≥ one installment)
                    </Label>
                    <Input
                      id="down-payment"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={`Min: ${installmentPlans.find((p) => p.planId === selectedPlanId)?.installmentAmount.toFixed(2) ?? "—"} ${checkout.currency}`}
                      value={downPayment}
                      onChange={(e) => setDownPayment(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  disabled={!selectedPlanId}
                  onClick={() => setStep("customer-details")}
                >
                  Continue
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  Secured by CorpoPay
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step: Select payment mode ──────────────────────────────────── */}
          {step === "select-mode" && (
            <Card>
              <CardHeader className="pb-3 text-center">
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {formatAmount(checkout.amount, checkout.currency)}
                </CardTitle>
                <CardDescription>{checkout.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium text-center">How would you like to pay?</p>

                {/* One-time */}
                <button
                  type="button"
                  onClick={() => handleModeSelect("once")}
                  className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-muted hover:border-primary transition-colors text-left"
                >
                  <CreditCard className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <p className="font-semibold">Pay once</p>
                    <p className="text-sm text-muted-foreground">
                      {formatAmount(checkout.amount, checkout.currency)} charged today
                    </p>
                  </div>
                </button>

                {/* Recurring */}
                <button
                  type="button"
                  onClick={() => handleModeSelect("recurring")}
                  className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-muted hover:border-primary transition-colors text-left"
                >
                  <RefreshCw className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <p className="font-semibold">Recurring billing</p>
                    <p className="text-sm text-muted-foreground">
                      {formatAmount(checkout.amount, checkout.currency)}{" "}
                      {checkout.billingInterval
                        ? intervalLabel(checkout.billingInterval, checkout.intervalValue ?? 1)
                        : "per cycle"}{" "}
                      — auto-charged, cancel anytime
                    </p>
                  </div>
                </button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <Shield className="h-3 w-3" />
                  Secured by CorpoPay
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step: Customer details ─────────────────────────────────────── */}
          {step === "customer-details" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="text-center space-y-1">
                  <CardTitle className="text-3xl font-bold tabular-nums">
                    {formatAmount(checkout.amount, checkout.currency)}
                    {checkout.isRecurring &&
                      payMode === "recurring" &&
                      checkout.billingInterval && (
                        <span className="text-base font-normal text-muted-foreground ml-2">
                          / {intervalLabel(checkout.billingInterval, checkout.intervalValue ?? 1)}
                        </span>
                      )}
                  </CardTitle>
                  <CardDescription className="text-sm">{checkout.description}</CardDescription>
                  {checkout.isRecurring && payMode === "recurring" && (
                    <p className="text-xs text-primary font-medium flex items-center justify-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Recurring billing — charged automatically
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                {apiError && <p className="text-sm text-destructive text-center">{apiError}</p>}

                <Button className="w-full" size="lg" onClick={handlePay} disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner className="mr-2" /> Loading payment…
                    </>
                  ) : checkout.isInstallment && selectedPlanId ? (
                    `Pay first installment — ${formatAmount(installmentPlans.find((p) => p.planId === selectedPlanId)?.installmentAmount ?? checkout.amount, checkout.currency)}`
                  ) : checkout.isRecurring && payMode === "recurring" ? (
                    `Subscribe — ${formatAmount(checkout.amount, checkout.currency)} / ${checkout.billingInterval ? intervalLabel(checkout.billingInterval, checkout.intervalValue ?? 1) : "cycle"}`
                  ) : (
                    `Pay ${formatAmount(checkout.amount, checkout.currency)}`
                  )}
                </Button>

                {(checkout.isInstallment || checkout.isRecurring) && (
                  <button
                    type="button"
                    onClick={() =>
                      setStep(checkout.isInstallment ? "select-installment" : "select-mode")
                    }
                    className="w-full text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    ← {checkout.isInstallment ? "Change payment plan" : "Change payment option"}
                  </button>
                )}

                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  Secured by CorpoPay
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step: Paywall embedded iframe ──────────────────────────────── */}
          {step === "paywall" && paywallData && (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Complete your payment securely below
              </p>
              <Card>
                <CardContent className="p-0 overflow-hidden rounded-lg">
                  {/* Hidden form auto-POSTed into the named iframe */}
                  <form
                    ref={formRef}
                    method="POST"
                    action={paywallData.paywallUrl}
                    target="paywall-frame"
                    className="hidden"
                  >
                    <input type="hidden" name="payload" value={paywallData.payload} />
                    <input type="hidden" name="signature" value={paywallData.signature} />
                    {/* mode must be a top-level POST field — the paywall JS reads it
                        from the form data when calling /pwthree/api/initialize?mode=DEEP_LINK&...;
                        without it initialize 400s and the paywall never renders. */}
                    <input type="hidden" name="mode" value={paywallData.mode} />
                  </form>

                  <iframe
                    ref={iframeRef}
                    name="paywall-frame"
                    title="Secure Payment — Payzone"
                    className="w-full border-0 rounded-lg"
                    style={{ minHeight: "600px", height: "70vh" }}
                    sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups"
                  />
                </CardContent>
              </Card>

              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                Secured by CorpoPay · Powered by Payzone VPS
              </div>
            </div>
          )}

          {/* ── Step: Success (non-redirect providers) ─────────────────────── */}
          {step === "success" && (
            <Card>
              <CardContent className="pt-10 pb-8 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                  <CheckCircle className="h-12 w-12 text-primary mx-auto" />
                </motion.div>
                <p className="text-lg font-semibold">Payment successful</p>
                <p className="text-sm text-muted-foreground">Thank you for your payment.</p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </>
  );
}

import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  FlaskConical,
  Lock,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Smartphone,
  Wallet,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/router";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Spinner } from "@/components/shared/Spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { components } from "@/lib/api-types";
import { client, getErrorMessage } from "@/lib/client";
import { statusLabel, statusVariant } from "@/lib/status";
import { cn, formatAmount, formatDate } from "@/lib/utils";

type ProviderConfig = components["schemas"]["ProviderConfigListItem"];
type TransactionDetail = components["schemas"]["TransactionDetail"];
type CreateIntentRequest = components["schemas"]["CreateIntentRequest"];

const TERMINAL = ["SUCCEEDED", "FAILED", "CANCELED", "REFUNDED"];
const SESSION_PREFIX = "corpopay:pg:";

type CaptureMode = "instant" | "preauth";
type Method = "3ds" | "card" | "apple_pay" | "google_pay";

type PaywallData = {
  paywallUrl: string;
  payload: string;
  signature: string;
  mode: string;
};

type StripeElementData = {
  clientSecret: string;
  publishableKey: string;
};

/** Method metadata — single source for icon + label across the whole page. */
function methodMeta(m: Method): { label: string; icon: typeof CreditCard; hint: string } {
  switch (m) {
    case "3ds":
      return { label: "3D Secure", icon: ShieldCheck, hint: "Payzone hosted 3DS paywall" };
    case "card":
      return { label: "Card", icon: CreditCard, hint: "Stripe Payment Element" };
    case "apple_pay":
      return { label: "Apple Pay", icon: Smartphone, hint: "Express Checkout wallet" };
    case "google_pay":
      return { label: "Google Pay", icon: Wallet, hint: "Express Checkout wallet" };
  }
}

/** In-page Stripe card confirmation (PaymentElement) — no full-page redirect. */
function CardCheckout({ returnUrl }: { returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError("");
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      // Only redirect when Stripe requires it (3DS challenge); otherwise stay in-page.
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message ?? "Payment could not be confirmed.");
    }
    setProcessing(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "never", googlePay: "never" },
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!stripe || processing} className="w-full" size="lg">
        {processing ? (
          <>
            <Spinner size="sm" className="mr-2" /> Confirming…
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" /> Pay now
          </>
        )}
      </Button>
    </form>
  );
}

/** Apple Pay / Google Pay confirmation surface. */
function WalletCheckout() {
  return <ExpressCheckoutElement onConfirm={async () => ({ type: "success" })} />;
}

/**
 * Unified payment window — one consistent card for every method.
 * VPS renders its 3DS paywall iframe; Stripe card renders PaymentElement in-page;
 * Apple/Google Pay render the ExpressCheckoutElement. All share the same chrome.
 */
function PaymentWindow({
  method,
  amountMAD,
  paywallData,
  stripeData,
  returnUrl,
  paywallFormRef,
}: {
  method: Method;
  amountMAD: string;
  paywallData: PaywallData | null;
  stripeData: StripeElementData | null;
  returnUrl: string;
  paywallFormRef: React.RefObject<HTMLFormElement | null>;
}) {
  const meta = methodMeta(method);
  const Icon = meta.icon;
  const stripePromise = useMemo(
    () => (stripeData ? loadStripe(stripeData.publishableKey) : null),
    [stripeData],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </span>
            <span>{meta.label}</span>
          </CardTitle>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{formatAmount(amountMAD, "MAD")}</p>
            <p className="text-xs text-muted-foreground">{meta.hint}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {method === "3ds" && paywallData ? (
          <div className="overflow-hidden rounded-lg border">
            <form
              ref={paywallFormRef}
              method="POST"
              action={paywallData.paywallUrl}
              target="playground-paywall"
              className="hidden"
            >
              <input type="hidden" name="payload" value={paywallData.payload} />
              <input type="hidden" name="signature" value={paywallData.signature} />
              <input type="hidden" name="mode" value={paywallData.mode} />
            </form>
            <iframe
              name="playground-paywall"
              title="Secure Payment — Payzone"
              className="w-full border-0"
              style={{ minHeight: "520px", height: "62vh" }}
              sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups"
            />
          </div>
        ) : method === "card" && stripeData && stripePromise ? (
          <Elements stripe={stripePromise} options={{ clientSecret: stripeData.clientSecret }}>
            <CardCheckout returnUrl={returnUrl} />
          </Elements>
        ) : (method === "apple_pay" || method === "google_pay") && stripeData && stripePromise ? (
          <Elements stripe={stripePromise} options={{ clientSecret: stripeData.clientSecret }}>
            <WalletCheckout />
          </Elements>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size="sm" /> Preparing payment…
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PlaygroundPage() {
  const router = useRouter();

  // ── Provider configs ─────────────────────────────────────────────────────────
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [provider, setProvider] = useState<"VPS" | "STRIPE">("VPS");
  const [method, setMethod] = useState<Method>("3ds");
  const [amount, setAmount] = useState("100.00");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("instant");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // ── Run state ────────────────────────────────────────────────────────────────
  const [intentId, setIntentId] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [paywallData, setPaywallData] = useState<PaywallData | null>(null);
  const [stripeData, setStripeData] = useState<StripeElementData | null>(null);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [apiError, setApiError] = useState("");
  const paywallFormRef = useRef<HTMLFormElement>(null);

  const connected = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const c of configs) if (c.status === "CONNECTED") map.set(c.provider, true);
    return map;
  }, [configs]);
  const vpsConnected = connected.get("VPS") === true;
  const stripeConnected = connected.get("STRIPE") === true;

  const base = `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard/playground`;
  // Return URL used by in-page Stripe (3DS redirect) so the run resumes by `ref`.
  const returnUrl = reference ? `${base}?ref=${reference}` : base;

  // ── Load connected providers ─────────────────────────────────────────────────
  useEffect(() => {
    client
      .GET("/provider-configs")
      .then(({ data }) => setConfigs(data ?? []))
      .catch(() => setConfigs([]))
      .finally(() => setConfigsLoading(false));
  }, []);

  // ── Resume from a provider redirect (Stripe 3DS / VPS return) ────────────────
  useEffect(() => {
    const ref = router.query.ref as string | undefined;
    if (ref && !intentId) {
      const stored = sessionStorage.getItem(SESSION_PREFIX + ref);
      if (stored) {
        setReference(ref);
        setIntentId(stored);
      }
    }
  }, [router.query.ref, intentId]);

  // ── Auto-submit the VPS paywall form into the named iframe ───────────────────
  useEffect(() => {
    if (paywallData && paywallFormRef.current) {
      paywallFormRef.current.submit();
    }
  }, [paywallData]);

  // ── Poll the live pipeline ───────────────────────────────────────────────────
  useEffect(() => {
    if (!intentId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      const { data } = await client.GET("/transactions/{id}", {
        params: { path: { id: intentId } },
      });
      if (cancelled) return;
      if (data) {
        setDetail(data);
        if (TERMINAL.includes(data.status) && timer) clearInterval(timer);
      }
    };

    tick();
    timer = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [intentId]);

  // ── Start a payment ──────────────────────────────────────────────────────────
  async function startPayment() {
    setApiError("");
    const mad = Number(amount);
    if (!Number.isFinite(mad) || mad <= 0) {
      setApiError("Enter a valid amount greater than 0.");
      return;
    }

    const ref = `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const walletMode =
      provider === "STRIPE" && (method === "apple_pay" || method === "google_pay")
        ? method
        : undefined;
    const checkoutMode = provider === "STRIPE" && method === "card" ? "element" : undefined;

    const body: CreateIntentRequest = {
      provider,
      amount: Math.round(mad * 100), // MAD → centimes
      currency: "MAD",
      reference: ref,
      description: "Playground test payment",
      returnUrl: `${base}?ref=${ref}`,
      successUrl: `${base}?ref=${ref}&result=success`,
      cancelUrl: `${base}?ref=${ref}&result=cancel`,
      failureUrl: `${base}?ref=${ref}&result=failure`,
      isPreauth: captureMode === "preauth",
      ...(checkoutMode ? { checkoutMode } : {}),
      ...(walletMode ? { walletMode } : {}),
      ...(email.trim() ? { customerEmail: email.trim() } : {}),
      ...(name.trim() ? { customerName: name.trim() } : {}),
    };

    setStarting(true);
    try {
      const { data, error } = await client.POST("/payment-intents", { body });
      if (error || !data) throw error;

      sessionStorage.setItem(SESSION_PREFIX + ref, data.intentId);
      setReference(ref);
      setIntentId(data.intentId);
      setPaywallData(null);
      setStripeData(null);

      if (provider === "VPS" && data.providerData?.paywallUrl) {
        setPaywallData({
          paywallUrl: data.providerData.paywallUrl as string,
          payload: data.providerData.payload as string,
          signature: data.providerData.signature as string,
          mode: (data.providerData.mode as string) ?? "DEEP_LINK",
        });
      } else if (data.stripeData?.clientSecret) {
        // Card (element) + wallet modes both return clientSecret for in-page mount.
        setStripeData({
          clientSecret: data.stripeData.clientSecret,
          publishableKey: data.stripeData.publishableKey,
        });
      } else if (data.redirectUrl) {
        // Fallback: Stripe hosted checkout (only reached if element mode is off).
        window.location.href = data.redirectUrl;
        return;
      }
    } catch (e) {
      setApiError(getErrorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  // ── Capture a pre-authorised payment ─────────────────────────────────────────
  async function captureIntent() {
    if (!intentId) return;
    setCapturing(true);
    setApiError("");
    const { error } = await client.POST("/payment-intents/{id}/capture", {
      params: { path: { id: intentId } },
    });
    setCapturing(false);
    if (error) {
      setApiError(getErrorMessage(error));
      return;
    }
    const { data } = await client.GET("/transactions/{id}", {
      params: { path: { id: intentId } },
    });
    if (data) setDetail(data);
  }

  function reset() {
    setIntentId(null);
    setReference(null);
    setDetail(null);
    setPaywallData(null);
    setStripeData(null);
    setApiError("");
  }

  const methods: Method[] = provider === "VPS" ? ["3ds"] : ["card", "apple_pay", "google_pay"];

  const status = detail?.status ?? null;
  const terminal = !!status && TERMINAL.includes(status);
  const failed = status === "FAILED" || status === "CANCELED";
  const settled = status === "SUCCEEDED" || status === "REFUNDED";

  // Guided phase: 0 = configure, 1 = pay, 2 = settled.
  const phase = !intentId ? 0 : settled || failed ? 2 : 1;
  const phases = [
    { label: "Configure", icon: Settings2 },
    { label: "Pay", icon: CreditCard },
    { label: "Settle", icon: BadgeCheck },
  ];

  // Intent lifecycle stepper (mirrors the API status progression).
  const steps = [
    { label: "Created", reached: !!status, active: status === "CREATED" },
    {
      label: "Payment",
      reached: !!status && status !== "CREATED",
      active: status === "REQUIRES_ACTION" || status === "AUTHORIZED" || status === "PROCESSING",
    },
    {
      label: settled ? "Settled" : failed ? "Failed" : "Settled",
      reached: settled || failed,
      active: settled,
      failed,
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            Payment Playground
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run real sandbox payments through your connected providers and watch the full CorpoPay
            pipeline — intent → provider → webhook → settlement — end to end.
          </p>
        </div>

        {/* ── Guided progress ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {phases.map((p, i) => {
            const Icon = p.icon;
            const done = phase > i;
            const active = phase === i;
            return (
              <div key={p.label} className="flex flex-1 items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border",
                      done
                        ? "border-green-600 bg-green-600 text-white"
                        : active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span
                    className={cn(done || active ? "text-foreground" : "text-muted-foreground")}
                  >
                    {p.label}
                  </span>
                </div>
                {i < phases.length - 1 && (
                  <div className={cn("h-px flex-1", done ? "bg-green-600" : "bg-muted")} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Configure ─────────────────────────────────────────────── */}
        {!intentId && (
          <Card>
            <CardHeader>
              <CardTitle>New test payment</CardTitle>
              <CardDescription>
                Uses the provider credentials saved in Settings. Test keys only — no real money
                moves.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {configsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size="sm" /> Checking connected providers…
                </div>
              ) : !vpsConnected && !stripeConnected ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No connected providers yet. Connect VPS or Stripe in{" "}
                  <a href="/dashboard/settings" className="text-primary underline">
                    Settings
                  </a>{" "}
                  first.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={provider === "VPS" ? "default" : "outline"}
                        disabled={!vpsConnected}
                        onClick={() => {
                          setProvider("VPS");
                          setMethod("3ds");
                        }}
                      >
                        <Lock className="mr-2 h-4 w-4" /> VPS / Payzone
                      </Button>
                      <Button
                        type="button"
                        variant={provider === "STRIPE" ? "default" : "outline"}
                        disabled={!stripeConnected}
                        onClick={() => {
                          setProvider("STRIPE");
                          setMethod("card");
                        }}
                      >
                        <Banknote className="mr-2 h-4 w-4" /> Stripe
                      </Button>
                    </div>
                    {!vpsConnected && (
                      <p className="text-xs text-muted-foreground">VPS not connected.</p>
                    )}
                    {!stripeConnected && (
                      <p className="text-xs text-muted-foreground">Stripe not connected.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Payment method</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {methods.map((m) => {
                        const meta = methodMeta(m);
                        const Icon = meta.icon;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMethod(m)}
                            className={cn(
                              "flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-colors",
                              method === m
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-primary/50",
                            )}
                          >
                            <Icon className="h-5 w-5 text-primary" />
                            <span className="text-sm font-medium">{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="pg-amount">Amount (MAD)</Label>
                      <Input
                        id="pg-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Capture</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={captureMode === "instant" ? "default" : "outline"}
                          onClick={() => setCaptureMode("instant")}
                        >
                          Instant
                        </Button>
                        <Button
                          type="button"
                          variant={captureMode === "preauth" ? "default" : "outline"}
                          onClick={() => setCaptureMode("preauth")}
                        >
                          Pre-auth
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="pg-email">Customer email (optional)</Label>
                      <Input
                        id="pg-email"
                        type="email"
                        placeholder="customer@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pg-name">Customer name (optional)</Label>
                      <Input
                        id="pg-name"
                        placeholder="Jane Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  </div>

                  {apiError && <p className="text-sm text-destructive">{apiError}</p>}

                  <Button className="w-full" size="lg" onClick={startPayment} disabled={starting}>
                    {starting ? (
                      <>
                        <Spinner size="sm" className="mr-2" /> Creating payment…
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" /> Start payment
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Steps 2 & 3: Pay + live pipeline ──────────────────────────────── */}
        {intentId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Reference</span>
                <code className="rounded bg-muted px-2 py-0.5 text-xs">{reference}</code>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> New test
              </Button>
            </div>

            {/* Unified payment window (all methods render in-page). */}
            {!terminal && (
              <PaymentWindow
                method={method}
                amountMAD={amount}
                paywallData={paywallData}
                stripeData={stripeData}
                returnUrl={returnUrl}
                paywallFormRef={paywallFormRef}
              />
            )}

            {/* Live pipeline card. */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Pipeline</CardTitle>
                  <div className="flex items-center gap-2">
                    {detail?.riskVerdict === "REVIEW" || detail?.riskVerdict === "BLOCK" ? (
                      <Badge variant={statusVariant(detail.riskVerdict)} className="text-xs">
                        {statusLabel(detail.riskVerdict)}
                      </Badge>
                    ) : null}
                    {status && (
                      <Badge variant={statusVariant(status)} className="text-xs">
                        {statusLabel(status)}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Intent lifecycle stepper */}
                <div className="flex items-center gap-2">
                  {steps.map((s, i) => (
                    <div key={s.label} className="flex flex-1 items-center gap-2">
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          s.failed
                            ? "text-destructive"
                            : s.active
                              ? "text-primary"
                              : s.reached
                                ? "text-green-600"
                                : "text-muted-foreground",
                        )}
                      >
                        {s.reached && !s.active && !s.failed ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <CircleDashed className={cn("h-4 w-4", s.active && "animate-pulse")} />
                        )}
                        <span>{s.label}</span>
                      </div>
                      {i < steps.length - 1 && <div className="h-px flex-1 bg-muted" />}
                    </div>
                  ))}
                </div>

                {status === "AUTHORIZED" && captureMode === "preauth" && (
                  <div className="rounded-lg border border-dashed p-3 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Payment authorised — capture to settle the funds.
                    </p>
                    <Button size="sm" onClick={captureIntent} disabled={capturing}>
                      {capturing ? (
                        <Spinner size="sm" className="mr-2" />
                      ) : (
                        <BadgeCheck className="mr-1.5 h-4 w-4" />
                      )}
                      Capture
                    </Button>
                  </div>
                )}

                {apiError && <p className="text-sm text-destructive">{apiError}</p>}

                {!detail && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner size="sm" /> Waiting for the payment pipeline…
                  </div>
                )}

                {detail?.timeline && detail.timeline.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Timeline
                    </p>
                    <ol className="space-y-2 border-l border-muted pl-4">
                      {detail.timeline.map((t) => (
                        <li key={`${t.type}-${t.timestamp}`} className="relative text-sm">
                          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(t.timestamp)}
                          </span>
                          <p className="font-medium">{t.type}</p>
                          <p className="text-xs text-muted-foreground">{t.detail}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {detail?.webhookEvents && detail.webhookEvents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Webhook events
                    </p>
                    {detail.webhookEvents.map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center gap-2 rounded-lg border p-2.5 text-sm"
                      >
                        {w.signatureVerified ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <span className="font-medium">{w.provider}</span>
                        <span className="text-muted-foreground text-xs">
                          signature {w.signatureVerified ? "verified" : "invalid"} · processed{" "}
                          {String(w.processed)}
                        </span>
                        {w.mappedStatus && (
                          <Badge
                            variant={statusVariant(w.mappedStatus)}
                            className="ml-auto text-xs"
                          >
                            {statusLabel(w.mappedStatus)}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {detail?.providerTxs && detail.providerTxs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Provider transactions
                    </p>
                    {detail.providerTxs.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{t.provider}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {t.providerTransactionId ?? "pending"}
                        </code>
                      </div>
                    ))}
                  </div>
                )}

                {detail?.refunds && detail.refunds.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Refunds
                    </p>
                    {detail.refunds.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        <Badge variant={statusVariant(r.status)} className="text-xs">
                          {statusLabel(r.status)}
                        </Badge>
                        <span>{formatAmount(String(r.amount), r.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

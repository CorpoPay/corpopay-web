import { useState, useEffect, useRef, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Clipboard,
  Check,
  Send,
  Loader2,
  ExternalLink,
  BookOpen,
  Zap,
  XCircle,
  RefreshCcw,
  Key,
  AlertTriangle,
  Info,
  Play,
  Square,
  CheckCircle2,
  Ban,
  Clock,
  Activity,
  Layers,
  ChevronRight,
  RotateCcw,
  Wifi,
  WifiOff,
  Trash2,
  FlaskConical,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const DEFAULT_KEY = "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderConfig {
  id: string;
  provider: string;
  status: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentIntentResponse {
  intentId: string;
  correlationId: string;
  checkoutUrl?: string;
  redirectUrl?: string;
  providerData?: {
    paywallUrl?: string;
    payload?: string;
    signature?: string;
    mode?: string;
  };
  stripeData?: unknown;
}

interface IntentStatus {
  status: string;
  providerRef?: string;
}

interface StatusHistoryEntry {
  status: string;
  timestamp: Date;
}

interface ResponseState {
  status: number;
  body: string;
  ms: number;
  checkoutUrl?: string;
  redirectUrl?: string;
  paywallUrl?: string;
  payload?: string;
  signature?: string;
  mode?: string;
}

interface WebhookEvent {
  id?: string;
  eventType?: string;
  type?: string;
  mappedStatus?: string;
  signatureVerified?: boolean;
  processed?: boolean;
  createdAt?: string;
  timestamp?: string;
}

interface ProviderTx {
  id?: string;
  provider?: string;
  providerTransactionId?: string;
  createdAt?: string;
}

interface RefundRecord {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  createdAt?: string;
}

interface FullIntent {
  id?: string;
  status?: string;
  provider?: string;
  providerRef?: string;
  correlationId?: string;
  metadata?: unknown;
  providerTxs?: ProviderTx[];
  refunds?: RefundRecord[];
  webhookEvents?: WebhookEvent[];
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground", className)}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Clipboard className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <div className="relative group">
      <pre
        className={cn(
          "bg-zinc-950 text-zinc-100 rounded-lg p-4 pr-10 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre",
          className,
        )}
      >
        {code}
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function HttpStatusBadge({ status }: { status: number }) {
  const color =
    status >= 200 && status < 300
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      : status >= 400
        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-bold font-mono",
        color,
      )}
    >
      {status}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; icon: React.ReactNode }> = {
    CREATED: {
      color:
        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
      icon: <Clock className="h-3 w-3" />,
    },
    REQUIRES_ACTION: {
      color:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    PROCESSING: {
      color:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    SUCCEEDED: {
      color:
        "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-700",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    FAILED: {
      color:
        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700",
      icon: <XCircle className="h-3 w-3" />,
    },
    CANCELED: {
      color:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-700",
      icon: <Ban className="h-3 w-3" />,
    },
    REFUNDED: {
      color:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-700",
      icon: <RotateCcw className="h-3 w-3" />,
    },
  };

  const { color, icon } = cfg[status] ?? {
    color: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200",
    icon: <Clock className="h-3 w-3" />,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        color,
      )}
    >
      {icon}
      {status}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 text-xs font-mono"
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

// ─── Flow Stepper ─────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Create Intent", sub: "POST /payment-intents" },
  { n: 2, label: "Open Checkout", sub: "Launch paywall / Stripe" },
  { n: 3, label: "Monitor Status", sub: "Live poll every 3 s" },
  { n: 4, label: "Capture / Void / Refund", sub: "Act on the result" },
];

function getFlowStep(intentId: string, status: string | null): number {
  if (!intentId) return 1;
  if (!status || status === "CREATED") return 2;
  if (status === "PROCESSING" || status === "REQUIRES_ACTION") return 3;
  if (status === "SUCCEEDED") return 4;
  return 5; // terminal: FAILED / CANCELED / REFUNDED
}

function FlowStepper({ intentId, status }: { intentId: string; status: string | null }) {
  const current = getFlowStep(intentId, status);
  const done = current > 4;

  return (
    <div className="rounded-xl border bg-muted/30 px-5 py-4">
      <div className="flex items-center gap-1 mb-3">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Test Flow
        </span>
        {done && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Complete
          </span>
        )}
      </div>

      {/* Stepper row */}
      <div className="flex items-start gap-0">
        {STEPS.map((step, idx) => {
          const isActive = current === step.n;
          const isCompleted = current > step.n;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.n} className="flex items-start flex-1 min-w-0">
              {/* Step node */}
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold shrink-0 transition-colors",
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground"
                      : isActive
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-muted border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.n}
                </div>
                <div className="mt-1.5 text-center px-1">
                  <p
                    className={cn(
                      "text-xs font-semibold leading-tight",
                      isActive
                        ? "text-foreground"
                        : isCompleted
                          ? "text-foreground/70"
                          : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground/70 leading-tight mt-0.5 hidden sm:block">
                    {step.sub}
                  </p>
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 mt-3.5 mx-1 flex-1 rounded transition-colors",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── What-to-do-next callout ──────────────────────────────────────────────────

const NEXT_STEP_MAP: Record<
  string,
  { color: string; icon: React.ReactNode; title: string; body: string }
> = {
  CREATED: {
    color:
      "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300",
    icon: <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />,
    title: "Next → Open the checkout",
    body: 'Scroll up to the Create Intent response and click "Launch Payzone" (VPS) or "Open Stripe Checkout" (Stripe). The status monitor below will update automatically once the customer completes payment.',
  },
  REQUIRES_ACTION: {
    color:
      "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300",
    icon: <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />,
    title: "Next → Capture or Void the pre-auth",
    body: "The card has been pre-authorized — funds are held but not yet charged. Use Capture to settle the payment, or Void to release the hold. Both options are in the Actions section below.",
  },
  PROCESSING: {
    color:
      "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300",
    icon: <Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 animate-spin" />,
    title: "Processing…",
    body: "The payment is being processed by the provider. The status monitor is polling every 3 s and will update automatically.",
  },
  SUCCEEDED: {
    color:
      "border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10 text-green-800 dark:text-green-300",
    icon: <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />,
    title: "Payment captured ✓",
    body: 'The payment has been fully charged. You can now issue a Refund from the Actions section below, or click "Fetch Full Details" to inspect webhook events and provider transactions.',
  },
  FAILED: {
    color:
      "border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10 text-red-800 dark:text-red-300",
    icon: <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />,
    title: "Payment failed",
    body: "The card was declined or an error occurred. Clear this session and create a new payment intent to retry.",
  },
  CANCELED: {
    color:
      "border-orange-200 bg-orange-50 dark:border-orange-800/40 dark:bg-orange-900/10 text-orange-800 dark:text-orange-300",
    icon: <Ban className="h-3.5 w-3.5 mt-0.5 shrink-0" />,
    title: "Payment voided",
    body: "The pre-authorization hold has been released. No charge was made. Clear this session and create a new intent if needed.",
  },
  REFUNDED: {
    color:
      "border-purple-200 bg-purple-50 dark:border-purple-800/40 dark:bg-purple-900/10 text-purple-800 dark:text-purple-300",
    icon: <RotateCcw className="h-3.5 w-3.5 mt-0.5 shrink-0" />,
    title: "Refund issued ✓",
    body: 'The transaction has been fully reversed. Click "Fetch Full Details" to confirm the refund record.',
  },
};

function WhatNextCallout({ status }: { status: string | null }) {
  if (!status || status === "CREATED") {
    const cfg = NEXT_STEP_MAP["CREATED"];
    return (
      <div className={cn("mt-3 rounded-lg border px-4 py-3 text-xs", cfg.color)}>
        <div className="flex items-start gap-2">
          {cfg.icon}
          <div>
            <p className="font-semibold mb-0.5">{cfg.title}</p>
            <p>{cfg.body}</p>
          </div>
        </div>
      </div>
    );
  }
  const cfg = NEXT_STEP_MAP[status];
  if (!cfg) return null;
  return (
    <div className={cn("mt-3 rounded-lg border px-4 py-3 text-xs", cfg.color)}>
      <div className="flex items-start gap-2">
        {cfg.icon}
        <div>
          <p className="font-semibold mb-0.5">{cfg.title}</p>
          <p>{cfg.body}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Step header ──────────────────────────────────────────────────────────────

function StepHeader({ n, title, total = 4 }: { n: number; title: string; total?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
        {n}
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <span className="text-xs text-muted-foreground">
        Step {n} of {total}
      </span>
    </div>
  );
}

/** Submits a hidden form POST to Payzone's paywallUrl */
function launchPayzoneForm(paywallUrl: string, payload: string, signature: string, mode?: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = paywallUrl;
  form.target = "_blank";

  const addHidden = (name: string, value: string) => {
    const el = document.createElement("input");
    el.type = "hidden";
    el.name = name;
    el.value = value;
    form.appendChild(el);
  };

  addHidden("payload", payload);
  addHidden("signature", signature);
  if (mode) addHidden("mode", mode);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

function ResponsePanel({
  response,
  error,
}: {
  response: ResponseState | null;
  error: string | null;
}) {
  if (error)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10 p-4">
        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Network Error</p>
        <p className="text-xs text-red-600 dark:text-red-400 font-mono">{error}</p>
      </div>
    );
  if (!response) return null;

  const isVps = !!(response.paywallUrl && response.payload && response.signature);
  const isStripe = !!response.redirectUrl && !isVps;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <HttpStatusBadge status={response.status} />
        <span className="text-xs text-muted-foreground">{response.ms} ms</span>
      </div>

      {isVps && (
        <div className="space-y-2">
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/10 px-4 py-3 text-xs text-blue-800 dark:text-blue-300">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">VPS / Payzone — form-POST integration</p>
                <p>
                  <span className="font-semibold">Recommended (Direct):</span> POST{" "}
                  <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
                    providerData.payload
                  </code>{" "}
                  +{" "}
                  <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
                    signature
                  </code>{" "}
                  +{" "}
                  <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
                    mode
                  </code>{" "}
                  directly to{" "}
                  <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
                    providerData.paywallUrl
                  </code>
                  . This bypasses the relay page and avoids any SSR dependency.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-0.5">
                Direct Payzone Form POST
              </p>
              <p className="text-xs font-mono text-green-700 dark:text-green-400 truncate">
                {response.paywallUrl}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-7 text-xs gap-1.5 border-green-300 dark:border-green-700"
              onClick={() =>
                launchPayzoneForm(
                  response.paywallUrl!,
                  response.payload!,
                  response.signature!,
                  response.mode,
                )
              }
            >
              <ExternalLink className="h-3 w-3" /> Launch Payzone
            </Button>
          </div>

          {response.checkoutUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/30 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-0.5">
                  Relay Page (alternative)
                </p>
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                  {response.checkoutUrl}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 h-7 text-xs gap-1.5"
                onClick={() => window.open(response.checkoutUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3" /> Open Relay
              </Button>
            </div>
          )}
        </div>
      )}

      {isStripe && (
        <div className="space-y-2">
          <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-800/40 dark:bg-purple-900/10 px-4 py-3 text-xs text-purple-800 dark:text-purple-300">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>
                <span className="font-semibold">Stripe integration:</span> Redirect the customer to{" "}
                <code className="font-mono bg-purple-100 dark:bg-purple-900/40 px-1 rounded">
                  redirectUrl
                </code>{" "}
                (the direct Stripe-hosted checkout session URL).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10 px-4 py-3">
            <p className="text-xs font-mono text-green-700 dark:text-green-300 truncate flex-1">
              {response.redirectUrl}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-7 text-xs gap-1.5"
              onClick={() => window.open(response.redirectUrl, "_blank")}
            >
              <ExternalLink className="h-3 w-3" /> Open Stripe Checkout
            </Button>
          </div>
        </div>
      )}

      {!isVps && !isStripe && response.checkoutUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10 px-4 py-3">
          <p className="text-xs font-mono text-green-700 dark:text-green-300 truncate flex-1">
            {response.checkoutUrl}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-7 text-xs gap-1.5"
            onClick={() => window.open(response.checkoutUrl, "_blank")}
          >
            <ExternalLink className="h-3 w-3" /> Open Checkout
          </Button>
        </div>
      )}

      <CodeBlock code={response.body} />
    </div>
  );
}

// ─── Section 1: Provider Configs ──────────────────────────────────────────────

function ProviderConfigsCard({ apiKey }: { apiKey: string }) {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/provider-configs`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json = await r.json();
      setProviders(Array.isArray(json) ? json : (json.data ?? []));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  const statusStyle = (s: string) => {
    switch (s?.toUpperCase()) {
      case "CONNECTED":
        return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
      case "DISABLED":
        return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
      case "INVALID":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
      default:
        return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
              <Layers className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">Your Providers</CardTitle>
                <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  GET
                </span>
                <code className="text-xs font-mono text-muted-foreground">/provider-configs</code>
              </div>
              <CardDescription className="mt-0.5">
                Configured payment providers and their connection status.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform text-muted-foreground",
                open && "rotate-90",
              )}
            />
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="gap-2 h-8 text-xs"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            {loading ? "Loading…" : "Load Providers"}
          </Button>

          {error && <p className="text-xs text-red-500 font-mono">{error}</p>}

          {providers && providers.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No provider configs found.</p>
          )}

          {providers && providers.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-3 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Provider</span>
                <span>Status</span>
                <span>Environment</span>
              </div>
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-3 items-center px-4 py-2.5 border-t text-xs gap-2"
                >
                  <span className="font-mono font-semibold">{p.provider}</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold w-fit",
                      statusStyle(p.status),
                    )}
                  >
                    {p.status}
                  </span>
                  <span className="text-muted-foreground">{p.environment}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Section 2: Create Payment Intent ─────────────────────────────────────────

function CreateIntentCard({
  apiKey,
  onIntentCreated,
}: {
  apiKey: string;
  onIntentCreated: (intentId: string, resp: PaymentIntentResponse) => void;
}) {
  const [fields, setFields] = useState({
    provider: "VPS",
    amount: "15000",
    currency: "MAD",
    reference: "ORDER-001",
    description: "Parking Zone A - 1 month",
    returnUrl: "https://example.com/payment/return",
    successUrl: "https://example.com/payment/success",
    cancelUrl: "https://example.com/payment/cancel",
    failureUrl: "https://example.com/payment/failure",
    customerName: "Ahmed Benkhalil",
    customerEmail: "ahmed@example.com",
  });
  const [isPreauth, setIsPreauth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState<string | null>(null);

  const set = (k: keyof typeof fields) => (v: string) => setFields((f) => ({ ...f, [k]: v }));

  const bodyObj = {
    ...fields,
    amount: Number(fields.amount),
    isPreauth,
  };
  const body = JSON.stringify(bodyObj, null, 2);
  const preview = `POST ${BASE}/payment-intents\nAuthorization: Bearer ${apiKey}\nContent-Type: application/json\n\n${body}`;

  async function send() {
    setLoading(true);
    setResponse(null);
    setError(null);
    setSessionStarted(null);
    const t = Date.now();
    try {
      const r = await fetch(`${BASE}/payment-intents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyObj),
      });
      const json: PaymentIntentResponse = await r.json();
      const pd = json?.providerData;
      setResponse({
        status: r.status,
        body: JSON.stringify(json, null, 2),
        ms: Date.now() - t,
        checkoutUrl: json.checkoutUrl,
        redirectUrl: json.redirectUrl,
        paywallUrl: pd?.paywallUrl,
        payload: pd?.payload,
        signature: pd?.signature,
        mode: pd?.mode,
      });
      if (r.ok && json.intentId) {
        setSessionStarted(json.intentId);
        onIntentCreated(json.intentId, json);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
            <Zap className="h-4 w-4 text-green-700 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">Create Payment Intent</CardTitle>
              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold font-mono bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                POST
              </span>
              <code className="text-xs font-mono text-muted-foreground">/payment-intents</code>
            </div>
            <CardDescription className="mt-0.5">
              Create a payment intent. On success, all downstream panels are auto-populated with the
              returned intentId.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Fields grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Provider selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">provider</Label>
            <select
              value={fields.provider}
              onChange={(e) => set("provider")(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="VPS">VPS</option>
              <option value="STRIPE">STRIPE</option>
            </select>
          </div>

          <Field
            label="amount in centimes  (e.g. 15000 = 150.00 MAD)"
            value={fields.amount}
            onChange={set("amount")}
            type="number"
          />
          <Field label="currency" value={fields.currency} onChange={set("currency")} />
          <Field label="reference" value={fields.reference} onChange={set("reference")} />
          <Field label="description" value={fields.description} onChange={set("description")} />
          <Field label="returnUrl" value={fields.returnUrl} onChange={set("returnUrl")} />
          <Field label="successUrl" value={fields.successUrl} onChange={set("successUrl")} />
          <Field label="cancelUrl" value={fields.cancelUrl} onChange={set("cancelUrl")} />
          <Field label="failureUrl" value={fields.failureUrl} onChange={set("failureUrl")} />
          <Field label="customerName" value={fields.customerName} onChange={set("customerName")} />
          <Field
            label="customerEmail"
            value={fields.customerEmail}
            onChange={set("customerEmail")}
            type="email"
          />

          {/* isPreauth toggle */}
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isPreauth}
              onClick={() => setIsPreauth((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isPreauth ? "bg-amber-500" : "bg-zinc-200 dark:bg-zinc-700",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
                  isPreauth ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
            <div>
              <Label
                className="text-xs font-medium cursor-pointer"
                onClick={() => setIsPreauth((v) => !v)}
              >
                isPreauth
              </Label>
              <p className="text-xs text-muted-foreground">
                Authorize the card without charging — capture or void later.
              </p>
            </div>
          </div>
        </div>

        {/* Provider callout */}
        {fields.provider === "VPS" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">VPS / Payzone integration:</span> After creating the
                intent, do <em>not</em> open{" "}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                  checkoutUrl
                </code>{" "}
                as a bare link. Use the <strong>&quot;Launch Payzone&quot;</strong> button in the
                response panel — it performs a form POST of{" "}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                  payload
                </code>
                ,{" "}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                  signature
                </code>
                ,{" "}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                  mode
                </code>{" "}
                directly to{" "}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                  providerData.paywallUrl
                </code>
                .
              </div>
            </div>
          </div>
        )}
        {fields.provider === "STRIPE" && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-800/40 dark:bg-purple-900/10 px-4 py-3 text-xs text-purple-800 dark:text-purple-300">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>
                <span className="font-semibold">Stripe integration:</span> Redirect the customer to{" "}
                <code className="font-mono bg-purple-100 dark:bg-purple-900/40 px-1 rounded">
                  redirectUrl
                </code>{" "}
                in the response (the direct Stripe-hosted checkout session URL).
              </p>
            </div>
          </div>
        )}

        {/* Request preview */}
        <div className="space-y-1.5">
          <SectionLabel>Request Preview</SectionLabel>
          <CodeBlock code={preview} />
        </div>

        <Button onClick={send} disabled={loading} className="gap-2 w-full sm:w-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? "Sending…" : "Create Intent"}
        </Button>

        {/* Session started banner */}
        {sessionStarted && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-green-800 dark:text-green-300">
                ✓ Session started — all downstream panels auto-populated
              </p>
              <p className="text-xs font-mono text-green-700 dark:text-green-400 truncate">
                {sessionStarted}
              </p>
            </div>
          </div>
        )}

        {(response || error) && (
          <div className="space-y-2">
            <SectionLabel>Response</SectionLabel>
            <ResponsePanel response={response} error={error} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 3: Active Session Banner ─────────────────────────────────────────

function ActiveSessionBanner({
  intentId,
  currentStatus,
  onClear,
}: {
  intentId: string;
  currentStatus: string | null;
  onClear: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Active Session</p>
            <p className="text-xs text-muted-foreground">
              All panels below are linked to this intent
            </p>
          </div>
        </div>
        {currentStatus && <PaymentStatusBadge status={currentStatus} />}
      </div>

      <div className="mt-3 flex items-center gap-2 bg-background/60 rounded-lg border px-3 py-2">
        <span className="text-xs text-muted-foreground font-medium shrink-0">intentId</span>
        <code className="text-xs font-mono flex-1 truncate text-foreground">{intentId}</code>
        <CopyButton text={intentId} />
      </div>

      {/* Contextual next-step guidance */}
      <WhatNextCallout status={currentStatus} />

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-7 text-xs text-muted-foreground"
          onClick={onClear}
        >
          <Trash2 className="h-3 w-3" />
          Clear Session
        </Button>
      </div>
    </div>
  );
}

// ─── Section 4: Live Status Monitor ───────────────────────────────────────────

function StatusMonitorCard({
  apiKey,
  intentId,
  onStatusChange,
}: {
  apiKey: string;
  intentId: string;
  onStatusChange: (status: string) => void;
}) {
  const [status, setStatus] = useState<IntentStatus | null>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [polling, setPolling] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastStatus = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!intentId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/payment-intents/${intentId}/status`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json: IntentStatus = await r.json();
      setStatus(json);
      if (json.status && json.status !== lastStatus.current) {
        lastStatus.current = json.status;
        setHistory((h) => [{ status: json.status, timestamp: new Date() }, ...h].slice(0, 8));
        onStatusChange(json.status);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [intentId, apiKey, onStatusChange]);

  // Start/stop polling
  useEffect(() => {
    if (!intentId) return;
    lastStatus.current = null;
    setHistory([]);
    setStatus(null);
    fetchStatus();
  }, [intentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!intentId) return;
    if (polling) {
      intervalRef.current = setInterval(fetchStatus, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling, fetchStatus, intentId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
              <Wifi className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">Live Status Monitor</CardTitle>
                <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  GET
                </span>
                <code className="text-xs font-mono text-muted-foreground">
                  /payment-intents/:id/status
                </code>
              </div>
              <CardDescription className="mt-0.5">
                Polls every 3 seconds while active session is set.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-xs"
              onClick={fetchStatus}
              disabled={loading || !intentId}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Refresh Now
            </Button>
            <Button
              size="sm"
              variant={polling ? "outline" : "default"}
              className="gap-1.5 h-7 text-xs"
              onClick={() => setPolling((p) => !p)}
              disabled={!intentId}
            >
              {polling ? (
                <>
                  <WifiOff className="h-3 w-3" /> Stop Polling
                </>
              ) : (
                <>
                  <Wifi className="h-3 w-3" /> Resume Polling
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status lifecycle legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-muted/30 px-3 py-2.5">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Lifecycle:</span>
          {[
            { s: "CREATED", arrow: true },
            { s: "REQUIRES_ACTION", arrow: true },
            { s: "PROCESSING", arrow: true },
            { s: "SUCCEEDED", arrow: false },
          ].map(({ s, arrow }) => (
            <span key={s} className="flex items-center gap-1">
              <PaymentStatusBadge status={s} />
              {arrow && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </span>
          ))}
          <span className="text-xs text-muted-foreground mx-1">or</span>
          {[
            { s: "FAILED", arrow: false },
            { s: "CANCELED", arrow: false },
            { s: "REFUNDED", arrow: false },
          ].map(({ s }) => (
            <PaymentStatusBadge key={s} status={s} />
          ))}
        </div>

        {!intentId && (
          <p className="text-xs text-muted-foreground italic">
            Create a payment intent above to start monitoring.
          </p>
        )}

        {intentId && (
          <>
            {error && <p className="text-xs text-red-500 font-mono">{error}</p>}

            {/* Current status */}
            {status && (
              <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Current Status</p>
                  <PaymentStatusBadge status={status.status} />
                </div>
                {status.providerRef && (
                  <div className="text-right space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Provider Ref</p>
                    <code className="text-xs font-mono text-foreground">{status.providerRef}</code>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  {polling ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      Live
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Paused</span>
                  )}
                </div>
              </div>
            )}

            {/* History timeline */}
            {history.length > 0 && (
              <div className="space-y-1.5">
                <SectionLabel>Status History</SectionLabel>
                <div className="space-y-1">
                  {history.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-xs py-1.5 px-3 rounded-md bg-muted/30"
                    >
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <PaymentStatusBadge status={entry.status} />
                      <span className="text-muted-foreground ml-auto font-mono">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 5: Actions ───────────────────────────────────────────────────────

function ActionCard({
  title,
  method,
  endpoint,
  description,
  icon,
  iconBg,
  children,
  disabled,
  disabledReason,
  loading,
  onSend,
  preview,
  response,
  error,
}: {
  title: string;
  method: string;
  endpoint: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  children?: React.ReactNode;
  disabled: boolean;
  disabledReason?: string;
  loading: boolean;
  onSend: () => void;
  preview: string;
  response: ResponseState | null;
  error: string | null;
}) {
  const methodColor =
    method === "POST"
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <Card className={cn(disabled && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", iconBg)}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{title}</CardTitle>
              <span
                className={cn(
                  "inline-flex items-center rounded px-2 py-0.5 text-xs font-bold font-mono",
                  methodColor,
                )}
              >
                {method}
              </span>
              <code className="text-xs font-mono text-muted-foreground">{endpoint}</code>
            </div>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {children}

        <div className="space-y-1.5">
          <SectionLabel>Request Preview</SectionLabel>
          <CodeBlock code={preview} />
        </div>

        {disabledReason && disabled ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Info className="h-3.5 w-3.5 shrink-0" />
              {disabledReason}
            </div>
            <Tooltip content={disabledReason}>
              <span className="inline-block">
                <Button disabled className="gap-2 w-full sm:w-auto cursor-not-allowed opacity-50">
                  <Send className="h-4 w-4" />
                  Send Request
                </Button>
              </span>
            </Tooltip>
          </div>
        ) : (
          <Button
            onClick={onSend}
            disabled={loading || disabled}
            className="gap-2 w-full sm:w-auto"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? "Sending…" : "Send Request"}
          </Button>
        )}

        {(response || error) && (
          <div className="space-y-2">
            <SectionLabel>Response</SectionLabel>
            <ResponsePanel response={response} error={error} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CaptureCard({
  apiKey,
  intentId,
  currentStatus,
  onSuccess,
}: {
  apiKey: string;
  intentId: string;
  currentStatus: string | null;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCapture = currentStatus === "REQUIRES_ACTION";
  const preview = `POST ${BASE}/payment-intents/${intentId || ":intentId"}/capture\nAuthorization: Bearer ${apiKey}\n\n# No request body needed.\n# Intent must be in REQUIRES_ACTION status (pre-auth hold placed).`;

  async function send() {
    if (!intentId) return;
    setLoading(true);
    setResponse(null);
    setError(null);
    const t = Date.now();
    try {
      const r = await fetch(`${BASE}/payment-intents/${intentId}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json = await r.json().catch(() => ({}));
      setResponse({
        status: r.status,
        body: JSON.stringify(json, null, 2),
        ms: Date.now() - t,
      });
      if (r.ok) onSuccess();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <ActionCard
      title="Capture Payment"
      method="POST"
      endpoint="/payment-intents/:id/capture"
      description="Charge the pre-authorized hold. Card is debited. Requires isPreauth=true at intent creation."
      icon={<Play className="h-4 w-4 text-green-700 dark:text-green-400" />}
      iconBg={canCapture ? "bg-green-500" : "bg-green-100 dark:bg-green-900/30"}
      disabled={!intentId || !canCapture}
      disabledReason={
        !intentId
          ? "Create a payment intent first."
          : "Status must be REQUIRES_ACTION. Create an intent with isPreauth=true, complete the paywall, then return here."
      }
      loading={loading}
      onSend={send}
      preview={preview}
      response={response}
      error={error}
    />
  );
}

function VoidCard({
  apiKey,
  intentId,
  currentStatus,
  onSuccess,
}: {
  apiKey: string;
  intentId: string;
  currentStatus: string | null;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canVoid = currentStatus === "REQUIRES_ACTION";
  const preview = `POST ${BASE}/payment-intents/${intentId || ":intentId"}/cancel\nAuthorization: Bearer ${apiKey}\n\n# No request body needed.\n# Intent must be in REQUIRES_ACTION status. Releases the card hold without charging.`;

  async function send() {
    if (!intentId) return;
    setLoading(true);
    setResponse(null);
    setError(null);
    const t = Date.now();
    try {
      const r = await fetch(`${BASE}/payment-intents/${intentId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json = await r.json().catch(() => ({}));
      setResponse({
        status: r.status,
        body: JSON.stringify(json, null, 2),
        ms: Date.now() - t,
      });
      if (r.ok) onSuccess();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <ActionCard
      title="Void / Cancel"
      method="POST"
      endpoint="/payment-intents/:id/cancel"
      description="Release a pre-authorized card hold without charging the customer."
      icon={<Ban className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
      iconBg="bg-orange-100 dark:bg-orange-900/30"
      disabled={!intentId || !canVoid}
      disabledReason={
        !intentId
          ? "Create a payment intent first."
          : "Status must be REQUIRES_ACTION. Create an intent with isPreauth=true, complete the paywall, then return here."
      }
      loading={loading}
      onSend={send}
      preview={preview}
      response={response}
      error={error}
    />
  );
}

function RefundCard({
  apiKey,
  intentId,
  currentStatus,
  onSuccess,
}: {
  apiKey: string;
  intentId: string;
  currentStatus: string | null;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("15000");
  const [currency, setCurrency] = useState("MAD");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRefund = currentStatus === "SUCCEEDED";
  const bodyObj = { amount: Number(amount), currency };
  const preview = `POST ${BASE}/transactions/${intentId || ":intentId"}/refund\nAuthorization: Bearer ${apiKey}\nContent-Type: application/json\n\n${JSON.stringify(bodyObj, null, 2)}\n\n# amount is in centimes (15000 = 150.00 MAD). Omit for a full refund.\n# Intent must be in SUCCEEDED status.`;

  async function send() {
    if (!intentId) return;
    setLoading(true);
    setResponse(null);
    setError(null);
    const t = Date.now();
    try {
      const r = await fetch(`${BASE}/transactions/${intentId}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyObj),
      });
      const json = await r.json().catch(() => ({}));
      setResponse({
        status: r.status,
        body: JSON.stringify(json, null, 2),
        ms: Date.now() - t,
      });
      if (r.ok) onSuccess();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <ActionCard
      title="Refund"
      method="POST"
      endpoint="/transactions/:id/refund"
      description="Return funds to the customer. Full or partial. Only once the payment has SUCCEEDED."
      icon={<RotateCcw className="h-4 w-4 text-purple-700 dark:text-purple-400" />}
      iconBg={canRefund ? "bg-purple-500" : "bg-purple-100 dark:bg-purple-900/30"}
      disabled={!intentId || !canRefund}
      disabledReason={
        !intentId
          ? "Create a payment intent first."
          : "Status must be SUCCEEDED. Complete the paywall payment (without isPreauth), then return here."
      }
      loading={loading}
      onSend={send}
      preview={preview}
      response={response}
      error={error}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="amount (centimes)"
          value={amount}
          onChange={setAmount}
          type="number"
          placeholder="15000"
        />
        <Field label="currency" value={currency} onChange={setCurrency} placeholder="MAD" />
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">Amount in centimes.</span> 15000 = 150.00 MAD. Partial
            refunds are supported. Omit{" "}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">amount</code>{" "}
            for a full refund.
          </p>
        </div>
      </div>
    </ActionCard>
  );
}

// ─── Section 6: Full Intent Details ───────────────────────────────────────────

function FullDetailsCard({ apiKey, intentId }: { apiKey: string; intentId: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FullIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetch_() {
    if (!intentId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/payment-intents/${intentId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json: FullIntent = await r.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  const webhooks: WebhookEvent[] = data?.webhookEvents ?? [];
  const providerTxs: ProviderTx[] = data?.providerTxs ?? [];
  const refunds: RefundRecord[] = data?.refunds ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0">
            <Eye className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">Full Intent Details</CardTitle>
              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                GET
              </span>
              <code className="text-xs font-mono text-muted-foreground">/payment-intents/:id</code>
            </div>
            <CardDescription className="mt-0.5">
              Full intent object including webhook events, provider transactions, and refunds.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <Button
          size="sm"
          variant="outline"
          onClick={fetch_}
          disabled={loading || !intentId}
          className="gap-2 h-8 text-xs"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {loading ? "Fetching…" : "Fetch Full Details"}
        </Button>

        {!intentId && (
          <p className="text-xs text-muted-foreground italic">
            Create a payment intent above first.
          </p>
        )}

        {error && <p className="text-xs text-red-500 font-mono">{error}</p>}

        {data && (
          <div className="space-y-5">
            {/* Raw JSON */}
            <div className="space-y-1.5">
              <SectionLabel>Raw Response</SectionLabel>
              <CodeBlock code={JSON.stringify(data, null, 2)} />
            </div>

            {/* Webhook Events */}
            <div className="space-y-1.5">
              <SectionLabel>Webhook Events ({webhooks.length})</SectionLabel>
              {webhooks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No webhook events.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-4 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider gap-2">
                    <span>Event Type</span>
                    <span>Mapped Status</span>
                    <span>Sig Verified</span>
                    <span>Timestamp</span>
                  </div>
                  {webhooks.map((w, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-4 items-center px-4 py-2.5 border-t text-xs gap-2"
                    >
                      <span className="font-mono truncate">{w.eventType ?? w.type ?? "—"}</span>
                      <span>
                        {w.mappedStatus ? <PaymentStatusBadge status={w.mappedStatus} /> : "—"}
                      </span>
                      <span>
                        {w.signatureVerified === undefined ? (
                          "—"
                        ) : w.signatureVerified ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            ✓ Yes
                          </span>
                        ) : (
                          <span className="text-red-500 font-semibold">✗ No</span>
                        )}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {(w.createdAt ?? w.timestamp)
                          ? new Date((w.createdAt ?? w.timestamp) as string).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Provider Transactions */}
            <div className="space-y-1.5">
              <SectionLabel>Provider Transactions ({providerTxs.length})</SectionLabel>
              {providerTxs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No provider transactions.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-3 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider gap-2">
                    <span>Provider</span>
                    <span>Provider Tx ID</span>
                    <span>Created At</span>
                  </div>
                  {providerTxs.map((tx, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-3 items-center px-4 py-2.5 border-t text-xs gap-2"
                    >
                      <span className="font-mono font-semibold">{tx.provider ?? "—"}</span>
                      <span className="font-mono truncate">{tx.providerTransactionId ?? "—"}</span>
                      <span className="text-muted-foreground font-mono">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Refunds */}
            <div className="space-y-1.5">
              <SectionLabel>Refunds ({refunds.length})</SectionLabel>
              {refunds.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No refunds.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-4 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider gap-2">
                    <span>ID</span>
                    <span>Status</span>
                    <span>Amount</span>
                    <span>Created At</span>
                  </div>
                  {refunds.map((rf, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-4 items-center px-4 py-2.5 border-t text-xs gap-2"
                    >
                      <span className="font-mono truncate">{rf.id ?? "—"}</span>
                      <span>{rf.status ? <PaymentStatusBadge status={rf.status} /> : "—"}</span>
                      <span className="font-mono">
                        {rf.amount != null
                          ? `${(rf.amount / 100).toFixed(2)} ${rf.currency ?? ""}`
                          : "—"}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {rf.createdAt ? new Date(rf.createdAt).toLocaleString() : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [apiKey, setApiKey] = useState(DEFAULT_KEY);
  const [activeIntentId, setActiveIntentId] = useState("");
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  const handleIntentCreated = useCallback((_intentId: string, _resp: PaymentIntentResponse) => {
    setActiveIntentId(_intentId);
    setCurrentStatus("CREATED");
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    setCurrentStatus(status);
  }, []);

  const handleClearSession = useCallback(() => {
    setActiveIntentId("");
    setCurrentStatus(null);
  }, []);

  return (
    <DashboardLayout title="Payment Test Suite">
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FlaskConical className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">End-to-End Payment Test Suite</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Follow the steps below from top to bottom. Creating an intent auto-populates every
            downstream panel — you never need to copy-paste an ID.
          </p>
        </div>

        {/* ── Visual flow stepper ─────────────────────────────────────── */}
        <FlowStepper intentId={activeIntentId} status={currentStatus} />

        {/* ── API Key ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">API Key</CardTitle>
            </div>
            <CardDescription>
              Used as the Bearer token on every request below. Pre-filled with the live key —
              replace if needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-xs h-9 pr-10"
                placeholder="cp_live_..."
              />
              <div className="absolute right-1 top-1">
                <CopyButton text={apiKey} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Providers (optional) ────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              Optional — load your provider configs to confirm which providers are CONNECTED before
              creating an intent.
            </span>
          </div>
          <ProviderConfigsCard apiKey={apiKey} />
        </div>

        {/* ── Step 1: Create Intent ────────────────────────────────────── */}
        <div className="space-y-3">
          <StepHeader n={1} title="Create a Payment Intent" />
          <CreateIntentCard apiKey={apiKey} onIntentCreated={handleIntentCreated} />
        </div>

        {/* ── Active Session Banner (appears after step 1) ─────────────── */}
        {activeIntentId && (
          <ActiveSessionBanner
            intentId={activeIntentId}
            currentStatus={currentStatus}
            onClear={handleClearSession}
          />
        )}

        {/* ── Step 2 hint (before session exists) ─────────────────────── */}
        {!activeIntentId && (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 px-5 py-6 text-center space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Steps 2 – 4 unlock after you create an intent above
            </p>
            <p className="text-xs text-muted-foreground/70">
              The Live Status Monitor, Capture, Void, and Refund panels will auto-populate with the
              returned intentId.
            </p>
          </div>
        )}

        {/* ── Step 2: Monitor Status ───────────────────────────────────── */}
        {activeIntentId && (
          <div className="space-y-3">
            <StepHeader n={2} title="Monitor Live Status" />
            <StatusMonitorCard
              apiKey={apiKey}
              intentId={activeIntentId}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}

        {/* ── Step 3: Actions ─────────────────────────────────────────── */}
        {activeIntentId && (
          <div className="space-y-3">
            <StepHeader n={3} title="Act on the Payment" />
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/20 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-foreground">Which action is available?</span>{" "}
                <span className="inline-flex items-center gap-1">
                  <PaymentStatusBadge status="REQUIRES_ACTION" />
                </span>{" "}
                → Capture or Void.{" "}
                <span className="inline-flex items-center gap-1">
                  <PaymentStatusBadge status="SUCCEEDED" />
                </span>{" "}
                → Refund. The relevant card is highlighted; others show why they&apos;re locked.
              </div>
            </div>
            <CaptureCard
              apiKey={apiKey}
              intentId={activeIntentId}
              currentStatus={currentStatus}
              onSuccess={() => setCurrentStatus("SUCCEEDED")}
            />
            <VoidCard
              apiKey={apiKey}
              intentId={activeIntentId}
              currentStatus={currentStatus}
              onSuccess={() => setCurrentStatus("CANCELED")}
            />
            <RefundCard
              apiKey={apiKey}
              intentId={activeIntentId}
              currentStatus={currentStatus}
              onSuccess={() => setCurrentStatus("REFUNDED")}
            />
          </div>
        )}

        {/* ── Step 4: Full Details ─────────────────────────────────────── */}
        {activeIntentId && (
          <div className="space-y-3">
            <StepHeader n={4} title="Inspect Full Intent Details" />
            <FullDetailsCard apiKey={apiKey} intentId={activeIntentId} />
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <p className="text-xs text-center text-muted-foreground">
          Base URL: <code className="font-mono">{BASE}</code>
        </p>
      </div>
    </DashboardLayout>
  );
}

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { client, getErrorMessage } from "@/lib/client";
import { statusVariant } from "@/lib/status";
import type { components } from "@/lib/api-types";
import { toast } from "@/lib/use-toast";
import {
  CheckCircle2,
  Loader2,
  PlugZap,
  AlertCircle,
  Webhook,
  PowerOff,
  Power,
  XCircle,
  HelpCircle,
  ChevronDown,
  BookOpen,
  Clipboard,
  Check,
  Info,
  ArrowRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderConfig = components["schemas"]["ProviderConfigListItem"];
type TenantProfile = components["schemas"]["TenantProfile"];
type ProviderValue = "NAPS" | "VPS" | "STRIPE";

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchTenant(): Promise<TenantProfile> {
  const { data, error } = await client.GET("/tenant");
  if (error || !data) throw error;
  return data;
}

async function updateTenant(data: {
  notifyWebhookUrl?: string | null;
  notifyEmail?: string | null;
}) {
  const { error } = await client.PATCH("/tenant", { body: data });
  if (error) throw error;
}

async function fetchConfigs(): Promise<ProviderConfig[]> {
  const { data, error } = await client.GET("/provider-configs");
  if (error) throw error;
  return data ?? [];
}

async function upsertConfig(
  provider: ProviderValue,
  environment: string,
  credentials: Record<string, unknown>,
) {
  const { error } = await client.POST("/provider-configs", {
    body: { provider, environment, credentials },
  });
  if (error) throw error;
}

async function testConfig(
  id: string,
): Promise<{ connected: boolean; status: string; error: string | null }> {
  const { data, error } = await client.POST("/provider-configs/{id}/test", {
    params: { path: { id } },
  });
  if (error || !data) throw error;
  return data;
}

async function toggleConfigStatus(
  id: string,
  enabled: boolean,
): Promise<{ id: string; provider: string; status: string }> {
  const { data, error } = await client.PATCH("/provider-configs/{id}/status", {
    params: { path: { id } },
    body: { enabled },
  });
  if (error || !data) throw error;
  return data;
}

async function deleteConfig(id: string) {
  const { error } = await client.DELETE("/provider-configs/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
}

// ─── Status display helpers ───────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "CONNECTED":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "DISABLED":
      return <PowerOff className="h-4 w-4 text-slate-400" />;
    case "INVALID":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "MISSING":
    default:
      return <HelpCircle className="h-4 w-4 text-yellow-500" />;
  }
}

// ─── Form schemas ─────────────────────────────────────────────────────────────

const webhookSchema = z.object({
  notifyWebhookUrl: z
    .string()
    .url("Must be a valid HTTPS URL")
    .refine((v) => v.startsWith("https://"), { message: "URL must use HTTPS" })
    .or(z.literal(""))
    .optional(),
  notifyEmail: z.string().email("Must be a valid email").or(z.literal("")).optional(),
});

type WebhookValues = z.infer<typeof webhookSchema>;

const napsSchema = z.object({
  merchantId: z.string().min(1, "Required"),
  terminalId: z.string().min(1, "Required"),
  secretKey: z.string().min(1, "Required"),
  baseUrl: z.string().url("Must be a valid URL"),
});

const vpsSchema = z.object({
  merchantCode: z.string().min(1, "Required"),
  apiKey: z.string().min(1, "Required"),
  baseUrl: z.string().url("Must be a valid URL"),
});

const stripeSchema = z.object({
  secretKey: z.string().min(1, "Required").startsWith("sk_", "Must start with sk_"),
  webhookSecret: z.string().min(1, "Required").startsWith("whsec_", "Must start with whsec_"),
  publishableKey: z.string().optional(),
});

type NapsValues = z.infer<typeof napsSchema>;
type VpsValues = z.infer<typeof vpsSchema>;
type StripeValues = z.infer<typeof stripeSchema>;

// ─── ProviderCard ─────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  title,
  description,
  configs,
}: {
  provider: ProviderValue;
  title: string;
  description: string;
  configs: ProviderConfig[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [env, setEnv] = useState<"SANDBOX" | "PRODUCTION">("SANDBOX");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // ── Save credentials ───────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (data: NapsValues | VpsValues | StripeValues) => upsertConfig(provider, env, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-configs"] });
      setOpen(false);
      toast.success("Configuration saved", `${title} ${env} credentials updated.`);
    },
    onError: () => toast.error("Failed to save", "Please check your credentials and try again."),
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => deleteConfig(deleteTarget!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-configs"] });
      setDeleteTarget(null);
      toast.success("Configuration removed");
    },
    onError: () => toast.error("Failed to remove configuration"),
  });

  // ── Enable / disable ──────────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleConfigStatus(id, enabled),
    onMutate: async ({ id, enabled }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ["provider-configs"] });
      const previous = qc.getQueryData<ProviderConfig[]>(["provider-configs"]);
      qc.setQueryData<ProviderConfig[]>(["provider-configs"], (old = []) =>
        old.map((c) => (c.id === id ? { ...c, status: enabled ? "CONNECTED" : "DISABLED" } : c)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back optimistic update
      if (ctx?.previous) {
        qc.setQueryData(["provider-configs"], ctx.previous);
      }
      toast.error("Toggle failed", "Could not update the provider status. Please try again.");
    },
    onSuccess: (_data, { enabled }) => {
      qc.invalidateQueries({ queryKey: ["provider-configs"] });
      toast.success(
        enabled ? "Provider enabled" : "Provider disabled",
        enabled
          ? `${title} is now active and will accept payments.`
          : `${title} is now disabled. No new payments will be processed.`,
      );
    },
    onSettled: () => {
      setToggling(null);
    },
  });

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const result = await testConfig(id);
      if (result.connected) {
        toast.success("Connection successful", `${title} is properly configured.`);
      } else {
        toast.error("Connection failed", result.error ?? "Could not connect to the provider.");
      }
      qc.invalidateQueries({ queryKey: ["provider-configs"] });
    } catch {
      toast.error("Test failed", "An unexpected error occurred.");
    } finally {
      setTesting(null);
    }
  }

  function handleToggle(id: string, currentStatus: string) {
    const enabling = currentStatus === "DISABLED";
    setToggling(id);
    toggleMutation.mutate({ id, enabled: enabling });
  }

  // ── Forms ──────────────────────────────────────────────────────────────────

  const StripeForm = () => {
    const {
      register,
      handleSubmit,
      formState: { errors },
    } = useForm<StripeValues>({ resolver: zodResolver(stripeSchema) });
    return (
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Secret Key</Label>
          <Input type="password" placeholder="sk_test_..." {...register("secretKey")} />
          {errors.secretKey && (
            <p className="text-xs text-destructive">{errors.secretKey.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Webhook Secret</Label>
          <Input type="password" placeholder="whsec_..." {...register("webhookSecret")} />
          {errors.webhookSecret && (
            <p className="text-xs text-destructive">{errors.webhookSecret.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Found in Stripe Dashboard → Developers → Webhooks. Point your webhook endpoint to{" "}
            <code className="bg-muted px-1 rounded text-xs">/webhooks/stripe</code>.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>
            Publishable Key <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input type="text" placeholder="pk_test_..." {...register("publishableKey")} />
          {errors.publishableKey && (
            <p className="text-xs text-destructive">{errors.publishableKey.message}</p>
          )}
        </div>
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
        {mutation.isError && <p className="text-xs text-destructive">Failed to save.</p>}
      </form>
    );
  };

  const NapsForm = () => {
    const {
      register,
      handleSubmit,
      formState: { errors },
    } = useForm<NapsValues>({ resolver: zodResolver(napsSchema) });
    return (
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-2">
        {(
          [
            ["merchantId", "Merchant ID"],
            ["terminalId", "Terminal ID"],
            ["secretKey", "Secret Key"],
            ["baseUrl", "Base URL"],
          ] as [keyof NapsValues, string][]
        ).map(([field, label]) => (
          <div key={field} className="space-y-1.5">
            <Label>{label}</Label>
            <Input type={field === "secretKey" ? "password" : "text"} {...register(field)} />
            {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
          </div>
        ))}
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
        {mutation.isError && <p className="text-xs text-destructive">Failed to save.</p>}
      </form>
    );
  };

  const VpsForm = () => {
    const {
      register,
      handleSubmit,
      formState: { errors },
    } = useForm<VpsValues>({ resolver: zodResolver(vpsSchema) });
    return (
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-2">
        {(
          [
            ["merchantCode", "Merchant Code"],
            ["apiKey", "API Key"],
            ["baseUrl", "Base URL"],
          ] as [keyof VpsValues, string][]
        ).map(([field, label]) => (
          <div key={field} className="space-y-1.5">
            <Label>{label}</Label>
            <Input type={field === "apiKey" ? "password" : "text"} {...register(field)} />
            {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
          </div>
        ))}
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
        {mutation.isError && <p className="text-xs text-destructive">Failed to save.</p>}
      </form>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs mt-1">{description}</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
              <PlugZap className="mr-2 h-4 w-4" />
              {open ? "Cancel" : "Configure"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing configs */}
          {configs.map((c) => {
            const isDisabled = c.status === "DISABLED";
            const canToggle = c.status === "CONNECTED" || c.status === "DISABLED";
            const isToggling = toggling === c.id;
            const isTesting = testing === c.id;

            return (
              <div
                key={c.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isDisabled ? "bg-muted/20 opacity-60" : "bg-muted/30"
                }`}
              >
                {/* Left: status icon + environment + badge */}
                <div className="flex items-center gap-2">
                  <StatusIcon status={c.status} />
                  <span className="text-sm font-medium">{c.environment}</span>
                  <Badge variant={statusVariant(c.status)} className="text-xs capitalize">
                    {c.status.toLowerCase()}
                  </Badge>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-1">
                  {/* Enable / Disable toggle — only shown when config has been
                      tested at least once (CONNECTED or DISABLED) */}
                  {canToggle && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(c.id, c.status)}
                      disabled={isToggling}
                      title={isDisabled ? "Enable provider" : "Disable provider"}
                    >
                      {isToggling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isDisabled ? (
                        <>
                          <Power className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                          <span className="text-green-600">Enable</span>
                        </>
                      ) : (
                        <>
                          <PowerOff className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                          <span className="text-slate-500">Disable</span>
                        </>
                      )}
                    </Button>
                  )}

                  {/* Test button — hidden for DISABLED configs */}
                  {!isDisabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTest(c.id)}
                      disabled={isTesting}
                    >
                      {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(c.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add / edit credentials form */}
          {open && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex gap-2">
                {(["SANDBOX", "PRODUCTION"] as const).map((e) => (
                  <Button
                    key={e}
                    size="sm"
                    variant={env === e ? "default" : "outline"}
                    onClick={() => setEnv(e)}
                  >
                    {e}
                  </Button>
                ))}
              </div>
              {provider === "NAPS" ? (
                <NapsForm />
              ) : provider === "VPS" ? (
                <VpsForm />
              ) : (
                <StripeForm />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the provider credentials. Any active payment links using
              this provider will stop working. If you only want to pause payments, use the Disable
              button instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── WebhookCard ──────────────────────────────────────────────────────────────

// ─── Inline copy button for code blocks ──────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 p-1 rounded text-zinc-400 hover:text-zinc-100 transition-colors opacity-0 group-hover:opacity-100"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Clipboard className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function CodeSnippet({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 pr-10 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre">
        {code}
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

// ─── Payload Reference (collapsible) ─────────────────────────────────────────

const SAMPLE_PAYLOAD_B2B = `{
  "event":      "payment.updated",
  "status":     "SUCCEEDED",
  "intentId":   "cmo7k1n8d000211zt5yhwn8py",
  "reference":  null,
  "amount":     15000,
  "currency":   "MAD",
  "metadata": {
    "your_order_id": "ORD-001"
  },
  "occurredAt": "2025-01-15T10:00:00.000Z"
}`;

const SAMPLE_PAYLOAD_LINK = `{
  "event":      "payment.updated",
  "status":     "SUCCEEDED",
  "intentId":   "cmo7k1n8d000211zt5yhwn8py",
  "reference":  "ORDER-001",
  "amount":     15000,
  "currency":   "MAD",
  "metadata":   undefined,
  "occurredAt": "2025-01-15T10:00:00.000Z"
}`;

const STATUS_ROWS = [
  {
    status: "AUTHORIZED",
    color: "text-amber-600 dark:text-amber-400",
    meaning: "Card hold placed — not yet charged (pre-auth flow).",
  },
  {
    status: "SUCCEEDED",
    color: "text-green-600 dark:text-green-400",
    meaning: "Payment fully captured. Fulfill the order.",
  },
  {
    status: "FAILED",
    color: "text-red-600 dark:text-red-400",
    meaning: "Declined or error. Notify the customer, allow retry.",
  },
  {
    status: "CANCELLED",
    color: "text-orange-600 dark:text-orange-400",
    meaning: "Pre-auth void — hold released, no money moved.",
  },
  {
    status: "REFUNDED",
    color: "text-purple-600 dark:text-purple-400",
    meaning: "Money returned to customer.",
  },
];

const FIELD_ROWS = [
  { field: "event", type: "string", note: 'Always "payment.updated".' },
  { field: "status", type: "string", note: "See status table below." },
  {
    field: "intentId",
    type: "string",
    note: "CorpoPay intent ID. Use this to look up the payment in your DB.",
  },
  {
    field: "reference",
    type: "string | null",
    note: "Your reference from the Payment Link. null for direct B2B intents.",
  },
  {
    field: "amount",
    type: "number | null",
    note: "Amount in centimes. 15000 = 150.00 MAD.",
  },
  { field: "currency", type: "string | null", note: 'ISO code e.g. "MAD".' },
  {
    field: "metadata",
    type: "object | undefined",
    note: "Your metadata from intent creation. Present for B2B intents only.",
  },
  { field: "occurredAt", type: "string", note: "ISO 8601 timestamp." },
];

function PayloadReference() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"b2b" | "link">("b2b");

  return (
    <div className="mt-6 pt-5 border-t">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Payload Reference
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform text-muted-foreground", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-5 space-y-6 text-xs">
          {/* ── How it works ── */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/10 px-4 py-3 text-blue-800 dark:text-blue-300">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">How it works</p>
                <p>
                  When a payment transitions to a notable state, CorpoPay fires a{" "}
                  <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
                    POST
                  </code>{" "}
                  request to your Webhook URL with{" "}
                  <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
                    Content-Type: application/json
                  </code>
                  . Your endpoint must return <strong>HTTP 200</strong>. If it doesn&apos;t,
                  CorpoPay retries up to <strong>3 times</strong> with exponential back-off.
                </p>
              </div>
            </div>
          </div>

          {/* ── Sample payload ── */}
          <div className="space-y-2.5">
            <p className="font-semibold text-foreground">Sample payload</p>

            {/* tab switcher */}
            <div className="flex rounded-md border overflow-hidden w-fit text-xs">
              <button
                type="button"
                onClick={() => setTab("b2b")}
                className={cn(
                  "px-3 py-1.5 font-medium transition-colors",
                  tab === "b2b"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Direct / B2B intent
              </button>
              <button
                type="button"
                onClick={() => setTab("link")}
                className={cn(
                  "px-3 py-1.5 font-medium border-l transition-colors",
                  tab === "link"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Payment Link
              </button>
            </div>

            <CodeSnippet code={tab === "b2b" ? SAMPLE_PAYLOAD_B2B : SAMPLE_PAYLOAD_LINK} />

            {tab === "b2b" ? (
              <p className="text-muted-foreground">
                For direct B2B intents,{" "}
                <code className="font-mono bg-muted px-1 rounded">reference</code> is{" "}
                <code className="font-mono bg-muted px-1 rounded">null</code> and{" "}
                <code className="font-mono bg-muted px-1 rounded">metadata</code> contains
                everything you passed when creating the intent — use it to carry your internal order
                or booking ID.
              </p>
            ) : (
              <p className="text-muted-foreground">
                For Payment Link intents,{" "}
                <code className="font-mono bg-muted px-1 rounded">reference</code> is the reference
                set on the link and{" "}
                <code className="font-mono bg-muted px-1 rounded">metadata</code> is not sent.
              </p>
            )}
          </div>

          {/* ── Fields ── */}
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Fields</p>
            <div className="rounded-lg border overflow-hidden">
              <div
                className="grid grid-cols-3 bg-muted/50 px-3 py-2 font-semibold uppercase tracking-wider text-muted-foreground"
                style={{ fontSize: "10px" }}
              >
                <span>Field</span>
                <span>Type</span>
                <span>Description</span>
              </div>
              {FIELD_ROWS.map((row) => (
                <div
                  key={row.field}
                  className="grid grid-cols-3 items-start px-3 py-2 border-t gap-2"
                >
                  <code className="font-mono font-semibold text-foreground">{row.field}</code>
                  <code className="font-mono text-muted-foreground">{row.type}</code>
                  <span className="text-muted-foreground">{row.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Status values ── */}
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Status values</p>
            <div className="rounded-lg border overflow-hidden">
              <div
                className="grid grid-cols-2 bg-muted/50 px-3 py-2 font-semibold uppercase tracking-wider text-muted-foreground"
                style={{ fontSize: "10px" }}
              >
                <span>status</span>
                <span>Meaning</span>
              </div>
              {STATUS_ROWS.map((row) => (
                <div
                  key={row.status}
                  className="grid grid-cols-2 items-start px-3 py-2 border-t gap-2"
                >
                  <code className={cn("font-mono font-semibold", row.color)}>{row.status}</code>
                  <span className="text-muted-foreground">{row.meaning}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Lookup strategy ── */}
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Recommended handler logic</p>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30 px-4 py-3 space-y-2 text-muted-foreground">
              <div className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <p>
                  Look up the payment in your DB using{" "}
                  <code className="font-mono bg-muted px-1 rounded">intentId</code>. Store it when
                  you first call{" "}
                  <code className="font-mono bg-muted px-1 rounded">POST /payment-intents</code>.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <p>
                  If you use direct B2B intents, pass your internal ID in{" "}
                  <code className="font-mono bg-muted px-1 rounded">metadata</code> at creation time
                  (e.g.{" "}
                  <code className="font-mono bg-muted px-1 rounded">{`{ "order_id": "ORD-001" }`}</code>
                  ). It will be forwarded here verbatim.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <p>
                  Return <strong className="text-foreground">HTTP 200</strong> as quickly as
                  possible — do heavy work asynchronously. CorpoPay reads only the status code.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <p>
                  <strong className="text-foreground">No HMAC signature</strong> is included in the
                  request. Secure your endpoint by embedding a secret token in the URL path (e.g.{" "}
                  <code className="font-mono bg-muted px-1 rounded">
                    /webhooks/corpopay/&#123;your-secret&#125;
                  </code>
                  ).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WebhookCard ──────────────────────────────────────────────────────────────

function WebhookCard() {
  const qc = useQueryClient();
  const { data: tenant } = useQuery({
    queryKey: ["tenant-profile"],
    queryFn: fetchTenant,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<WebhookValues>({
    resolver: zodResolver(webhookSchema),
    values: {
      notifyWebhookUrl: tenant?.notifyWebhookUrl ?? "",
      notifyEmail: tenant?.notifyEmail ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: WebhookValues) =>
      updateTenant({
        notifyWebhookUrl: data.notifyWebhookUrl || null,
        notifyEmail: data.notifyEmail || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-profile"] });
      toast.success("Webhook settings saved", "Outbound notifications updated.");
    },
    onError: () => toast.error("Failed to save", "Please check the URL and try again."),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Outbound Notifications</CardTitle>
            <CardDescription className="text-xs mt-1">
              CorpoPay will POST payment events to your webhook URL after each status change.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="notifyWebhookUrl">Webhook URL</Label>
            <Input
              id="notifyWebhookUrl"
              placeholder="https://your-app.com/payments/corpopay/callback"
              {...register("notifyWebhookUrl")}
            />
            {errors.notifyWebhookUrl && (
              <p className="text-xs text-destructive">{errors.notifyWebhookUrl.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Must be a publicly reachable HTTPS endpoint. Leave blank to disable.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notifyEmail">Notification Email</Label>
            <Input
              id="notifyEmail"
              type="email"
              placeholder="payments@your-company.com"
              {...register("notifyEmail")}
            />
            {errors.notifyEmail && (
              <p className="text-xs text-destructive">{errors.notifyEmail.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Optional. Receive email alerts for failed or refunded payments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={mutation.isPending || !isDirty}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
            {isDirty && (
              <Button type="button" size="sm" variant="ghost" onClick={() => reset()}>
                Discard
              </Button>
            )}
            {tenant?.notifyWebhookUrl && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" /> Active
              </span>
            )}
          </div>
        </form>

        <PayloadReference />
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: configs = [] } = useQuery({
    queryKey: ["provider-configs"],
    queryFn: fetchConfigs,
  });

  const napsConfigs = configs.filter((c) => c.provider === "NAPS");
  const vpsConfigs = configs.filter((c) => c.provider === "VPS");
  const stripeConfigs = configs.filter((c) => c.provider === "STRIPE");

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure payment providers and outbound notifications.
          </p>
        </div>

        <ProviderCard
          provider="NAPS"
          title="NAPS"
          description="Network for Automated Payment Systems — Morocco's national card network."
          configs={napsConfigs}
        />

        <ProviderCard
          provider="VPS"
          title="VPS / Payzone"
          description="VPS Payzone payment gateway for card acceptance."
          configs={vpsConfigs}
        />

        <ProviderCard
          provider="STRIPE"
          title="Stripe"
          description="Stripe global card payments — Visa, Mastercard, Apple Pay, Google Pay and more."
          configs={stripeConfigs}
        />

        <WebhookCard />
      </div>
    </DashboardLayout>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { CopyButton } from "@/components/shared/CopyButton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { components } from "@/lib/api-types";
import { client } from "@/lib/client";
import { buildPaymentLinkPayload } from "@/lib/payment-links";
import { toast } from "@/lib/use-toast";
import { formatAmount } from "@/lib/utils";

const BILLING_INTERVALS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUAL", label: "Annual" },
  { value: "CUSTOM", label: "Custom (days)" },
] as const;

const PROVIDERS = [
  { value: "NAPS", label: "NAPS" },
  { value: "VPS", label: "VPS / Payzone" },
  { value: "STRIPE", label: "Stripe" },
] as const;

type ProviderValue = (typeof PROVIDERS)[number]["value"];

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  amount: z.coerce.number().min(1, "Amount must be at least 1"),
  currency: z.string().default("MAD"),
  provider: z.enum(["NAPS", "VPS", "STRIPE"] as const).default("VPS"),
  reference: z.string().optional(),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  customerName: z.string().optional(),
  maxUses: z.coerce.number().int().min(1).optional().or(z.literal("")),
  expiresAt: z.string().optional(),
  isRecurring: z.boolean().optional(),
  billingInterval: z
    .enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"] as const)
    .optional(),
  intervalValue: z.coerce.number().int().min(1).optional(),
  maxRetries: z.coerce.number().int().min(1).max(10).optional(),
});

type FormValues = z.infer<typeof schema>;

type CreateLinkResponse = components["schemas"]["PaymentLinkCreateResponse"];

async function createLink(data: FormValues): Promise<CreateLinkResponse> {
  const payload = buildPaymentLinkPayload(data);

  const { data: result, error } = await client.POST("/payment-links", { body: payload });
  if (error || !result) throw error;
  return result;
}

export default function NewPaymentLinkPage() {
  const [created, setCreated] = useState<CreateLinkResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRecurring, setRecurring] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderValue>("VPS");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: "MAD",
      provider: "VPS",
      billingInterval: "MONTHLY",
      intervalValue: 1,
      maxRetries: 3,
    },
  });

  const watchedProvider = watch("provider") as ProviderValue;
  const isVps = watchedProvider === "VPS";

  const mutation = useMutation({
    mutationFn: createLink,
    onSuccess: (data) => {
      setCreated(data);
      toast.success("Payment link created!", "Share it with your customers to collect payments.");
    },
    onError: () => toast.error("Failed to create link", "Please check your form and try again."),
  });

  function toggleRecurring(enabled: boolean) {
    setRecurring(enabled);
    setValue("isRecurring", enabled);
  }

  function handleProviderChange(value: ProviderValue) {
    setSelectedProvider(value);
    setValue("provider", value);
    // Recurring billing is only supported with VPS — reset if switching away
    if (value !== "VPS" && isRecurring) {
      setRecurring(false);
      setValue("isRecurring", false);
    }
  }

  function copyUrl() {
    if (!created) return;
    const url = `${window.location.origin}/checkout/${created.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const checkoutUrl =
    created && typeof window !== "undefined"
      ? `${window.location.origin}/checkout/${created.slug}`
      : "";

  if (created) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto space-y-6">
          <div>
            <Link
              href="/dashboard/payment-links"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back to payment links
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Link Created!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Share this link with your customers to collect payment.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{created.description}</CardTitle>
              <CardDescription>{formatAmount(created.amount, created.currency)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* URL */}
              <div className="flex items-center gap-2">
                <Input readOnly value={checkoutUrl} className="font-mono text-xs" />
                <CopyButton
                  value={checkoutUrl}
                  variant="outline"
                  successMessage="Checkout URL copied!"
                />
                <Button variant="outline" size="icon" asChild title="Open checkout">
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              {/* QR code */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <p className="text-sm font-medium text-muted-foreground">QR Code</p>
                <div className="p-3 border rounded-lg bg-white">
                  <QRCodeSVG value={checkoutUrl} size={180} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Customers can scan this to open the checkout page.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/dashboard/payment-links/new">Create another</Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/dashboard/payment-links">View all links</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <Link
            href="/dashboard/payment-links"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to payment links
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">New Payment Link</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a shareable link for customers to pay you.
          </p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Link Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                {/* Provider */}
                <div className="space-y-1.5">
                  <Label htmlFor="provider">Payment Provider *</Label>
                  <div className="flex gap-2">
                    {PROVIDERS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleProviderChange(value)}
                        className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                          watchedProvider === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-muted"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" {...register("provider")} />
                  {errors.provider && (
                    <p className="text-xs text-destructive">{errors.provider.message}</p>
                  )}
                </div>

                <Label htmlFor="title">Title *</Label>
                <Input id="title" placeholder="e.g. Invoice #1042" {...register("title")} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="100.00"
                    {...register("amount")}
                  />
                  {errors.amount && (
                    <p className="text-xs text-destructive">{errors.amount.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" placeholder="MAD" maxLength={3} {...register("currency")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reference">Internal Reference</Label>
                <Input
                  id="reference"
                  placeholder="Your internal order/invoice number"
                  {...register("reference")}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Customer (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  placeholder="Pre-fill customer name"
                  {...register("customerName")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customerEmail">Customer Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  placeholder="customer@example.com"
                  {...register("customerEmail")}
                />
                {errors.customerEmail && (
                  <p className="text-xs text-destructive">{errors.customerEmail.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Limits (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="maxUses">Max Uses</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    {...register("maxUses")}
                  />
                  {errors.maxUses && (
                    <p className="text-xs text-destructive">{errors.maxUses.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiresAt">Expires At</Label>
                  <Input id="expiresAt" type="datetime-local" {...register("expiresAt")} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recurring billing */}
          <Card className={isRecurring ? "ring-2 ring-primary" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Recurring Billing</CardTitle>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isRecurring}
                  onClick={() => toggleRecurring(!isRecurring)}
                  disabled={!isVps}
                  title={
                    !isVps
                      ? "Recurring billing is only supported with the VPS/Payzone provider"
                      : undefined
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${
                    isRecurring ? "bg-primary" : "bg-input"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
                      isRecurring ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              {!isVps && (
                <p className="text-xs text-muted-foreground pt-1">
                  Recurring billing is only available with VPS / Payzone.
                </p>
              )}
            </CardHeader>

            {isRecurring && (
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="billingInterval">Billing Interval</Label>
                    <select
                      id="billingInterval"
                      {...register("billingInterval")}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {BILLING_INTERVALS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="intervalValue">Interval Count</Label>
                    <Input
                      id="intervalValue"
                      type="number"
                      min="1"
                      placeholder="1"
                      {...register("intervalValue")}
                    />
                    <p className="text-xs text-muted-foreground">
                      e.g. 2 + Monthly = every 2 months
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxRetries">Max Retry Attempts</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    min="1"
                    max="10"
                    placeholder="3"
                    {...register("maxRetries")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of dunning attempts before cancelling the subscription.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {mutation.isError && (
            <p className="text-sm text-destructive text-center">
              Failed to create link. Please try again.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Creating…
              </>
            ) : (
              "Create Payment Link"
            )}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}

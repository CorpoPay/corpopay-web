import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "@/lib/use-toast";
import { client, getErrorMessage } from "@/lib/client";
import type { components } from "@/lib/api-types";
import { formatAmount } from "@/lib/utils";
import { ChevronLeft, Pause, Play, X, RefreshCw } from "lucide-react";

type BillingEvent = components["schemas"]["BillingEvent"];
type SubscriptionDetail = components["schemas"]["SubscriptionDetail"];

function intervalLabel(type: string, value = 1): string {
  if (value > 1) {
    const unit: Record<string, string> = {
      DAILY: "days",
      WEEKLY: "weeks",
      MONTHLY: "months",
      QUARTERLY: "quarters",
      ANNUAL: "years",
      CUSTOM: "days",
    };
    return `Every ${value} ${unit[type] ?? "days"}`;
  }
  const labels: Record<string, string> = {
    DAILY: "Daily",
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
    ANNUAL: "Annual",
    CUSTOM: "Custom",
  };
  return labels[type] ?? type;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <span className="w-44 shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function SubscriptionDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: sub, isLoading } = useQuery<SubscriptionDetail>({
    queryKey: ["subscription", id],
    queryFn: async () => {
      const { data, error } = await client.GET("/subscriptions/{id}", {
        params: { path: { id: id ?? "" } },
      });
      if (error || !data) throw error;
      return data;
    },
    enabled: !!id,
  });

  const pauseMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.POST("/subscriptions/{id}/pause", {
        params: { path: { id: id ?? "" } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription", id] });
      toast.success("Subscription paused");
    },
    onError: (e) => toast.error("Failed to pause", getErrorMessage(e)),
  });

  const resumeMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.POST("/subscriptions/{id}/resume", {
        params: { path: { id: id ?? "" } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription", id] });
      toast.success("Subscription resumed");
    },
    onError: (e) => toast.error("Failed to resume", getErrorMessage(e)),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      const { error } = await client.DELETE("/subscriptions/{id}", {
        params: { path: { id: id ?? "" } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription", id] });
      setCancelOpen(false);
      toast.success("Subscription cancelled", "No future charges will be made.");
    },
    onError: (e) => toast.error("Failed to cancel", getErrorMessage(e)),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="py-16 text-center text-sm text-muted-foreground">Loading subscription…</div>
      </DashboardLayout>
    );
  }

  if (!sub) {
    return (
      <DashboardLayout>
        <div className="py-16 text-center text-sm text-destructive">Subscription not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Back link */}
        <div>
          <Link
            href="/dashboard/subscriptions"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Subscriptions
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
              Subscription
            </h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{sub.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={sub.status} />
            {(sub.status === "ACTIVE" || sub.status === "PAST_DUE") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => pauseMut.mutate()}
                disabled={pauseMut.isPending}
              >
                <Pause className="h-4 w-4 mr-1" /> Pause
              </Button>
            )}
            {sub.status === "PAUSED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => resumeMut.mutate()}
                disabled={resumeMut.isPending}
              >
                <Play className="h-4 w-4 mr-1" /> Resume
              </Button>
            )}
            {sub.status !== "CANCELLED" && sub.status !== "EXPIRED" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCancelOpen(true)}
                disabled={cancelMut.isPending}
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Customer ID"
              value={<span className="font-mono text-xs">{sub.customerId}</span>}
            />
            <InfoRow
              label="Amount"
              value={<strong>{formatAmount(Number(sub.amount), sub.currency)}</strong>}
            />
            <InfoRow
              label="Billing cycle"
              value={intervalLabel(sub.intervalType, sub.intervalValue)}
            />
            <InfoRow
              label="Next billing"
              value={sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleString() : null}
            />
            <InfoRow
              label="Current period"
              value={
                sub.currentPeriodStart && sub.currentPeriodEnd
                  ? `${new Date(sub.currentPeriodStart).toLocaleDateString()} – ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                  : null
              }
            />
            {sub.trialEndDate && (
              <InfoRow label="Trial ends" value={new Date(sub.trialEndDate).toLocaleDateString()} />
            )}
            <InfoRow label="Retry count" value={`${sub.retryCount} / ${sub.maxRetries}`} />
            <InfoRow
              label="Payment link"
              value={
                sub.paymentLinkId ? (
                  <span className="font-mono text-xs">{sub.paymentLinkId}</span>
                ) : null
              }
            />
            <InfoRow label="Created" value={new Date(sub.createdAt).toLocaleString()} />
            <InfoRow label="Updated" value={new Date(sub.updatedAt).toLocaleString()} />
          </CardContent>
        </Card>

        {/* Billing events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing Events</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!sub.billingEvents.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No billing events yet.
              </div>
            ) : (
              <div className="divide-y">
                {sub.billingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex flex-col sm:flex-row sm:items-start sm:justify-between px-4 py-4 gap-2"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {ev.status === "CHARGED" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary">
                            CHARGED
                          </span>
                        ) : ev.status === "DECLINED" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/15 text-destructive">
                            DECLINED
                          </span>
                        ) : ev.status === "REFUNDED" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            REFUNDED
                          </span>
                        ) : (
                          <StatusBadge status={ev.status} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {formatAmount(Number(ev.amount), ev.currency)} — Attempt #
                          {ev.attemptNumber}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Period:{" "}
                          {ev.billingPeriodStart
                            ? new Date(ev.billingPeriodStart).toLocaleDateString()
                            : "—"}{" "}
                          –{" "}
                          {ev.billingPeriodEnd
                            ? new Date(ev.billingPeriodEnd).toLocaleDateString()
                            : "—"}
                        </p>
                        {ev.vpsTransactionId && (
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            VPS TX: {ev.vpsTransactionId}
                          </p>
                        )}
                        {ev.errorMessage && (
                          <p className="text-xs text-red-600 mt-0.5">{ev.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                      {ev.processedAt ? new Date(ev.processedAt).toLocaleString() : "Pending"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Cancel confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              No future charges will be made to the customer&apos;s payment method. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelMut.mutate()}
            >
              {cancelMut.isPending ? "Cancelling…" : "Cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

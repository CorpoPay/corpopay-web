import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, RefreshCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { components } from "@/lib/api-types";
import { client, getErrorMessage } from "@/lib/client";
import { toMoney } from "@/lib/money";
import { toast } from "@/lib/use-toast";
import { formatAmount, formatDate } from "@/lib/utils";

type TransactionDetail = Omit<components["schemas"]["TransactionDetail"], "amount"> & {
  amount: number | string | null;
};

const timelineIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  SUCCEEDED: CheckCircle2,
  PAYMENT_SUCCEEDED: CheckCircle2,
  FAILED: XCircle,
  PAYMENT_FAILED: XCircle,
  CANCELED: XCircle,
  PAYMENT_CANCELED: XCircle,
  REFUND_INITIATED: RefreshCcw,
};

async function fetchTransaction(id: string): Promise<TransactionDetail> {
  const { data, error } = await client.GET("/transactions/{id}", {
    params: { path: { id } },
  });
  if (error || !data) throw error;
  return { ...data, amount: toMoney(data.amount) };
}

async function issueRefund(id: string) {
  const { error } = await client.POST("/transactions/{id}/refund", {
    params: { path: { id } },
  });
  if (error) throw error;
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const qc = useQueryClient();
  const [refundOpen, setRefundOpen] = useState(false);

  const {
    data: tx,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => fetchTransaction(id),
    enabled: !!id,
  });

  const refundMutation = useMutation({
    mutationFn: () => issueRefund(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transaction", id] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setRefundOpen(false);
      toast.success("Refund initiated", "The refund has been submitted for processing.");
    },
    onError: (e) =>
      toast.error("Refund failed", getErrorMessage(e) || "Please try again or contact support."),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <p className="text-sm text-muted-foreground py-20 text-center">Loading…</p>
      </DashboardLayout>
    );
  }

  if (isError || !tx) {
    return (
      <DashboardLayout>
        <p className="text-sm text-destructive py-20 text-center">Transaction not found.</p>
      </DashboardLayout>
    );
  }

  const providerTxId = tx.providerTxs?.[0]?.providerTransactionId;
  const paymentLinkLabel = tx.paymentLink
    ? tx.paymentLink.description || tx.paymentLink.reference
    : null;
  const canRefund = tx.status === "SUCCEEDED";
  const alreadyRefunded = (tx.refunds ?? []).some((r) => r.status === "SUCCEEDED");

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/dashboard/transactions"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to transactions
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transaction</h1>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">{tx.id}</p>
          </div>
          <StatusBadge status={tx.status} className="text-sm px-3 py-1" />
        </div>

        {/* Summary card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-semibold tabular-nums">
                  {tx.amount != null ? formatAmount(tx.amount, tx.currency ?? "MAD") : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-medium">{tx.provider}</dd>
              </div>
              {providerTxId && (
                <div>
                  <dt className="text-muted-foreground">Provider TX ID</dt>
                  <dd className="font-mono text-xs">{providerTxId}</dd>
                </div>
              )}
              {tx.providerRef && (
                <div>
                  <dt className="text-muted-foreground">Provider Ref</dt>
                  <dd className="font-mono text-xs">{tx.providerRef}</dd>
                </div>
              )}
              {paymentLinkLabel && (
                <div>
                  <dt className="text-muted-foreground">Payment Link</dt>
                  <dd>
                    <Link
                      href={`/dashboard/payment-links`}
                      className="text-primary hover:underline"
                    >
                      {paymentLinkLabel}
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(tx.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last updated</dt>
                <dd>{formatDate(tx.updatedAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Timeline */}
        {tx.timeline && tx.timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative border-l border-border ml-3">
                {tx.timeline.map((event, i) => {
                  const Icon = timelineIcon[event.type] ?? Clock;
                  return (
                    <li key={i} className="mb-6 ml-5 last:mb-0">
                      <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background border">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                      </span>
                      <p className="text-sm font-medium">{event.type}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(event.timestamp)}</p>
                      {event.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5">{event.detail}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Refunds */}
        {tx.refunds && tx.refunds.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Refunds</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {tx.refunds.map((refund) => (
                <div key={refund.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-mono text-muted-foreground text-xs">
                      {refund.id.slice(0, 16)}…
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(refund.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={refund.status} />
                    <span className="text-sm font-semibold">
                      {formatAmount(refund.amount, tx.currency ?? "MAD")}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Refund action */}
        {canRefund && !alreadyRefunded && (
          <>
            <Separator />
            <div className="flex justify-end">
              <Button variant="destructive" size="sm" onClick={() => setRefundOpen(true)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Issue Refund
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Refund confirm dialog */}
      <AlertDialog open={refundOpen} onOpenChange={setRefundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue full refund?</AlertDialogTitle>
            <AlertDialogDescription>
              This will refund{" "}
              {tx.amount != null ? formatAmount(tx.amount, tx.currency ?? "MAD") : "the amount"} to
              the customer via {tx.provider}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => refundMutation.mutate()}
            >
              {refundMutation.isPending ? "Processing…" : "Confirm Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pause, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { components } from "@/lib/api-types";
import { client } from "@/lib/client";
import { toast } from "@/lib/use-toast";
import { formatAmount } from "@/lib/utils";

type Subscription = components["schemas"]["SubscriptionListItem"];

type SubscriptionsResponse = {
  data: Subscription[];
  total: number;
  page: number;
  limit: number;
};

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

export default function SubscriptionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SubscriptionsResponse>({
    queryKey: ["subscriptions", page, status],
    queryFn: async () => {
      const { data, error } = await client.GET("/subscriptions", {
        params: {
          query: { page: String(page), limit: "20", ...(status ? { status } : {}) },
        },
      });
      if (error) throw error;
      return data ?? { data: [], total: 0, page: 1, limit: 20 };
    },
  });

  const pauseMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.POST("/subscriptions/{id}/pause", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription paused");
    },
    onError: () => toast.error("Failed to pause subscription"),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.DELETE("/subscriptions/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      setCancelTarget(null);
      toast.success("Subscription cancelled", "No future charges will be made.");
    },
    onError: () => toast.error("Failed to cancel subscription"),
  });

  const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "All statuses" },
    { value: "ACTIVE", label: "Active" },
    { value: "PAUSED", label: "Paused" },
    { value: "PAST_DUE", label: "Past due" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "EXPIRED", label: "Expired" },
  ];

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <RefreshCw className="h-6 w-6 text-primary" />
              Subscriptions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage recurring billing subscriptions for your customers.
            </p>
          </div>
        </div>

        {/* Status filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setStatus(value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    status === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-muted bg-muted/30 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <TableCard
          title={data ? `${data.total} subscription${data.total !== 1 ? "s" : ""}` : undefined}
        >
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !data?.data.length ? (
            <EmptyState
              icon={RefreshCw}
              title="No subscriptions"
              description={
                status
                  ? `No ${status.toLowerCase()} subscriptions found.`
                  : "No recurring subscriptions yet."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-mono text-xs">
                      {sub.customerId.slice(0, 16)}…
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(Number(sub.amount), sub.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {intervalLabel(sub.intervalType, sub.intervalValue)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={sub.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.nextBillingDate
                        ? new Date(sub.nextBillingDate).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{sub.retryCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild title="View details">
                          <Link href={`/dashboard/subscriptions/${sub.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {(sub.status === "ACTIVE" || sub.status === "PAST_DUE") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Pause subscription"
                            onClick={() => pauseMut.mutate(sub.id)}
                            disabled={pauseMut.isPending}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {sub.status !== "CANCELLED" && sub.status !== "EXPIRED" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cancel subscription"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setCancelTarget(sub.id)}
                            disabled={cancelMut.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>

        <Pagination
          page={page - 1}
          totalPages={totalPages}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      </div>

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              No future charges will be made. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelTarget && cancelMut.mutate(cancelTarget)}
            >
              {cancelMut.isPending ? "Cancelling…" : "Cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

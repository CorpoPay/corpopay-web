import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Plus, RefreshCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FormField } from "@/components/shared/FormField";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonRow } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { components } from "@/lib/api-types";
import { client, getErrorMessage } from "@/lib/client";
import { toast } from "@/lib/use-toast";
import { formatAmount, formatDate } from "@/lib/utils";

type Payout = components["schemas"]["Payout"];
type Provider = "VPS" | "STRIPE" | "PAYPAL" | "ADYEN";

const PROVIDERS: Provider[] = ["VPS", "STRIPE", "PAYPAL", "ADYEN"];
const TERMINAL_STATUSES = ["PAID", "FAILED", "CANCELLED"];

async function fetchPayouts(): Promise<Payout[]> {
  const { data, error } = await client.GET("/payouts");
  if (error || !data) throw error;
  return data;
}

async function createPayout(body: { idempotencyKey: string; provider: Provider }): Promise<void> {
  const { error } = await client.POST("/payouts", { body });
  if (error) throw error;
}

async function processPayout(id: string): Promise<void> {
  const { error } = await client.POST("/payouts/{id}/process", {
    params: { path: { id } },
  });
  if (error) throw error;
}

async function cancelPayout(id: string): Promise<void> {
  const { error } = await client.POST("/payouts/{id}/cancel", {
    params: { path: { id } },
  });
  if (error) throw error;
}

export default function PayoutsPage() {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<Provider>("VPS");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Payout | null>(null);

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["payouts"],
    queryFn: fetchPayouts,
  });

  const createMutation = useMutation({
    mutationFn: () => createPayout({ idempotencyKey, provider }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payouts"] });
      toast.success("Payout created", "Eligible funds were snapshotted into a payout.");
      setIdempotencyKey("");
    },
    onError: (e) => toast.error("Create failed", getErrorMessage(e) || "Please try again."),
  });

  const processMutation = useMutation({
    mutationFn: processPayout,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payouts"] });
      toast.success("Payout processing", "The payout has been dispatched to the provider.");
    },
    onError: (e) => toast.error("Process failed", getErrorMessage(e) || "Please try again."),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPayout,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payouts"] });
      setCancelTarget(null);
      toast.success("Payout cancelled", "The payout has been cancelled.");
    },
    onError: (e) => toast.error("Cancel failed", getErrorMessage(e) || "Please try again."),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Snapshot eligible funds and disburse them via a provider.
          </p>
        </div>

        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Payout</CardTitle>
            <CardDescription>Snapshots the tenant&apos;s currently eligible funds.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Provider">
                <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Idempotency Key">
                <Input
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  placeholder="e.g. payout-2026-09-01"
                />
              </FormField>
            </div>
            <Button
              className="mt-4"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !idempotencyKey}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating…" : "Create Payout"}
            </Button>
          </CardContent>
        </Card>

        {/* List table */}
        <TableCard title="Payouts">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="py-0 px-6">
                      <SkeletonRow />
                    </TableCell>
                  </TableRow>
                ))
              ) : !payouts?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No payouts yet.
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((p) => {
                  const canProcess = p.status === "DRAFT" || p.status === "SCHEDULED";
                  const canCancel = !TERMINAL_STATUSES.includes(p.status);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {p.id.slice(0, 12)}…
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-sm">{p.provider}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-sm">
                        {formatAmount(p.amountCents / 100, p.currency ?? "MAD")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatAmount(p.feeCents / 100, p.currency ?? "MAD")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(p.createdAt)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canProcess && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => processMutation.mutate(p.id)}
                              disabled={processMutation.isPending}
                            >
                              <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                              Process
                            </Button>
                          )}
                          {canCancel && (
                            <Button variant="outline" size="sm" onClick={() => setCancelTarget(p)}>
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          )}
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                            <Link href={`/dashboard/payouts/${p.id}`}>
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>

      {/* Cancel confirm */}
      <AlertDialog open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this payout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the payout
              {cancelTarget
                ? ` of ${formatAmount(cancelTarget.amountCents / 100, cancelTarget.currency ?? "MAD")}`
                : ""}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Confirm Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

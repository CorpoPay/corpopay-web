import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
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

type Dispute = components["schemas"]["Dispute"];

async function fetchDisputes(): Promise<Dispute[]> {
  const { data, error } = await client.GET("/disputes");
  if (error || !data) throw error;
  return data;
}

async function resolveDispute(id: string, outcome: "WON" | "LOST"): Promise<void> {
  const { error } = await client.POST("/disputes/{id}/resolve", {
    params: { path: { id } },
    body: { outcome },
  });
  if (error) throw error;
}

export default function DisputesPage() {
  const qc = useQueryClient();
  const [resolveTarget, setResolveTarget] = useState<{
    dispute: Dispute;
    outcome: "WON" | "LOST";
  } | null>(null);

  const { data: disputes, isLoading } = useQuery({
    queryKey: ["disputes"],
    queryFn: fetchDisputes,
  });

  const resolveMutation = useMutation({
    mutationFn: (vars: { id: string; outcome: "WON" | "LOST" }) =>
      resolveDispute(vars.id, vars.outcome),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disputes"] });
      setResolveTarget(null);
      toast.success("Dispute resolved", "The dispute outcome has been recorded.");
    },
    onError: (e) => toast.error("Resolve failed", getErrorMessage(e) || "Please try again."),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Disputes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inbound chargebacks and disputes from providers.
          </p>
        </div>

        <TableCard title="Disputes">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Provider Dispute ID</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead>Recovery</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="py-0 px-6">
                      <SkeletonRow />
                    </TableCell>
                  </TableRow>
                ))
              ) : !disputes?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    No disputes yet.
                  </TableCell>
                </TableRow>
              ) : (
                disputes.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-sm">{d.provider}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.providerDisputeId}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {formatAmount(d.amountCents / 100, d.currency ?? "MAD")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatAmount(d.feeCents / 100, d.currency ?? "MAD")}
                    </TableCell>
                    <TableCell>
                      {d.recovery ? (
                        <StatusBadge status={d.recovery.status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(d.createdAt)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {d.status === "OPEN" ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResolveTarget({ dispute: d, outcome: "WON" })}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                            Won
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResolveTarget({ dispute: d, outcome: "LOST" })}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5 text-destructive" />
                            Lost
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>

      {/* Resolve confirm */}
      <AlertDialog open={resolveTarget !== null} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark dispute as {resolveTarget?.outcome === "LOST" ? "lost" : "won"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This records the dispute outcome
              {resolveTarget
                ? ` for ${formatAmount(resolveTarget.dispute.amountCents / 100, resolveTarget.dispute.currency ?? "MAD")}`
                : ""}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              className={
                resolveTarget?.outcome === "LOST"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={() =>
                resolveTarget &&
                resolveMutation.mutate({
                  id: resolveTarget.dispute.id,
                  outcome: resolveTarget.outcome,
                })
              }
            >
              {resolveMutation.isPending ? "Resolving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

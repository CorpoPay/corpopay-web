import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FormField } from "@/components/shared/FormField";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type SettlementStatement = components["schemas"]["SettlementStatement"];

async function fetchStatements(): Promise<SettlementStatement[]> {
  const { data, error } = await client.GET("/settlement-statements");
  if (error || !data) throw error;
  return data;
}

export default function StatementsPage() {
  const qc = useQueryClient();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [currency, setCurrency] = useState("");

  const { data: statements, isLoading } = useQuery({
    queryKey: ["statements"],
    queryFn: fetchStatements,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: {
        periodStart: string | null;
        periodEnd: string | null;
        currency?: string | null;
      } = {
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        ...(currency ? { currency } : {}),
      };
      const { error } = await client.POST("/settlement-statements", { body });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["statements"] });
      toast.success("Statement created", "The settlement statement has been generated.");
      setPeriodStart("");
      setPeriodEnd("");
      setCurrency("");
    },
    onError: (e) => toast.error("Create failed", getErrorMessage(e) || "Please try again."),
  });

  const finalizeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.POST("/settlement-statements/{id}/finalize", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["statements"] });
      toast.success("Statement finalized", "The settlement statement has been finalized.");
    },
    onError: (e) => toast.error("Finalize failed", getErrorMessage(e) || "Please try again."),
  });

  const voidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.POST("/settlement-statements/{id}/void", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["statements"] });
      toast.success("Statement voided", "The settlement statement has been voided.");
    },
    onError: (e) => toast.error("Void failed", getErrorMessage(e) || "Please try again."),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Periodic settlement statements for the tenant.
          </p>
        </div>

        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Settlement Statement</CardTitle>
            <CardDescription>Generate a statement over a date period.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Period Start">
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </FormField>
              <FormField label="Period End">
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </FormField>
              <FormField label="Currency">
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="MAD"
                />
              </FormField>
            </div>
            <Button
              className="mt-4"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating…" : "Create Statement"}
            </Button>
          </CardContent>
        </Card>

        {/* List table */}
        <TableCard title="Statements">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Closing</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Finalized At</TableHead>
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
              ) : !statements?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No statements yet.
                  </TableCell>
                </TableRow>
              ) : (
                statements.map((s) => {
                  const canFinalize = s.status === "DRAFT";
                  const canVoid = s.status !== "VOID" && s.status !== "FINALIZED";
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatAmount(s.openingBalanceCents / 100, s.currency ?? "MAD")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatAmount(s.closingBalanceCents / 100, s.currency ?? "MAD")}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-sm">
                        {formatAmount(s.netCents / 100, s.currency ?? "MAD")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {s.finalizedAt ? formatDate(s.finalizedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canFinalize && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => finalizeMutation.mutate(s.id)}
                              disabled={finalizeMutation.isPending}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                              Finalize
                            </Button>
                          )}
                          {canVoid && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => voidMutation.mutate(s.id)}
                              disabled={voidMutation.isPending}
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5 text-destructive" />
                              Void
                            </Button>
                          )}
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
    </DashboardLayout>
  );
}

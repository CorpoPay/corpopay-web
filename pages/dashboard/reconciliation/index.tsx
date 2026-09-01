import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Plus, RefreshCcw } from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FormField } from "@/components/shared/FormField";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate } from "@/lib/utils";

type ReconciliationReport = components["schemas"]["ReconciliationReport"];
type Provider = "VPS" | "STRIPE" | "PAYPAL" | "ADYEN";

const PROVIDERS: Provider[] = ["VPS", "STRIPE", "PAYPAL", "ADYEN"];

async function fetchReports(): Promise<ReconciliationReport[]> {
  const { data, error } = await client.GET("/reconciliation-reports");
  if (error || !data) throw error;
  return data;
}

function parseLines(text: string): { reference: string; amountCents: number }[] {
  const out: { reference: string; amountCents: number }[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [reference, amount] = line.split(",").map((s) => s.trim());
    if (!reference || amount == null || Number.isNaN(Number(amount))) continue;
    out.push({ reference, amountCents: Number(amount) });
  }
  return out;
}

export default function ReconciliationPage() {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<Provider>("VPS");
  const [linesText, setLinesText] = useState("");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reconciliation-reports"],
    queryFn: fetchReports,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: {
        provider: Provider;
        lines: { reference: string; amountCents: number }[];
      } = { provider, lines: parseLines(linesText) };
      const { error } = await client.POST("/reconciliation-reports", { body });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation-reports"] });
      toast.success("Report created", "The reconciliation report has been uploaded.");
      setLinesText("");
    },
    onError: (e) => toast.error("Create failed", getErrorMessage(e) || "Please try again."),
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.POST("/reconciliation-reports/{id}/run", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation-reports"] });
      toast.success("Report running", "The reconciliation has been matched against the ledger.");
    },
    onError: (e) => toast.error("Run failed", getErrorMessage(e) || "Please try again."),
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.POST("/reconciliation-reports/{id}/resolve", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation-reports"] });
      toast.success("Report resolved", "Differences have been resolved.");
    },
    onError: (e) => toast.error("Resolve failed", getErrorMessage(e) || "Please try again."),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reconciliation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload provider statements and reconcile against the ledger.
          </p>
        </div>

        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Reconciliation Report</CardTitle>
            <CardDescription>
              Upload external lines to match against internal entries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <FormField label="Provider" className="sm:max-w-xs">
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
              <FormField
                label="Lines"
                hint="One per line: reference,amountCents (e.g. EXT-123,125000)"
              >
                <textarea
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={linesText}
                  onChange={(e) => setLinesText(e.target.value)}
                  placeholder={"EXT-123,125000\nEXT-124,99000"}
                />
              </FormField>
            </div>
            <Button
              className="mt-4"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !linesText.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating…" : "Create Report"}
            </Button>
          </CardContent>
        </Card>

        {/* List table */}
        <TableCard title="Reports">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Lines</TableHead>
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
              ) : !reports?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No reconciliation reports yet.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((r) => {
                  const canRun = r.status === "DRAFT";
                  const canResolve = r.status !== "DRAFT" && r.status !== "RESOLVED";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.provider}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-sm">{r.currency}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.periodStart && r.periodEnd
                          ? `${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {r.lines?.length ?? 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canRun && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => runMutation.mutate(r.id)}
                              disabled={runMutation.isPending}
                            >
                              <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                              Run
                            </Button>
                          )}
                          {canResolve && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resolveMutation.mutate(r.id)}
                              disabled={resolveMutation.isPending}
                            >
                              <ListChecks className="mr-1 h-3.5 w-3.5" />
                              Resolve
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

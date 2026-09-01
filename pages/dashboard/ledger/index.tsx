import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableCard } from "@/components/shared/TableCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { client } from "@/lib/client";
import { toMoney } from "@/lib/money";
import { cn, formatAmount, formatDate } from "@/lib/utils";

type LedgerResponse = components["schemas"]["LedgerResponse"];

async function fetchLedger(): Promise<LedgerResponse> {
  const { data, error } = await client.GET("/ledger");
  if (error || !data) throw error;
  return data;
}

function formatMoney(value: unknown, currency = "MAD"): string {
  const narrowed = toMoney(value);
  return narrowed == null ? "—" : formatAmount(narrowed, currency);
}

export default function LedgerPage() {
  const { data: ledger, isLoading } = useQuery({
    queryKey: ["ledger"],
    queryFn: fetchLedger,
  });

  const balances = ledger ? Object.entries(ledger.balances) : [];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Settlement balances and journal entries.
          </p>
        </div>

        {ledger && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium",
              ledger.balanced
                ? "border-border bg-muted/40 text-foreground"
                : "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {ledger.balanced ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {ledger.balanced ? "Ledger is balanced" : "Ledger is out of balance"}
          </div>
        )}

        {/* Balance cards */}
        {balances.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map(([account, value]) => (
              <Card key={account}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {account}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold tabular-nums">{formatMoney(value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Entries table */}
        <TableCard title="Entries">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="py-0 px-6">
                      <SkeletonRow />
                    </TableCell>
                  </TableRow>
                ))
              ) : !ledger?.entries?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No ledger entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                ledger.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm font-medium">{entry.account}</TableCell>
                    <TableCell className="text-sm">{entry.direction}</TableCell>
                    <TableCell className="text-sm">{entry.category}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {formatMoney(entry.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatMoney(entry.balanceAfter)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </DashboardLayout>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FormField } from "@/components/shared/FormField";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
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
import { cn, formatAmount, formatDate } from "@/lib/utils";

type WalletDetail = components["schemas"]["WalletDetail"];
type WalletTransaction = components["schemas"]["WalletTransaction"];
type Action = "topup" | "debit" | "refund" | "adjust";

const ACTIONS: { value: Action; label: string }[] = [
  { value: "topup", label: "Top up" },
  { value: "debit", label: "Debit (draw down)" },
  { value: "refund", label: "Refund" },
  { value: "adjust", label: "Adjust" },
];

async function fetchWallet(id: string): Promise<WalletDetail> {
  const { data, error } = await client.GET("/wallets/{id}", {
    params: { path: { id } },
  });
  if (error || !data) throw error;
  return data;
}

async function applyAction(id: string, action: Action, amountCents: number): Promise<void> {
  const params = { params: { path: { id } } } as const;
  const body = { amountCents };
  if (action === "topup") {
    const { error } = await client.POST("/wallets/{id}/topup", { ...params, body });
    if (error) throw error;
  } else if (action === "debit") {
    const { error } = await client.POST("/wallets/{id}/debit", { ...params, body });
    if (error) throw error;
  } else if (action === "refund") {
    const { error } = await client.POST("/wallets/{id}/refund", { ...params, body });
    if (error) throw error;
  } else {
    const { error } = await client.POST("/wallets/{id}/adjust", { ...params, body });
    if (error) throw error;
  }
}

function signedAmount(value: number, currency: string, credit: boolean): string {
  const sign = credit ? "+" : "";
  return `${sign}${formatAmount(value, currency)}`;
}

function TransactionRow({ tx, currency }: { tx: WalletTransaction; currency: string }) {
  const credit = tx.amountCents >= 0;
  return (
    <TableRow>
      <TableCell className="text-sm font-medium">{tx.type}</TableCell>
      <TableCell
        className={cn(
          "text-right font-semibold tabular-nums text-sm",
          credit ? "text-emerald-600" : "text-destructive",
        )}
      >
        {signedAmount(tx.amountCents / 100, currency, credit)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {formatAmount(tx.balanceAfterCents / 100, currency)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {tx.sourceType ? (
          <span className="font-mono text-xs">
            {tx.sourceType}
            {tx.sourceId ? ` · ${tx.sourceId}` : ""}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(tx.createdAt)}
      </TableCell>
    </TableRow>
  );
}

export default function WalletDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = router.query as { id: string };

  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<Action>("topup");

  const {
    data: wallet,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["wallet", id],
    queryFn: () => fetchWallet(id),
    enabled: !!id,
  });

  const actionMutation = useMutation({
    mutationFn: () => {
      const mad = Number(amount);
      if (!Number.isFinite(mad) || mad === 0) throw new Error("Enter a valid non-zero amount.");
      if (action !== "adjust" && mad <= 0) throw new Error("Amount must be greater than 0.");
      return applyAction(id, action, Math.round(mad * 100));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet", id] });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Wallet updated", `Applied ${action} to the wallet.`);
      setAmount("");
    },
    onError: (e) => toast.error("Action failed", getErrorMessage(e) || "Please try again."),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <p className="text-sm text-muted-foreground py-20 text-center">Loading…</p>
      </DashboardLayout>
    );
  }

  if (isError || !wallet) {
    return (
      <DashboardLayout>
        <p className="text-sm text-destructive py-20 text-center">Wallet not found.</p>
      </DashboardLayout>
    );
  }

  const currency = wallet.currency ?? "MAD";

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/dashboard/wallets"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to wallets
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">{wallet.id}</p>
          </div>
          <StatusBadge status={wallet.status} className="text-sm px-3 py-1" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Balance</dt>
                <dd className="font-semibold tabular-nums text-lg">
                  {formatAmount(wallet.balanceCents / 100, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="font-medium">{currency}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="font-medium">
                  {wallet.ownerType === "CUSTOMER" ? "Customer" : "Tenant"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Owner ID</dt>
                <dd className="font-mono text-xs">{wallet.ownerId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(wallet.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last updated</dt>
                <dd>{formatDate(wallet.updatedAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wallet action</CardTitle>
            <CardDescription>
              Move money on this wallet. Debit draws down stored value (CorpoPay takes its
              commission via your fee schedule); adjust accepts a negative amount.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Action">
                <Select value={action} onValueChange={(v) => setAction(v as Action)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Amount (MAD)"
                hint={action === "adjust" ? "Negative value = debit" : "Positive amount"}
              >
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={action === "adjust" ? "e.g. -50" : "e.g. 100.50"}
                />
              </FormField>
            </div>
            <Button
              className="mt-4"
              onClick={() => actionMutation.mutate()}
              disabled={actionMutation.isPending || !amount.trim()}
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              {actionMutation.isPending ? "Applying…" : "Apply"}
            </Button>
          </CardContent>
        </Card>

        {/* Transactions */}
        <TableCard title="Transactions">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!wallet.transactions?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              ) : (
                wallet.transactions.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} currency={currency} />
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </DashboardLayout>
  );
}

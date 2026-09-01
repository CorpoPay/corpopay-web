import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatAmount, formatDate } from "@/lib/utils";

type Payout = components["schemas"]["Payout"];

async function fetchPayout(id: string): Promise<Payout> {
  const { data, error } = await client.GET("/payouts/{id}", {
    params: { path: { id } },
  });
  if (error || !data) throw error;
  return data;
}

export default function PayoutDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const {
    data: payout,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["payout", id],
    queryFn: () => fetchPayout(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <p className="text-sm text-muted-foreground py-20 text-center">Loading…</p>
      </DashboardLayout>
    );
  }

  if (isError || !payout) {
    return (
      <DashboardLayout>
        <p className="text-sm text-destructive py-20 text-center">Payout not found.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/dashboard/payouts"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to payouts
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payout</h1>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">{payout.id}</p>
          </div>
          <StatusBadge status={payout.status} className="text-sm px-3 py-1" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-semibold tabular-nums">
                  {formatAmount(payout.amountCents / 100, payout.currency ?? "MAD")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fee</dt>
                <dd className="font-medium tabular-nums">
                  {formatAmount(payout.feeCents / 100, payout.currency ?? "MAD")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-medium">{payout.provider}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Method</dt>
                <dd className="font-medium">{payout.method}</dd>
              </div>
              {payout.providerTransferId && (
                <div>
                  <dt className="text-muted-foreground">Provider Transfer ID</dt>
                  <dd className="font-mono text-xs">{payout.providerTransferId}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Idempotency Key</dt>
                <dd className="font-mono text-xs">{payout.idempotencyKey}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(payout.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last updated</dt>
                <dd>{formatDate(payout.updatedAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <TableCard title="Items">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ledger Entry ID</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!payout.items?.length ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-10">
                    No items.
                  </TableCell>
                </TableRow>
              ) : (
                payout.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.ledgerEntryId}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {formatAmount(item.amountCents / 100, payout.currency ?? "MAD")}
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

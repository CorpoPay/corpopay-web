import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import { SkeletonRow } from "@/components/shared/SkeletonRow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { client } from "@/lib/client";
import { formatAmount, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";

interface SearchResult {
  id: string;
  status: string;
  provider: string;
  providerRef: string | null;
  correlationId: string;
  createdAt: string;
  paymentLink: {
    slug: string;
    amount: number | string;
    currency: string;
    description: string;
    reference: string;
  } | null;
}

interface SearchResponse {
  found: boolean;
  intent: SearchResult | null;
}

export default function AdminPaymentsSearchPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-payment-search", submitted],
    queryFn: async () => {
      if (!submitted) return { found: false, intent: null };
      const { data, error } = await client.GET("/admin/payments/search", {
        params: { query: { q: submitted } },
      });
      if (error) throw error;
      return data ?? { found: false, intent: null };
    },
    enabled: !!submitted,
  });

  function handleSearch() {
    if (query.trim()) setSubmitted(query.trim());
  }

  const intent = data?.intent;
  const label = intent?.paymentLink?.description || intent?.paymentLink?.reference || null;

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Search</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search across all tenants by transaction ID, payment intent ID, or payment link slug.
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Transaction ID, intent ID, or link slug…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={!query.trim()}>
            Search
          </Button>
        </div>

        {/* Results */}
        {submitted && (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Correlation ID</TableHead>
                  <TableHead>Link / Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <SkeletonRow cols={8} rows={4} />
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-destructive py-10">
                      Search failed.
                    </TableCell>
                  </TableRow>
                ) : !intent ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No results for &quot;{submitted}&quot;.
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={intent.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {intent.id.slice(0, 14)}…
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {intent.correlationId.slice(0, 14)}…
                    </TableCell>
                    <TableCell className="text-sm">{label ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={intent.status} />
                    </TableCell>
                    <TableCell className="text-sm">{intent.provider}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {intent.paymentLink
                        ? formatAmount(intent.paymentLink.amount, intent.paymentLink.currency)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(intent.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <Link href={`/dashboard/transactions/${intent.id}`} target="_blank">
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </div>
    </AdminLayout>
  );
}

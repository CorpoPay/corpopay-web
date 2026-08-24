import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonRow } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SearchInput } from "@/components/shared/SearchInput";
import { TableCard } from "@/components/shared/TableCard";
import { Pagination } from "@/components/shared/Pagination";
import { toast } from "@/lib/use-toast";
import { client } from "@/lib/client";
import { formatAmount, formatDate } from "@/lib/utils";
import { toMoney } from "@/lib/money";
import type { components } from "@/lib/api-types";
import Link from "next/link";
import { Download, ArrowUpRight } from "lucide-react";

type Transaction = Omit<components["schemas"]["Transaction"], "amount"> & {
  amount: number | string | null;
};

interface TransactionsResponse {
  data: Transaction[];
  total: number;
}

const PAGE_SIZE = 25;
const STATUS_OPTIONS = [
  "ALL",
  "CREATED",
  "REQUIRES_ACTION",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
  "REFUNDED",
];
const PROVIDER_OPTIONS = ["ALL", "NAPS", "VPS"];

async function fetchTransactions(
  page: number,
  status: string,
  provider: string,
  search: string,
): Promise<TransactionsResponse> {
  const { data, error } = await client.GET("/transactions", {
    params: {
      query: {
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        ...(status !== "ALL" ? { status } : {}),
        ...(provider !== "ALL" ? { provider } : {}),
        ...(search ? { search } : {}),
      },
    },
  });
  if (error) throw error;
  return {
    data: (data?.data ?? []).map((tx) => ({ ...tx, amount: toMoney(tx.amount) })),
    total: data?.total ?? 0,
  };
}

async function exportCsv(status: string, provider: string) {
  const { data, error } = await client.GET("/exports/transactions.csv", {
    params: {
      query: {
        ...(status !== "ALL" ? { status } : {}),
        ...(provider !== "ALL" ? { provider } : {}),
      },
    },
  });
  if (error) throw error;
  const blob = new Blob([data ?? ""], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("ALL");
  const [provider, setProvider] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  // Debounce search
  let debounceTimer: ReturnType<typeof setTimeout>;
  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => setDebouncedSearch(val), 400);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", page, status, provider, debouncedSearch],
    queryFn: () => fetchTransactions(page, status, provider, debouncedSearch),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  async function handleExport() {
    setExporting(true);
    try {
      await exportCsv(status, provider);
      toast.success("Export complete", "Your CSV file has been downloaded.");
    } catch {
      toast.error("Export failed", "Could not export transactions. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.total !== undefined ? `${data.total} total` : "Loading…"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <SearchInput
            placeholder="Search by ID or reference…"
            value={search}
            onChange={(v) => handleSearchChange(v)}
            containerClassName="flex-1 min-w-[200px]"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All statuses" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p === "ALL" ? "All providers" : p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Link / Reference</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
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
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tx.id.slice(0, 12)}…
                    </TableCell>
                    <TableCell className="text-sm">{tx.paymentLink?.title ?? "—"}</TableCell>
                    <TableCell className="text-sm">{tx.provider}</TableCell>
                    <TableCell>
                      <StatusBadge status={tx.status} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {tx.amount != null ? formatAmount(tx.amount, tx.currency ?? "MAD") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <Link href={`/dashboard/transactions/${tx.id}`}>
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      </div>
    </DashboardLayout>
  );
}

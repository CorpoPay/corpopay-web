import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Pagination } from "@/components/shared/Pagination";
import { SkeletonRow } from "@/components/shared/SkeletonRow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
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
import { client } from "@/lib/client";
import { formatAmount, formatDate } from "@/lib/utils";

interface AdminStatementItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  status: string;
  openingBalanceCents: number;
  closingBalanceCents: number;
  netCents: number;
  finalizedAt: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface StatementsResponse {
  data: AdminStatementItem[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["ALL", "DRAFT", "FINALIZED", "VOID"];

async function fetchStatements(page: number, status: string): Promise<StatementsResponse> {
  const { data, error } = await client.GET("/admin/settlement-statements", {
    params: {
      query: {
        limit: String(PAGE_SIZE),
        page: String(page + 1),
        ...(status !== "ALL" ? { status } : {}),
      },
    },
  });
  if (error) throw error;
  return data ?? { data: [], total: 0, page: 1, limit: PAGE_SIZE };
}

export default function AdminStatementsPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-statements", page, status],
    queryFn: () => fetchStatements(page, status),
  });

  const statements = data?.data ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settlement Statements</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.total !== undefined ? `${data.total} total` : "Loading…"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
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
        </div>

        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Finalized</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRow cols={6} rows={5} />
              ) : statements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No statements found.
                  </TableCell>
                </TableRow>
              ) : (
                statements.map((statement) => (
                  <TableRow key={statement.id}>
                    <TableCell>
                      <div className="font-medium">{statement.tenantName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {statement.tenantSlug}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(statement.periodStart)} – {formatDate(statement.periodEnd)}
                    </TableCell>
                    <TableCell className="text-sm">{statement.currency}</TableCell>
                    <TableCell>
                      <StatusBadge status={statement.status} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {formatAmount(statement.netCents / 100, statement.currency ?? "MAD")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {statement.finalizedAt ? formatDate(statement.finalizedAt) : "—"}
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
    </AdminLayout>
  );
}

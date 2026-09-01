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
import { formatDate } from "@/lib/utils";

interface AdminReconciliationItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  provider: string;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  summary: Record<string, unknown> | null;
  lineCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ReconciliationResponse {
  data: AdminReconciliationItem[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["ALL", "PENDING", "MATCHED", "UNMATCHED", "RESOLVED"];

async function fetchReconciliation(page: number, status: string): Promise<ReconciliationResponse> {
  const { data, error } = await client.GET("/admin/reconciliation-reports", {
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

export default function AdminReconciliationPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reconciliation", page, status],
    queryFn: () => fetchReconciliation(page, status),
  });

  const reports = data?.data ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reconciliation</h1>
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
                <TableHead>Provider</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRow cols={6} rows={5} />
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No reconciliation reports found.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="font-medium">{report.tenantName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {report.tenantSlug}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{report.provider}</TableCell>
                    <TableCell className="text-sm">{report.currency}</TableCell>
                    <TableCell>
                      <StatusBadge status={report.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {report.lineCount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(report.createdAt)}
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

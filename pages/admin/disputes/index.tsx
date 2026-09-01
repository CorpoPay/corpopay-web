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

interface AdminDisputeItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  provider: string;
  providerDisputeId: string;
  paymentIntentId: string | null;
  amountCents: number;
  feeCents: number;
  currency: string;
  reason: string | null;
  evidenceDueDate: string | null;
  recovery: {
    id: string;
    status: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface DisputesResponse {
  data: AdminDisputeItem[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["ALL", "OPEN", "WON", "LOST"];

async function fetchDisputes(page: number, status: string): Promise<DisputesResponse> {
  const { data, error } = await client.GET("/admin/disputes", {
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

export default function AdminDisputesPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-disputes", page, status],
    queryFn: () => fetchDisputes(page, status),
  });

  const disputes = data?.data ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Disputes</h1>
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
                <TableHead>Provider Dispute ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead>Recovery</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRow cols={8} rows={5} />
              ) : disputes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    No disputes found.
                  </TableCell>
                </TableRow>
              ) : (
                disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell>
                      <div className="font-medium">{dispute.tenantName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {dispute.tenantSlug}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{dispute.provider}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {dispute.providerDisputeId}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={dispute.status} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {formatAmount(dispute.amountCents / 100, dispute.currency ?? "MAD")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {formatAmount(dispute.feeCents / 100, dispute.currency ?? "MAD")}
                    </TableCell>
                    <TableCell>
                      {dispute.recovery ? (
                        <StatusBadge status={dispute.recovery.status} />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(dispute.createdAt)}
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

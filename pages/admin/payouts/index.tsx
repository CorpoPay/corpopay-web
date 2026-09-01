import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Pagination } from "@/components/shared/Pagination";
import { SkeletonRow } from "@/components/shared/SkeletonRow";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "@/lib/use-toast";
import { formatAmount, formatDate } from "@/lib/utils";

interface AdminPayoutItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  provider: string;
  method: string;
  currency: string;
  amountCents: number;
  feeCents: number;
  providerTransferId: string | null;
  idempotencyKey: string;
  items: { id: string; ledgerEntryId: string; amountCents: number }[];
  createdAt: string;
  updatedAt: string;
}

interface PayoutsResponse {
  data: AdminPayoutItem[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  "ALL",
  "DRAFT",
  "SCHEDULED",
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "CANCELLED",
];
const CAN_EXECUTE = ["DRAFT", "SCHEDULED", "PENDING", "PROCESSING"];

async function fetchPayouts(page: number, status: string): Promise<PayoutsResponse> {
  const { data, error } = await client.GET("/admin/payouts", {
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

async function executePayout(id: string, externalReference: string) {
  const { error } = await client.POST("/admin/payouts/{id}/execute", {
    params: { path: { id } },
    body: { externalReference },
  });
  if (error) throw error;
}

export default function AdminPayoutsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<AdminPayoutItem | null>(null);
  const [externalReference, setExternalReference] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payouts", page, status],
    queryFn: () => fetchPayouts(page, status),
  });

  const executeMutation = useMutation({
    mutationFn: ({ id, externalReference }: { id: string; externalReference: string }) =>
      executePayout(id, externalReference),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      toast.success("Payout marked as paid");
      setSelected(null);
    },
    onError: () => toast.error("Failed to mark payout as paid"),
  });

  const payouts = data?.data ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
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
            <SelectTrigger className="w-[180px]">
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
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRow cols={8} rows={5} />
              ) : payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    No payouts found.
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      <div className="font-medium">{payout.tenantName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {payout.tenantSlug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={payout.status} />
                    </TableCell>
                    <TableCell className="text-sm">{payout.provider}</TableCell>
                    <TableCell className="text-sm">{payout.method}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {formatAmount(payout.amountCents / 100, payout.currency ?? "MAD")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {formatAmount(payout.feeCents / 100, payout.currency ?? "MAD")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(payout.createdAt)}
                    </TableCell>
                    <TableCell>
                      {CAN_EXECUTE.includes(payout.status) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => {
                            setSelected(payout);
                            setExternalReference("");
                          }}
                        >
                          Mark Paid
                        </Button>
                      ) : null}
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

      <AlertDialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark payout as paid</AlertDialogTitle>
            <AlertDialogDescription>
              Record a manual payout for{" "}
              <span className="font-medium text-foreground">{selected?.tenantName}</span> as paid.
              This will create the provider transfer and move the payout to a paid state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="externalReference">External reference</Label>
            <Input
              id="externalReference"
              value={externalReference}
              onChange={(e) => setExternalReference(e.target.value)}
              placeholder="Provider transfer ID / reference"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={() => {
                if (selected) {
                  executeMutation.mutate({
                    id: selected.id,
                    externalReference: externalReference.trim(),
                  });
                }
              }}
              disabled={!externalReference.trim() || executeMutation.isPending}
            >
              Mark Paid
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

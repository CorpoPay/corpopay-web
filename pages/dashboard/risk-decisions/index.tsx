import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import { Button } from "@/components/ui/button";
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
import { client, getErrorMessage } from "@/lib/client";
import { toast } from "@/lib/use-toast";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 25;
const VERDICT_OPTIONS = ["REVIEW", "ALL", "ALLOW", "BLOCK"] as const;

interface RiskDecision {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  verdict: string | null;
  provider: string;
  correlationId: string;
  paymentLinkId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RiskDecisionsResponse {
  data: RiskDecision[];
  total: number;
}

async function fetchRiskDecisions(verdict: string, page: number): Promise<RiskDecisionsResponse> {
  const { data, error } = await client.GET("/admin/risk-decisions", {
    params: {
      query: {
        limit: String(PAGE_SIZE),
        page: String(page),
        ...(verdict !== "ALL" ? { verdict } : {}),
      },
    },
  });
  if (error || !data) throw error;
  return data as RiskDecisionsResponse;
}

export default function RiskDecisionsPage() {
  const qc = useQueryClient();
  const [verdict, setVerdict] = useState<string>("REVIEW");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["risk-decisions", verdict, page],
    queryFn: () => fetchRiskDecisions(verdict, page),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "ALLOW" | "BLOCK" }) => {
      const { error } = await client.POST("/admin/risk-decisions/{id}/resolve", {
        params: { path: { id } },
        body: { verdict: decision },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk-decisions"] });
      toast.success("Decision saved", "The risk decision has been resolved.");
    },
    onError: (e) => toast.error("Resolve failed", getErrorMessage(e) || "Please try again."),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Risk Review</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review payment intents flagged by the enforcement engine and override their verdict.
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-3">
          <Select
            value={verdict}
            onValueChange={(v) => {
              setVerdict(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Verdict" />
            </SelectTrigger>
            <SelectContent>
              {VERDICT_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v === "ALL" ? "All verdicts" : v}
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
                <TableHead>Tenant</TableHead>
                <TableHead>Correlation ID</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
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
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No risk decisions found.
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      <span className="font-medium">{item.tenantName}</span>
                      <span className="block text-xs text-muted-foreground">{item.tenantSlug}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.correlationId}
                    </TableCell>
                    <TableCell className="text-sm">{item.provider}</TableCell>
                    <TableCell>
                      {item.verdict ? (
                        <StatusBadge status={item.verdict} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate({ id: item.id, decision: "ALLOW" })}
                        >
                          Allow
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate({ id: item.id, decision: "BLOCK" })}
                        >
                          Block
                        </Button>
                      </div>
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
